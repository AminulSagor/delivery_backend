# API Contract Gap Audit

Verified against the current controllers, DTOs, response mappers, services, and
global exception/response handlers on 2026-09-19.

## Result summary

| Requirement                                  | Result                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| Third-party provider list                    | Available                                                   |
| Assign parcel to third party                 | Available through Carrybee APIs (the supported third party) |
| Parcel CSV/XLSX export                       | Frontend responsibility; no backend API required            |
| Parcel status dropdown/list endpoint         | Available and documented below                              |
| Rider dashboard response contract            | Available and documented below                              |
| Rider pending/completed delivery response    | Available and documented below                              |
| Rider pending/completed return response      | Available and documented below                              |
| Hub pickup list and bulk-assignment response | Available and documented below                              |
| Create/update/deactivate rider response      | Available and documented below                              |

## Shared error contract

All thrown HTTP errors use this envelope. The `statusCode`, `error`, `message`,
and `path` values depend on the failure.

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Rider not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/dashboard"
}
```

Validation errors can return `message` as an array of strings.

---

## 1. Active Third-Party Providers

### API Name

Get Active Third-Party Providers

### Method + Endpoint

`GET /third-party-providers/active`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path/Query Parameters

No path or query parameters.

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "provider-uuid",
        "provider_code": "CARRYBEE",
        "provider_name": "Carrybee",
        "description": "Third-party delivery provider",
        "is_active": true,
        "created_at": "2026-01-01T10:00:00.000Z",
        "updated_at": "2026-09-01T10:00:00.000Z",
        "delivered_count": 125,
        "unique_id": "CARRYBEE",
        "type": "CARRYBEE"
      }
    ]
  },
  "message": "Active providers retrieved successfully",
  "timestamp": "2026-09-19T10:00:00.000Z"
}
```

### Error Response

`401 Unauthorized`

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "No authorization token provided",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/third-party-providers/active"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: HUB_MANAGER, ADMIN",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/third-party-providers/active"
}
```

### Business Rules

- Only active providers are returned.
- Providers are ordered by `provider_name` ascending.
- `type` is inferred from existing parcel data. A newly configured Carrybee
  provider with no assigned parcel may temporarily return `THIRD_PARTY`.

---

## 2. Assign Parcel to Third Party (Carrybee)

Carrybee is the supported third-party delivery provider. The following APIs
cover single and bulk third-party assignment.

### API Name

Assign One Parcel to Carrybee

### Method + Endpoint

`POST /carrybee/parcels/:parcelId/assign`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path Parameter

`parcelId`: UUID, required

Query parameters: none.

### Request Body

```json
{
  "provider_id": "provider-uuid",
  "notes": "Handle with care"
}
```

`provider_id` and `notes` are optional for this single-assignment route. When
`provider_id` is omitted, the service selects the active provider whose code is
`CARRYBEE`.

### Success Response

```json
{
  "success": true,
  "data": {
    "parcel_id": "parcel-uuid",
    "carrybee_consignment_id": "CB-9404",
    "delivery_fee": 60.5,
    "cod_fee": 12
  },
  "message": "Parcel assigned to Carrybee successfully",
  "timestamp": "2026-09-19T10:00:00.000Z"
}
```

### Error Response

`404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Parcel with ID parcel-uuid not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/carrybee/parcels/parcel-uuid/assign"
}
```

`400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Parcel must be in hub to assign to Carrybee (current status: DELIVERED)",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/carrybee/parcels/parcel-uuid/assign"
}
```

Authentication and role failures use the same `401`/`403` envelopes shown for
the active-provider endpoint, with the Carrybee request path. UUID/body
validation failures use the shared `400` envelope and can return `message` as
an array.

### Business Rules

- `provider_id` is optional. When omitted, the active provider with
  `provider_code=CARRYBEE` is selected.
- The parcel must exist, belong to the hub manager's hub (admin bypasses this
  ownership check), be `IN_HUB`, and not already be assigned to a rider or
  Carrybee.
- The provider must be active and have `provider_code=CARRYBEE`.
- The parcel must have a store, positive weight, valid recipient details and
  Carrybee location IDs, and COD not exceeding 100,000 BDT.
- A successful assignment sets `delivery_provider=CARRYBEE`,
  `status=ASSIGNED_TO_THIRD_PARTY`, provider/consignment/fee fields, and
  `assigned_to_carrybee_at`.

### API Name

Bulk Assign Parcels to Carrybee

### Method + Endpoint

`POST /carrybee/parcels/assign/carrybee`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path/Query Parameters

No path or query parameters.

### Request Body

```json
{
  "parcel_ids": ["parcel-uuid-1", "parcel-uuid-2"],
  "provider_id": "provider-uuid",
  "notes": "Handle with care"
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "success": [
      {
        "parcel_id": "parcel-uuid-1",
        "tracking_number": "MGS-000001",
        "consignment_id": "CB-9404",
        "delivery_fee": 60.5
      }
    ],
    "failed": [
      {
        "parcel_id": "parcel-uuid-2",
        "reason": "Invalid status: DELIVERED. Must be IN_HUB."
      }
    ]
  },
  "message": "Processed 2 parcels. Success: 1, Failed: 1"
}
```

### Error Response

`400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid or inactive provider selected",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/carrybee/parcels/assign/carrybee"
}
```

### Business Rules

- `parcel_ids` is a required UUID array; `provider_id` is a required UUID;
  `notes` is optional. The current DTO does not apply `ArrayMinSize`, so an
  empty array passes DTO validation and produces an HTTP 200 result with empty
  `success` and `failed` arrays.
- Provider validation happens before item processing. An invalid/inactive or
  non-Carrybee provider fails the entire request with HTTP 400.
- Each parcel is then processed independently using the same ownership,
  status, assignment, store, weight, recipient, location, and COD rules as the
  single-assignment API.
- Bulk assignment uses HTTP 200 even when individual items fail; inspect both
  `data.success` and `data.failed`.
- Authentication/role and DTO-validation errors use the standard `401`, `403`,
  and `400` envelopes.

---

## 3. Parcel Export API

### Status

No backend endpoint is required. CSV/XLSX generation and download will be
handled by the frontend from the parcel-list data it has loaded.

Current backend inspection confirms there is no hub parcel CSV/XLSX export
controller or service method. Because export is a frontend responsibility,
there is no backend Method/Endpoint, request, success response, or error
contract to document.

---

## 4. Parcel Status Dropdown/List API

### API Name

Get Parcel Status Options

### Method + Endpoint

`GET /parcels/statuses`

### Authentication

`Authorization: Bearer <token>`

Roles: `MERCHANT`, `ADMIN`, `HUB_MANAGER`, `RIDER`

### Path/Query Parameters

No path or query parameters.

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "statuses": [
      { "value": "PENDING", "label": "Pending" },
      { "value": "PICKED_UP", "label": "Picked Up" },
      { "value": "IN_HUB", "label": "In Hub" },
      { "value": "ASSIGNED_TO_RIDER", "label": "Assigned To Rider" },
      {
        "value": "ASSIGNED_TO_THIRD_PARTY",
        "label": "Assigned To Third Party"
      },
      { "value": "OUT_FOR_DELIVERY", "label": "Out For Delivery" },
      { "value": "OUT_FOR_PICKUP", "label": "Out For Pickup" },
      { "value": "IN_TRANSIT", "label": "In Transit" },
      { "value": "DELIVERED", "label": "Delivered" },
      { "value": "PARTIAL_DELIVERY", "label": "Partial Delivery" },
      { "value": "EXCHANGE", "label": "Exchange" },
      { "value": "FAILED_DELIVERY", "label": "Failed Delivery" },
      { "value": "RETURNED_TO_HUB", "label": "Returned To Hub" },
      { "value": "CANCELLED", "label": "Cancelled" },
      { "value": "RETURNED", "label": "Returned" },
      { "value": "PAID_RETURN", "label": "Paid Return" },
      { "value": "RETURN_TO_MERCHANT", "label": "Return To Merchant" },
      {
        "value": "DELIVERY_RESCHEDULED",
        "label": "Delivery Rescheduled"
      }
    ]
  },
  "message": "Parcel statuses retrieved successfully"
}
```

### Error Response

`401 Unauthorized`

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "No authorization token provided",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/parcels/statuses"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: MERCHANT, ADMIN, HUB_MANAGER, RIDER",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/parcels/statuses"
}
```

### Business Rules

- Every enum status is returned exactly once as `{ value, label }`.
- Labels are generated by title-casing the enum value and replacing underscores
  with spaces.
- The synthetic parcel-list filter value `ACTIVE` is not a real parcel status
  and is therefore not returned by this endpoint. Frontend may add an `Active`
  filter option locally when that aggregate filter is needed.

---

## 5. Rider Dashboard

### API Name

Get Rider Dashboard

### Method + Endpoint

`GET /riders/dashboard`

### Authentication

`Authorization: Bearer <rider-token>`

Role: `RIDER`

### Path/Query Parameters

No path or query parameters.

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "rider-uuid"
    },
    "pending_pickups": 3,
    "pending_deliveries": 8,
    "completed_deliveries": 5,
    "total_deliveries": 13,
    "pending_returns": 2,
    "completed_returns": 1,
    "total_returns": 3
  },
  "message": "Dashboard retrieved successfully"
}
```

### Error Response

`404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Rider not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/dashboard"
}
```

### Business Rules

- All counts use the current Bangladesh calendar day.
- `pending_pickups` counts today's assigned `CONFIRMED` pickup requests.
- Pending deliveries are today's non-return parcels in `ASSIGNED_TO_RIDER`.
- Completed deliveries count today's rider actions with a delivery outcome.
- Pending returns are today's return parcels in `ASSIGNED_TO_RIDER`.
- `total_deliveries` and `total_returns` are sums of their pending/completed
  values, not lifetime totals.

---

## 6. Rider Pending/Completed Deliveries

### API Name

Get Rider Deliveries

### Method + Endpoint

`GET /riders/deliveries?tab=pending`

`GET /riders/deliveries?tab=completed`

### Authentication

`Authorization: Bearer <rider-token>`

Role: `RIDER`

### Path/Query Parameters

Path parameters: none.

`tab`: `pending` or `completed`; optional, defaults to `pending`

### Request Body

No request body.

### Success Response

`200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "parcel-uuid",
      "customer_id": "customer-uuid",
      "merchant_id": "merchant-uuid",
      "store_id": "store-uuid",
      "pickup_request_id": "pickup-uuid",
      "parcel_tx_id": "#139679",
      "tracking_number": "MGS-000001",
      "merchant_order_id": "ORD-1001",
      "delivery_area_text": "Gulshan 2",
      "delivery_coverage_area_id": "coverage-area-uuid",
      "customer_name": "Customer Name",
      "customer_phone": "01700000000",
      "customer_secondary_phone": null,
      "customer_address": "Full delivery address",
      "product_description": "Product",
      "product_price": 1200,
      "product_weight": 1,
      "parcel_type": 1,
      "delivery_charge": 60,
      "weight_charge": 0,
      "cod_charge": 12,
      "discount": 0,
      "total_charge": 72,
      "is_cod": true,
      "cod_amount": 1200,
      "is_exchange": false,
      "receivable_amount": 1128,
      "cod_collected_amount": 0,
      "return_charge": 0,
      "delivery_charge_applicable": true,
      "return_charge_applicable": false,
      "financial_status": "PENDING",
      "invoice_id": null,
      "clearance_required": false,
      "clearance_done": false,
      "clearance_invoice_id": null,
      "paid_amount": null,
      "status": "ASSIGNED_TO_RIDER",
      "payment_status": "UNPAID",
      "paid_to_merchant": false,
      "paid_to_merchant_at": null,
      "cod_cleared_at": null,
      "cod_status": "PENDING",
      "delivery_type": 1,
      "assigned_rider_id": "rider-uuid",
      "assigned_at": "2026-09-19T08:00:00.000Z",
      "rider_accepted_at": null,
      "out_for_delivery_at": null,
      "reschedule_count": 0,
      "rider_action_status": null,
      "rider_action_rider_id": null,
      "hub_confirmation_status": null,
      "rider_action_at": null,
      "hub_confirmed_at": null,
      "completed_at": null,
      "is_delivery_rescheduled": false,
      "special_instructions": null,
      "admin_notes": null,
      "return_reason": null,
      "current_hub_id": "hub-uuid",
      "origin_hub_id": "hub-uuid",
      "destination_hub_id": null,
      "is_inter_hub_transfer": false,
      "transferred_at": null,
      "received_at_destination_hub": null,
      "transfer_notes": null,
      "delivery_provider": "INTERNAL",
      "third_party_provider_id": null,
      "issue_type": null,
      "issue_description": null,
      "issue_reported_by_id": null,
      "issue_reported_at": null,
      "is_issue_resolved": false,
      "carrybee_consignment_id": null,
      "carrybee_delivery_fee": null,
      "carrybee_cod_fee": null,
      "assigned_to_carrybee_at": null,
      "recipient_carrybee_city_id": null,
      "recipient_carrybee_zone_id": null,
      "recipient_carrybee_area_id": null,
      "original_parcel_id": null,
      "is_return_parcel": false,
      "picked_up_at": null,
      "delivered_at": null,
      "created_at": "2026-09-19T07:00:00.000Z",
      "updated_at": "2026-09-19T08:00:00.000Z",
      "received_at": "2026-09-19T07:30:00.000Z",
      "age": 0,
      "merchant": {
        "id": "merchant-uuid",
        "user_id": "merchant-user-uuid",
        "thana": "Gulshan",
        "district": "Dhaka",
        "full_address": "Merchant full address",
        "secondary_number": null,
        "status": "APPROVED",
        "is_advance_payment_disabled": false,
        "approved_at": "2026-01-01T10:00:00.000Z",
        "approved_by": "admin-user-uuid",
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "user": {
          "id": "merchant-user-uuid",
          "full_name": "Merchant Name",
          "phone": "01800000000",
          "email": "merchant@example.com",
          "role": "MERCHANT",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        }
      },
      "store": {
        "id": "store-uuid",
        "store_code": "STR-0001",
        "merchant_id": "merchant-uuid",
        "business_name": "ABC Store",
        "business_address": "Store address",
        "phone_number": "01800000000",
        "email": "store@example.com",
        "facebook_page": null,
        "hub_id": "hub-uuid",
        "is_default": true,
        "status": "APPROVED",
        "is_active": true,
        "district": "Dhaka",
        "thana": "Gulshan",
        "area": "Gulshan 2",
        "carrybee_store_id": null,
        "carrybee_city_id": null,
        "carrybee_zone_id": null,
        "carrybee_area_id": null,
        "is_carrybee_synced": false,
        "carrybee_synced_at": null,
        "auto_assign_to_carrybee": false,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "performance": {
          "total_parcels_handled": 0,
          "successfully_delivered": 0,
          "total_returns": 0
        },
        "hub": {
          "id": "hub-uuid",
          "hub_code": "HUB-001",
          "branch_name": "Gulshan Hub",
          "area": "Gulshan",
          "address": "Hub address",
          "manager_name": "Hub Manager",
          "manager_phone": "01900000000",
          "manager_user_id": "hub-manager-user-uuid",
          "status": "ACTIVE",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "merchant": {
          "id": "merchant-uuid",
          "user_id": "merchant-user-uuid",
          "thana": "Gulshan",
          "district": "Dhaka",
          "full_address": "Merchant full address",
          "secondary_number": null,
          "status": "APPROVED",
          "is_advance_payment_disabled": false,
          "approved_at": "2026-01-01T10:00:00.000Z",
          "approved_by": "admin-user-uuid",
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z",
          "user": {
            "id": "merchant-user-uuid",
            "full_name": "Merchant Name",
            "phone": "01800000000",
            "email": "merchant@example.com",
            "role": "MERCHANT",
            "is_active": true,
            "created_at": "2026-01-01T09:00:00.000Z",
            "updated_at": "2026-01-01T10:00:00.000Z"
          }
        }
      },
      "customer": {
        "id": "customer-uuid",
        "customer_name": "Customer Name",
        "phone_number": "01700000000",
        "secondary_number": null,
        "customer_address": "Full delivery address",
        "delivery_coverage_area_id": "coverage-area-uuid",
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "delivery_area": {
        "id": "coverage-area-uuid",
        "division": "Dhaka",
        "city": "Dhaka",
        "city_id": 14,
        "zone": "Gulshan",
        "zone_id": 467,
        "area": "Gulshan 2",
        "area_id": 12121,
        "inside_dhaka_flag": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "delivery_coverage_area": {
        "id": "coverage-area-uuid",
        "division": "Dhaka",
        "city": "Dhaka",
        "city_id": 14,
        "zone": "Gulshan",
        "zone_id": 467,
        "area": "Gulshan 2",
        "area_id": 12121,
        "inside_dhaka_flag": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "assigned_rider": {
        "id": "rider-uuid",
        "rider_code": "RDR-0001",
        "user_id": "rider-user-uuid",
        "hub_id": "hub-uuid",
        "photo": null,
        "guardian_mobile_no": "01600000000",
        "bike_type": "MOTORCYCLE",
        "nid_number": null,
        "license_no": null,
        "present_address": "Dhaka",
        "permanent_address": "Dhaka",
        "fixed_salary": 12000,
        "commission_per_delivery": 25,
        "bank_name": null,
        "bank_account_number": null,
        "bank_branch": null,
        "nid_front_photo": null,
        "nid_back_photo": null,
        "license_front_photo": null,
        "license_back_photo": null,
        "parent_nid_front_photo": null,
        "parent_nid_back_photo": null,
        "approval_status": "APPROVED",
        "approved_at": "2026-01-01T10:00:00.000Z",
        "approved_by": "admin-user-uuid",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "full_name": "Rider Name",
        "phone": "01500000000",
        "user": {
          "id": "rider-user-uuid",
          "full_name": "Rider Name",
          "phone": "01500000000",
          "email": "rider@example.com",
          "role": "RIDER",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "hub": {
          "id": "hub-uuid",
          "hub_code": "HUB-001",
          "branch_name": "Gulshan Hub",
          "area": "Gulshan",
          "address": "Hub address",
          "manager_name": "Hub Manager",
          "manager_phone": "01900000000",
          "manager_user_id": "hub-manager-user-uuid",
          "status": "ACTIVE",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "approver": null,
        "rider_status": "On duty",
        "assigned_parcels_count": 0
      },
      "current_hub": {
        "id": "hub-uuid",
        "hub_code": "HUB-001",
        "branch_name": "Gulshan Hub",
        "area": "Gulshan",
        "address": "Hub address",
        "manager_name": "Hub Manager",
        "manager_phone": "01900000000",
        "manager_user_id": "hub-manager-user-uuid",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "origin_hub": {
        "id": "hub-uuid",
        "hub_code": "HUB-001",
        "branch_name": "Gulshan Hub",
        "area": "Gulshan",
        "address": "Hub address",
        "manager_name": "Hub Manager",
        "manager_phone": "01900000000",
        "manager_user_id": "hub-manager-user-uuid",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "destination_hub": null,
      "third_party_provider": null
    }
  ],
  "count": 1,
  "tab": "pending"
}
```

The JSON above is the complete object emitted by `toParcelListItem`. Nullable
relations are returned as `null` when absent. The same wrapper and field set is
used for both tabs. A completed row records its rider outcome in
`rider_action_status` and its action time in `rider_action_at`; operational
`status` may later change after hub processing.

### Error Response

`401 Unauthorized`

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "No authorization token provided",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/deliveries?tab=pending"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: RIDER",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/deliveries?tab=pending"
}
```

### Business Rules

- `tab=pending` returns only non-return parcels assigned to the authenticated
  rider during the current Bangladesh day that remain
  `status=ASSIGNED_TO_RIDER`.
- `tab=completed` returns parcels whose action was performed by the
  authenticated rider during the current Bangladesh day and whose
  `rider_action_status` is one of `DELIVERED`, `PARTIAL_DELIVERY`, `EXCHANGE`,
  `PAID_RETURN`, `RETURNED`, `RETURN_TO_MERCHANT`, or
  `DELIVERY_RESCHEDULED`. Rows appear before or after hub confirmation.
- Results are ordered by `updated_at` descending.
- This endpoint is not paginated.
- `tab` is echoed in the response.
- The controller does not apply a runtime DTO validator to `tab`; in the
  current service, any supplied value other than `pending` follows the
  completed-query branch. Clients must send only the documented values.

---

## 7. Rider Pending/Completed Returns

### API Name

Get Rider Returns

### Method + Endpoint

`GET /riders/returns?tab=pending`

`GET /riders/returns?tab=completed`

### Authentication

`Authorization: Bearer <rider-token>`

Role: `RIDER`

### Path/Query Parameters

Path parameters: none.

`tab`: `pending` or `completed`; optional, defaults to `pending`

### Request Body

No request body.

### Success Response

`200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "return-parcel-uuid",
      "customer_id": "customer-uuid",
      "merchant_id": "merchant-uuid",
      "store_id": "store-uuid",
      "pickup_request_id": "pickup-request-uuid",
      "parcel_tx_id": "#139680",
      "tracking_number": "RTN-000001",
      "merchant_order_id": "ORD-1001-RETURN",
      "delivery_area_text": "Gulshan 2",
      "delivery_coverage_area_id": "coverage-area-uuid",
      "customer_name": "Customer Name",
      "customer_phone": "01700000000",
      "customer_secondary_phone": null,
      "customer_address": "Full delivery address",
      "product_description": "Returned product",
      "product_price": 1200,
      "product_weight": 1,
      "parcel_type": 1,
      "delivery_charge": 60,
      "weight_charge": 0,
      "cod_charge": 12,
      "discount": 0,
      "total_charge": 72,
      "is_cod": true,
      "cod_amount": 1200,
      "is_exchange": false,
      "receivable_amount": 1128,
      "cod_collected_amount": 0,
      "return_charge": 60,
      "delivery_charge_applicable": true,
      "return_charge_applicable": true,
      "financial_status": "PENDING",
      "invoice_id": null,
      "clearance_required": false,
      "clearance_done": false,
      "clearance_invoice_id": null,
      "paid_amount": null,
      "status": "ASSIGNED_TO_RIDER",
      "payment_status": "UNPAID",
      "paid_to_merchant": false,
      "paid_to_merchant_at": null,
      "cod_cleared_at": null,
      "cod_status": "PENDING",
      "delivery_type": 1,
      "assigned_rider_id": "rider-uuid",
      "assigned_at": "2026-09-19T08:00:00.000Z",
      "rider_accepted_at": null,
      "out_for_delivery_at": null,
      "reschedule_count": 0,
      "rider_action_status": null,
      "rider_action_rider_id": null,
      "hub_confirmation_status": null,
      "rider_action_at": null,
      "hub_confirmed_at": null,
      "completed_at": null,
      "is_delivery_rescheduled": false,
      "special_instructions": null,
      "admin_notes": null,
      "return_reason": "Customer refused",
      "current_hub_id": "hub-uuid",
      "origin_hub_id": "hub-uuid",
      "destination_hub_id": null,
      "is_inter_hub_transfer": false,
      "transferred_at": null,
      "received_at_destination_hub": null,
      "transfer_notes": null,
      "delivery_provider": "INTERNAL",
      "third_party_provider_id": null,
      "issue_type": null,
      "issue_description": null,
      "issue_reported_by_id": null,
      "issue_reported_at": null,
      "is_issue_resolved": false,
      "carrybee_consignment_id": null,
      "carrybee_delivery_fee": null,
      "carrybee_cod_fee": null,
      "assigned_to_carrybee_at": null,
      "recipient_carrybee_city_id": null,
      "recipient_carrybee_zone_id": null,
      "recipient_carrybee_area_id": null,
      "original_parcel_id": "original-parcel-uuid",
      "is_return_parcel": true,
      "picked_up_at": null,
      "delivered_at": null,
      "created_at": "2026-09-19T07:00:00.000Z",
      "updated_at": "2026-09-19T08:00:00.000Z",
      "received_at": "2026-09-19T07:30:00.000Z",
      "age": 0,
      "merchant": {
        "id": "merchant-uuid",
        "user_id": "merchant-user-uuid",
        "thana": "Gulshan",
        "district": "Dhaka",
        "full_address": "Merchant full address",
        "secondary_number": null,
        "status": "APPROVED",
        "is_advance_payment_disabled": false,
        "approved_at": "2026-01-01T10:00:00.000Z",
        "approved_by": "admin-user-uuid",
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "user": {
          "id": "merchant-user-uuid",
          "full_name": "Merchant Name",
          "phone": "01800000000",
          "email": "merchant@example.com",
          "role": "MERCHANT",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        }
      },
      "store": {
        "id": "store-uuid",
        "store_code": "STR-0001",
        "merchant_id": "merchant-uuid",
        "business_name": "ABC Store",
        "business_address": "Store address",
        "phone_number": "01800000000",
        "email": "store@example.com",
        "facebook_page": null,
        "hub_id": "hub-uuid",
        "is_default": true,
        "status": "APPROVED",
        "is_active": true,
        "district": "Dhaka",
        "thana": "Gulshan",
        "area": "Gulshan 2",
        "carrybee_store_id": null,
        "carrybee_city_id": null,
        "carrybee_zone_id": null,
        "carrybee_area_id": null,
        "is_carrybee_synced": false,
        "carrybee_synced_at": null,
        "auto_assign_to_carrybee": false,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "performance": {
          "total_parcels_handled": 0,
          "successfully_delivered": 0,
          "total_returns": 0
        },
        "hub": {
          "id": "hub-uuid",
          "hub_code": "HUB-001",
          "branch_name": "Gulshan Hub",
          "area": "Gulshan",
          "address": "Hub address",
          "manager_name": "Hub Manager",
          "manager_phone": "01900000000",
          "manager_user_id": "hub-manager-user-uuid",
          "status": "ACTIVE",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "merchant": {
          "id": "merchant-uuid",
          "user_id": "merchant-user-uuid",
          "thana": "Gulshan",
          "district": "Dhaka",
          "full_address": "Merchant full address",
          "secondary_number": null,
          "status": "APPROVED",
          "is_advance_payment_disabled": false,
          "approved_at": "2026-01-01T10:00:00.000Z",
          "approved_by": "admin-user-uuid",
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z",
          "user": {
            "id": "merchant-user-uuid",
            "full_name": "Merchant Name",
            "phone": "01800000000",
            "email": "merchant@example.com",
            "role": "MERCHANT",
            "is_active": true,
            "created_at": "2026-01-01T09:00:00.000Z",
            "updated_at": "2026-01-01T10:00:00.000Z"
          }
        }
      },
      "customer": {
        "id": "customer-uuid",
        "customer_name": "Customer Name",
        "phone_number": "01700000000",
        "secondary_number": null,
        "customer_address": "Full delivery address",
        "delivery_coverage_area_id": "coverage-area-uuid",
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "delivery_area": {
        "id": "coverage-area-uuid",
        "division": "Dhaka",
        "city": "Dhaka",
        "city_id": 14,
        "zone": "Gulshan",
        "zone_id": 467,
        "area": "Gulshan 2",
        "area_id": 12121,
        "inside_dhaka_flag": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "delivery_coverage_area": {
        "id": "coverage-area-uuid",
        "division": "Dhaka",
        "city": "Dhaka",
        "city_id": 14,
        "zone": "Gulshan",
        "zone_id": 467,
        "area": "Gulshan 2",
        "area_id": 12121,
        "inside_dhaka_flag": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "assigned_rider": {
        "id": "rider-uuid",
        "rider_code": "RDR-0001",
        "user_id": "rider-user-uuid",
        "hub_id": "hub-uuid",
        "photo": null,
        "guardian_mobile_no": "01600000000",
        "bike_type": "MOTORCYCLE",
        "nid_number": null,
        "license_no": null,
        "present_address": "Dhaka",
        "permanent_address": "Dhaka",
        "fixed_salary": 12000,
        "commission_per_delivery": 25,
        "bank_name": null,
        "bank_account_number": null,
        "bank_branch": null,
        "nid_front_photo": null,
        "nid_back_photo": null,
        "license_front_photo": null,
        "license_back_photo": null,
        "parent_nid_front_photo": null,
        "parent_nid_back_photo": null,
        "approval_status": "APPROVED",
        "approved_at": "2026-01-01T10:00:00.000Z",
        "approved_by": "admin-user-uuid",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z",
        "full_name": "Rider Name",
        "phone": "01500000000",
        "user": {
          "id": "rider-user-uuid",
          "full_name": "Rider Name",
          "phone": "01500000000",
          "email": "rider@example.com",
          "role": "RIDER",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "hub": {
          "id": "hub-uuid",
          "hub_code": "HUB-001",
          "branch_name": "Gulshan Hub",
          "area": "Gulshan",
          "address": "Hub address",
          "manager_name": "Hub Manager",
          "manager_phone": "01900000000",
          "manager_user_id": "hub-manager-user-uuid",
          "status": "ACTIVE",
          "is_active": true,
          "created_at": "2026-01-01T09:00:00.000Z",
          "updated_at": "2026-01-01T10:00:00.000Z"
        },
        "approver": null,
        "rider_status": "On duty",
        "assigned_parcels_count": 0
      },
      "current_hub": {
        "id": "hub-uuid",
        "hub_code": "HUB-001",
        "branch_name": "Gulshan Hub",
        "area": "Gulshan",
        "address": "Hub address",
        "manager_name": "Hub Manager",
        "manager_phone": "01900000000",
        "manager_user_id": "hub-manager-user-uuid",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "origin_hub": {
        "id": "hub-uuid",
        "hub_code": "HUB-001",
        "branch_name": "Gulshan Hub",
        "area": "Gulshan",
        "address": "Hub address",
        "manager_name": "Hub Manager",
        "manager_phone": "01900000000",
        "manager_user_id": "hub-manager-user-uuid",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-01-01T09:00:00.000Z",
        "updated_at": "2026-01-01T10:00:00.000Z"
      },
      "destination_hub": null,
      "third_party_provider": null
    }
  ],
  "count": 1
}
```

The JSON above is the complete object emitted by `toParcelListItem`. Nullable
relations such as `merchant`, `store`, `customer`, hub fields,
`delivery_area`/`delivery_coverage_area`, `assigned_rider`, and
`third_party_provider` are returned as `null` when that relation is absent.

For a completed row, the wrapper and field set are identical. Its actual
outcome appears in `rider_action_status`; `rider_action_rider_id` and
`rider_action_at` identify the rider action, while `status` may later reflect a
hub-confirmed operational state.

### Error Response

`401 Unauthorized`

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "No authorization token provided",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/returns?tab=pending"
}
```

`403 Forbidden` is returned when an authenticated non-rider role calls the
endpoint:

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: RIDER",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/returns?tab=pending"
}
```

### Business Rules

- `tab=pending` returns only return parcels where `is_return_parcel=true`, the
  authenticated rider is currently assigned, `status=ASSIGNED_TO_RIDER`, and
  `assigned_at` falls within the current Bangladesh day.
- `tab=completed` returns parcels whose action was performed by the
  authenticated rider during the current Bangladesh day and whose
  `rider_action_status` is one of `RETURNED`, `PAID_RETURN`,
  `RETURNED_TO_HUB`, or `RETURN_TO_MERCHANT`.
- Results are ordered by `updated_at` descending.
- This endpoint is not paginated.
- Unlike the deliveries endpoint, the current response does **not** echo
  `tab`; frontend must retain the selected tab locally.
- The controller does not apply a runtime DTO validator to `tab`; in the
  current service, any supplied value other than `pending` follows the
  completed-query branch. Clients must send only the documented values.

---

## 8. Hub Pickup List

### API Name

Get Hub Pickup Requests

### Method + Endpoint

`GET /pickup-requests/hub/my-requests`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Query Parameters

Path parameters: none.

- `page`: integer, optional, default `1`
- `limit`: integer `1..100`, optional, default `20`
- `status`: `PENDING`, `CONFIRMED`, `PICKED_UP`, or `CANCELLED`; default
  `PENDING`
- `search`: string, optional
- `sortBy`: string, optional; supported service fields are `created_at`,
  `requested_at`, `updated_at`, and `request_code`
- `order`: `ASC` or `DESC`, optional, default `DESC`

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "pickupRequests": [
      {
        "id": "pickup-request-uuid",
        "request_code": "REQ-2001",
        "pickup_location": "House 1, Road 2, Dhaka",
        "store_name": "ABC Store",
        "store_phone": "01700000000",
        "comment": "Pickup before 5 PM",
        "pickup_count": 5,
        "status": "PENDING",
        "assigned_rider_id": null
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Pickup requests retrieved successfully"
}
```

### Error Response

`400 Bad Request` for an invalid query value:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Invalid pickup status"],
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/pickup-requests/hub/my-requests?status=INVALID"
}
```

`403 Forbidden` for an authenticated role other than hub manager/admin:

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: HUB_MANAGER, ADMIN",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/pickup-requests/hub/my-requests"
}
```

Missing, invalid, or expired bearer tokens return the standard `401` envelope.
If retrieval itself fails, the service returns HTTP 400 with message
`Failed to retrieve pickup requests`.

### Business Rules

- Hub managers see only their own hub; admins can query system-wide results.
- When `status` is absent, only `PENDING` requests are returned.

---

## 9. Bulk Assign Pickup Requests to Rider

### API Name

Bulk Assign Pickup Requests to Rider

### Method + Endpoint

`POST /pickup-requests/hub/bulk-assign-rider`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path/Query Parameters

No path or query parameters.

### Request Body

```json
{
  "rider_id": "rider-uuid",
  "pickup_ids": ["pickup-uuid-1", "pickup-uuid-2"],
  "notes": "Collect before 5 PM"
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 1,
      "failed": 1
    },
    "results": [
      {
        "pickupId": "pickup-uuid-1",
        "success": true,
        "message": "Assigned successfully"
      },
      {
        "pickupId": "pickup-uuid-2",
        "success": false,
        "message": "Invalid status: CONFIRMED"
      }
    ]
  },
  "message": "1 pickup(s) assigned, 1 failed"
}
```

Partial item failures remain inside this HTTP 200 response. They are not
endpoint-level HTTP errors.

### Error Response

`404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Rider not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/pickup-requests/hub/bulk-assign-rider"
}
```

`400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot assign to inactive rider",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/pickup-requests/hub/bulk-assign-rider"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Rider does not belong to your hub",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/pickup-requests/hub/bulk-assign-rider"
}
```

DTO validation errors use HTTP 400 with `message` as an array. Authentication
and role failures use the standard `401`/`403` envelopes.

### Business Rules

- `pickup_ids` must contain at least one UUID.
- Rider must exist, be active, and (for a hub manager) belong to the same hub.
- Each pickup must exist, belong to the hub, be `PENDING`, and be unassigned.
- Successful items become `CONFIRMED`; related parcel pickup lifecycle becomes
  `OUT_FOR_PICKUP`.
- HTTP 200 can contain partial failures; inspect every `results` item.

---

## 10. Create Rider

### API Name

Create Rider

### Method + Endpoint

`POST /riders`

### Authentication

`Authorization: Bearer <hub-manager-token>`

Role: `HUB_MANAGER`

### Path/Query Parameters

No path or query parameters.

### Request Body

```json
{
  "full_name": "Ahmed Wasi",
  "phone": "01700000000",
  "email": "ahmed@example.com",
  "password": "password123",
  "guardian_mobile_no": "01800000000",
  "bike_type": "MOTORCYCLE",
  "present_address": "Dhaka",
  "permanent_address": "Dhaka",
  "fixed_salary": 12000,
  "commission_per_delivery": 25,
  "nid_number": null,
  "license_no": null
}
```

### Success Response

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "rider-uuid",
    "rider_code": "RDR-0001",
    "user_id": "user-uuid",
    "hub_id": "hub-uuid",
    "photo": null,
    "guardian_mobile_no": "01800000000",
    "bike_type": "MOTORCYCLE",
    "nid_number": null,
    "license_no": null,
    "present_address": "Dhaka",
    "permanent_address": "Dhaka",
    "fixed_salary": 12000,
    "commission_per_delivery": 25,
    "bank_name": null,
    "bank_account_number": null,
    "bank_branch": null,
    "nid_front_photo": null,
    "nid_back_photo": null,
    "license_front_photo": null,
    "license_back_photo": null,
    "parent_nid_front_photo": null,
    "parent_nid_back_photo": null,
    "approval_status": "PENDING",
    "approved_at": null,
    "approved_by": null,
    "is_active": false,
    "created_at": "2026-09-19T10:00:00.000Z",
    "updated_at": "2026-09-19T10:00:00.000Z",
    "full_name": "Ahmed Wasi",
    "phone": "01700000000",
    "user": {
      "id": "user-uuid",
      "full_name": "Ahmed Wasi",
      "phone": "01700000000",
      "email": "ahmed@example.com",
      "role": "RIDER",
      "is_active": false,
      "created_at": "2026-09-19T10:00:00.000Z",
      "updated_at": "2026-09-19T10:00:00.000Z"
    },
    "hub": {
      "id": "hub-uuid",
      "hub_code": "HUB-001",
      "branch_name": "Gulshan Hub",
      "area": "Gulshan",
      "address": "Hub address",
      "manager_name": "Hub Manager",
      "manager_phone": "01900000000",
      "manager_user_id": "hub-manager-user-uuid",
      "status": "ACTIVE",
      "is_active": true,
      "created_at": "2026-01-01T09:00:00.000Z",
      "updated_at": "2026-01-01T10:00:00.000Z"
    },
    "approver": null,
    "rider_status": "Leave",
    "assigned_parcels_count": 0
  },
  "message": "Rider created successfully. Pending admin approval."
}
```

### Error Response

`400 Bad Request` validation example:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Phone must be a valid Bangladesh number (01XXXXXXXXX)"],
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders"
}
```

`409 Conflict`

```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Phone number already registered",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders"
}
```

The conflict message can instead be `Email already registered` or
`NID number already registered` when that unique field conflicts.

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Access denied. Required roles: HUB_MANAGER",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders"
}
```

Missing, invalid, or expired bearer tokens return the standard `401` envelope.
If the hub-manager account has no valid hub assignment, the endpoint returns
HTTP 400 with the exact service message describing the missing/invalid hub.

`401 Unauthorized`

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "No authorization token provided",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders"
}
```

### Business Rules

- The authenticated hub manager must have a hub; it is assigned automatically.
- Hub-manager-created riders start with `approval_status=PENDING` and
  `is_active=false`; admin approval is required before login/work assignment.
- Phone and guardian phone must be valid 11-digit Bangladesh mobile numbers.
- Password minimum length is 8.
- `bike_type`: `BICYCLE`, `MOTORCYCLE`, `SCOOTER`, or `VAN`.
- `fixed_salary` and `commission_per_delivery` cannot be negative.
- `nid_number`, `license_no`, and document images are optional.
- Unknown fields are rejected.

---

## 11. Update Rider

### API Name

Update Rider

### Method + Endpoint

`PATCH /riders/:riderId`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path Parameter

`riderId`: UUID, required

Query parameters: none.

### Request Body

```json
{
  "full_name": "Ahmed Wasi",
  "phone": "01700000000",
  "fixed_salary": 12000,
  "commission_per_delivery": 25,
  "nid_number": null,
  "license_no": null
}
```

This is a partial update. The frontend should send only changed fields.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "rider-uuid",
    "rider_code": "RDR-0001",
    "user_id": "user-uuid",
    "hub_id": "hub-uuid",
    "photo": null,
    "guardian_mobile_no": "01800000000",
    "bike_type": "MOTORCYCLE",
    "nid_number": null,
    "license_no": null,
    "present_address": "Dhaka",
    "permanent_address": "Dhaka",
    "fixed_salary": 12000,
    "commission_per_delivery": 25,
    "bank_name": null,
    "bank_account_number": null,
    "bank_branch": null,
    "nid_front_photo": null,
    "nid_back_photo": null,
    "license_front_photo": null,
    "license_back_photo": null,
    "parent_nid_front_photo": null,
    "parent_nid_back_photo": null,
    "approval_status": "APPROVED",
    "approved_at": "2026-01-01T10:00:00.000Z",
    "approved_by": "admin-user-uuid",
    "is_active": true,
    "created_at": "2026-01-01T09:00:00.000Z",
    "updated_at": "2026-09-19T10:00:00.000Z",
    "full_name": "Ahmed Wasi",
    "phone": "01700000000",
    "user": {
      "id": "user-uuid",
      "full_name": "Ahmed Wasi",
      "phone": "01700000000",
      "email": "ahmed@example.com",
      "role": "RIDER",
      "is_active": true,
      "created_at": "2026-01-01T09:00:00.000Z",
      "updated_at": "2026-09-19T10:00:00.000Z"
    },
    "hub": {
      "id": "hub-uuid",
      "hub_code": "HUB-001",
      "branch_name": "Gulshan Hub",
      "area": "Gulshan",
      "address": "Hub address",
      "manager_name": "Hub Manager",
      "manager_phone": "01900000000",
      "manager_user_id": "hub-manager-user-uuid",
      "status": "ACTIVE",
      "is_active": true,
      "created_at": "2026-01-01T09:00:00.000Z",
      "updated_at": "2026-01-01T10:00:00.000Z"
    },
    "approver": null,
    "rider_status": "Break",
    "assigned_parcels_count": 0
  },
  "message": "Rider updated successfully"
}
```

### Error Response

`404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Rider with ID rider-uuid not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/rider-uuid"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Rider does not belong to your hub",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/rider-uuid"
}
```

When a hub manager attempts a hub transfer, the same 403 envelope returns
`Hub managers cannot transfer riders`.

`409 Conflict`

```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Phone number already registered",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/rider-uuid"
}
```

The conflict message can instead be `Email already registered` or
`NID number already registered`. Invalid UUID/body values use HTTP 400;
authentication/role failures use the standard `401`/`403` envelopes.

### Business Rules

- Send only changed fields.
- Do not send `is_active`; it is rejected as an unknown DTO field.
- Activation/deactivation has separate endpoints.
- Hub managers can edit only riders in their hub and cannot transfer a rider.
- Admin may change `hub_id`.
- The linked user and staff mirror are updated where applicable.

---

## 12. Deactivate Rider

### API Name

Deactivate Rider

### Method + Endpoint

`PATCH /riders/:riderId/deactivate`

### Authentication

`Authorization: Bearer <token>`

Roles: `HUB_MANAGER`, `ADMIN`

### Path Parameter

`riderId`: UUID, required

Query parameters: none.

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "rider-uuid",
    "rider_code": "RDR-0001",
    "user_id": "user-uuid",
    "hub_id": "hub-uuid",
    "photo": null,
    "guardian_mobile_no": "01800000000",
    "bike_type": "MOTORCYCLE",
    "nid_number": null,
    "license_no": null,
    "present_address": "Dhaka",
    "permanent_address": "Dhaka",
    "fixed_salary": 12000,
    "commission_per_delivery": 25,
    "bank_name": null,
    "bank_account_number": null,
    "bank_branch": null,
    "nid_front_photo": null,
    "nid_back_photo": null,
    "license_front_photo": null,
    "license_back_photo": null,
    "parent_nid_front_photo": null,
    "parent_nid_back_photo": null,
    "approval_status": "APPROVED",
    "approved_at": "2026-01-01T10:00:00.000Z",
    "approved_by": "admin-user-uuid",
    "is_active": false,
    "created_at": "2026-01-01T09:00:00.000Z",
    "updated_at": "2026-09-19T10:00:00.000Z",
    "full_name": "Ahmed Wasi",
    "phone": "01700000000",
    "user": {
      "id": "user-uuid",
      "full_name": "Ahmed Wasi",
      "phone": "01700000000",
      "email": "ahmed@example.com",
      "role": "RIDER",
      "is_active": false,
      "created_at": "2026-01-01T09:00:00.000Z",
      "updated_at": "2026-09-19T10:00:00.000Z"
    },
    "hub": {
      "id": "hub-uuid",
      "hub_code": "HUB-001",
      "branch_name": "Gulshan Hub",
      "area": "Gulshan",
      "address": "Hub address",
      "manager_name": "Hub Manager",
      "manager_phone": "01900000000",
      "manager_user_id": "hub-manager-user-uuid",
      "status": "ACTIVE",
      "is_active": true,
      "created_at": "2026-01-01T09:00:00.000Z",
      "updated_at": "2026-01-01T10:00:00.000Z"
    },
    "approver": null,
    "rider_status": "Leave",
    "assigned_parcels_count": 0
  },
  "message": "Rider deactivated successfully"
}
```

### Error Response

`404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Rider with ID rider-uuid not found",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/rider-uuid/deactivate"
}
```

`403 Forbidden`

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Rider does not belong to your hub",
  "timestamp": "2026-09-19T10:00:00.000Z",
  "path": "/riders/rider-uuid/deactivate"
}
```

Invalid UUIDs use HTTP 400. Missing/invalid tokens and disallowed roles use the
standard `401`/`403` envelopes.

### Business Rules

- This is a soft deactivation; rider history is preserved.
- The linked rider login and staff mirror are also deactivated.
- Reactivation is admin-only through `PATCH /riders/:riderId/activate`.

---

## Final Original-Requirement Checklist

- **COMPLETE — Third-party parcel assignment:** exact active-provider, single
  Carrybee assignment, and bulk Carrybee assignment endpoints, request bodies,
  success responses, error responses, and business rules are documented.
- **COMPLETE — Parcel export:** **NOT FOUND IN CURRENT BACKEND**. Backend
  inspection confirms there is no hub parcel CSV/XLSX export endpoint; export
  is a frontend responsibility, so no backend contract exists.
- **COMPLETE — Parcel status list:** `GET /parcels/statuses` includes the full
  enum-derived `{ value, label }` response and authentication/authorization
  errors.
- **COMPLETE — Rider Dashboard:** the complete response, no-body contract,
  exact 404 envelope, and Bangladesh-day counting behavior are documented.
- **COMPLETE — Pending/completed Rider Deliveries:** both tabs, the exact
  wrapper, complete mapped parcel/nested response, errors, ordering, and filter
  behavior are documented.
- **COMPLETE — Pending/completed Rider Returns:** both tabs, the exact wrapper,
  complete mapped parcel/nested response, errors, ordering, and filter behavior
  are documented directly in the section.
- **COMPLETE — Hub pickup list:** query contract, no-body contract, complete
  returned pickup object/pagination wrapper, errors, and hub scoping are
  documented.
- **COMPLETE — Bulk pickup assignment:** request, full/partial-success response,
  endpoint-level errors, per-item failures, and assignment rules are
  documented.
- **COMPLETE — Create Rider:** complete rider/user/hub success object,
  validation/conflict/authentication errors, and creation rules are documented.
- **COMPLETE — Edit Rider:** complete updated rider/user/hub success object,
  exact 403/404/409 error envelopes, partial-update rules, and authorization
  behavior are documented.
- **COMPLETE — Deactivate Rider:** complete returned rider/user/hub object,
  exact 403/404 errors, and soft-deactivation behavior are documented.
