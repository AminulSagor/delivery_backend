# Customer Fraud List System API Documentation

## Overview
This document covers the full fraud list workflow for customers.

Base route prefix: `/customers/fraud`

Authentication:
- Bearer token required
- Guarded by JWT + role checks

Roles:
- Merchant endpoints: `MERCHANT`
- Admin endpoints: `ADMIN`

---

## Full Flow (End-to-End)

1. Merchant opens customer registry for fraud screening
   - `GET /customers/fraud/customers`
2. Merchant checks one customer details by id or phone
   - `GET /customers/fraud/customers/:customerId`
   - `GET /customers/fraud/customers/phone/:phone`
3. Merchant submits fraud request with reason
   - `POST /customers/fraud/requests`
4. Admin lists fraud requests and reviews each
   - `GET /customers/fraud/admin/requests`
   - `PATCH /customers/fraud/admin/requests/:requestId/review`
5. Merchant can remove from fraud list (their own active entry)
   - `DELETE /customers/fraud/customers/:customerId`
   - `DELETE /customers/fraud/customers/phone/:phone`

---

## Status and Action Enums

### Fraud Request Status
- `PENDING`
- `APPROVED`
- `REJECTED`
- `REMOVED`

### Admin Review Actions
- `APPROVE`
- `REJECT`

---

## 1) Merchant: Get All Customers (Fraud Screening List)

### Endpoint
`GET /customers/fraud/customers`

### Behavior
- This endpoint returns all customers in the customer registry (same customer universe used by the web customer list).
- It is not limited to customers already in fraud list.
- Fraud information is returned under `fraud_status` for each customer.

### Query Params
- `page` number, optional, default `1`
- `limit` number, optional, default `20`
- `search` string, optional
  - Searches by customer name, primary phone, secondary phone
- `sortBy` string, optional
  - Supported: `customer_name`, `phone_number`, `total_orders`, `last_order_at`
  - Fallback: `customer_name`
- `order` enum, optional: `ASC` or `DESC`

### Example Queries
- `GET /customers/fraud/customers?page=1&limit=20`
- `GET /customers/fraud/customers?page=1&limit=20&search=akash`
- `GET /customers/fraud/customers?page=1&limit=20&search=01712&sortBy=total_orders&order=DESC`

### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
      "customer_name": "Akash",
      "phone_number": "01712121212",
      "total_orders": 40,
      "is_new_customer": false,
      "customer_tag": "EXISTING_CUSTOMER",
      "customer_rating": "92.5%",
      "success_rate": 92.5,
      "delivered_count": 37,
      "cancelled_returned_count": 3,
      "fraud_status": {
        "in_fraud_list": true,
        "approved_reports_count": 1,
        "pending_reports_count": 0
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "All customers retrieved successfully"
}
```

### Error Response Example (403)
```json
{
  "success": false,
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "Access denied. Required roles: MERCHANT",
  "timestamp": "2026-04-09T12:00:00.000Z",
  "path": "/customers/fraud/customers?page=1&limit=20"
}
```

---

## 2) Merchant: Get Customer Fraud Details by Customer ID

### Endpoint
`GET /customers/fraud/customers/:customerId`

### Path Param
- `customerId` UUID

### Example
`GET /customers/fraud/customers/3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c`

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
      "name": "Akash",
      "address": "Dhaka",
      "phone": "01712121212",
      "is_new_customer": false,
      "customer_tag": "EXISTING_CUSTOMER",
      "last_order_placed_on": "25th April, 2025"
    },
    "order_history_breakdown": {
      "delivered": 37,
      "cancelled_returned": 3,
      "total_orders": 40,
      "successfully_delivered": 37,
      "success_rate": "92.5%",
      "overall_success_rate": "92.5%",
      "overall_success_rate_formula": "(37 Delivered / 40 Orders)"
    },
    "fraud_list": {
      "is_in_fraud_list": true,
      "approved_reports_count": 1,
      "pending_reports_count": 0,
      "reports": [
        {
          "id": "5f5e5f5e-1111-2222-3333-444444444444",
          "status": "APPROVED",
          "reason": "Repeated fake booking and refused delivery 3 times.",
          "created_at": "2026-04-01T08:20:00.000Z",
          "updated_at": "2026-04-02T10:00:00.000Z",
          "is_active": true,
          "added_by": {
            "merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
            "merchant_name": "Merchant One",
            "merchant_phone": "01700000001"
          },
          "admin_review": {
            "reviewed_by_admin_id": "49c9dcfc-35c5-4f3d-a9d2-f94fb4b41ae1",
            "reviewed_by_admin_name": "Admin User",
            "reviewed_at": "2026-04-02T10:00:00.000Z",
            "admin_note": "Evidence verified"
          }
        }
      ]
    }
  },
  "message": "Customer fraud details retrieved successfully"
}
```

### Error Response Example (404)
```json
{
  "success": false,
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "Customer not found",
  "timestamp": "2026-04-09T12:05:00.000Z",
  "path": "/customers/fraud/customers/00000000-0000-0000-0000-000000000000"
}
```

---

## 3) Merchant: Get Customer Fraud Details by Phone Number

### Endpoint
`GET /customers/fraud/customers/phone/:phone`

### Path Param
- `phone` string (example: `01712121212`)

### Example
`GET /customers/fraud/customers/phone/01712121212`

### Success Response (200)
Same shape as customer-id details endpoint.

### Error Response Example (404)
```json
{
  "success": false,
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "Customer not found",
  "timestamp": "2026-04-09T12:07:00.000Z",
  "path": "/customers/fraud/customers/phone/01999999999"
}
```

---

## 4) Merchant: Submit Fraud Request

### Endpoint
`POST /customers/fraud/requests`

### Request Body Rules
- Must provide at least one:
  - `customer_id` (uuid)
  - `phone_number` (format: `01XXXXXXXXX`)
- Must provide:
  - `reason` (non-empty string)

### Body Example A (Using customer_id)
```json
{
  "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
  "reason": "Repeated fake booking and refused delivery."
}
```

### Body Example B (Using phone_number)
```json
{
  "phone_number": "01712121212",
  "reason": "Customer repeatedly cancels after dispatch."
}
```

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "id": "a95bc58d-42b8-4ab0-a6fd-801cf1364ee1",
    "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
    "merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
    "reason": "Customer repeatedly cancels after dispatch.",
    "status": "PENDING",
    "is_active": true,
    "reviewed_by_admin_id": null,
    "reviewed_at": null,
    "admin_note": null,
    "removed_by_merchant_id": null,
    "removed_at": null,
    "created_at": "2026-04-09T12:10:00.000Z",
    "updated_at": "2026-04-09T12:10:00.000Z"
  },
  "message": "Fraud list request submitted successfully"
}
```

### Error Response Examples

#### Duplicate active request (400)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "You already have an active fraud request for this customer",
  "timestamp": "2026-04-09T12:11:00.000Z",
  "path": "/customers/fraud/requests"
}
```

#### Missing customer reference (400)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Either customer_id or phone_number is required",
  "timestamp": "2026-04-09T12:12:00.000Z",
  "path": "/customers/fraud/requests"
}
```

---

## 5) Admin: List Fraud Requests

### Endpoint
`GET /customers/fraud/admin/requests`

### Query Params
- `page` number, optional, default `1`
- `limit` number, optional, default `20`
- `status` enum optional: `PENDING | APPROVED | REJECTED | REMOVED`
- `search` string optional
  - Searches customer name/phone and merchant name/phone
- `sortBy` optional: `created_at`, `updated_at`, `status`, `customer_name`
- `order` optional: `ASC` or `DESC`

### Example Query
`GET /customers/fraud/admin/requests?page=1&limit=20&status=PENDING&search=akash&sortBy=created_at&order=DESC`

### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "a95bc58d-42b8-4ab0-a6fd-801cf1364ee1",
      "status": "PENDING",
      "reason": "Customer repeatedly cancels after dispatch.",
      "is_active": true,
      "created_at": "2026-04-09T12:10:00.000Z",
      "reviewed_at": null,
      "admin_note": null,
      "customer": {
        "id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
        "name": "Akash",
        "phone": "01712121212"
      },
      "added_by_merchant": {
        "id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
        "name": "Merchant One",
        "phone": "01700000001"
      },
      "reviewed_by_admin": {
        "id": null,
        "name": null
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "Fraud requests retrieved successfully"
}
```

---

## 6) Admin: Review Fraud Request (Approve or Reject)

### Endpoint
`PATCH /customers/fraud/admin/requests/:requestId/review`

### Path Param
- `requestId` UUID

### Body Example A (Approve)
```json
{
  "action": "APPROVE",
  "admin_note": "Evidence validated"
}
```

### Body Example B (Reject)
```json
{
  "action": "REJECT",
  "admin_note": "Insufficient proof"
}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "a95bc58d-42b8-4ab0-a6fd-801cf1364ee1",
    "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
    "merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
    "reason": "Customer repeatedly cancels after dispatch.",
    "status": "APPROVED",
    "is_active": true,
    "reviewed_by_admin_id": "49c9dcfc-35c5-4f3d-a9d2-f94fb4b41ae1",
    "reviewed_at": "2026-04-09T12:15:00.000Z",
    "admin_note": "Evidence validated",
    "updated_at": "2026-04-09T12:15:00.000Z"
  },
  "message": "Fraud request reviewed successfully"
}
```

### Error Response Examples

#### Reject without admin_note (400)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "admin_note is required when rejecting",
  "timestamp": "2026-04-09T12:16:00.000Z",
  "path": "/customers/fraud/admin/requests/a95bc58d-42b8-4ab0-a6fd-801cf1364ee1/review"
}
```

#### Non-pending request review (400)
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Only active pending fraud requests can be reviewed",
  "timestamp": "2026-04-09T12:17:00.000Z",
  "path": "/customers/fraud/admin/requests/a95bc58d-42b8-4ab0-a6fd-801cf1364ee1/review"
}
```

---

## 7) Merchant: Remove Customer from Fraud List by Customer ID

### Endpoint
`DELETE /customers/fraud/customers/:customerId`

### Example
`DELETE /customers/fraud/customers/3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c`

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "a95bc58d-42b8-4ab0-a6fd-801cf1364ee1",
    "status": "REMOVED",
    "is_active": false,
    "removed_at": "2026-04-09T12:20:00.000Z",
    "removed_by_merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f"
  },
  "message": "Customer removed from fraud list successfully"
}
```

### Error Response Example (404)
```json
{
  "success": false,
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "No active fraud list entry found for this customer by your account",
  "timestamp": "2026-04-09T12:21:00.000Z",
  "path": "/customers/fraud/customers/3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c"
}
```

---

## 8) Merchant: Remove Customer from Fraud List by Phone

### Endpoint
`DELETE /customers/fraud/customers/phone/:phone`

### Example
`DELETE /customers/fraud/customers/phone/01712121212`

### Success Response (200)
Same shape as remove-by-customer-id.

---

## Postman-ready Request Set

### Merchant: list
`GET {{baseUrl}}/customers/fraud/customers?page=1&limit=20&search=akash`

### Merchant: details by phone
`GET {{baseUrl}}/customers/fraud/customers/phone/01712121212`

### Merchant: add to fraud list
`POST {{baseUrl}}/customers/fraud/requests`
```json
{
  "phone_number": "01712121212",
  "reason": "Repeated fake booking"
}
```

### Admin: list requests
`GET {{baseUrl}}/customers/fraud/admin/requests?page=1&limit=20&status=PENDING`

### Admin: approve request
`PATCH {{baseUrl}}/customers/fraud/admin/requests/{{requestId}}/review`
```json
{
  "action": "APPROVE",
  "admin_note": "Verified"
}
```

### Merchant: remove from fraud list by phone
`DELETE {{baseUrl}}/customers/fraud/customers/phone/01712121212`
