# Merchant Advance Payments API Documentation

## Overview
This document covers **merchant-facing** advance payment APIs.

Base route: `/advance-payments`

Authentication:
- `Authorization: Bearer <merchant_access_token>`
- Role required: `MERCHANT`

Advance payment statuses:
- `PENDING_MERCHANT_APPROVAL`
- `MERCHANT_REVIEW_REQUESTED`
- `APPROVED_BY_MERCHANT`
- `PAID`
- `CANCELLED`

---

## 1) Get Merchant Advance Payment List

### Endpoint
`GET /advance-payments/merchant/invoice/list`

### Query Parameters
- `page` (number, optional, default: `1`)
- `limit` (number, optional, default: `10` from service pagination flow)
- `status` (enum, optional)
- `search` (string, optional) - searches by `invoice_id`
- `start_date` (string, optional)
- `end_date` (string, optional)
- `sortBy` (string, optional, default: `created_at`)
- `order` (`ASC` or `DESC`, optional, default: `DESC`)

Notes:
- Merchant ownership is enforced from token (`merchantId` in auth context).
- Any `merchant_id` query from merchant side is ignored by ownership enforcement.

### Example Queries

#### A. Basic list
`GET /advance-payments/merchant/invoice/list?page=1&limit=20`

#### B. Filter by status
`GET /advance-payments/merchant/invoice/list?page=1&limit=20&status=PENDING_MERCHANT_APPROVAL`

#### C. Search + date range + sort
`GET /advance-payments/merchant/invoice/list?page=1&limit=20&search=ADV-123&start_date=2026-04-01&end_date=2026-04-30&sortBy=created_at&order=DESC`

### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "2148054c-df81-4ba8-ae9b-33f77e07d248",
      "invoice_id": "ADV-419301",
      "created_at": "2026-04-09T06:22:14.512Z",
      "merchant_name": "Rahim Traders",
      "merchant_phone": "01700000000",
      "total_parcels": 125,
      "net_amount": 84350,
      "status": "PENDING_MERCHANT_APPROVAL",
      "is_paid": false,
      "paid_at": null
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
  "message": "My advance payments retrieved successfully"
}
```

### Common Error Response Example
```json
{
  "success": false,
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "Advance payment feature is disabled for this merchant",
  "timestamp": "2026-04-09T06:30:12.120Z",
  "path": "/advance-payments/merchant/invoice/list?page=1&limit=20"
}
```

---

## 2) Get Merchant Advance Payment Details

### Endpoint
`GET /advance-payments/merchant/invoice/:id`

### Path Params
- `id` (uuid, required)

### Example
`GET /advance-payments/merchant/invoice/2148054c-df81-4ba8-ae9b-33f77e07d248`

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "2148054c-df81-4ba8-ae9b-33f77e07d248",
    "invoice_id": "ADV-419301",
    "status": "PENDING_MERCHANT_APPROVAL",
    "created_at": "2026-04-09T06:22:14.512Z",
    "paid_at": null,
    "is_paid": false,
    "merchant": {
      "id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
      "name": "Rahim Traders",
      "phone": "01700000000"
    },
    "breakdown": {
      "total_parcels": 125,
      "total_collectable": 100000,
      "deductions": {
        "delivery_fee": 9000,
        "cod_charge": 1500,
        "weight_charge": 3000,
        "return_charge": 2150
      },
      "net_payable": 84350
    },
    "payment_method": "BANK_TRANSFER",
    "admin_note": "Adjusted by finance team",
    "merchant_review_note": "",
    "created_by": "Admin User"
  },
  "message": "Advance payment details retrieved successfully"
}
```

### Common Error Response Example
```json
{
  "success": false,
  "statusCode": 403,
  "error": "ForbiddenException",
  "message": "You do not have permission to view this invoice",
  "timestamp": "2026-04-09T06:33:52.900Z",
  "path": "/advance-payments/merchant/invoice/2148054c-df81-4ba8-ae9b-33f77e07d248"
}
```

---

## 3) Merchant Action on Invoice (Approve or Request Review)

### Endpoint
`PATCH /advance-payments/merchant/invoice/:id/action`

### Path Params
- `id` (uuid, required)

### Request Body
- `action` (required): `APPROVE` or `REQUEST_REVIEW`
- `review_note` (optional string, but required when `action=REQUEST_REVIEW`)

### Body Example: Approve
```json
{
  "action": "APPROVE"
}
```

### Body Example: Request Review
```json
{
  "action": "REQUEST_REVIEW",
  "review_note": "Please verify delivery fee and weight charge deduction."
}
```

### Success Response (200) - Approve
Note: this endpoint returns the saved advance payment entity directly.
```json
{
  "id": "2148054c-df81-4ba8-ae9b-33f77e07d248",
  "invoice_id": "ADV-419301",
  "merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
  "status": "APPROVED_BY_MERCHANT",
  "merchant_review_note": "",
  "is_paid": false,
  "paid_at": null,
  "updated_at": "2026-04-09T06:40:30.010Z"
}
```

### Success Response (200) - Request Review
```json
{
  "id": "2148054c-df81-4ba8-ae9b-33f77e07d248",
  "invoice_id": "ADV-419301",
  "merchant_id": "0b3f0ef8-35be-42eb-a9af-2b3411fce80f",
  "status": "MERCHANT_REVIEW_REQUESTED",
  "merchant_review_note": "Please verify delivery fee and weight charge deduction.",
  "is_paid": false,
  "paid_at": null,
  "updated_at": "2026-04-09T06:42:18.001Z"
}
```

### Common Error Response Examples

#### A. Missing review note on REQUEST_REVIEW
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Review note is required",
  "timestamp": "2026-04-09T06:45:00.000Z",
  "path": "/advance-payments/merchant/invoice/2148054c-df81-4ba8-ae9b-33f77e07d248/action"
}
```

#### B. Wrong current status for action
```json
{
  "success": false,
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Action not allowed in current status",
  "timestamp": "2026-04-09T06:46:20.000Z",
  "path": "/advance-payments/merchant/invoice/2148054c-df81-4ba8-ae9b-33f77e07d248/action"
}
```

#### C. Invoice not found
```json
{
  "success": false,
  "statusCode": 404,
  "error": "NotFoundException",
  "message": "Invoice not found",
  "timestamp": "2026-04-09T06:47:10.000Z",
  "path": "/advance-payments/merchant/invoice/00000000-0000-0000-0000-000000000000/action"
}
```

---

## Quick Postman-ready Request Set

### List
`GET {{baseUrl}}/advance-payments/merchant/invoice/list?page=1&limit=20&status=PENDING_MERCHANT_APPROVAL`

### Detail
`GET {{baseUrl}}/advance-payments/merchant/invoice/{{advancePaymentId}}`

### Approve
`PATCH {{baseUrl}}/advance-payments/merchant/invoice/{{advancePaymentId}}/action`

```json
{
  "action": "APPROVE"
}
```

### Request Review
`PATCH {{baseUrl}}/advance-payments/merchant/invoice/{{advancePaymentId}}/action`

```json
{
  "action": "REQUEST_REVIEW",
  "review_note": "Need correction in breakdown"
}
```
