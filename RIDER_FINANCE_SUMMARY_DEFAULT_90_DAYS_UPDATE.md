# Rider Finance Summary - Default 90 Days Window Update

## Updated Endpoints
- GET {{baseUrl}}/riders/finance/summary
- GET {{baseUrl}}/riders/summary (alias)

## Auth
- Bearer token required
- Role: RIDER

## Behavior Change
- Previous default behavior: when no query params were provided, the `summary` section used today's range only.
- New default behavior: when no query params are provided, the `summary` section now uses the last 90 days (inclusive).
- This change affects only the `summary` block date range and status breakdown calculations.
- Other fields keep existing behavior:
  - `earnings.today` uses today.
  - `earnings.this_month` uses current month.
  - `tasks_for_today` uses today.
  - `cod_summary_today` uses today.
  - `lifetime_cash_collection_30_days` uses last 30 days.

## Query Params
- `startDate` (optional, format: YYYY-MM-DD)
- `endDate` (optional, format: YYYY-MM-DD)

## Request Body Variants
This is a GET endpoint, so request body is not used.

### Variant 1: No Query Params (default last 90 days)
Request URL:
GET {{baseUrl}}/riders/finance/summary

Body:
None

### Variant 2: With Custom Date Range
Request URL:
GET {{baseUrl}}/riders/finance/summary?startDate=2026-04-01&endDate=2026-04-07

Body:
None

### Variant 3: Only startDate
Request URL:
GET {{baseUrl}}/riders/finance/summary?startDate=2026-04-01

Body:
None

Behavior:
- `summary.date_range.start` = start of `startDate`
- `summary.date_range.end` = end of today

### Variant 4: Only endDate
Request URL:
GET {{baseUrl}}/riders/finance/summary?endDate=2026-04-07

Body:
None

Behavior:
- `summary.date_range.start` = start of today
- `summary.date_range.end` = end of `endDate`

## Success Response Example (200) - Default (No Query Params)
Example for request date `2026-04-07`:
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
        "start": "2026-01-08T00:00:00.000Z",
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

## Success Response Example (200) - Custom Date Range
```json
{
  "success": true,
  "data": {
    "summary": {
      "date_range": {
        "start": "2026-04-01T00:00:00.000Z",
        "end": "2026-04-07T23:59:59.999Z"
      },
      "total_parcel": 31,
      "delivered": 10,
      "partially_delivered": 2,
      "return": 3,
      "paid_return": 0,
      "pickup": 15,
      "exchanged": 1,
      "return_to_merchant": 0,
      "price_change": 0
    }
  },
  "message": "Finance summary retrieved successfully"
}
```

## Error Response Examples

### Unauthorized (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Forbidden (403)
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

### Rider Profile Not Found (404)
```json
{
  "statusCode": 404,
  "message": "Rider profile not found for this user",
  "error": "Not Found"
}
```

## Implementation Notes
- Default 90-day range is inclusive and implemented as `startOfDay(today - 89 days)` to `endOfDay(today)`.
- Both endpoints (`/riders/finance/summary` and `/riders/summary`) share the same service logic, so behavior is identical.
