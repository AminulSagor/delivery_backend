# Merchant Delivery Performance Endpoint Documentation

## Overview
This endpoint returns only graph-focused delivery performance data for the authenticated merchant.

It does not return:
- cash_on_delivery_details
- full dashboard summary blocks

## Endpoint
GET /merchants/dashboard/delivery-performance

## Authorization
- Required: Bearer access token
- Role: MERCHANT

## Query Parameters
| Name | Type | Required | Allowed Values | Notes |
|------|------|----------|----------------|-------|
| performance_range | string | No | weekly, monthly | Default is weekly |
| month | string | No | Month name or YYYY-MM | Only valid when performance_range=monthly |

## month Parameter Behavior
Supported month values:
- Full month names: january, february, march, april, may, june, july, august, september, october, november, december
- Short month names: jan, feb, mar, apr, may, jun, jul, aug, sep, sept, oct, nov, dec
- Year-month format: YYYY-MM (example: 2026-04)

Rules:
- If month is a month name, current UTC year is used.
- If month is YYYY-MM, that exact year and month are used.
- month with performance_range=weekly returns 400.

## Date Window Rules
All date calculations are UTC-based.

1) Weekly
- Window: last 7 days including today
- Example when today is 2026-04-08:
  - start_date: 2026-04-02
  - end_date: 2026-04-08

2) Monthly without month param
- Window: last 30 days including today
- Example when today is 2026-04-08:
  - start_date: 2026-03-10
  - end_date: 2026-04-08

3) Monthly with month param as name
- month=april and current year 2026:
  - start_date: 2026-04-01
  - end_date: 2026-04-30

4) Monthly with month param as YYYY-MM
- month=2025-11:
  - start_date: 2025-11-01
  - end_date: 2025-11-30

## Request Variants

### Variant 1: Weekly (default)
GET /merchants/dashboard/delivery-performance

### Variant 2: Weekly (explicit)
GET /merchants/dashboard/delivery-performance?performance_range=weekly

### Variant 3: Monthly rolling 30-day window
GET /merchants/dashboard/delivery-performance?performance_range=monthly

### Variant 4: Monthly fixed calendar month by name
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=april

### Variant 5: Monthly fixed calendar month by short name
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=jun

### Variant 6: Monthly fixed calendar month by YYYY-MM
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=2026-04

## cURL Examples

### Weekly
curl --request GET "{{BASE_URL}}/merchants/dashboard/delivery-performance?performance_range=weekly" \
  --header "Authorization: Bearer {{MERCHANT_ACCESS_TOKEN}}"

### Monthly by month name
curl --request GET "{{BASE_URL}}/merchants/dashboard/delivery-performance?performance_range=monthly&month=april" \
  --header "Authorization: Bearer {{MERCHANT_ACCESS_TOKEN}}"

### Monthly by YYYY-MM
curl --request GET "{{BASE_URL}}/merchants/dashboard/delivery-performance?performance_range=monthly&month=2026-04" \
  --header "Authorization: Bearer {{MERCHANT_ACCESS_TOKEN}}"

## Success Response (200)
{
  "success": true,
  "data": {
    "range": "monthly",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "totals": {
      "delivered": 152,
      "returned": 37,
      "total_parcel": 241
    },
    "trend": [
      {
        "day": "Tue",
        "date": "2026-04-01",
        "delivered": 6,
        "returned": 1,
        "total_parcel": 9
      },
      {
        "day": "Wed",
        "date": "2026-04-02",
        "delivered": 5,
        "returned": 2,
        "total_parcel": 10
      }
    ]
  },
  "message": "Merchant delivery performance retrieved successfully"
}

## Response Field Meaning
- range: requested range after normalization (weekly or monthly)
- start_date: first UTC day included in the graph
- end_date: last UTC day included in the graph
- totals.delivered: sum of delivered counts across trend days
- totals.returned: sum of returned counts across trend days
- totals.total_parcel: sum of all parcels across trend days
- trend: day-wise graph points in ascending date order

Delivered statuses in graph:
- DELIVERED
- PARTIAL_DELIVERY
- EXCHANGE

Returned statuses in graph:
- RETURNED
- PAID_RETURN
- RETURN_TO_MERCHANT
- RETURNED_TO_HUB

## Error Responses

### 400 Bad Request: month used with weekly
Request:
GET /merchants/dashboard/delivery-performance?performance_range=weekly&month=april

Response:
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "month filter is only supported when performance_range is monthly",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance?performance_range=weekly&month=april"
}

### 400 Bad Request: invalid month name
Request:
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=abcdxyz

Response:
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "month must be in YYYY-MM format or month name like april",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance?performance_range=monthly&month=abcdxyz"
}

### 400 Bad Request: invalid YYYY-MM (DTO validation)
Request:
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=2026-13

Response:
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "month must match /^(\\d{4}-(0[1-9]|1[0-2])|[A-Za-z]+)$/ regular expression"
  ],
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance?performance_range=monthly&month=2026-13"
}

### 401 Unauthorized
{
  "success": false,
  "statusCode": 401,
  "error": "UnauthorizedException",
  "message": "Unauthorized",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance"
}

### 403 Forbidden (wrong role)
{
  "success": false,
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "Forbidden resource",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance"
}

### 404 Not Found (merchant missing)
{
  "success": false,
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "Merchant not found",
  "timestamp": "2026-04-08T12:00:00.000Z",
  "path": "/merchants/dashboard/delivery-performance"
}

## Quick Frontend Notes
- Use trend array directly for chart plotting.
- Use start_date and end_date for chart title/subtitle.
- Always treat returned dates as UTC dates.
- For fixed monthly charts, send both performance_range=monthly and month.
