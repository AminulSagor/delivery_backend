# Merchant Store Availability — Frontend API Guide

This API powers the **Active / Inactive** switch on the merchant store card.

## Authentication

Send the merchant JWT with every request:

```http
Authorization: Bearer <merchant_access_token>
Content-Type: application/json
```

## Read the current state

Use either existing store endpoint:

```http
GET /stores
GET /stores/:storeId
```

Each store now includes both fields:

```json
{
  "status": "APPROVED",
  "is_active": true
}
```

Frontend display rule:

- `is_active: true` means the toggle is **Active**.
- `is_active: false` means the toggle is **Inactive**.
- `is_active` is derived from `status === "APPROVED"`.

## Change availability

```http
PATCH /stores/:storeId/availability
```

Only the merchant who owns the store can use this endpoint.

### Deactivate

Request:

```json
{
  "is_active": false
}
```

Successful response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "store": {
      "id": "<storeId>",
      "status": "DISABLED",
      "is_active": false
    }
  },
  "message": "Store deactivated successfully",
  "timestamp": "2026-09-05T14:00:00.000Z"
}
```

A store can be deactivated only when **every parcel belonging to that store** is in one of these last stages:

```text
DELIVERED
RETURNED
PAID_RETURN
PARTIAL_DELIVERY
EXCHANGE
RETURN_TO_MERCHANT
```

Statuses such as `PENDING`, `PICKED_UP`, `IN_TRANSIT`, `RETURNED_TO_HUB`, `FAILED_DELIVERY`, and `CANCELLED` do not satisfy this rule.

If any parcel has not reached an allowed last stage, the API returns `400 Bad Request`:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Cannot deactivate this store because 2 parcels have not reached a final stage.",
  "timestamp": "2026-09-05T14:00:00.000Z",
  "path": "/stores/<storeId>/availability"
}
```

Keep the toggle active when this error occurs and show `message` to the merchant.

### Activate again

Request:

```json
{
  "is_active": true
}
```

Successful response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "store": {
      "id": "<storeId>",
      "status": "APPROVED",
      "is_active": true
    }
  },
  "message": "Store activated successfully",
  "timestamp": "2026-09-05T14:00:00.000Z"
}
```

Only a merchant-disabled store can be activated this way. A `PENDING` or `DECLINED` store still requires admin approval.

## Frontend behavior

1. Disable the switch while the PATCH request is pending.
2. Send the new switch value as `is_active`.
3. On success, replace the displayed store with `response.data.store`.
4. On failure, restore the previous switch state and display `response.message`.

Example:

```ts
async function updateStoreAvailability(storeId: string, isActive: boolean) {
  return api.patch(`/stores/${storeId}/availability`, {
    is_active: isActive,
  });
}
```

When inactive, the backend rejects new parcel entries and new pickup requests for that store. Existing API field names are unchanged; `is_active` is only an added response field and the request field for this new toggle endpoint.

## Legacy endpoint

`PATCH /stores/:storeId/disable` remains available and follows the same parcel-stage restriction. The merchant toggle should use `PATCH /stores/:storeId/availability` because it supports both activation and deactivation.
