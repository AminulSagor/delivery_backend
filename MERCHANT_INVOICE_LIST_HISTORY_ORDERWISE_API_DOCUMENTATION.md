# Merchant Invoice List, Payment History, and Order-wise API Documentation

## Base URL

`{{baseUrl}}`

## Authentication

- `Authorization: Bearer <accessToken>` is required for all endpoints in this document.
- Allowed roles:
  - Merchant
  - Admin

---

## 1) Payment History

### Endpoint

`GET /merchant-invoices/payment-history`

### Purpose

Returns invoice payment history for a merchant with pagination and status/date filtering.

### Query Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | UUID | Admin: Yes, Merchant: No | Target merchant user id. Merchant role is auto-scoped to own id. |
| `page` | number | No | Default: `1` |
| `limit` | number | No | Default: `10` |
| `status` | enum | No | `PAID`, `UNPAID`, `PROCESSING` |
| `from_date` | date (ISO) | No | Start date filter |
| `to_date` | date (ISO) | No | End date filter |

### Request Variants

#### Merchant token (self history)

```http
GET {{baseUrl}}/merchant-invoices/payment-history?page=1&limit=10&status=PAID&from_date=2025-01-01&to_date=2025-12-31
Authorization: Bearer {{merchantAccessToken}}
```

#### Admin token (specific merchant)

```http
GET {{baseUrl}}/merchant-invoices/payment-history?merchant_id=3cd043c7-2b98-4ca0-b34b-4f59e0bbcabd&page=1&limit=10&status=PAID&from_date=2025-01-01&to_date=2025-12-31
Authorization: Bearer {{adminAccessToken}}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "invoice_id": "6a5aab74-22e2-4d8d-a71f-1e6f1e2f0c31",
        "invoice_no": "MI090426A1B2",
        "transaction_id": "TXN-MB1C3D-8QW9ER",
        "date": "2025-07-14T10:12:44.000Z",
        "total_parcels": 18,
        "total_cod_collected": 128500,
        "total_delivery_charges": 6400,
        "total_return_charges": 850,
        "payable_amount": 121250,
        "status": "PAID",
        "paid_at": "2025-07-16T13:25:10.000Z",
        "payment_reference": "BANK-TRX-998877",
        "payment_method": {
          "type": "BANK_ACCOUNT",
          "details": {
            "bank_name": "Dutch-Bangla Bank",
            "branch_name": "Banani",
            "account_holder_name": "Merchant ABC",
            "account_number": "1234567890",
            "routing_number": "090260123"
          }
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "total_pages": 1
    },
    "summary": {
      "total_paid": 121250,
      "total_pending": 0,
      "total_processing": 0
    }
  },
  "message": "Merchant payment history retrieved successfully"
}
```

### Error Responses

#### Admin call without `merchant_id` (controller-level business validation)

```json
{
  "success": false,
  "message": "Merchant ID is required"
}
```

#### Invalid query values (ValidationPipe)

```json
{
  "statusCode": 400,
  "message": [
    "from_date must be a valid ISO 8601 date string",
    "status must be a string"
  ],
  "error": "Bad Request"
}
```

#### Unauthorized / Forbidden

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 2) Invoice List

### Endpoint

`GET /merchant-invoices`

### Purpose

Returns paginated invoice list with financial breakdown per invoice.

### Query Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | UUID | Admin: No, Merchant: No | Optional admin filter. Merchant role auto-scopes to own id. |
| `invoice_status` | enum | No | `UNPAID`, `PROCESSING`, `PAID` |
| `fromDate` | date (ISO) | No | Inclusive start date on invoice `created_at` |
| `toDate` | date (ISO) | No | Inclusive end date on invoice `created_at` |
| `page` | number | No | Default: `1` |
| `limit` | number | No | Default: `10` |

### Request Variants

#### Merchant token

```http
GET {{baseUrl}}/merchant-invoices?page=1&limit=10&invoice_status=PAID&fromDate=2025-01-01&toDate=2025-12-31
Authorization: Bearer {{merchantAccessToken}}
```

#### Admin token (single merchant)

```http
GET {{baseUrl}}/merchant-invoices?merchant_id=3cd043c7-2b98-4ca0-b34b-4f59e0bbcabd&page=1&limit=10&invoice_status=PAID&fromDate=2025-01-01&toDate=2025-12-31
Authorization: Bearer {{adminAccessToken}}
```

#### Admin token (all merchants)

```http
GET {{baseUrl}}/merchant-invoices?page=1&limit=20&invoice_status=UNPAID
Authorization: Bearer {{adminAccessToken}}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "6a5aab74-22e2-4d8d-a71f-1e6f1e2f0c31",
        "invoice_no": "MI090426A1B2",
        "merchant_name": "Merchant ABC",
        "merchant_phone": "01700000000",
        "total_parcels": 18,
        "financial_breakdown": {
          "collectable_amount": 130000,
          "collected_amount": 128500,
          "charges": {
            "delivery_charge": 5200,
            "cod_charge": 900,
            "weight_charge": 300,
            "return_charge": 850,
            "discount": 0,
            "total_charges": 7250
          }
        },
        "payable_amount": 121250,
        "payment_method": {
          "id": "dbd1f62d-a9f0-4ae0-9624-bfa5dc5ce8f1",
          "method_type": "BANK_ACCOUNT"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Invoices retrieved successfully"
}
```

### Error Responses

#### Invalid query values (ValidationPipe)

```json
{
  "statusCode": 400,
  "message": [
    "invoice_status must be one of the following values: UNPAID, PROCESSING, PAID",
    "fromDate must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

#### Unauthorized / Forbidden

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 3) Order-wise Invoices

### Endpoint

`GET /merchant-invoices/orderwise`

### Purpose

Returns parcel-level order rows linked to invoices, so each row contains both invoice context and order/financial details.

### Query Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | UUID | Admin: No, Merchant: No | Optional admin filter. Merchant role auto-scopes to own id. |
| `invoice_status` | enum | No | `UNPAID`, `PROCESSING`, `PAID` |
| `order_status` | enum | No | Any valid parcel status (for example `DELIVERED`, `RETURNED`) |
| `from_date` / `fromDate` | date (ISO) | No | Start date filter on parcel `created_at` |
| `to_date` / `toDate` | date (ISO) | No | End date filter on parcel `created_at` |
| `search` | string | No | Searches tracking, parcel tx id, merchant order id, customer phone, invoice no |
| `sort_by` | enum | No | `order_date`, `receivable_amount` |
| `sort_order` | enum | No | `ASC`, `DESC` |
| `page` | number | No | Default: `1` |
| `limit` | number | No | Default: `10`, max `100` |

### Request Variants

#### Merchant token

```http
GET {{baseUrl}}/merchant-invoices/orderwise?page=1&limit=10&invoice_status=PAID&order_status=DELIVERED&from_date=2025-01-01&to_date=2025-12-31&sort_by=order_date&sort_order=DESC
Authorization: Bearer {{merchantAccessToken}}
```

#### Admin token (single merchant)

```http
GET {{baseUrl}}/merchant-invoices/orderwise?merchant_id=3cd043c7-2b98-4ca0-b34b-4f59e0bbcabd&page=1&limit=10&invoice_status=PAID&search=TRK
Authorization: Bearer {{adminAccessToken}}
```

#### Admin token (all merchants)

```http
GET {{baseUrl}}/merchant-invoices/orderwise?page=1&limit=20&sort_by=receivable_amount&sort_order=DESC
Authorization: Bearer {{adminAccessToken}}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "invoice_info": {
          "invoice_id": "6a5aab74-22e2-4d8d-a71f-1e6f1e2f0c31",
          "invoice_no": "MI090426A1B2",
          "transaction_id": "TXN-MB1C3D-8QW9ER",
          "merchant_id": "3cd043c7-2b98-4ca0-b34b-4f59e0bbcabd",
          "invoice_status": "PAID",
          "invoice_date": "2025-07-14T10:12:44.000Z",
          "paid_at": "2025-07-16T13:25:10.000Z"
        },
        "order_info": {
          "parcel_id": "6f7db1a3-cb59-4fda-a188-2f9f7cd30f48",
          "parcel_tx_id": "#139679",
          "tracking_number": "TRK123456",
          "order_id": "ORD-10021",
          "order_date": "2025-07-12T08:12:20.000Z",
          "order_status": "DELIVERED"
        },
        "customer_info": {
          "name": "Rahim Uddin",
          "phone": "01811112222",
          "address": "Banani, Dhaka"
        },
        "store_info": {
          "store_id": "8794e9b0-7f64-47cb-8c66-2860c6b851f5",
          "store_name": "Main Outlet",
          "store_phone": "01900001111"
        },
        "financial_info": {
          "collectable_amount": 8000,
          "collected_amount": 8000,
          "delivery_fee": 120,
          "cod_fee": 40,
          "weight_charge": 20,
          "total_fee": 180,
          "return_charge": 0,
          "receivable_amount": 7820,
          "currency": "BDT"
        },
        "payment_method": {
          "id": "dbd1f62d-a9f0-4ae0-9624-bfa5dc5ce8f1",
          "method_type": "BANK_ACCOUNT"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    },
    "summary": {
      "total_orders": 1,
      "total_collected_amount": 8000,
      "total_fee": 180,
      "total_return_charge": 0,
      "total_receivable": 7820
    }
  },
  "message": "Order-wise invoices retrieved successfully"
}
```

### Error Responses

#### Invalid query values (ValidationPipe)

```json
{
  "statusCode": 400,
  "message": [
    "sort_by must be one of the following values: order_date, receivable_amount",
    "limit must not be greater than 100"
  ],
  "error": "Bad Request"
}
```

#### Unauthorized / Forbidden

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## 4) Invoice Details By ID

### Endpoint

`GET /merchant-invoices/{{invoiceId}}`

Alternative flexible endpoint (single or all):

`GET /merchant-invoices/invoice-details`

### Purpose

Returns one invoice with parcel-level details, filters, sorting, and pagination.

### Query Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Default: `1` |
| `limit` | number | No | Default: `10` |
| `order_status` | enum | No | Parcel status filter (for example `DELIVERED`, `RETURNED`) |
| `invoice_status` | enum | No | Invoice status filter |
| `store_id` | UUID | No | Store filter |
| `from_date` | date (ISO) | No | Parcel `created_at` start date |
| `to_date` | date (ISO) | No | Parcel `created_at` end date |
| `sort_by` | enum | No | `order_date`, `receivable_amount` |
| `sort_order` | enum | No | `ASC`, `DESC` |

### Request Variants

#### Merchant token

```http
GET {{baseUrl}}/merchant-invoices/{{invoiceId}}?page=1&limit=10&order_status=DELIVERED&sort_by=order_date&sort_order=DESC
Authorization: Bearer {{merchantAccessToken}}
```

#### Admin token

```http
GET {{baseUrl}}/merchant-invoices/{{invoiceId}}?page=1&limit=10&order_status=DELIVERED&sort_by=order_date&sort_order=DESC
Authorization: Bearer {{adminAccessToken}}
```

#### With store/date filters

```http
GET {{baseUrl}}/merchant-invoices/{{invoiceId}}?page=1&limit=10&store_id=8794e9b0-7f64-47cb-8c66-2860c6b851f5&from_date=2025-01-01&to_date=2025-12-31&sort_by=receivable_amount&sort_order=DESC
Authorization: Bearer {{merchantAccessToken}}
```

#### Without invoice ID (all invoice details)

```http
GET {{baseUrl}}/merchant-invoices/invoice-details?page=1&limit=10&store_id=8794e9b0-7f64-47cb-8c66-2860c6b851f5&from_date=2025-01-01&to_date=2025-12-31&sort_by=receivable_amount&sort_order=DESC
Authorization: Bearer {{merchantAccessToken}}
```

#### With optional `invoice_id` on flexible endpoint

```http
GET {{baseUrl}}/merchant-invoices/invoice-details?invoice_id={{invoiceId}}&page=1&limit=10&order_status=DELIVERED&sort_by=order_date&sort_order=DESC
Authorization: Bearer {{merchantAccessToken}}
```

### Success Response (200)

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "6a5aab74-22e2-4d8d-a71f-1e6f1e2f0c31",
      "invoice_no": "MI090426A1B2",
      "transaction_id": "TXN-MB1C3D-8QW9ER",
      "date": "2025-07-14T10:12:44.000Z",
      "status": "PAID",
      "paid_at": "2025-07-16T13:25:10.000Z",
      "payment_reference": "BANK-TRX-998877",
      "notes": "Settled by admin",
      "created_at": "2025-07-14T10:12:44.000Z",
      "updated_at": "2025-07-16T13:25:10.000Z"
    },
    "merchant": {
      "id": "3cd043c7-2b98-4ca0-b34b-4f59e0bbcabd",
      "profile_id": "8ff9ad92-23a7-4d88-961d-10bf83348a8f",
      "name": "Merchant ABC",
      "phone": "01700000000"
    },
    "payment_method": {
      "id": "dbd1f62d-a9f0-4ae0-9624-bfa5dc5ce8f1",
      "method_type": "BANK_ACCOUNT",
      "details": {
        "bank_name": "Dutch-Bangla Bank",
        "branch_name": "Banani",
        "account_holder_name": "Merchant ABC",
        "account_number": "1234567890",
        "routing_number": "090260123"
      }
    },
    "summary": {
      "total_parcels": 18,
      "delivered_count": 15,
      "partial_delivery_count": 1,
      "returned_count": 2,
      "paid_return_count": 0,
      "total_cod_amount": 130000,
      "total_cod_collected": 128500,
      "total_delivery_charges": 6400,
      "total_return_charges": 850,
      "payable_amount": 121250
    },
    "parcels": [
      {
        "parcel_info": {
          "parcel_id": "6f7db1a3-cb59-4fda-a188-2f9f7cd30f48",
          "parcel_tx_id": "#139679",
          "tracking_number": "TRK123456",
          "order_id": "ORD-10021",
          "order_date": "2025-07-12T08:12:20.000Z"
        },
        "customer_info": {
          "customer_id": "c4f305d8-910a-4015-8dcb-6b4b43a8c6c1",
          "customer_name": "Rahim Uddin",
          "customer_phone": "01811112222",
          "customer_address": "Banani, Dhaka"
        },
        "store_info": {
          "store_id": "8794e9b0-7f64-47cb-8c66-2860c6b851f5",
          "store_name": "Main Outlet",
          "store_phone": "01900001111"
        },
        "financial_info": {
          "receivable_amount": 7820,
          "currency": "BDT",
          "breakdown": {
            "collectable_amount": 8000,
            "collected_amount": 8000,
            "delivery_fee": 120,
            "cod_fee": 40,
            "weight_charge": 20,
            "discount": 0,
            "total_fee": 180,
            "return_charge": 0
          }
        },
        "status_info": {
          "order_status": "DELIVERED",
          "invoice_type": "DELIVERY",
          "invoice_status": "PAID"
        }
      }
    ],
    "pagination": {
      "total": 18,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  },
  "message": "Invoice details retrieved successfully"
}
```

### Error Responses

#### Invalid UUID in path param (`invoiceId`)

```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

#### Invalid query values (ValidationPipe)

```json
{
  "statusCode": 400,
  "message": [
    "sort_by must be one of the following values: order_date, receivable_amount",
    "sort_order must be one of the following values: ASC, DESC"
  ],
  "error": "Bad Request"
}
```

#### Invoice not found

```json
{
  "statusCode": 404,
  "message": "Invoice not found",
  "error": "Not Found"
}
```

#### Merchant trying to access an invoice they do not own

```json
{
  "success": false,
  "message": "Unauthorized access to this invoice"
}
```

#### Unauthorized / Forbidden

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

---

## Key Differences at a Glance

- `/merchant-invoices/payment-history`: payment-centric invoice history with payment summary.
- `/merchant-invoices`: invoice-centric list with invoice-level charge breakdown.
- `/merchant-invoices/orderwise`: parcel/order-centric rows joined with invoice context.
- `/merchant-invoices/{{invoiceId}}`: single-invoice detail with parcel list, filters, sorting, and pagination.
