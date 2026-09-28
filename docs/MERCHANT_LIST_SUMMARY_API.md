# Merchant List Summary API

### API Name

Get Merchant List with Global Summary

### Method + Endpoint

```http
GET /merchants
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
- `status`: Merchant status, optional.
- `district`: District filter, optional.
- `search`: Merchant name, phone, email, or store name, optional.

Example:

```http
GET /merchants?page=1&limit=10&status=APPROVED&district=Dhaka
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
        "id": "merchant-uuid",
        "full_name": "Booklet Design BD",
        "phone": "01800000000",
        "email": "merchant@example.com",
        "thana": "Dhanmondi",
        "district": "Dhaka",
        "status": "APPROVED",
        "created_at": "2026-09-23T00:00:00.000Z",
        "total_parcels": 900,
        "total_parcels_delivered": 746,
        "total_parcels_returned": 20,
        "collected_amount": 1187,
        "delivery_charge": 660,
        "total_paid": 1000,
        "is_advance_payment_disabled": false,
        "action": null
      }
    ],
    "pagination": {
      "total": 365,
      "page": 1,
      "limit": 10
    },
    "summary": {
      "total_merchants": 365,
      "top_merchant": {
        "id": "merchant-uuid",
        "full_name": "Booklet Design BD",
        "successful_parcels": 746
      },
      "top_merchant_transaction": 1187,
      "currency": "BDT"
    }
  },
  "message": "Merchants retrieved successfully",
  "timestamp": "2026-09-23T00:00:00.000Z"
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
      "limit": 10
    },
    "summary": {
      "total_merchants": 0,
      "top_merchant": null,
      "top_merchant_transaction": 0,
      "currency": "BDT"
    }
  },
  "message": "Merchants retrieved successfully",
  "timestamp": "2026-09-23T00:00:00.000Z"
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
  "path": "/merchants"
}
```

### Business Rules

- The `merchants` array remains paginated.
- The `summary` object is calculated from every merchant matching the supplied
  `status`, `district`, and `search` filters, not only the current page.
- `summary.total_merchants` is the total number of filtered merchants.
- The top merchant is the filtered merchant with the highest number of
  successful parcels.
- Successful parcels use the same statuses as the merchant list:
  `DELIVERED`, `PARTIAL_DELIVERY`, `EXCHANGE`, and `PAID_RETURN`.
- If successful parcel counts are tied, the merchant with the higher collected
  amount is selected.
- `summary.top_merchant_transaction` is the selected top merchant's total
  collected COD amount.
- Monetary values use BDT.
- Pagination changes only the `merchants` array; it does not change the
  summary values for the same filters.
