# Invoice & Finance API Documentation

> **Comprehensive guide for Admin and Hub Manager invoice and financial endpoints**

---

## Table of Contents

1. [Merchant Invoice Endpoints](#merchant-invoice-endpoints)
2. [Advance Payments Endpoints](#advance-payments-endpoints)
3. [Merchant Finance Endpoints](#merchant-finance-endpoints)
4. [Common Response Format](#common-response-format)
5. [Error Handling](#error-handling)
6. [Authentication & Authorization](#authentication--authorization)

---

## Merchant Invoice Endpoints

Base URL: `/merchant-invoices`

### 1. **Get Merchant Invoice Eligibility List** ✅ ADMIN ONLY

Retrieves a list of merchants with unpaid parcels (across entire lifespan). Shows merchants who are eligible for invoice generation.

```http
GET /merchant-invoices/merchant-eligibility-list
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `merchant_id` | UUID | No | Filter by specific merchant |
| `search` | string | No | Search by merchant name/phone |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "merchant_phone": "01700000000",
        "total_parcels": 45,
        "delivered_parcels": 40,
        "returned_parcels": 5,
        "total_transactions": "125000.00",
        "merchant_address": "Dhaka, Bangladesh",
        "unpaid_amount": "85000.00"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    },
    "summary": {
      "total_merchants": 50,
      "total_unpaid_amount": "4250000.00"
    }
  },
  "message": "Merchant invoice eligibility list retrieved successfully"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "Invalid page or limit parameter",
  "error": "BadRequestException"
}
```

---

### 2. **Get All Unpaid Parcels List** ✅ ADMIN ONLY

Shows individual parcels with `paid_to_merchant = false`. Parcel-level view with detailed breakdown.

```http
GET /merchant-invoices/unpaid-parcels-list
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `status` | string | No | Filter by parcel status (DELIVERED, RETURNED, etc.) |
| `merchant_id` | UUID | No | Filter by merchant ID |
| `hub_id` | UUID | No | Filter by hub ID |
| `search` | string | No | Search by tracking number or merchant name |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "parcel_id": "550e8400-e29b-41d4-a716-446655440000",
        "tracking_number": "DL123456",
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "customer_name": "Ahmed Khan",
        "customer_phone": "01911223344",
        "customer_address": "House 15, Road 5, Gulshan, Dhaka",
        "status": "DELIVERED",
        "delivery_date": "2026-05-10T14:30:00Z",
        "hub_name": "Dhaka Hub 1",
        "cod_collected_amount": "5000.00",
        "delivery_charge": "200.00",
        "return_charge": "0.00",
        "cod_charge": "50.00",
        "total_charges": "250.00",
        "net_payable": "5250.00"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 10,
      "totalPages": 15
    },
    "summary": {
      "total_cod_collected": "750000.00",
      "total_charges": "25000.00",
      "total_payable": "775000.00"
    }
  },
  "message": "Unpaid parcels list retrieved successfully"
}
```

---

### 3. **Get Pending Invoices List** ✅ ADMIN ONLY

Shows all unpaid/processing invoices with full details.

```http
GET /merchant-invoices/pending-list
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `merchant_id` | UUID | No | Filter by specific merchant |
| `search` | string | No | Search by invoice number or merchant |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
        "invoice_no": "MI060526A1B2",
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "merchant_phone": "01700000000",
        "total_parcels": 8,
        "financial_breakdown": {
          "collectable_amount": "12500.00",
          "collected_amount": "12000.00",
          "charges": {
            "delivery_charge": "600.00",
            "cod_charge": "200.00",
            "weight_charge": "100.00",
            "return_charge": "150.00",
            "discount": "50.00",
            "total_charges": "1000.00"
          }
        },
        "payable_amount": "11000.00",
        "payment_method": {
          "id": "7a6f3d2b-3c5f-4e2b-8d4b-16a0f81a9d21",
          "method_type": "BKASH"
        },
        "invoice_status": "UNPAID",
        "created_at": "2026-05-05T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    },
    "summary": {
      "total_pending_invoices": 25,
      "total_pending_amount": "275000.00"
    }
  },
  "message": "Pending invoices list retrieved successfully"
}
```

---

### 4. **Get Merchant Payment Dashboard** ✅ ADMIN & MERCHANT

Shows payment overview: Total Earning, Last Paid At, Available Balance.

```http
GET /merchant-invoices/payment-dashboard
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | Yes (for ADMIN) | Merchant ID (auto-detected for MERCHANT) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "total_earning": "500000.00",
    "last_paid_at": "2026-05-01T15:45:00Z",
    "available_balance": "150000.00",
    "pending_balance": "350000.00",
    "total_invoices": 12,
    "paid_invoices": 8,
    "unpaid_invoices": 4
  },
  "message": "Merchant payment dashboard retrieved successfully"
}
```

---

### 5. **Get Merchant Payment History** ✅ ADMIN & MERCHANT

Retrieves payment history with pagination and filtering.

```http
GET /merchant-invoices/payment-history
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | Yes (for ADMIN) | Merchant ID (auto-detected for MERCHANT) |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |
| `status` | string | No | Filter by status (PAID, UNPAID, PROCESSING) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "transaction_id": "txn_12345678",
        "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
        "invoice_no": "MI060526A1B2",
        "amount": "11000.00",
        "status": "PAID",
        "paid_at": "2026-05-02T14:30:00Z",
        "payment_method": "BKASH",
        "reference": "BKASH_PAY_123456"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  },
  "message": "Merchant payment history retrieved successfully"
}
```

---

### 6. **Get Admin Merchant Payment Summary** ✅ ADMIN ONLY

Shows overview of all merchants' payment status.

```http
GET /merchant-invoices/admin/payment-summary
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `search` | string | No | Search by merchant name/phone |
| `has_pending_balance` | boolean | No | Filter with pending balance (true/false) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "total_earning": "500000.00",
        "paid_amount": "350000.00",
        "pending_balance": "150000.00",
        "last_payment_date": "2026-05-01T15:45:00Z",
        "active_invoices": 4,
        "payment_method": "BKASH"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 10,
      "totalPages": 15
    }
  },
  "message": "Admin merchant payment summary retrieved successfully"
}
```

---

### 7. **Export Pending Invoices to Excel** ✅ ADMIN ONLY

Generates and downloads an Excel file of all pending invoices.

```http
GET /merchant-invoices/export/pending
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Response:** Excel file download

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="pending-invoices-2026-05-12.xlsx"
```

---

### 8. **Get Merchant Invoice Summary** ✅ ADMIN & MERCHANT

Comprehensive summary with merchant info, parcel stats, transaction stats, financial summary.

```http
GET /merchant-invoices/summary
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | Yes (for ADMIN) | Merchant ID (auto-detected for MERCHANT) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "merchant_name": "Demo Store Ltd",
    "merchant_phone": "01700000000",
    "merchant_email": "contact@demostore.com",
    "parcel_stats": {
      "total_parcels": 200,
      "delivered": 180,
      "returned": 20,
      "ongoing": 0
    },
    "transaction_stats": {
      "total_transactions": "1000000.00",
      "collected_cod": "950000.00",
      "pending_cod": "50000.00"
    },
    "financial_summary": {
      "total_earning": "500000.00",
      "paid": "350000.00",
      "pending": "150000.00",
      "hold": "0.00"
    },
    "invoice_summary": {
      "total_invoices": 12,
      "paid_invoices": 8,
      "unpaid_invoices": 4,
      "last_invoice_date": "2026-05-10T10:00:00Z"
    }
  },
  "message": "Merchant invoice summary retrieved successfully"
}
```

---

### 9. **Get Unpaid Parcels Grouped by Store** ✅ ADMIN & MERCHANT

Returns unpaid parcels grouped by store.

```http
GET /merchant-invoices/unpaid-by-store
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | Yes (for ADMIN) | Merchant ID (auto-detected for MERCHANT) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "stores": [
      {
        "store_id": "550e8400-e29b-41d4-a716-446655440001",
        "store_name": "Main Store",
        "unpaid_parcels_count": 25,
        "total_payable": "125000.00",
        "cod_collected": "100000.00",
        "charges": "25000.00"
      },
      {
        "store_id": "550e8400-e29b-41d4-a716-446655440002",
        "store_name": "Branch Store",
        "unpaid_parcels_count": 15,
        "total_payable": "75000.00",
        "cod_collected": "60000.00",
        "charges": "15000.00"
      }
    ]
  },
  "message": "Unpaid parcels by store retrieved successfully"
}
```

---

### 10. **Get Eligible Parcels for Invoice Generation** ✅ ADMIN & MERCHANT

Returns parcels that are eligible for invoice generation.

```http
GET /merchant-invoices/eligible-parcels
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | Yes (for ADMIN) | Merchant ID (auto-detected for MERCHANT) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "eligible_parcels": [
      {
        "parcel_id": "550e8400-e29b-41d4-a716-446655440000",
        "tracking_number": "DL123456",
        "customer_name": "Ahmed Khan",
        "customer_phone": "01911223344",
        "customer_address": "House 15, Road 5, Gulshan, Dhaka",
        "status": "DELIVERED",
        "delivered_at": "2026-05-10T14:30:00Z",
        "cod_collected": "5000.00",
        "cod_charge": "50.00",
        "delivery_charge": "200.00",
        "delivery_charge_applicable": true,
        "return_charge": "0.00",
        "return_charge_applicable": false,
        "net_payable": "5250.00",
        "delivery_charge_breakdown": {
          "delivery_charge": "200.00",
          "return_charge": "0.00",
          "cod_charge": "50.00",
          "total_charges": "250.00"
        }
      }
    ],
    "total_count": 50,
    "summary": {
      "total_cod_collected": "250000.00",
      "total_delivery_charges": "10000.00",
      "total_return_charges": "2000.00",
      "estimated_payable": "262000.00"
    }
  },
  "message": "Eligible parcels retrieved successfully"
}
```

---

### 11. **Generate Merchant Invoice** ✅ ADMIN ONLY

Creates a new merchant invoice from selected parcels.

```http
POST /merchant-invoices
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Request Body:**

```json
{
  "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
  "parcel_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

**Validation Rules:**

- `merchant_id`: Optional (auto-detected from parcels if omitted)
- `parcel_ids`: Required, array of UUIDs, minimum 1 parcel

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
      "invoice_no": "MI060526A1B2",
      "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
      "total_parcels": 3,
      "invoice_status": "UNPAID",
      "created_at": "2026-05-12T10:00:00Z",
      "created_by": "admin-user-id"
    },
    "breakdown": {
      "total_cod_collected": "15000.00",
      "total_charges": "750.00",
      "total_payable": "15750.00",
      "payment_method": {
        "id": "7a6f3d2b-3c5f-4e2b-8d4b-16a0f81a9d21",
        "method_type": "BKASH"
      }
    }
  },
  "message": "Invoice generated successfully"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "At least one parcel must be included",
  "error": "BadRequestException"
}
```

---

### 12. **Get Invoice List** ✅ ADMIN & MERCHANT

Retrieves list of invoices with pagination.

```http
GET /merchant-invoices
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `merchant_id` | UUID | No | Filter by merchant (MERCHANT role auto-filtered) |
| `status` | string | No | Filter by status (PAID, UNPAID, PROCESSING) |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
        "invoice_no": "MI060526A1B2",
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "total_parcels": 8,
        "payable_amount": "11000.00",
        "invoice_status": "UNPAID",
        "created_at": "2026-05-05T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  },
  "message": "Invoices retrieved successfully"
}
```

---

### 13. **Get Order-wise Invoice List** ✅ ADMIN & MERCHANT

Shows invoices in order-wise format across all invoices.

```http
GET /merchant-invoices/orderwise
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | No | Filter by merchant |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `invoice_status` | string | No | Filter by invoice status |
| `order_status` | string | No | Filter by parcel status |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |
| `sort_by` | string | No | Sort field (order_date, receivable_amount) |
| `sort_order` | string | No | Sort direction (ASC, DESC) |
| `search` | string | No | Search by tracking number |

---

### 14. **Get Invoice Details** ✅ ADMIN & MERCHANT

Retrieves detailed information of a specific invoice with parcel list.

```http
GET /merchant-invoices/:id
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Invoice ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number for parcels (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `order_status` | string | No | Filter by parcel status |
| `store_id` | UUID | No | Filter by store |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |
| `sort_by` | string | No | Sort field |
| `sort_order` | string | No | Sort direction (ASC, DESC) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
      "invoice_no": "MI060526A1B2",
      "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
      "merchant_name": "Demo Store Ltd",
      "merchant_phone": "01700000000",
      "total_parcels": 8,
      "invoice_status": "UNPAID",
      "created_at": "2026-05-05T10:00:00Z",
      "financial_breakdown": {
        "collectable_amount": "12500.00",
        "collected_amount": "12000.00",
        "total_charges": "1000.00",
        "net_payable": "11000.00"
      }
    },
    "parcels": [
      {
        "parcel_id": "550e8400-e29b-41d4-a716-446655440000",
        "tracking_number": "DL123456",
        "customer_name": "Ahmed Khan",
        "customer_phone": "01911223344",
        "status": "DELIVERED",
        "delivered_at": "2026-05-10T14:30:00Z",
        "cod_collected": "5000.00",
        "delivery_charge": "200.00",
        "cod_charge": "50.00",
        "total_charge": "250.00"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Invoice details retrieved successfully"
}
```

---

### 15. **Get Flexible Invoice Details** ✅ ADMIN & MERCHANT

Flexible endpoint that can return single invoice details OR all invoice details across multiple invoices.

```http
GET /merchant-invoices/invoice-details
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice_id` | UUID | No | If provided, returns single invoice details; otherwise returns all |
| `merchant_id` | UUID | No | Filter by merchant |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `invoice_status` | string | No | Filter by invoice status |
| `order_status` | string | No | Filter by parcel status |
| `store_id` | UUID | No | Filter by store |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |
| `sort_by` | string | No | Sort field |
| `sort_order` | string | No | Sort direction (ASC, DESC) |
| `search` | string | No | Search query |

**Response:** Returns single invoice details if `invoice_id` provided; otherwise returns paginated list of all invoice details.

---

### 16. **Update Invoice Status** ✅ ADMIN ONLY

Updates the status of an invoice.

```http
PATCH /merchant-invoices/:id/status
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Invoice ID |

**Request Body:**

```json
{
  "invoice_status": "PROCESSING"
}
```

**Valid Status Values:**

- `UNPAID`
- `PROCESSING`
- `PAID`
- `CANCELLED`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
      "invoice_status": "PROCESSING",
      "updated_at": "2026-05-12T10:00:00Z"
    }
  },
  "message": "Invoice status updated successfully"
}
```

---

### 17. **Mark Invoice as Paid** ✅ ADMIN ONLY

Marks an invoice as paid and creates a payment record.

```http
POST /merchant-invoices/:id/pay
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Invoice ID |

**Request Body:**

```json
{
  "payment_reference": "BKASH_PAY_123456",
  "notes": "Payment completed via BKASH"
}
```

**Field Descriptions:**

- `payment_reference` (optional): Transaction reference number
- `notes` (optional): Additional payment notes

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_id": "2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1",
      "invoice_status": "PAID",
      "paid_at": "2026-05-12T10:00:00Z",
      "paid_by": "admin-user-id",
      "payment_reference": "BKASH_PAY_123456"
    }
  },
  "message": "Invoice marked as paid successfully"
}
```

---

## Advance Payments Endpoints

Base URL: `/advance-payments`

### 1. **Create Advance Payment Invoice** ✅ ADMIN ONLY

Creates a new advance payment invoice for a merchant.

```http
POST /advance-payments/admin/create/invoice
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Request Body:**

```json
{
  "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
  "amount": "50000.00",
  "reason": "Business expansion"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "advance_payment_id": "3a2b1c0d-e1f2-4g5h-6i7j-8k9l0m1n2o3p",
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "amount": "50000.00",
    "status": "PENDING",
    "created_at": "2026-05-12T10:00:00Z"
  },
  "message": "Advance payment created successfully"
}
```

---

### 2. **Get All Advance Payments (Admin)** ✅ ADMIN ONLY

Lists all advance payment invoices.

```http
GET /advance-payments/admin/invoice/list
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `merchant_id` | UUID | No | Filter by merchant |
| `status` | string | No | Filter by status (PENDING, APPROVED, PAID, REJECTED) |
| `search` | string | No | Search by merchant name/ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "advance_payment_id": "3a2b1c0d-e1f2-4g5h-6i7j-8k9l0m1n2o3p",
      "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
      "merchant_name": "Demo Store Ltd",
      "amount": "50000.00",
      "status": "PENDING",
      "reason": "Business expansion",
      "created_at": "2026-05-12T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  },
  "message": "Advance payments retrieved successfully"
}
```

---

### 3. **Get Single Advance Payment (Admin)** ✅ ADMIN ONLY

Retrieves details of a specific advance payment.

```http
GET /advance-payments/admin/invoice/:id
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Advance Payment ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "advance_payment_id": "3a2b1c0d-e1f2-4g5h-6i7j-8k9l0m1n2o3p",
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "merchant_name": "Demo Store Ltd",
    "merchant_phone": "01700000000",
    "amount": "50000.00",
    "status": "PENDING",
    "reason": "Business expansion",
    "created_at": "2026-05-12T10:00:00Z",
    "created_by": "admin-user-id",
    "notes": "Awaiting approval"
  },
  "message": "Advance payment details retrieved successfully"
}
```

---

### 4. **Update Advance Payment (Admin)** ✅ ADMIN ONLY

Updates an advance payment invoice.

```http
PATCH /advance-payments/admin/invoice/:id/update
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Advance Payment ID |

**Request Body:**

```json
{
  "amount": "60000.00",
  "reason": "Extended business expansion"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "advance_payment_id": "3a2b1c0d-e1f2-4g5h-6i7j-8k9l0m1n2o3p",
    "amount": "60000.00",
    "reason": "Extended business expansion",
    "updated_at": "2026-05-12T10:30:00Z"
  },
  "message": "Advance payment updated successfully"
}
```

---

### 5. **Mark Advance Payment as Paid (Admin)** ✅ ADMIN ONLY

Marks an advance payment as paid.

```http
PATCH /advance-payments/admin/invoice/:id/pay
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Advance Payment ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "advance_payment_id": "3a2b1c0d-e1f2-4g5h-6i7j-8k9l0m1n2o3p",
    "status": "PAID",
    "paid_at": "2026-05-12T10:45:00Z",
    "paid_by": "admin-user-id"
  },
  "message": "Advance payment marked as paid successfully"
}
```

---

### 6. **Get Advance Payments (Merchant)** ✅ MERCHANT ONLY

Lists advance payments for the current merchant.

```http
GET /advance-payments/merchant/invoice/list
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `status` | string | No | Filter by status |

---

### 7. **Get Single Advance Payment (Merchant)** ✅ MERCHANT ONLY

Retrieves details of a specific advance payment (merchant's own).

```http
GET /advance-payments/merchant/invoice/:id
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`

---

### 8. **Merchant Advance Payment Action** ✅ MERCHANT ONLY

Allows merchant to accept or reject an advance payment.

```http
PATCH /advance-payments/merchant/invoice/:id/action
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Advance Payment ID |

**Request Body:**

```json
{
  "action": "ACCEPT"
}
```

**Valid Actions:**

- `ACCEPT` - Accept the advance payment
- `REJECT` - Reject the advance payment

---

## Merchant Finance Endpoints

Base URL: `/merchant-finance`

### 1. **Get Merchant Finance Overview (Admin)** ✅ ADMIN ONLY

Retrieves financial overview for a specific merchant.

```http
GET /merchant-finance/admin/:merchantId
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | UUID | Yes | Merchant ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
    "merchant_name": "Demo Store Ltd",
    "current_balance": "150000.00",
    "hold_amount": "50000.00",
    "available_balance": "100000.00",
    "total_earned": "500000.00",
    "total_paid": "350000.00",
    "pending_amount": "150000.00"
  },
  "message": "Merchant finance retrieved successfully"
}
```

---

### 2. **Get All Merchants Finance Summary (Admin)** ✅ ADMIN ONLY

Retrieves financial summary for all merchants.

```http
GET /merchant-finance/admin/all
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `search` | string | No | Search by merchant name |
| `sort_by` | string | No | Sort field (current_balance, total_earned) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "merchants": [
      {
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_name": "Demo Store Ltd",
        "current_balance": "150000.00",
        "available_balance": "100000.00",
        "total_earned": "500000.00",
        "total_paid": "350000.00",
        "pending_amount": "150000.00"
      }
    ],
    "pagination": {
      "total": 200,
      "page": 1,
      "limit": 10,
      "totalPages": 20
    }
  },
  "message": "All merchants finance retrieved successfully"
}
```

---

### 3. **Get Merchant Transaction History (Admin)** ✅ ADMIN ONLY

Retrieves transaction history for a specific merchant.

```http
GET /merchant-finance/admin/:merchantId/transactions
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | UUID | Yes | Merchant ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 10) |
| `from_date` | string (ISO8601) | No | Filter from date |
| `to_date` | string (ISO8601) | No | Filter to date |
| `type` | string | No | Filter by transaction type (DEBIT, CREDIT) |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transaction_id": "txn_12345678",
        "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
        "transaction_type": "CREDIT",
        "amount": "5000.00",
        "description": "Invoice payment - MI060526A1B2",
        "balance_before": "145000.00",
        "balance_after": "150000.00",
        "created_at": "2026-05-12T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 85,
      "page": 1,
      "limit": 10,
      "totalPages": 9
    }
  },
  "message": "Merchant transactions retrieved successfully"
}
```

---

### 4. **Adjust Merchant Balance (Admin)** ✅ ADMIN ONLY

Adjusts merchant balance (add or deduct).

```http
POST /merchant-finance/admin/:merchantId/adjust
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | UUID | Yes | Merchant ID |

**Request Body:**

```json
{
  "type": "CREDIT",
  "amount": "10000.00",
  "reason": "Adjustment for discrepancy",
  "reference": "ADJ_20260512_001"
}
```

**Valid Type Values:**

- `CREDIT` - Add to balance
- `DEBIT` - Deduct from balance

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "transaction_id": "txn_87654321",
    "type": "CREDIT",
    "amount": "10000.00",
    "balance_after": "160000.00"
  },
  "message": "Balance credited successfully"
}
```

---

### 5. **Hold Merchant Balance (Admin)** ✅ ADMIN ONLY

Holds a portion of merchant's available balance.

```http
POST /merchant-finance/admin/:merchantId/hold
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | UUID | Yes | Merchant ID |

**Request Body:**

```json
{
  "hold_amount": "50000.00",
  "reason": "Pending investigation"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "hold_amount": "50000.00",
    "available_balance": "50000.00"
  },
  "message": "Balance held successfully"
}
```

---

### 6. **Release Held Balance (Admin)** ✅ ADMIN ONLY

Releases previously held balance.

```http
POST /merchant-finance/admin/:merchantId/release-hold
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | UUID | Yes | Merchant ID |

**Request Body:**

```json
{
  "release_amount": "50000.00",
  "reason": "Investigation cleared"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "hold_amount": "0.00",
    "available_balance": "100000.00"
  },
  "message": "Balance released successfully"
}
```

---

### 7. **Get Current Merchant Finance (Merchant)** ✅ MERCHANT ONLY

Retrieves current merchant's finance overview.

```http
GET /merchant-finance/my
```

**Authentication:** Required (JWT Token)

**Required Roles:** `MERCHANT`

---

### 8. **Sync All Merchants Finance (Admin)** ✅ ADMIN ONLY

Synchronizes finance data for all merchants from parcels.

```http
POST /merchant-finance/admin/sync-all
```

**Authentication:** Required (JWT Token)

**Required Roles:** `ADMIN`

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "synced": 150,
    "errors": 2
  },
  "message": "Synced 150 merchants, 2 errors"
}
```

---

## Common Response Format

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "error": "ErrorType"
}
```

### Paginated Response

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  },
  "message": "Data retrieved successfully"
}
```

---

## Error Handling

### Common HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | Invoice retrieved |
| 201 | Created | Invoice generated |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Invoice not found |
| 500 | Server Error | Database error |

### Error Response Examples

**Missing Required Field (400):**

```json
{
  "success": false,
  "message": "Merchant ID is required",
  "error": "BadRequestException"
}
```

**Unauthorized (401):**

```json
{
  "success": false,
  "message": "Invalid or expired token",
  "error": "UnauthorizedException"
}
```

**Forbidden (403):**

```json
{
  "success": false,
  "message": "Insufficient permissions to perform this action",
  "error": "ForbiddenException"
}
```

**Not Found (404):**

```json
{
  "success": false,
  "message": "Invoice with ID 2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1 not found",
  "error": "NotFoundException"
}
```

---

## Authentication & Authorization

### JWT Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

### Role-Based Access Control (RBAC)

#### Admin Role

- Full access to all merchant invoices
- Can create, update, and manage invoices
- Can mark invoices as paid
- Can manage merchant finances
- Can create and manage advance payments
- Can export invoice data

#### Hub Manager Role

- No specific invoice management permissions in current implementation
- Can access invoice data for their assigned hub's merchants (when implemented)

#### Merchant Role

- Can view their own invoices
- Can view eligible parcels for invoicing
- Can view payment history
- Can view financial summary
- Cannot create or modify invoices

---

## Example End-to-End Flow

### Scenario: Admin Creates Invoice and Marks as Paid

#### Step 1: Get Merchant Eligibility List

```http
GET /merchant-invoices/merchant-eligibility-list?page=1&limit=10
Authorization: Bearer <admin_token>
```

#### Step 2: Get Unpaid Parcels for Selected Merchant

```http
GET /merchant-invoices/unpaid-parcels-list?merchant_id=123e4567-e89b-12d3-a456-426614174000&page=1&limit=20
Authorization: Bearer <admin_token>
```

#### Step 3: Get Eligible Parcels

```http
GET /merchant-invoices/eligible-parcels?merchant_id=123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <admin_token>
```

#### Step 4: Generate Invoice

```http
POST /merchant-invoices
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
  "parcel_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ]
}
```

#### Step 5: Get Invoice Details

```http
GET /merchant-invoices/2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1?page=1&limit=10
Authorization: Bearer <admin_token>
```

#### Step 6: Update Invoice Status (Optional)

```http
PATCH /merchant-invoices/2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1/status
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "invoice_status": "PROCESSING"
}
```

#### Step 7: Mark Invoice as Paid

```http
POST /merchant-invoices/2f1c7c2e-6d1d-4f63-9aa5-4b32f1b6a0a1/pay
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "payment_reference": "BKASH_20260512_001",
  "notes": "Payment received via BKASH"
}
```

#### Step 8: Verify Payment (Get Pending Invoices)

```http
GET /merchant-invoices/pending-list?page=1&limit=10
Authorization: Bearer <admin_token>
```

---

## Additional Notes

- All monetary values are returned as strings to avoid floating-point precision issues
- All timestamps are in ISO 8601 format (UTC)
- Pagination defaults: page=1, limit=10
- Maximum limit per request: 100 items
- All UUIDs must be valid UUID v4 format
- Date filtering supports ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)

---

**Last Updated:** May 12, 2026  
**Version:** 1.0.0
