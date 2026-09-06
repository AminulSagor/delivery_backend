# Bulk Order with Frontend Barikoi — Frontend Integration Guide

This flow is for the merchant **Bulk Order** table. The frontend parses CSV/XLSX files and calls Barikoi. The backend does not read the file and does not call Barikoi in this flow.

The backend uses the same address-matching algorithm as the existing single-address endpoint:

```http
POST /coverage/address/suggest
```

## Complete flow

1. Frontend reads the CSV/XLSX file and creates table rows.
2. Frontend calls Barikoi for each recipient address.
3. Frontend sends all parcel rows and their Barikoi data to `POST /parcels/bulk-suggest`.
4. Backend validates each row, applies the single-address matching algorithm and calculates charges.
5. Frontend displays and corrects rows requiring attention.
6. Frontend sends confirmed rows to `POST /parcels/bulk-create`.

Both parcel endpoints require a merchant JWT:

```http
Authorization: Bearer <merchant_access_token>
Content-Type: application/json
```

The maximum batch size is 1,000 rows.

## Step 1: Build each frontend row

Every table row should have a stable string `row_id`. It is returned unchanged so results can be mapped back to the correct frontend row.

### Parcel fields

| Field                      | Required            | Description                                                                                        |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `row_id`                   | Recommended         | Stable frontend row identifier, such as `"row-1"`                                                  |
| `store_id`                 | Required by this UI | UUID from `GET /stores`; store must belong to the merchant and be active                           |
| `customer_name`            | Yes                 | Recipient name                                                                                     |
| `customer_phone`           | Yes                 | Bangladesh number in `01XXXXXXXXX` format                                                          |
| `customer_secondary_phone` | No                  | Optional secondary number                                                                          |
| `customer_address`         | Yes                 | Original raw recipient address                                                                     |
| `delivery_area`            | Conditional         | Merchant pickup address; may be omitted when `store_id` identifies a store with a business address |
| `merchant_order_id`        | No                  | Merchant’s order/reference ID                                                                      |
| `product_description`      | No                  | Parcel description                                                                                 |
| `product_price_raw`        | Yes                 | Collect amount as a string, for example `"1000"` or `"0"`                                          |
| `product_weight_raw`       | Yes                 | Weight in kilograms as a string, for example `"0.5"`                                               |
| `parcel_type_raw`          | No                  | `"1"` Parcel, `"2"` Book, `"3"` Document                                                           |
| `delivery_type_raw`        | No                  | `"1"` Normal, `"2"` Express, `"3"` Same Day                                                        |
| `is_exchange_raw`          | No                  | `"TRUE"` or `"FALSE"`                                                                              |
| `special_instructions`     | No                  | Delivery instructions                                                                              |

A positive `product_price_raw` is automatically treated as COD. The backend does not rely on a frontend COD flag to calculate the final charge.

### Barikoi fields

Send the same fields used by the single suggestion API for every row:

| Field           | Required | Description                                                                |
| --------------- | -------- | -------------------------------------------------------------------------- |
| `address`       | No       | Raw address sent to Barikoi; when omitted, backend uses `customer_address` |
| `fixedAddress`  | No       | Barikoi-corrected address                                                  |
| `addressStatus` | No       | Barikoi address status, such as `complete` or `incomplete`                 |
| `confidence`    | No       | Barikoi confidence on its original scale, such as `75`                     |
| `barikoiScore`  | No       | Barikoi score                                                              |
| `city`          | No       | Barikoi city                                                               |
| `area`          | No       | Barikoi area                                                               |
| `subArea`       | No       | Barikoi sub-area                                                           |
| `thana`         | No       | Barikoi thana                                                              |

The backend always evaluates the raw address. Barikoi structured fields are considered reliable when:

- `fixedAddress` is present;
- `addressStatus` is not `incomplete`;
- `confidence >= 60`; and
- `barikoiScore > 0`.

Low-confidence or incomplete Barikoi data therefore falls back to the raw-address matching behavior used by the single suggestion API.

## Step 2: Validate and suggest the batch

```http
POST /parcels/bulk-suggest
```

Request:

```json
{
  "items": [
    {
      "row_id": "row-1",
      "store_id": "9709e313-9cf0-4d02-a217-c040283e86bf",
      "customer_name": "Rahim Uddin",
      "customer_phone": "01712345678",
      "customer_address": "House 10, Road 7, Sector 7, Uttara, Dhaka",
      "address": "House 10, Road 7, Sector 7, Uttara, Dhaka",
      "fixedAddress": "House 10, Road 7, Uttara Sector 7, Dhaka",
      "addressStatus": "complete",
      "confidence": 82,
      "barikoiScore": 1,
      "city": "Dhaka",
      "area": "Uttara",
      "subArea": "Sector 7",
      "thana": "Uttara",
      "merchant_order_id": "ORDER-1001",
      "product_description": "Shoes",
      "product_price_raw": "1000",
      "product_weight_raw": "1",
      "parcel_type_raw": "1",
      "delivery_type_raw": "1",
      "is_exchange_raw": "FALSE"
    }
  ]
}
```

Successful HTTP response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1,
      "success": 1,
      "resolved": 0,
      "failed": 0
    },
    "results": [
      {
        "original_row": {
          "row_id": "row-1",
          "customer_address": "House 10, Road 7, Sector 7, Uttara, Dhaka"
        },
        "row_id": "row-1",
        "status": "SUCCESS",
        "suggested_area_id": "91b49d21-5fa2-4140-9d9f-4efefdef3ba1",
        "suggested_division": "Dhaka",
        "suggested_city": "Dhaka",
        "suggested_city_id": 1,
        "suggested_zone": "Uttara",
        "suggested_zone_id": 10,
        "suggested_area": "Sector 7",
        "suggested_carrybee_area_id": 100,
        "coverage_area_uuid": "91b49d21-5fa2-4140-9d9f-4efefdef3ba1",
        "inside_dhaka_flag": true,
        "match_level": "AREA",
        "confidence": 1,
        "delivery_charge": 60,
        "weight_charge": 10,
        "cod_charge": 10,
        "discount": 5,
        "total_charge": 75,
        "receivable_amount": 925
      }
    ]
  },
  "message": "Address and pricing suggestions generated successfully.",
  "timestamp": "2026-09-05T15:00:00.000Z"
}
```

Important ID mapping:

- `coverage_area_uuid`: UUID required for parcel creation.
- `suggested_area_id`: backward-compatible alias of `coverage_area_uuid`.
- `suggested_city_id`: numeric Carrybee city ID.
- `suggested_zone_id`: numeric Carrybee zone ID.
- `suggested_carrybee_area_id`: numeric Carrybee area ID.

The response `confidence` is the backend matcher’s normalized value from `0` to `1`. It is different from the Barikoi input confidence scale.

### Row statuses

#### `SUCCESS`

The backend found an exact area UUID and calculated all charges. The row can be confirmed.

#### `RESOLVED`

The backend found only a city or zone, but not a final area UUID. For example:

```json
{
  "row_id": "row-2",
  "status": "RESOLVED",
  "match_level": "ZONE",
  "suggested_city": "Dhaka",
  "suggested_zone": "Uttara",
  "suggested_area": null,
  "coverage_area_uuid": null,
  "error": "Address matched only to ZONE. Select a recipient area before confirming."
}
```

The frontend must let the merchant select the missing area. Then add its UUID as `delivery_coverage_area_id` and call `POST /parcels/bulk-suggest` again for that row to calculate charges.

#### `FAILED`

The row has invalid parcel/store data, invalid numeric values, or no usable address match. Display `error` beside the row and prevent confirmation until corrected.

HTTP `200` means the batch was processed; it does not mean every row succeeded. Always inspect `data.summary` and each result’s `status`.

## Manual location correction APIs

```http
GET /coverage/cities
GET /coverage/cities/:cityId/zones
GET /coverage/zones/:zoneId/areas
```

Area response example:

```json
{
  "success": true,
  "data": {
    "areas": [
      {
        "area": "Sector 7",
        "area_id": 100,
        "id": "91b49d21-5fa2-4140-9d9f-4efefdef3ba1"
      }
    ]
  },
  "timestamp": "2026-09-05T15:00:00.000Z"
}
```

Use `id` as `delivery_coverage_area_id`. Do not use the numeric `area_id` for parcel creation.

## Step 3: Confirm and create parcels

```http
POST /parcels/bulk-create
```

Send only rows that have a selected `delivery_coverage_area_id`. Use the UUID returned by `coverage_area_uuid`/`suggested_area_id`, or the UUID selected manually from the areas API.

Request:

```json
{
  "items": [
    {
      "row_id": "row-1",
      "store_id": "9709e313-9cf0-4d02-a217-c040283e86bf",
      "delivery_coverage_area_id": "91b49d21-5fa2-4140-9d9f-4efefdef3ba1",
      "customer_name": "Rahim Uddin",
      "customer_phone": "01712345678",
      "customer_address": "House 10, Road 7, Sector 7, Uttara, Dhaka",
      "merchant_order_id": "ORDER-1001",
      "product_description": "Shoes",
      "product_price_raw": "1000",
      "product_weight_raw": "1",
      "parcel_type_raw": "1",
      "delivery_type_raw": "1",
      "is_exchange_raw": "FALSE"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1,
      "success": 1,
      "failed": 0
    },
    "results": [
      {
        "success": true,
        "row_id": "row-1",
        "tracking": "TRK-20260905-ABCDE"
      }
    ]
  },
  "message": "Batch parcels created successfully.",
  "timestamp": "2026-09-05T15:01:00.000Z"
}
```

Creation is row-based. One failed row does not roll back successfully created rows. Always inspect `data.summary` and `data.results`.

The backend revalidates store ownership, active status and coverage area, and recalculates charges during creation. Do not send or trust frontend-calculated charge fields.

## Frontend TypeScript outline

```ts
type BulkSuggestionStatus = 'SUCCESS' | 'RESOLVED' | 'FAILED';

async function suggestBulkOrders(items: BulkOrderItem[]) {
  const response = await api.post('/parcels/bulk-suggest', { items });
  return response.data.data;
}

async function createBulkOrders(items: BulkOrderItem[]) {
  const response = await api.post('/parcels/bulk-create', { items });
  return response.data.data;
}

function applySuggestionResults(rows: BulkOrderItem[], results: BulkResult[]) {
  const resultByRowId = new Map(
    results.map((result) => [result.row_id, result]),
  );

  return rows.map((row) => ({
    ...row,
    suggestion: resultByRowId.get(row.row_id),
  }));
}
```

Recommended UI behavior:

1. Keep `row_id` unchanged from file parsing until creation finishes.
2. Disable **Confirm Orders** while suggestion or creation is running.
3. Enable confirmation only for rows with `status === "SUCCESS"` and a `coverage_area_uuid`.
4. Highlight `RESOLVED` rows for manual area selection.
5. Highlight `FAILED` rows and display their `error`.
6. After creation, show the tracking number or row-level creation error.
7. Prevent double submission while a creation request is pending.

## Compatibility

- Existing routes are unchanged.
- Existing bulk parcel fields remain supported.
- `suggested_area_id` remains available.
- Barikoi fields, `row_id`, detailed location fields, detailed charges and the suggestion summary are additive.
- No database migration is required.
