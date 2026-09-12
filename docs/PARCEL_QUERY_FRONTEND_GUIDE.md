# Unified Parcel Query and Summary Frontend Guide

This backend work covers the original items 1, 2, 8, 9, and 19. No frontend code was changed.

## One query API, separate screen searches

Every screen keeps its own search input. They all send the same `search` query parameter to:

```http
GET /hubs/parcels
Authorization: Bearer <hub-manager-token>
```

Supported query parameters:

```text
page, limit, search, status, merchantId, riderId, providerId,
assignment, history, startDate, endDate, days, paymentStatus,
storeId, customerName, customerPhone, merchantName, area,
minAmount, maxAmount, deliveryType, sortBy, order
```

`assignment` accepts `UNASSIGNED`, `RIDER`, or `THIRD_PARTY`. Dates use `YYYY-MM-DD` and Bangladesh (`Asia/Dhaka`) day boundaries. `startDate` and `endDate` must be supplied together.

The backend search covers parcel UUID/display ID/tracking number, merchant order ID, customer name/phone/address, merchant/store, rider name/phone, coverage location, provider name/code, and Carrybee consignment ID.

Example response:

```json
{
  "success": true,
  "data": {
    "parcels": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 20,
      "totalPages": 0,
      "hasNext": false,
      "hasPrev": false
    },
    "summary": {
      "total": 0,
      "by_status": {},
      "cod_amount": 0,
      "total_charge": 0
    }
  },
  "message": "Parcels retrieved successfully"
}
```

The summary represents the entire filtered result, not only the current page.

## All Parcel screen

Send all search and dropdown values to the API instead of filtering the current page in the browser:

```http
GET /hubs/parcels?page=1&limit=20&search=01700000000&merchantId=<uuid>&riderId=<uuid>&status=ASSIGNED_TO_RIDER
```

Load dropdowns from:

```http
GET /hubs/merchants
GET /hubs/riders
```

Use real UUID values from these responses. Remove the hard-coded Merchant 1/Rider 1 options. Reset `page` to `1` whenever a search or filter changes.

## Third Party screen

Load the provider dropdown from:

```http
GET /third-party-providers/active
```

All Parcel List contains only unassigned parcels ready for assignment:

```http
GET /hubs/parcels?status=IN_HUB&assignment=UNASSIGNED&page=1&limit=20&search=
```

Assigned Parcel List contains current third-party assignments:

```http
GET /hubs/parcels?status=ASSIGNED_TO_THIRD_PARTY&assignment=THIRD_PARTY&providerId=<optional-provider-uuid>&page=1&limit=20&search=
```

To show delivered parcels for a provider:

```http
GET /hubs/parcels?status=DELIVERED&assignment=THIRD_PARTY&providerId=<optional-provider-uuid>&page=1&limit=20&search=
```

Do not use `/hubs/parcels/outgoing` for this screen. That endpoint is exclusively for active hub-to-hub transfers.

## Parcel History

Use the unified API with the history flag:

```http
GET /hubs/parcels?history=true&page=1&limit=20&search=&startDate=2026-09-01&endDate=2026-09-12
```

History returns only hub-confirmed completed statuses:

```text
DELIVERED
PARTIAL_DELIVERY
EXCHANGE
PAID_RETURN
RETURNED
RETURN_TO_MERCHANT
```

`CANCELLED` and `DELIVERY_RESCHEDULED` are excluded. A specific completed status can still be supplied, for example `history=true&status=DELIVERED`. A non-completed history status returns HTTP 400.

`GET /hubs/parcels/history` remains available for compatibility, but new frontend work should use the unified API.

## View and edit a parcel

The current detail route can remain:

```http
GET /hubs/dashboard/parcels/:parcelUuid
```

The reusable full detail route is also available:

```http
GET /parcels/:parcelUuid
```

Save edits with:

```http
PATCH /parcels/:parcelUuid
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

Example request:

```json
{
  "customer_name": "Updated Customer",
  "customer_phone": "01700000000",
  "customer_secondary_phone": "01800000000",
  "customer_address": "House 10, Road 4, Mirpur, Dhaka",
  "delivery_coverage_area_id": "9709e313-9cf0-4d02-a217-c040283e86bf",
  "product_description": "One clothing parcel",
  "product_price": 1200,
  "product_weight": 1.5,
  "special_instructions": "Call before delivery"
}
```

The hub may send any subset of those fields while status is `IN_HUB`, `ASSIGNED_TO_RIDER`, or `ASSIGNED_TO_THIRD_PARTY`. Weight or coverage changes recalculate the affected backend charges. The response returns the updated full parcel.

## Rider Delivered summary

The default is lifetime because no date is required:

```http
GET /riders/parcel-summary?type=DELIVERED&page=1&limit=20&search=
Authorization: Bearer <rider-token>
```

Optional date example:

```http
GET /riders/parcel-summary?type=DELIVERED&startDate=2026-09-01&endDate=2026-09-12&search=Mirpur&page=1&limit=20
```

## Rider Return summary

```http
GET /riders/parcel-summary?type=RETURNED&page=1&limit=20&search=
Authorization: Bearer <rider-token>
```

This card/list does not count every parcel having a return-like status. It counts only parcels explicitly created/marked as return parcels by the hub and assigned to the authenticated rider (`is_return_parcel=true`).

Frontend requirement: when the hub creates a return parcel, it must then use the normal rider-assignment flow for that return parcel. The return card appears only after that assignment.

Both rider summary types return:

```json
{
  "success": true,
  "data": {
    "type": "RETURNED",
    "total": 2,
    "cod_amount": 1040,
    "parcels": [],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Rider parcel summary retrieved successfully"
}
```

Use `total` for the large card and `parcels` for its details list. Search supports parcel ID, customer name/phone, and location. Supplying a date range filters the card and list together.
