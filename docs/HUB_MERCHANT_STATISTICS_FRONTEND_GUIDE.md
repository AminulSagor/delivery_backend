# Hub merchant statistics frontend guide

No frontend code was changed. Use the existing hub-manager bearer token.

## Merchant management page

```http
GET /hubs/merchants/performance?page=1&limit=20&search=sifat
```

Optional history filters:

```http
GET /hubs/merchants/performance?start_date=2026-09-01&end_date=2026-09-12&page=1&limit=20
```

Use these response fields for the top cards and table:

```json
{
  "summary": {
    "total_merchants": 2,
    "active_merchants": 2,
    "total_stores": 3,
    "total_parcels": 120,
    "delivered_parcels": 80,
    "returned_parcels": 10,
    "total_transactions": 45000,
    "total_platform_charge": 7200,
    "top_merchant": {
      "merchant_id": "uuid",
      "business_name": "Booklet Design BD",
      "successful_parcels": 46,
      "total_parcels": 60,
      "total_transactions": 25000,
      "platform_charge": 3900
    }
  },
  "merchants": [],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

The endpoint includes merchants that currently have zero parcels. Bind the
cards to `total_merchants`, `top_merchant`, and either `active_merchants` or
`total_platform_charge`; do not display the same total-merchant card twice.

## Merchant detail parcel-flow graph

Existing presets:

```http
GET /merchants/:merchantId/overview?range=last7d
GET /merchants/:merchantId/overview?range=month&month=2026-09
```

Custom inclusive date range:

```http
GET /merchants/:merchantId/overview?start_date=2026-09-01&end_date=2026-09-12
```

Use `parcel_flow_totals` for the three requested totals:

```json
{
  "parcel_flow_totals": {
    "received_count": 35,
    "received_value": 75000,
    "platform_charge": 6500,
    "currency": "BDT"
  },
  "graph": [
    {
      "bucket": "2026-09-12",
      "received_count": 5,
      "received_value": 12000,
      "platform_charge": 900
    }
  ]
}
```

- `received_count`: parcels received in the selected period.
- `received_value`: sum of received parcel product values.
- `platform_charge`: applicable delivery/return charges only after hub
  confirmation. Legacy already-completed parcels are included for historical
  compatibility.

All date buckets and boundaries use `Asia/Dhaka`.
