# Merchant Balance and Bulk Parcel Import API

Date: 2026-07-19

This guide documents the merchant dashboard contracts for the available-balance card and CSV/XLSX parcel import.

Auth: both endpoints require a JWT bearer token with role `MERCHANT`.

## Merchant Available Balance

Method: `GET`

Path: `/auth/me`

Merchant responses now include:

```json
{
  "success": true,
  "data": {
    "user_id": "merchant-user-uuid",
    "role": "MERCHANT",
    "merchant_id": "merchant-profile-uuid",
    "check_balance": 1250.5
  }
}
```

`check_balance` is the merchant's current withdrawable balance:

`max(0, current_balance - hold_amount)`

The value is returned as a number rounded to two decimal places. The field is only added for merchant users; other `/auth/me` role responses are unchanged.

## Upload and Create Parcels

Method: `POST`

Path: `/parcels/bulk-import`

Content type: `multipart/form-data`

Limits:

- Accepted files: `.csv` and `.xlsx`
- File form field: `file`
- Maximum file size: 5 MB
- Maximum parcel rows per upload: 1,000
- For XLSX files, the first worksheet is imported

Optional form fields applied as defaults to every row:

| Field | Description |
| --- | --- |
| `store_id` | Merchant store UUID; a row-level `store_id` overrides it |
| `delivery_area` | Merchant pickup address; a row-level value overrides it |

If a row has `store_id` but no `delivery_area`, the backend uses that store's `business_address`. Store ownership and approval are still validated by the normal parcel-creation flow.

Example request:

```bash
curl -X POST "https://api.example.com/parcels/bulk-import" \
  -H "Authorization: Bearer <MERCHANT_TOKEN>" \
  -F "file=@parcels.xlsx" \
  -F "store_id=3f9a6865-18df-44bd-9088-7fc15d4df18c"
```

## Spreadsheet Columns

The header is the first non-empty row. Header matching is case-insensitive and accepts spaces or underscores.

| Canonical column | Required | Description |
| --- | --- | --- |
| `customer_name` | Yes | Recipient name |
| `customer_phone` | Yes | Bangladesh phone number in `01XXXXXXXXX` format |
| `customer_address` | Yes | Full recipient address; include area, zone, and city for reliable matching |
| `delivery_area` | Conditional | Merchant pickup address; may come from the request default or store |
| `store_id` | No | Merchant store UUID |
| `delivery_coverage_area_id` | No | Exact coverage-area UUID; when absent, the backend resolves it from `customer_address` |
| `merchant_order_id` | No | Merchant's order/reference ID |
| `customer_secondary_phone` | No | Alternate Bangladesh phone number |
| `product_description` | No | Product or parcel description |
| `product_price` | No | COD/product amount; defaults to `0` |
| `product_weight` | No | Weight in kilograms; defaults to `0` |
| `parcel_type` | No | `1`/`Parcel`, `2`/`Book`, or `3`/`Document` |
| `delivery_type` | No | `1`/`Normal`, `2`/`Express`, or `3`/`Same Day` |
| `is_exchange` | No | `TRUE`/`FALSE`, `YES`/`NO`, or `1`/`0` |
| `special_instructions` | No | Delivery note |

The parser also accepts common aliases such as `name`, `phone`, `delivery_address`, `pickup_address`, `order_id`, `price`, `cod_amount`, `weight`, `description`, and `notes`.

Example CSV:

```csv
merchant_order_id,customer_name,customer_phone,customer_address,product_description,product_price,product_weight,parcel_type,delivery_type,special_instructions
ORDER-1001,Jane Doe,01712345678,"House 1, Mirpur 10, Dhaka",Shoes,1250,1.5,Parcel,Express,Call before delivery
ORDER-1002,John Doe,01812345678,"Uttara Sector 7, Dhaka",Documents,0,0.5,Document,Normal,
```

`product_price > 0` follows the existing parcel rule and creates a COD parcel. Numeric commas and common `BDT`, `Tk`, or `৳` prefixes are accepted.

## Import Response

Successful and failed rows can exist in the same response. A bad row does not roll back parcels created from other valid rows.

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 1,
      "failed": 1
    },
    "results": [
      {
        "row_number": 2,
        "merchant_order_id": "ORDER-1001",
        "success": true,
        "tracking": "TRK123456"
      },
      {
        "row_number": 3,
        "merchant_order_id": "ORDER-1002",
        "success": false,
        "error": "Processing Error: No suitable coverage area found from customer address."
      }
    ]
  },
  "message": "Bulk import completed with row-level results.",
  "timestamp": "2026-07-19T10:00:00.000Z"
}
```

`row_number` is the original CSV/XLSX row number, including the header row. The endpoint returns HTTP `201` after processing even when some individual rows fail, so the dashboard should show `data.summary` and the row-level `data.results` instead of treating HTTP success as proof that every row was created.

Every successful row uses the existing parcel creation logic. This preserves merchant/store authorization, approved-store checks, customer validation, coverage validation, pricing, tracking-number generation, pickup-request linkage, and any configured Carrybee auto-assignment.
