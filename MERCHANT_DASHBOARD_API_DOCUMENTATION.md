# Merchant Dashboard API Documentation

## Overview
This API returns complete dashboard data for merchant panel in one response.
It includes:
- Summary for today's parcel
- Delivery performance (weekly or monthly)
- Cash on Delivery (COD) details
- Summary for lifetime parcel (optionally filtered by date range)

This is a merchant-only API and always uses authenticated merchant context from JWT.

---

## Endpoint
`GET /merchants/dashboard/summary`

### Dedicated Graph Endpoint
`GET /merchants/dashboard/delivery-performance`

## Authorization
- Required: `Bearer <access_token>`
- Role: `MERCHANT`

---

## Query Parameters

| Name | Type | Required | Allowed | Description |
|------|------|----------|---------|-------------|
| `performance_range` | string | No | `weekly`, `monthly` | Controls delivery performance chart range. Default: `weekly` |
| `lifetime_start_date` | string | No | `YYYY-MM-DD` | Start date for lifetime summary filter (UTC day) |
| `lifetime_end_date` | string | No | `YYYY-MM-DD` | End date for lifetime summary filter (UTC day, inclusive) |

Validation rules:
- `lifetime_start_date` and `lifetime_end_date` must be provided together.
- `lifetime_start_date` must be less than or equal to `lifetime_end_date`.
- Invalid calendar dates are rejected (example: `2026-02-30`).

---

## Request Variants

### Variant 1: Default dashboard (weekly, all-time lifetime)
```http
GET /merchants/dashboard/summary
Authorization: Bearer <merchant_token>
```

### Variant 2: Monthly performance + filtered lifetime
```http
GET /merchants/dashboard/summary?performance_range=monthly&lifetime_start_date=2026-04-01&lifetime_end_date=2026-04-30
Authorization: Bearer <merchant_token>
```

### Variant 3: Graph only (weekly)
```http
GET /merchants/dashboard/delivery-performance
Authorization: Bearer <merchant_token>
```

### Variant 4: Graph only (monthly)
```http
GET /merchants/dashboard/delivery-performance?performance_range=monthly
Authorization: Bearer <merchant_token>
```

---

## Graph Endpoint Success Response (200)

```json
{
  "success": true,
  "data": {
    "range": "weekly",
    "start_date": "2026-04-02",
    "end_date": "2026-04-08",
    "totals": {
      "delivered": 52,
      "returned": 19,
      "total_parcel": 88
    },
    "trend": [
      {
        "day": "Thu",
        "date": "2026-04-02",
        "delivered": 7,
        "returned": 2,
        "total_parcel": 12
      }
    ]
  },
  "message": "Merchant delivery performance retrieved successfully"
}
```

---

## Success Response (200)

```json
{
  "success": true,
  "data": {
    "generated_at": "2026-04-08T10:25:47.556Z",
    "date_context": {
      "timezone": "UTC",
      "today_start": "2026-04-08T00:00:00.000Z",
      "today_end": "2026-04-09T00:00:00.000Z"
    },
    "summary_for_todays_parcel": {
      "new_parcels": {
        "count": 12,
        "amount": 48000
      },
      "pick_up": {
        "count": 45,
        "amount": 48000
      },
      "in_transit": {
        "count": 27,
        "amount": 38000
      },
      "assigned": {
        "count": 23,
        "amount": 48000
      },
      "delivered": {
        "count": 12,
        "amount": 48000
      },
      "delivery_on_reschedule": {
        "count": 7,
        "amount": 48000
      }
    },
    "delivery_performance": {
      "range": "weekly",
      "start_date": "2026-04-02",
      "end_date": "2026-04-08",
      "totals": {
        "delivered": 52,
        "returned": 19,
        "total_parcel": 88
      },
      "trend": [
        {
          "day": "Thu",
          "date": "2026-04-02",
          "delivered": 7,
          "returned": 2,
          "total_parcel": 12
        },
        {
          "day": "Fri",
          "date": "2026-04-03",
          "delivered": 6,
          "returned": 3,
          "total_parcel": 11
        },
        {
          "day": "Sat",
          "date": "2026-04-04",
          "delivered": 8,
          "returned": 2,
          "total_parcel": 14
        },
        {
          "day": "Sun",
          "date": "2026-04-05",
          "delivered": 9,
          "returned": 4,
          "total_parcel": 15
        },
        {
          "day": "Mon",
          "date": "2026-04-06",
          "delivered": 8,
          "returned": 3,
          "total_parcel": 13
        },
        {
          "day": "Tue",
          "date": "2026-04-07",
          "delivered": 6,
          "returned": 3,
          "total_parcel": 10
        },
        {
          "day": "Wed",
          "date": "2026-04-08",
          "delivered": 8,
          "returned": 2,
          "total_parcel": 13
        }
      ]
    },
    "cash_on_delivery_details": {
      "collection_status": {
        "total_collected": 350120,
        "total_pending": 79330
      },
      "total_cash_on_delivery_amount": 177632,
      "todays_collection": 4523,
      "total_fee": 45123,
      "total_receivable": 132509,
      "fee_breakdown": {
        "total_delivery_charge": 25500,
        "total_weight_charge": 3200,
        "total_cod_charge": 7423,
        "total_return_charge": 9000
      }
    },
    "summary_for_lifetime_parcel": {
      "date_range": {
        "start_date": "2026-04-01",
        "end_date": "2026-04-30"
      },
      "total_parcel": {
        "count": 312356,
        "amount": 567890
      },
      "delivered": {
        "count": 102234,
        "amount": 231000
      },
      "partially_delivered": {
        "count": 26010,
        "amount": 45123
      },
      "paid_return": {
        "count": 12890,
        "amount": 23890
      },
      "exchange": {
        "count": 8770,
        "amount": 17770
      },
      "pending_delivery": {
        "count": 106600,
        "amount": 196700
      },
      "return_percentage": {
        "percentage": 30.12,
        "count": 94000,
        "amount": 152400
      },
      "pending_return": {
        "count": 18500,
        "amount": 30200
      },
      "return_to_merchant": {
        "count": 22100,
        "amount": 40800
      }
    }
  },
  "message": "Merchant dashboard summary retrieved successfully"
}
```

---

## Error Responses

### 400 Bad Request - Missing lifetime pair
```json
{
  "statusCode": 400,
  "message": "lifetime_start_date and lifetime_end_date must be provided together",
  "error": "Bad Request"
}
```

### 400 Bad Request - Invalid date format
```json
{
  "statusCode": 400,
  "message": [
    "lifetime_start_date must match /^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$/ regular expression"
  ],
  "error": "Bad Request"
}
```

### 400 Bad Request - Start date after end date
```json
{
  "statusCode": 400,
  "message": "lifetime_start_date must be less than or equal to lifetime_end_date",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden - Wrong role
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### 404 Not Found - Merchant missing
```json
{
  "statusCode": 404,
  "message": "Merchant not found",
  "error": "Not Found"
}
```

---

## Calculation and Status Mapping

All amounts are computed from `product_price` for parcel summary blocks and from COD/charge columns for COD block.

### 1) Summary for Today's Parcel
Time window:
- `created_at >= today_start`
- `created_at < today_end`
- UTC boundaries

Cards:
- `new_parcels`: all statuses in today's window
- `pick_up`: status `PICKED_UP`
- `in_transit`: status `IN_TRANSIT`
- `assigned`: statuses `ASSIGNED_TO_RIDER`, `ASSIGNED_TO_THIRD_PARTY`, `OUT_FOR_DELIVERY`
- `delivered`: status `DELIVERED`
- `delivery_on_reschedule`: status `DELIVERY_RESCHEDULED`

Each card:
- `count` = parcel count
- `amount` = sum of `product_price`

### 2) Delivery Performance
Range:
- `weekly`: last 7 days including today
- `monthly`: last 30 days including today

Per day bucket (UTC date of `created_at`):
- `total_parcel` = all parcels created that day
- `delivered` = statuses `DELIVERED`, `PARTIAL_DELIVERY`, `EXCHANGE`
- `returned` = statuses `RETURNED`, `PAID_RETURN`, `RETURN_TO_MERCHANT`, `RETURNED_TO_HUB`

### 3) Cash on Delivery Details (COD)
Scope:
- `is_cod = true`
- excludes `CANCELLED`

Fields:
- `total_collected` = sum(`cod_collected_amount`)
- `total_pending` = sum(max(`cod_amount - cod_collected_amount`, 0))
- `total_cash_on_delivery_amount` = sum(`cod_amount`)
- `todays_collection` = sum(`cod_collected_amount`) where `delivered_at` is today (UTC)
- `total_fee` = sum(`total_charge + return_charge`)
- `total_receivable` = `total_cash_on_delivery_amount - total_fee`
- `fee_breakdown`:
  - `total_delivery_charge` = sum(`delivery_charge`)
  - `total_weight_charge` = sum(`weight_charge`)
  - `total_cod_charge` = sum(`cod_charge`)
  - `total_return_charge` = sum(`return_charge`)

### 4) Summary for Lifetime Parcel
Scope:
- all parcels for merchant
- optional filter by `created_at` between `lifetime_start_date` and `lifetime_end_date` (inclusive date range)

Cards and mappings:
- `total_parcel`: all statuses
- `delivered`: `DELIVERED`
- `partially_delivered`: `PARTIAL_DELIVERY`
- `paid_return`: `PAID_RETURN`
- `exchange`: `EXCHANGE`
- `pending_delivery`: `PENDING`, `PICKED_UP`, `IN_HUB`, `ASSIGNED_TO_RIDER`, `ASSIGNED_TO_THIRD_PARTY`, `OUT_FOR_DELIVERY`, `OUT_FOR_PICKUP`, `IN_TRANSIT`, `FAILED_DELIVERY`, `DELIVERY_RESCHEDULED`
- `pending_return`: `RETURNED_TO_HUB`
- `return_to_merchant`: `RETURN_TO_MERCHANT`
- `return_percentage`:
  - numerator statuses: `RETURNED`, `PAID_RETURN`, `RETURN_TO_MERCHANT`, `RETURNED_TO_HUB`
  - denominator: `total_parcel.count`
  - formula: `(numerator_count / total_parcel.count) * 100`, rounded to 2 decimals

Each block amount in lifetime section:
- `amount` = sum of `product_price` for its status scope

---

## Notes for Frontend
- Currency format should be applied on UI side (backend returns numeric values).
- All date window calculations are UTC-based.
- This endpoint is designed for dashboard cards and charts to avoid multi-call mismatches.
