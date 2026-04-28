# Carrybee Parcel Assignment Flow

This document describes the role of the Carrybee-related endpoints in this service, the parcel assignment flow (single and bulk), the expected request/response bodies, the DTOs used for validation, and the entity updates that occur on success.

## Overview

- Purpose: assign parcels to Carrybee (third-party delivery), ensure stores are synced with Carrybee, and handle Carrybee webhooks updating parcel status and financial fields.
- Primary actors / roles:
  - `HUB_MANAGER`: allowed to list parcels for assignment and to assign parcels to Carrybee.
  - `MERCHANT` / `ADMIN`: allowed to sync stores and access location endpoints.

## Important endpoints

- `GET /carrybee/parcels/for-assignment`
  - Guard: `JwtAuthGuard`, `RolesGuard`
  - Roles: `HUB_MANAGER`
  - Query DTO: `CarrybeeParcelQueryDto` (pagination + filters)
  - Response: { success: true, data: Paginated<Parcel>, message }

- `POST /carrybee/parcels/:parcelId/assign`
  - Guard: `JwtAuthGuard`, `RolesGuard`
  - Roles: `HUB_MANAGER`
  - Body DTO: `AssignToCarrybeeDto`
  - Behavior: validate parcel + store + provider, auto-sync store if required, create Carrybee order, update `Parcel` entity.
  - Success response example:

```json
{
  "parcel_id": "e0f3a2c1-...",
  "carrybee_consignment_id": "CB-9404",
  "delivery_fee": 60.5,
  "cod_fee": 12.0,
  "message": "Parcel assigned to Carrybee successfully"
}
```

- `POST /carrybee/parcels/assign/carrybee` (bulk)
  - Guard: `JwtAuthGuard`, `RolesGuard`
  - Roles: `HUB_MANAGER`
  - Body DTO: `AssignParcelToCarrybeeDto` (array of `parcel_ids`, `provider_id`, optional `notes`)
  - Response: { success: [...], failed: [...] }

- `POST /carrybee/stores/:storeId/sync`
  - Guard: `JwtAuthGuard`, `RolesGuard`
  - Roles: `MERCHANT`, `ADMIN`
  - Body DTO: `SyncStoreToCarrybeeDto` (carrybee_city_id, carrybee_zone_id, carrybee_area_id)
  - Response: { store_id, carrybee_store_id, is_carrybee_synced }

- `POST /webhooks/carrybee`
  - Public endpoint (no auth header) but requires header `x-carrybee-webhook-signature`
  - Body DTO: `CarrybeeWebhookDto`
  - Behavior: verify signature; map Carrybee events to `Parcel` statuses; update financial fields (cod collected, return charge) atomically.

## DTOs (validation summary)

- `AssignToCarrybeeDto` (single assignment)
  - `provider_id?: string` (UUID, optional — auto-resolved if omitted)
  - `notes?: string` (optional)

- `AssignParcelToCarrybeeDto` (bulk)
  - `parcel_ids`: string[] (required, each UUID)
  - `provider_id`: string (UUID, required)
  - `notes?: string`

- `SyncStoreToCarrybeeDto`
  - `carrybee_city_id?: number`
  - `carrybee_zone_id?: number`
  - `carrybee_area_id?: number`

- `CarrybeeWebhookDto`
  - `event`: string
  - `store_id`, `consignment_id`, `merchant_order_id?`, `timestamptz`
  - financial fields: `collectable_amount?`, `cod_fee?`, `delivery_fee?`, `collected_amount?`, `reason?`, `attempt?`, `invoice_id?`

See the concrete DTO implementations in:

- [src/carrybee/dto/assign-to-carrybee.dto.ts](src/carrybee/dto/assign-to-carrybee.dto.ts)
- [src/carrybee/dto/sync-store-to-carrybee.dto.ts](src/carrybee/dto/sync-store-to-carrybee.dto.ts)
- [src/carrybee/dto/carrybee-webhook.dto.ts](src/carrybee/dto/carrybee-webhook.dto.ts)
- [src/carrybee/dto/carrybee-parcel-query.dto.ts](src/carrybee/dto/carrybee-parcel-query.dto.ts)

## Key validation & entity checks performed (server-side)

Before a parcel is assigned to Carrybee the service performs the following checks (see `src/carrybee/carrybee.service.ts`):

1. Parcel exists (404 if not found).
2. Parcel belongs to the caller's hub (current_hub_id or store.hub_id).
3. Parcel status must be `IN_HUB`.
4. Parcel must not already be assigned to a rider or to Carrybee.
5. Provider validation: provided `provider_id` must exist and be active and must be Carrybee (provider_code === 'CARRYBEE'). If omitted, the active Carrybee provider is auto-selected.
6. Store must exist; if not synced with Carrybee the service will auto-sync the store (calls `internalSyncStore`) — but auto-sync requires the store to have Carrybee location IDs (`carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id`) and address fields (`district`, `thana`, `area`). If missing, client must update store before assignment.
7. Parcel weight must be present and > 0. Weight is converted to grams with `convertWeightToGrams`.
8. COD amount must be <= 100000 (Carrybee limit).
9. Customer phone is normalized via `formatPhoneForCarrybee`.
10. Delivery type mapped to Carrybee using `mapDeliveryType`.
11. Recipient Carrybee location derived from `delivery_coverage_area` (preferred) or parcel fields `recipient_carrybee_*`.
12. Recipient address length constrained (10–200 chars).
13. Recipient name length constrained (2–99 chars).

If any check fails the service throws `BadRequestException` with a descriptive message.

## What the service sends to Carrybee (order payload)

The order payload contains fields similar to:

```json
{
  "store_id": 9404,
  "merchant_order_id": "MER-1234",
  "delivery_type": 1,
  "product_type": 1,
  "recipient_phone": "+8801538386793",
  "recipient_name": "Customer Name",
  "recipient_address": "Full address...",
  "city_id": 14,
  "zone_id": 4,
  "area_id": 208,
  "special_instruction": "Leave at guard",
  "product_description": "Description",
  "item_weight": 500,
  "collectable_amount": 1200
}
```

Note: `store_id` is Carrybee store ID (numeric). The service will attempt to create or fetch the Carrybee store before creating the order.

## Entity updates on success

On successful assignment the `Parcel` entity is updated as follows (see `src/parcels/entities/parcel.entity.ts`):

- `delivery_provider` => `DeliveryProvider.CARRYBEE`
- `third_party_provider_id` => assigned provider UUID
- `status` => `ASSIGNED_TO_THIRD_PARTY`
- `carrybee_consignment_id` => string from Carrybee
- `carrybee_delivery_fee` => number (parsed from Carrybee response)
- `carrybee_cod_fee` => number
- `assigned_to_carrybee_at` => timestamp
- `admin_notes` => appended when `notes` provided

Store fields updated on store sync:

- `store.carrybee_store_id` => numeric Carrybee store id
- `store.is_carrybee_synced` => true
- `store.carrybee_synced_at` => timestamp
- `store.carrybee_city_id/zone_id/area_id` => mapping used

## Webhook handling

- Endpoint: `POST /webhooks/carrybee` with header `x-carrybee-webhook-signature`.
- The service verifies the signature against `CARRYBEE_WEBHOOK_SIGNATURE` and rejects invalid signatures.
- Events mapping is implemented in `mapEventToStatus` and includes (example):
  - `order.picked` -> `PICKED_UP`
  - `order.in-transit` -> `IN_TRANSIT`
  - `order.assigned-for-delivery` -> `OUT_FOR_DELIVERY`
  - `order.delivered` -> `DELIVERED` (also sets `cod_collected_amount`, `payment_status` and financial flags)
  - `order.returned` / `order.returned-to-merchant` -> `RETURNED` (calculates return charge)

## Errors & troubleshooting

- Common failure reasons when creating orders:
  - Invalid Carrybee base URL or credentials (check env vars: `CARRYBEE_SANDBOX_BASE_URL`, `CARRYBEE_SANDBOX_CLIENT_ID`, `CARRYBEE_SANDBOX_CLIENT_SECRET`, `CARRYBEE_SANDBOX_CLIENT_CONTEXT`).
  - Missing Carrybee store mapping or missing store location IDs.
  - Payload validation failures (phone/address/name/weight/COD limits).

When a Carrybee API call fails the service logs the axios error (`error.response?.data`) and rethrows a `BadRequestException` with the error message.

## References (code)

- Controller & endpoints: [src/carrybee/carrybee.controller.ts](src/carrybee/carrybee.controller.ts)
- Service & validations: [src/carrybee/carrybee.service.ts](src/carrybee/carrybee.service.ts)
- API client: [src/carrybee/carrybee-api.service.ts](src/carrybee/carrybee-api.service.ts)
- Parcel entity: [src/parcels/entities/parcel.entity.ts](src/parcels/entities/parcel.entity.ts)

---

If you want, I can also:

- Add small unit tests for the validation logic.
- Add a small example `curl`/HTTPie collection for assignment and webhook testing.

Created by developer assistant — update or request additions as needed.
