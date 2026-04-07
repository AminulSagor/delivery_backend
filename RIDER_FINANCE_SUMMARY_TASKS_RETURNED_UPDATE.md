# Rider Finance Summary - Tasks Returned + Card Shape Update

## Updated Endpoints
- GET {{baseUrl}}/riders/finance/summary
- GET {{baseUrl}}/riders/summary (alias)

## Auth
- Bearer token required
- Role: RIDER

## Query Params
- startDate (optional, format: YYYY-MM-DD)
- endDate (optional, format: YYYY-MM-DD)

## Request Body Variants
This is a GET endpoint, so request body is not used.

### Variant 1: With Date Range
Request URL:
GET {{baseUrl}}/riders/finance/summary?startDate=2026-04-01&endDate=2026-04-06

Body:
None

### Variant 2: Without Date Range (defaults to last 90 days)
Request URL:
GET {{baseUrl}}/riders/finance/summary

Body:
None

## Response Change Summary
- Added `tasks_for_today.returned` (today's returned parcel count).
- Updated `cards.tasks_for_today` to include `total`, `pickups`, `deliveries`, and `returned`.
- Updated `cards.cod_collected` to use `total`.
- Updated `cards.earning_today` to use `total`.

## Success Response Example (200)
```json
{
  "success": true,
  "data": {
    "earnings": {
      "today": 120,
      "this_month": 980
    },
    "tasks_for_today": {
      "total": 5,
      "pickups": 1,
      "deliveries": 3,
      "returned": 1
    },
    "cards": {
      "tasks_for_today": {
        "title": "Tasks for Today",
        "total": 5,
        "pickups": 1,
        "deliveries": 3,
        "returned": 1
      },
      "cod_collected": {
        "title": "COD Collected",
        "total": 3200
      },
      "earning_today": {
        "title": "Earning Today",
        "total": 120
      }
    },
    "lifetime_cash_collection_30_days": 15450,
    "cod_summary_today": {
      "total_collected_amount": 3200,
      "total_pending": 1800,
      "total_collection": 5000
    },
    "summary": {
      "date_range": {
        "start": "2026-04-01T00:00:00.000Z",
        "end": "2026-04-06T23:59:59.999Z"
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

## Notes
- `tasks_for_today.returned` is calculated from parcels where:
  - `status = RETURNED`
  - `assigned_rider_id = current rider`
  - `updated_at` is within today's start and end time.
- `tasks_for_today.total = pickups + deliveries + returned`.
