# Admin Merchant Parcels API

### API Name

Get Parcels for a Merchant

### Method + Endpoint

```http
GET /admin/parcels?merchantId=:merchantId
```

### Authentication

```http
Authorization: Bearer <admin-token>
```

Role:

`ADMIN`

### Query Parameters

- `merchantId`: Merchant UUID, required for the merchant-details page.
- `page`: Positive integer, optional. Default: `1`.
- `limit`: Positive integer from `1` to `100`, optional. Default: `20`.
- `search`: Optional search text.
- `status`: Optional parcel status or `ACTIVE`.
- `storeId`: Optional store UUID.
- `hubId`: Optional hub UUID.
- `customerName`: Optional customer-name filter.
- `customerPhone`: Optional customer-phone filter.
- `merchantName`: Optional merchant-name filter.
- `minAmount`: Optional minimum amount.
- `maxAmount`: Optional maximum amount.
- `deliveryType`: Optional delivery-type filter.
- `sortBy`: Optional sorting field. Default: `created_at`.
- `order`: `ASC` or `DESC`, optional. Default: `DESC`.

Supported `sortBy` values:

- `created_at`
- `updated_at`
- `tracking_number`
- `parcel_tx_id`
- `customer_name`
- `merchant_name`
- `status`
- `cod_amount`
- `total_charge`

Example:

```http
GET /admin/parcels?merchantId=merchant-uuid&page=1&limit=20&search=139679&sortBy=created_at&order=DESC
```

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "parcel-uuid",
        "merchant_id": "merchant-uuid",
        "store_id": "store-uuid",
        "parcel_tx_id": "#139679",
        "tracking_number": "MF120526DHV4",
        "merchant_order_id": "ORDER-1001",
        "customer_name": "Farzana Rahman",
        "customer_phone": "+880123456789",
        "customer_secondary_phone": null,
        "customer_address": "Plot 142, Safwan Road, Bashundhara, Dhaka",
        "status": "DELIVERED",
        "delivered_at": "2026-09-23T08:35:00.000Z",
        "delivery_area_text": "Dhaka, Dhanmondi",
        "delivery_area": {
          "id": "coverage-area-uuid",
          "division": "Dhaka",
          "city": "Dhaka",
          "city_id": 1,
          "zone": "Dhanmondi",
          "zone_id": 10,
          "area": "Area 01",
          "area_id": 100
        },
        "assigned_rider_id": "rider-uuid",
        "assigned_rider": {
          "id": "rider-uuid",
          "full_name": "Ahmed Wasi",
          "phone": "+8801234567890",
          "photo": "https://example.com/rider.jpg"
        },
        "store": {
          "id": "store-uuid",
          "store_code": "FUL001",
          "business_name": "Fulkoli Book Store",
          "business_address": "Dhaka",
          "phone_number": "01700000000",
          "status": "APPROVED"
        },
        "total_charge": 1187,
        "delivery_charge": 125,
        "cod_charge": 12,
        "weight_charge": 50,
        "discount": 0,
        "cod_amount": 1000,
        "age": 2,
        "age_days": 2,
        "created_at": "2026-09-21T08:35:00.000Z",
        "updated_at": "2026-09-23T08:35:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "All parcels retrieved successfully"
}
```

### Empty Success Response

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
    }
  },
  "message": "All parcels retrieved successfully"
}
```

### Error Responses

Invalid merchant ID (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Invalid merchant ID"],
  "timestamp": "2026-09-23T00:00:00.000Z",
  "path": "/admin/parcels?merchantId=invalid-id"
}
```

Unauthorized (`401 Unauthorized`):

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "timestamp": "2026-09-23T00:00:00.000Z",
  "path": "/admin/parcels"
}
```

### Business Rules

- `merchantId` limits the result to parcels belonging to that merchant.
- The endpoint is restricted to administrators.
- Results are paginated and default to newest parcels first.
- Search matches parcel UUID, tracking number, parcel display ID, merchant order
  ID, customer name, customer phone, merchant name, store name, delivery-area
  text, city, zone, and area.
- `status=ACTIVE` includes parcels in `PENDING`, `PICKED_UP`, `IN_TRANSIT`,
  `IN_HUB`, `ASSIGNED_TO_RIDER`, `OUT_FOR_DELIVERY`, and
  `DELIVERY_RESCHEDULED` states.
- `age` is calculated from the parcel received date when available; otherwise,
  it uses the creation date.
- `age_days` is calculated from the creation date.
- `discount` is calculated as the non-negative difference between the sum of
  delivery, weight, and COD charges and `total_charge`.
- Related store, delivery area, assigned rider, merchant, customer, hub, and
  third-party provider information is returned when available.

### Table Field Mapping

- Parcel ID: `parcel_tx_id`, with `tracking_number` as fallback.
- Customer info: `customer_name`, `customer_phone`, `customer_address`.
- Delivery area: `delivery_area.city`, `delivery_area.zone`,
  `delivery_area.area`.
- Status: `status`; use the relevant status timestamp such as `delivered_at`,
  or fall back to `updated_at`.
- Assigned rider: `assigned_rider.full_name`, `assigned_rider.phone`,
  `assigned_rider.photo`.
- Store: `store.business_name`.
- Amount: `total_charge`, `delivery_charge`, `cod_charge`, `weight_charge`,
  `discount`.
- Age: `age`.
- Created and last updated: `created_at`, `updated_at`.
