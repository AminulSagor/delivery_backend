# Parcel Intake — Receive and Pickup Request Frontend Guide

This guide covers the hub parcel-receiving workflow and pickup-request APIs.
The backend owns all charge calculations. The frontend must send actual parcel
weight, never a manually calculated weight charge.

## 1. Load parcels awaiting receipt

```http
GET /hubs/parcels/received?page=1&limit=20&search=&merchantId=
Authorization: Bearer <hub-manager-token>
```

Eligible parcel statuses are `PENDING`, `OUT_FOR_PICKUP`, and `PICKED_UP`.
Search and merchant filters are handled by the backend.

Use `product_weight` as the editable Weight column value. Do not derive weight
from `weight_charge`; pricing rules are not guaranteed to use a fixed per-kg
amount.

## 2. Receive parcels and confirm actual weights

```http
POST /hubs/parcels/receive
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

The existing request remains valid:

```json
{
  "parcel_ids": [
    "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
    "7416d76d-4f94-4ccf-af0f-c03658fe28cb"
  ]
}
```

To change weight as part of receiving, add only the parcels whose actual weight
changed:

```json
{
  "parcel_ids": [
    "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
    "7416d76d-4f94-4ccf-af0f-c03658fe28cb"
  ],
  "weight_updates": [
    {
      "parcel_id": "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
      "product_weight": 1.5
    }
  ]
}
```

Every `weight_updates[].parcel_id` must also exist in `parcel_ids`. Duplicate
weight updates are rejected. `product_weight` must be a non-negative number with
at most two decimal places.

For each changed weight, the backend recalculates the weight charge using the
merchant, delivery area, COD amount, and current pricing configuration. It then
rebuilds total charge and merchant receivable before changing the parcel to
`IN_HUB`.

Relevant response fields:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 2,
      "failed": 0
    },
    "results": [
      {
        "parcel_id": "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
        "success": true,
        "weight_changed": true,
        "product_weight": 1.5,
        "weight_charge": 40,
        "total_charge": 110,
        "receivable_amount": 890
      }
    ]
  }
}
```

The endpoint preserves partial-success behavior: an invalid parcel produces a
failed result without preventing other valid parcels from being received. A
pricing/recalculation error fails that parcel rather than receiving it with
stale charges.

### Optional save-before-receive endpoint

If the UI saves an edited cell before the user presses Receive, use:

```http
PATCH /parcels/:parcelId/hub-charges
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

```json
{
  "product_weight": 1.5
}
```

Do not send `{ "weight_charge": 60 }` or `{ "delivery_charge": 60 }`. Those
are calculated results, not editable weight input. Sending only `weight_charge`
causes the validation error shown by the current Receive UI.

## 3. Pickup request APIs

### Merchant creates a pickup request

```http
POST /pickup-requests
Authorization: Bearer <merchant-token>
Content-Type: application/json
```

```json
{
  "store_id": "store-uuid",
  "estimated_parcels": 5,
  "comment": "Pickup before 5 PM"
}
```

### Hub Request List — pending and ready to assign

```http
GET /pickup-requests/hub/my-requests?page=1&limit=20&status=PENDING&search=REQ-2001
Authorization: Bearer <hub-manager-token>
```

When `status` is omitted, this endpoint defaults to `PENDING`.

### Hub Assigned Rider tab — rider currently collecting

```http
GET /pickup-requests/hub/accepted-pickups?page=1&limit=20&search=Rider
Authorization: Bearer <hub-manager-token>
```

This endpoint returns `CONFIRMED` pickup requests assigned to riders.

### Hub Pickup Done tab

```http
GET /pickup-requests/hub/confirmed-pickups?page=1&limit=20&search=Store
Authorization: Bearer <hub-manager-token>
```

Despite the legacy route name, this endpoint returns completed pickup requests
whose status is `PICKED_UP`.

All three hub endpoints now perform server-side search. Search matches request
code, store name, store phone, pickup address, comment, and rider or merchant
name/phone where applicable. Debounce search input by approximately 300–500 ms
and reset `page` to 1 when it changes.

Valid pickup statuses are:

```text
PENDING
CONFIRMED
PICKED_UP
CANCELLED
```

Do not send `ASSIGNED` or `COMPLETED`; those are UI labels, not backend pickup
statuses.

### Assign pending pickup requests

```http
POST /pickup-requests/hub/bulk-assign-rider
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

```json
{
  "rider_id": "rider-uuid",
  "pickup_ids": ["pickup-request-uuid"],
  "notes": "Collect before 5 PM"
}
```

### Rider loads and completes pickup work

```http
GET /pickup-requests/rider/my-pickups?filter=pending
Authorization: Bearer <rider-token>
```

```http
PATCH /pickup-requests/:pickupRequestId/rider/complete
Authorization: Bearer <rider-token>
Content-Type: application/json
```

```json
{
  "picked_up_count": 5,
  "parcel_ids": ["parcel-uuid-1", "parcel-uuid-2"],
  "notes": "Collected from merchant"
}
```
