# Rider Finance Summary Card Drill-Down API Documentation

## Overview
This document defines the Rider app flow for finance summary cards:

1. Load finance summary cards from `GET /riders/finance/summary`
2. Click a card metric (for example `delivered`) and fetch filtered list from `GET /riders/finance/summary/breakdown`
3. Click one list item and open full detail using the correct detail endpoint

This keeps card count, list data, and details aligned.

## Auth
- Bearer token required
- Role: RIDER

---

## Flow Summary

### Step 1: Get Summary Cards
Endpoint:
- `GET {{baseUrl}}/riders/finance/summary`

### Step 2: Click Card -> Get Metric List
Endpoint:
- `GET {{baseUrl}}/riders/finance/summary/breakdown`

Required query:
- `metric`

Optional query:
- `startDate`, `endDate`, `page`, `limit`

### Step 3: Click List Item -> Get Full Detail
Use endpoint by metric type:
- Parcel metrics -> `GET /riders/deliveries/:id` or `GET /riders/returns/:id`
- Pickup metric -> `GET /riders/pickups/:id`

---

## 1) Finance Summary Endpoint

### Endpoint
GET {{baseUrl}}/riders/finance/summary

### Query Params
- `startDate` (optional, ISO date string)
- `endDate` (optional, ISO date string)

### Date Range Behavior for `summary`
- No `startDate` and no `endDate`:
  - default lifetime
  - start = startOfDay(rider.created_at)
  - end = endOfDay(today)
- `startDate` only:
  - start = startOfDay(startDate)
  - end = endOfDay(today)
- `endDate` only:
  - start = startOfDay(today)
  - end = endOfDay(endDate)
- Both provided:
  - start = startOfDay(startDate)
  - end = endOfDay(endDate)

### Request Body Variants
This is a GET endpoint, so request body is not used.

#### Variant 1: Default (no date)
Request URL:
GET {{baseUrl}}/riders/finance/summary

Body:
None

#### Variant 2: Custom range
Request URL:
GET {{baseUrl}}/riders/finance/summary?startDate=2026-04-01&endDate=2026-04-07

Body:
None

### Success Response Example (200)
```json
{
  "success": true,
  "data": {
    "earnings": {
      "today": 0,
      "this_month": 15
    },
    "tasks_for_today": {
      "total": 3,
      "pickups": 0,
      "deliveries": 3,
      "returned": 0
    },
    "cards": {
      "tasks_for_today": {
        "title": "Tasks for Today",
        "total": 3,
        "pickups": 0,
        "deliveries": 3,
        "returned": 0
      },
      "cod_collected": {
        "title": "COD Collected",
        "total": 0
      },
      "earning_today": {
        "title": "Earning Today",
        "total": 0
      }
    },
    "lifetime_cash_collection_30_days": 160,
    "cod_summary_today": {
      "total_collected_amount": 0,
      "total_pending": 0,
      "total_collection": 0
    },
    "summary": {
      "date_range": {
        "start": "2025-01-15T00:00:00.000Z",
        "end": "2026-04-07T23:59:59.999Z"
      },
      "total_parcel": 0,
      "delivered": 0,
      "partially_delivered": 0,
      "return": 0,
      "paid_return": 0,
      "pickup": 0,
      "exchanged": 0,
      "return_to_merchant": 0,
      "price_change": 0
    }
  },
  "message": "Finance summary retrieved successfully"
}
```

---

## 2) Finance Summary Breakdown Endpoint (Card Click List)

### Endpoint
GET {{baseUrl}}/riders/finance/summary/breakdown

### Query Params
- `metric` (required enum)
- `startDate` (optional, ISO date string)
- `endDate` (optional, ISO date string)
- `page` (optional, integer >= 1, default 1)
- `limit` (optional, integer 1..100, default 20)

### Supported `metric` Values
- `delivered`
- `partially_delivered`
- `return`
- `paid_return`
- `pickup`
- `exchanged`
- `return_to_merchant`

### Notes
- Uses the same date-range rules as `summary.date_range`.
- `pickup` returns `item_type = pickup_request`.
- All other metrics return `item_type = parcel`.
- `total` means:
  - For parcel metrics: total parcel rows for that metric in range.
  - For pickup metric: sum of `picked_up_count` in range.
- `list_count` means number of list rows returned by metric query before pagination.

### Request Body Variants
This is a GET endpoint, so request body is not used.

#### Variant 1: Delivered list (default lifetime)
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=delivered&page=1&limit=20

Body:
None

#### Variant 2: Partially delivered list (custom range)
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=partially_delivered&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

#### Variant 3: Return list (custom range)
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=return&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

#### Variant 4: Paid return list
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=paid_return&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

#### Variant 5: Pickup list
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=pickup&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

#### Variant 6: Exchanged list
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=exchanged&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

#### Variant 7: Return-to-merchant list
Request URL:
GET {{baseUrl}}/riders/finance/summary/breakdown?metric=return_to_merchant&startDate=2026-04-01&endDate=2026-04-07&page=1&limit=20

Body:
None

### Success Response Example (200) - Parcel Metric (`delivered`)
```json
{
  "success": true,
  "data": {
    "metric": "delivered",
    "item_type": "parcel",
    "date_range": {
      "start": "2026-04-01T00:00:00.000Z",
      "end": "2026-04-07T23:59:59.999Z"
    },
    "total": 2,
    "list_count": 2,
    "items": [
      {
        "id": "f11b0845-4d99-4764-894b-06773f42d252",
        "parcel_tx_id": "#140411",
        "tracking_number": "TRK-20260407-0411",
        "status": "DELIVERED",
        "delivered_at": "2026-04-07T11:20:10.000Z",
        "cod_amount": 1200,
        "total_charge": 100,
        "assigned_rider_id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
        "customer_name": "Karim",
        "customer_phone": "01710000000",
        "customer_address": "Mirpur, Dhaka",
        "store": {
          "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
          "business_name": "Shafa Mart"
        },
        "merchant": {
          "id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b"
        }
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Finance summary parcel breakdown retrieved successfully"
}
```

### Success Response Example (200) - Pickup Metric (`pickup`)
```json
{
  "success": true,
  "data": {
    "metric": "pickup",
    "item_type": "pickup_request",
    "date_range": {
      "start": "2026-04-01T00:00:00.000Z",
      "end": "2026-04-07T23:59:59.999Z"
    },
    "total": 8,
    "list_count": 3,
    "items": [
      {
        "id": "6b66dd59-5904-44ad-aa10-9157061abfaa",
        "request_code": "REQ-2088",
        "pickup_count": 4,
        "status": "PICKED_UP",
        "comment": "Done",
        "created_at": "2026-04-07T08:00:00.000Z",
        "store": {
          "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
          "business_name": "Shafa Mart",
          "phone_number": "01700000000",
          "business_address": "Uttara, Dhaka"
        },
        "assigned_rider": {
          "id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
          "full_name": "Rakib Hasan",
          "phone": "01800000000"
        },
        "picked_up_count": 4,
        "picked_up_at": "2026-04-07T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Finance summary pickup breakdown retrieved successfully"
}
```

### Error Response Examples

#### 400 Invalid metric
```json
{
  "statusCode": 400,
  "message": [
    "Invalid metric. Use: delivered, partially_delivered, return, paid_return, pickup, exchanged, return_to_merchant"
  ],
  "error": "Bad Request"
}
```

#### 400 Invalid date format
```json
{
  "statusCode": 400,
  "message": [
    "startDate must be a valid ISO date string"
  ],
  "error": "Bad Request"
}
```

#### 400 Invalid pagination
```json
{
  "statusCode": 400,
  "message": [
    "limit cannot exceed 100"
  ],
  "error": "Bad Request"
}
```

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 404 Rider profile not found
```json
{
  "statusCode": 404,
  "message": "Rider profile not found for this user",
  "error": "Not Found"
}
```

---

## 3) Single Item Detail Endpoint (List Item Click)

Use one endpoint for all metrics:

- `GET /riders/finance/summary/detail/:id`
- `GET /riders/finance/summary/detail/:id?metric=<metric>`

Notes:
- `metric` is optional.
- If `metric` is not provided, backend auto-detects from item status and returns detected metric.
- If `metric` is provided, backend enforces strict metric-status match validation.

### Request Body Variants
All are GET endpoints, so request body is not used.

#### Delivery detail variant (auto-detect)
Request URL:
GET {{baseUrl}}/riders/finance/summary/detail/f11b0845-4d99-4764-894b-06773f42d252

Body:
None

#### Delivery metric detail variant (strict)
Request URL:
GET {{baseUrl}}/riders/finance/summary/detail/f11b0845-4d99-4764-894b-06773f42d252?metric=delivered

Body:
None

#### Return metric detail variant (strict)
Request URL:
GET {{baseUrl}}/riders/finance/summary/detail/2dd63ef4-93af-4f14-9e58-8c9e2d069d03?metric=return

Body:
None

#### Pickup metric detail variant (strict)
Request URL:
GET {{baseUrl}}/riders/finance/summary/detail/6b66dd59-5904-44ad-aa10-9157061abfaa?metric=pickup

Body:
None

### Success Response Example (200) - Single Detail Endpoint
```json
{
  "success": true,
  "data": {
    "metric": "delivered",
    "item_type": "parcel",
    "detail": {
      "id": "f11b0845-4d99-4764-894b-06773f42d252",
      "parcel_tx_id": "#140411",
      "tracking_number": "TRK-20260407-0411",
      "status": "DELIVERED",
      "customer_name": "Karim",
      "customer_phone": "01710000000",
      "customer_address": "Mirpur, Dhaka",
      "cod_amount": 1200,
      "total_charge": 100,
      "assigned_rider_id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
      "delivered_at": "2026-04-07T11:20:10.000Z",
      "store": {
        "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
        "business_name": "Shafa Mart"
      },
      "merchant": {
        "id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b"
      }
    }
  },
  "message": "Finance summary detail retrieved successfully"
}
```

### Error Response Examples (Detail Endpoints)

#### 400 Metric does not match item status
```json
{
  "statusCode": 400,
  "message": "Parcel status PARTIAL_DELIVERY does not match metric delivered",
  "error": "Bad Request"
}
```

#### 404 Detail not found for rider (auto-detect mode)
```json
{
  "statusCode": 404,
  "message": "Finance summary detail not found for this rider",
  "error": "Not Found"
}
```

#### 403 Forbidden (pickup detail ownership violation)
```json
{
  "statusCode": 403,
  "message": "This completed pickup is not available for this rider",
  "error": "Forbidden"
}
```

#### 404 Not found or not assigned
```json
{
  "statusCode": 404,
  "message": "Parcel not found or not assigned to you",
  "error": "Not Found"
}
```

---

## Frontend Integration Reference

### Delivered Card Click Flow
1. Call summary:
   - `GET /riders/finance/summary`
2. Read `data.summary.delivered`
3. On card click call:
   - `GET /riders/finance/summary/breakdown?metric=delivered&startDate=<from summary date_range.start>&endDate=<from summary date_range.end>`
4. Render list
5. On list item click call:
  - `GET /riders/finance/summary/detail/:id`

### Pickup Card Click Flow
1. Breakdown:
   - `GET /riders/finance/summary/breakdown?metric=pickup&startDate=...&endDate=...`
2. On item click:
  - `GET /riders/finance/summary/detail/:id`

### Return Card Click Flow
1. Breakdown:
   - `GET /riders/finance/summary/breakdown?metric=return&startDate=...&endDate=...`
2. On item click:
  - `GET /riders/finance/summary/detail/:id`

---

## Important Notes
- `total_parcel` in summary is aggregate of multiple categories and does not currently have a dedicated breakdown metric.
- `price_change` is currently reported as `0` in summary and has no drill-down metric.
- Always pass the same date range from summary card context to breakdown request to keep count and list consistent.
