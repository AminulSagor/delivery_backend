# Merchant Delivery Performance API

Date: 2026-07-19

This endpoint supplies the merchant dashboard Delivery Performance chart shown in the design. It supports a rolling seven-day view and a selected-month view.

## Endpoint

Method: `GET`

Path: `/merchants/dashboard/delivery-performance`

Auth: bearer token with role `MERCHANT`.

The merchant ID always comes from the authenticated JWT. A merchant cannot request another merchant's performance.

## Query Parameters

| Parameter           | Required | Values                                    | Description                                      |
| ------------------- | -------- | ----------------------------------------- | ------------------------------------------------ |
| `performance_range` | No       | `weekly`, `monthly`                       | Defaults to `weekly`                             |
| `month`             | No       | `YYYY-MM` or a month name such as `April` | Monthly mode only; selects a full calendar month |

Examples:

```http
GET /merchants/dashboard/delivery-performance?performance_range=weekly
Authorization: Bearer <MERCHANT_TOKEN>
```

```http
GET /merchants/dashboard/delivery-performance?performance_range=monthly&month=2026-04
Authorization: Bearer <MERCHANT_TOKEN>
```

Passing `month` with `performance_range=weekly` returns HTTP `400`.
A month name uses the current UTC year. When monthly mode omits `month`, the existing rolling 30-day behavior is retained.

## Monthly Response

Monthly chart buckets follow the four labels in the design:

- `Wk 1`: days 1-7
- `Wk 2`: days 8-14
- `Wk 3`: days 15-21
- `Wk 4`: day 22 through the end of the month

```json
{
  "success": true,
  "data": {
    "range": "monthly",
    "start_date": "2026-04-01",
    "end_date": "2026-04-30",
    "totals": {
      "delivered": 798,
      "returned": 207,
      "total_parcel": 1005
    },
    "chart": {
      "bucket_type": "week",
      "categories": ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
      "series": [
        {
          "key": "delivered",
          "name": "Delivered",
          "data": [180, 200, 198, 220]
        },
        {
          "key": "returned",
          "name": "Returned",
          "data": [40, 60, 47, 60]
        },
        {
          "key": "total_parcel",
          "name": "Total Parcel",
          "data": [220, 260, 245, 280]
        }
      ],
      "buckets": [
        {
          "key": "week_3",
          "label": "Wk 3",
          "start_date": "2026-04-15",
          "end_date": "2026-04-21",
          "delivered": 198,
          "returned": 47,
          "total_parcel": 245
        }
      ]
    },
    "trend": [
      {
        "day": "Wed",
        "date": "2026-04-01",
        "delivered": 0,
        "returned": 0,
        "total_parcel": 0
      }
    ]
  },
  "message": "Merchant delivery performance retrieved successfully"
}
```

The example abbreviates `chart.buckets` and the existing daily `trend` array. The real response contains all four buckets and every day in the requested range. Existing `range`, `start_date`, `end_date`, `totals`, and `trend` fields remain available for backward compatibility.

## Weekly Response

The weekly view returns the last seven UTC calendar days, including today. `chart.bucket_type` is `day`; `chart.categories` contains weekday labels such as `Mon`, `Tue`, and `Wed`; and each `chart.buckets` item contains its exact `start_date` and `end_date`.

## Counting Rules

- `Delivered`: parcels currently in `DELIVERED`, `PARTIAL_DELIVERY`, or `EXCHANGE`.
- `Returned`: parcels currently in `RETURNED`, `PAID_RETURN`, `RETURN_TO_MERCHANT`, or `RETURNED_TO_HUB`.
- `Total Parcel`: all merchant parcels created inside that bucket, regardless of their current status.
- Empty days and weeks are returned with zero values so the chart axes remain stable.
- All date boundaries use UTC.

## Frontend Mapping

For chart libraries that accept categories and series directly, use:

- X-axis: `data.chart.categories`
- Bar series: `data.chart.series`
- Tooltip details: the matching item in `data.chart.buckets`
- Month selector: send `performance_range=monthly&month=YYYY-MM`
- Weekly button: send `performance_range=weekly` and omit `month`
