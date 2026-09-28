# Merchant Clearance List API

### API Name

Get Merchant Clearance List

### Method + Endpoint

```http
GET /admin/merchants/clearance-list
```

### Authentication

```http
Authorization: Bearer <admin-token>
```

Role:

`ADMIN`

### Query Parameters

- `page`: Positive integer, optional. Default: `1`.
- `limit`: Positive integer, optional. Default: `10`.
- `merchant_id`: Merchant UUID, optional.
- `search`: Merchant name or phone, optional.

Example:

```http
GET /admin/merchants/clearance-list?page=1&limit=10&search=Sifat
```

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchant_id": "merchant-uuid",
        "merchant_name": "Sifat",
        "phone_number": "01538386793",
        "total_parcels": 85,
        "total_delivered": 64,
        "total_returned": 21,
        "total_collected_amount": 6391,
        "total_delivery_charge": 5660,
        "total_return_charge": 130.05,
        "total_due_amount": 600.95
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    },
    "summary": {
      "total_parcels": 85,
      "total_delivered": 64,
      "total_returned": 21,
      "total_collected_amount": 6391,
      "total_delivery_charge": 5660,
      "total_return_charge": 130.05,
      "total_due_amount": 600.95
    }
  },
  "message": "Merchant clearance list retrieved successfully"
}
```

### Empty Success Response

```json
{
  "success": true,
  "data": {
    "merchants": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    },
    "summary": {
      "total_parcels": 0,
      "total_delivered": 0,
      "total_returned": 0,
      "total_collected_amount": 0,
      "total_delivery_charge": 0,
      "total_return_charge": 0,
      "total_due_amount": 0
    }
  },
  "message": "Merchant clearance list retrieved successfully"
}
```

### Error Response

Unauthorized (`401 Unauthorized`):

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "timestamp": "2026-09-23T00:00:00.000Z",
  "path": "/admin/merchants/clearance-list"
}
```

### Business Rules

- Only parcels whose lifecycle is complete are included.
- Only parcels with `paid_to_merchant = false` are included.
- The allowed final parcel statuses are:
  - `DELIVERED` — Delivered
  - `RETURNED` — Return
  - `PAID_RETURN` — Paid Return
  - `PARTIAL_DELIVERY` — Partial Delivered
  - `EXCHANGE` — Exchanged
  - `RETURN_TO_MERCHANT` — Returned to Merchant
- Parcels in any other status are excluded from merchant rows and summary
  totals.
- `total_delivered` counts `DELIVERED`, `PARTIAL_DELIVERY`, and `EXCHANGE`.
- `total_returned` counts `RETURNED`, `PAID_RETURN`, and
  `RETURN_TO_MERCHANT`.
- `total_due_amount` is calculated as:
  `total_collected_amount - total_delivery_charge - total_return_charge`.
- Summary values are calculated from all matching merchants before pagination.
- Merchants without an unpaid parcel in one of the allowed final statuses are
  not returned.
