# Merchant Frontend API Guide

Scope:
- Merchant Dashboard
- Merchant Invoices
- Merchant Customer Fraud
- Merchant Payout Settings
- Merchant Profile Settings & Security

Related guide:
- Hub Panel APIs: see HUB_PANEL_FRONTEND_API_GUIDE.md

Source aligned with your current collection and backend controllers/services.

## Quick Summary
- All endpoints require Merchant JWT unless marked otherwise.
- Standard success envelope is used in most endpoints: success, data, message.
- Pagination is used heavily with page and limit.
- Invoices support multiple filters (status, date range, sorting, search).
- Customer Fraud supports both customer_id and phone based flows.
- Payout Settings supports BANK_ACCOUNT, BKASH, NAGAD, CASH with verification/default workflow.
- Merchant profile settings include business/contact updates, document upload links, and password change.

## Authentication
Header:
- Authorization: Bearer <merchant_jwt>

## Standard Response Shape
Success (common):
```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Validation/exception error (common Nest shape in this project):
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-04-09T09:00:00.000Z",
  "path": "/api/path"
}
```

Unauthorized example:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

------------------------------------------------------------

# 1) Merchant Dashboard APIs

## 1.1 Delivery Performance Graph
GET /merchants/dashboard/delivery-performance

Short summary:
- Returns weekly or monthly delivery trend with totals.

Query filters:
- performance_range: weekly | monthly (optional, default weekly)
- month: month name (e.g. april) or YYYY-MM (only valid when performance_range=monthly)

Request body:
- None

Example request:
- /merchants/dashboard/delivery-performance?performance_range=weekly
- /merchants/dashboard/delivery-performance?performance_range=monthly&month=april

Success response example:
```json
{
  "success": true,
  "data": {
    "range": "weekly",
    "start_date": "2026-04-03",
    "end_date": "2026-04-09",
    "totals": {
      "delivered": 44,
      "returned": 6,
      "total_parcel": 57
    },
    "trend": [
      {
        "day": "Fri",
        "date": "2026-04-03",
        "delivered": 6,
        "returned": 1,
        "total_parcel": 8
      }
    ]
  },
  "message": "Merchant delivery performance retrieved successfully"
}
```

Common errors:
- 400 when month is provided but performance_range is not monthly
- 400 when month format is invalid

------------------------------------------------------------

## 1.2 Cash On Delivery Details
GET /merchants/dashboard/cash-on-delivery-details

Short summary:
- Returns collection totals, pending COD, fee breakdown, and receivable summary.

Query filters:
- None

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "cash_on_delivery_details": {
      "collection_status": {
        "total_collected": 125000,
        "total_pending": 18000
      },
      "total_cash_on_delivery_amount": 143000,
      "todays_collection": 7600,
      "total_fee": 13200,
      "total_receivable": 129800,
      "fee_breakdown": {
        "total_delivery_charge": 9000,
        "total_weight_charge": 1700,
        "total_cod_charge": 1200,
        "total_return_charge": 1300
      }
    }
  },
  "message": "Merchant cash on delivery details retrieved successfully"
}
```

------------------------------------------------------------

## 1.3 Today Summary (Specific Date Supported)
GET /parcels/today-summary

Short summary:
- Returns day-wise parcel count and amount by status buckets.

Query filters:
- date: YYYY-MM-DD (optional, default today)

Request body:
- None

Example request:
- /parcels/today-summary
- /parcels/today-summary?date=2026-04-09

Success response example:
```json
{
  "success": true,
  "data": {
    "date": "2026-04-09",
    "summary": {
      "new_parcels": { "count": 12, "amount": 18200 },
      "pickup": { "count": 6, "amount": 9400 },
      "in_transit": { "count": 9, "amount": 14200 },
      "assigned": { "count": 5, "amount": 8100 },
      "out_for_delivery": { "count": 4, "amount": 6200 },
      "delivered": { "count": 10, "amount": 15400 },
      "delivery_rescheduled": { "count": 2, "amount": 2900 },
      "returned": { "count": 1, "amount": 700 },
      "cancelled": { "count": 0, "amount": 0 }
    },
    "total": { "count": 49, "amount": 75100 }
  },
  "message": "Today's parcel summary retrieved successfully"
}
```

Common errors:
- 400 when date is not valid ISO date

------------------------------------------------------------

## 1.4 Lifetime Breakdown
GET /parcels/lifetime-summary

Short summary:
- Returns lifetime or date-range parcel summary by status buckets.

Query filters:
- startDate: YYYY-MM-DD (optional)
- endDate: YYYY-MM-DD (optional)

Important rule:
- If one of startDate/endDate is passed, both must be passed.

Request body:
- None

Example request:
- /parcels/lifetime-summary
- /parcels/lifetime-summary?startDate=2026-04-01&endDate=2026-04-30

Success response example:
```json
{
  "success": true,
  "data": {
    "summary": {
      "new_parcels": { "count": 200, "amount": 320000 },
      "pickup": { "count": 160, "amount": 260000 },
      "in_transit": { "count": 48, "amount": 79000 },
      "assigned": { "count": 55, "amount": 86000 },
      "out_for_delivery": { "count": 30, "amount": 47000 },
      "delivered": { "count": 510, "amount": 825000 },
      "delivery_rescheduled": { "count": 22, "amount": 34000 },
      "returned": { "count": 60, "amount": 90000 },
      "cancelled": { "count": 11, "amount": 12000 }
    },
    "total": { "count": 1096, "amount": 1753000 }
  },
  "message": "Lifetime parcel summary retrieved successfully"
}
```

Common errors:
- 400 when only one date is sent
- 400 when startDate > endDate

------------------------------------------------------------

## 1.5 COD Details Endpoint in Collection
The collection also has:
- GET /merchants/dashboard/cash-on-delivery-details

This is already covered in section 1.2.

============================================================

# 2) Merchant Invoices APIs

## 2.1 All Invoice List
GET /merchant-invoices

Short summary:
- Returns paginated invoice list with financial breakdown per invoice.

Query filters:
- page: number (default 1)
- limit: number (default 10, max 100)
- invoice_status: UNPAID | PROCESSING | PAID
- fromDate: ISO datetime/date
- toDate: ISO datetime/date
- merchant_id: UUID (admin use; merchant token auto-scoped)

Request body:
- None

Example request:
- /merchant-invoices?page=1&limit=10&invoice_status=PAID&fromDate=2025-01-01&toDate=2025-12-31

Success response example:
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "9f2b4e8e-b53f-4eb0-a1dc-6e7b8a001111",
        "invoice_no": "INV-2026-000145",
        "merchant_name": "MD.Sifat Stores",
        "merchant_phone": "+8801538386793",
        "total_parcels": 37,
        "financial_breakdown": {
          "collectable_amount": 124500,
          "collected_amount": 121300,
          "charges": {
            "delivery_charge": 6900,
            "cod_charge": 1200,
            "weight_charge": 950,
            "return_charge": 500,
            "discount": 0,
            "total_charges": 9550
          }
        },
        "payable_amount": 111750,
        "payment_method": {
          "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
          "method_type": "BANK_ACCOUNT"
        }
      }
    ],
    "pagination": {
      "total": 82,
      "page": 1,
      "limit": 10,
      "totalPages": 9
    }
  },
  "message": "Invoices retrieved successfully"
}
```

------------------------------------------------------------

## 2.2 Orderwise Payment All (Across All Invoices)
GET /merchant-invoices/invoice-details

Short summary:
- Returns parcel-level order rows across all invoices.
- If invoice_id is sent, it returns single-invoice detailed view.

Query filters:
- invoice_id: UUID (optional)
- page, limit
- invoice_status: UNPAID | PROCESSING | PAID
- order_status: ParcelStatus
- store_id: UUID
- from_date / to_date
- fromDate / toDate (alias supported)
- search
- sort_by: order_date | receivable_amount
- sort_order: ASC | DESC
- merchant_id (admin use; merchant token auto-scoped)

Request body:
- None

Example request (all):
- /merchant-invoices/invoice-details?page=1&limit=10&order_status=DELIVERED&sort_by=order_date&sort_order=DESC

Success response example (without invoice_id):
```json
{
  "success": true,
  "data": {
    "invoice_details": [
      {
        "invoice": {
          "id": "e138ca08-c220-4e80-bf34-9680ca7f10aa",
          "invoice_no": "INV-2026-000145",
          "transaction_id": "MF-250411-001145",
          "status": "PAID",
          "invoice_date": "2026-04-08T09:15:00.000Z",
          "paid_at": "2026-04-08T12:41:12.000Z",
          "merchant_id": "df32ef2e-96fe-4a1d-8723-78372129a05e"
        },
        "parcel": {
          "parcel_id": "5c0196be-a251-4152-87db-f5f48cb25311",
          "parcel_tx_id": "MF250411000234",
          "tracking_number": "TRK-20260411-00234",
          "order_id": "ORD-001",
          "order_date": "2026-04-07T08:00:00.000Z",
          "order_status": "DELIVERED",
          "invoice_type": "DELIVERY"
        },
        "customer": {
          "name": "John Customer",
          "phone": "01813445678",
          "address": "House 20, Road 5, Dhanmondi, Dhaka"
        },
        "store": {
          "store_id": "badc26d3-9f5c-47c8-b828-3c1828169f3d",
          "store_name": "I am a test store",
          "store_phone": "01538386793"
        },
        "financial": {
          "collectable_amount": 1400,
          "collected_amount": 1400,
          "delivery_fee": 80,
          "cod_fee": 10,
          "weight_charge": 5,
          "total_fee": 95,
          "return_charge": 0,
          "receivable_amount": 1305,
          "currency": "BDT"
        },
        "payment_method": {
          "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
          "method_type": "BANK_ACCOUNT"
        }
      }
    ],
    "pagination": {
      "total": 140,
      "page": 1,
      "limit": 10,
      "totalPages": 14
    },
    "summary": {
      "total_orders": 140,
      "total_invoices": 21,
      "total_collected_amount": 422500,
      "total_fee": 29810,
      "total_return_charge": 3800,
      "total_receivable": 388890
    }
  },
  "message": "All invoice details retrieved successfully"
}
```

Success response example (with invoice_id):
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "e138ca08-c220-4e80-bf34-9680ca7f10aa",
      "invoice_no": "INV-2026-000145",
      "transaction_id": "MF-250411-001145",
      "status": "PAID"
    },
    "merchant": {
      "id": "df32ef2e-96fe-4a1d-8723-78372129a05e",
      "name": "MD.Sifat Stores",
      "phone": "+8801538386793"
    },
    "payment_method": {
      "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
      "method_type": "BANK_ACCOUNT"
    },
    "summary": {
      "total_parcels": 37,
      "delivered_count": 31,
      "partial_delivery_count": 2,
      "returned_count": 4,
      "paid_return_count": 0,
      "total_cod_amount": 124500,
      "total_cod_collected": 121300,
      "total_delivery_charges": 9050,
      "total_return_charges": 500,
      "payable_amount": 111750
    },
    "parcels": [],
    "pagination": {
      "total": 37,
      "page": 1,
      "limit": 10,
      "totalPages": 4
    }
  },
  "message": "Invoice details retrieved successfully"
}
```

------------------------------------------------------------

## 2.3 Orderwise Payment By Invoice (Collection label says "Without InvoiceId")
GET /merchant-invoices/:id

Short summary:
- Returns detailed parcel list and summary for a specific invoice.

Note:
- Collection item name is misleading; this endpoint requires invoice id in path.

Path param:
- id: invoice UUID

Query filters:
- page, limit
- order_status: ParcelStatus
- invoice_status: UNPAID | PROCESSING | PAID
- store_id: UUID
- from_date, to_date
- sort_by: order_date | receivable_amount
- sort_order: ASC | DESC

Request body:
- None

Example request:
- /merchant-invoices/e138ca08-c220-4e80-bf34-9680ca7f10aa?page=1&limit=10&order_status=DELIVERED&sort_by=order_date&sort_order=DESC

Success response:
- Same data structure as section 2.2 "with invoice_id" response.

Common errors:
- 404 invoice not found
- unauthorized access for merchant when invoice is not owned by token merchant

------------------------------------------------------------


------------------------------------------------------------

## 2.5 Advance Invoice List
GET /advance-payments/merchant/invoice/list

Short summary:
- Returns merchant advance invoices with pagination and filters.

Query filters:
- page (default 1)
- limit (default 10)
- status:
  - PENDING_MERCHANT_APPROVAL
  - MERCHANT_REVIEW_REQUESTED
  - APPROVED_BY_MERCHANT
  - PAID
  - CANCELLED
- start_date
- end_date
- search (invoice_id search)

Request body:
- None

Example request:
- /advance-payments/merchant/invoice/list?status=PENDING_MERCHANT_APPROVAL&page=1&limit=20

Success response example:
```json
{
  "success": true,
  "data": [
    {
      "id": "ee0c7a04-8ec9-421d-af00-dfa9e0ca2aa6",
      "invoice_id": "ADV-958640",
      "created_at": "2026-04-05T11:10:00.000Z",
      "merchant_name": "MD.Sifat Stores",
      "merchant_phone": "+8801538386793",
      "total_parcels": 22,
      "net_amount": 16500,
      "status": "PENDING_MERCHANT_APPROVAL",
      "is_paid": false,
      "paid_at": null
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "My advance payments retrieved successfully"
}
```

------------------------------------------------------------

## 2.6 Advance Invoice Details
GET /advance-payments/merchant/invoice/:id

Short summary:
- Returns detailed advance invoice breakdown and workflow info.

Path param:
- id: advance invoice UUID

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "id": "ee0c7a04-8ec9-421d-af00-dfa9e0ca2aa6",
    "invoice_id": "ADV-958640",
    "status": "PENDING_MERCHANT_APPROVAL",
    "created_at": "2026-04-05T11:10:00.000Z",
    "paid_at": null,
    "is_paid": false,
    "merchant": {
      "id": "df32ef2e-96fe-4a1d-8723-78372129a05e",
      "name": "MD.Sifat Stores",
      "phone": "+8801538386793"
    },
    "breakdown": {
      "total_parcels": 22,
      "total_collectable": 22000,
      "deductions": {
        "delivery_fee": 2500,
        "cod_charge": 500,
        "weight_charge": 300,
        "return_charge": 2200
      },
      "net_payable": 16500
    },
    "payment_method": "BANK_TRANSFER",
    "admin_note": "Advance released against settlement cycle",
    "merchant_review_note": "",
    "created_by": "Admin"
  },
  "message": "Advance payment details retrieved successfully"
}
```

------------------------------------------------------------

## 2.7 Advance Invoice Action (Approve / Request Review)
PATCH /advance-payments/merchant/invoice/:id/action

Short summary:
- Merchant approves admin-created advance invoice, or requests review with note.

Path param:
- id: advance invoice UUID

Body variants:

Variant A (Approve):
```json
{
  "action": "APPROVE"
}
```

Variant B (Request Review):
```json
{
  "action": "REQUEST_REVIEW",
  "review_note": "Please verify delivery fee and weight charge deduction."
}
```

Success response example:
```json
{
  "id": "ee0c7a04-8ec9-421d-af00-dfa9e0ca2aa6",
  "invoice_id": "ADV-958640",
  "status": "APPROVED_BY_MERCHANT",
  "merchant_review_note": "",
  "updated_at": "2026-04-09T10:40:00.000Z"
}
```

Common errors:
- 400 review_note required when action=REQUEST_REVIEW
- 400 action not allowed in current status
- 403 if advance payment feature disabled for merchant

============================================================

# 3) Merchant Customer Fraud APIs

## 3.1 Get Fraud Customers List (Registered Customers List)
GET /customers/fraud/customers

Short summary:
- Returns paginated registered customers with order stats and fraud indicators.
- Includes new customer tagging: NEW_CUSTOMER or EXISTING_CUSTOMER.

Query filters:
- page (default 1)
- limit (default 20)
- search (name/phone)
- sortBy:
  - customer_name (default fallback)
  - total_orders
  - last_order_at
  - phone_number
- order: ASC | DESC

Request body:
- None

Example request:
- /customers/fraud/customers?page=1&limit=20&sortBy=total_orders&order=DESC

Success response example:
```json
{
  "success": true,
  "data": [
    {
      "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
      "customer_name": "John Customer",
      "phone_number": "01813445678",
      "total_orders": 12,
      "is_new_customer": false,
      "customer_tag": "EXISTING_CUSTOMER",
      "customer_rating": "83.33%",
      "success_rate": 83.33,
      "delivered_count": 10,
      "cancelled_returned_count": 2,
      "fraud_status": {
        "in_fraud_list": true,
        "approved_reports_count": 1,
        "pending_reports_count": 0
      }
    }
  ],
  "pagination": {
    "total": 95,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "All customers retrieved successfully"
}
```

------------------------------------------------------------

## 3.2 Get Customer Fraud Details by Phone
GET /customers/fraud/customers/phone/:phone

Short summary:
- Returns detailed fraud and order history breakdown for a customer phone.

Path param:
- phone: 01XXXXXXXXX

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
      "name": "John Customer",
      "address": "House 20, Road 5, Dhanmondi, Dhaka",
      "phone": "01813445678",
      "is_new_customer": false,
      "customer_tag": "EXISTING_CUSTOMER",
      "last_order_placed_on": "7th April, 2026"
    },
    "order_history_breakdown": {
      "delivered": 10,
      "cancelled_returned": 2,
      "total_orders": 12,
      "successfully_delivered": 10,
      "success_rate": "83.33%",
      "overall_success_rate": "83.33%",
      "overall_success_rate_formula": "(10 Delivered / 12 Orders)"
    },
    "fraud_list": {
      "is_in_fraud_list": true,
      "approved_reports_count": 1,
      "pending_reports_count": 0,
      "reports": []
    }
  },
  "message": "Customer fraud details retrieved successfully"
}
```

------------------------------------------------------------

## 3.3 Get Customer Fraud Details by Customer ID
GET /customers/fraud/customers/:customerId

Short summary:
- Same response shape as phone lookup but uses customerId.

Path param:
- customerId: UUID

Request body:
- None

------------------------------------------------------------

## 3.4 Submit Fraud Request
POST /customers/fraud/requests

Short summary:
- Merchant submits fraud report for a customer.

Body variants:

Variant A (by customer_id):
```json
{
  "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
  "reason": "Repeated fake booking and refused delivery."
}
```

Variant B (by phone_number):
```json
{
  "phone_number": "01712121212",
  "reason": "Customer repeatedly cancels after dispatch."
}
```

Rules:
- Either customer_id or phone_number is required.
- reason is required.
- Duplicate active request by same merchant for same customer is blocked.

Success response example:
```json
{
  "success": true,
  "data": {
    "id": "f50f8482-1d60-4f66-8d37-f23b7f3dc840",
    "customer_id": "3f1f8b74-9bba-4a4f-9716-03a5fdc47f8c",
    "merchant_id": "df32ef2e-96fe-4a1d-8723-78372129a05e",
    "status": "PENDING",
    "reason": "Repeated fake booking and refused delivery.",
    "is_active": true,
    "created_at": "2026-04-09T10:55:00.000Z"
  },
  "message": "Fraud list request submitted successfully"
}
```

Common errors:
- 400 Either customer_id or phone_number is required
- 400 duplicate active fraud request
- 404 customer not found

------------------------------------------------------------

## 3.5 Remove Fraud List Request by Customer ID
DELETE /customers/fraud/customers/:customerId

Short summary:
- Removes merchant's latest active fraud entry for that customer by marking it REMOVED.

Path param:
- customerId: UUID

Request body:
- None

Important note:
- Collection shows action/admin_note in body, but backend does not use request body for this endpoint.

Success response example:
```json
{
  "success": true,
  "data": {
    "id": "f50f8482-1d60-4f66-8d37-f23b7f3dc840",
    "status": "REMOVED",
    "is_active": false,
    "removed_at": "2026-04-09T11:05:00.000Z",
    "removed_by_merchant_id": "df32ef2e-96fe-4a1d-8723-78372129a05e"
  },
  "message": "Customer removed from fraud list successfully"
}
```

Common errors:
- 404 no active fraud list entry found for this customer by your account

============================================================

# 4) Merchant Payout Settings APIs

## 4.1 Available Payment Methods
GET /merchants/my/payout-methods/available

Short summary:
- Returns only method types not yet added by this merchant.

Query filters:
- None

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "available_methods": ["BANK_ACCOUNT", "BKASH", "NAGAD", "CASH"]
  },
  "message": "Available payout methods retrieved successfully"
}
```

------------------------------------------------------------

## 4.2 Current Payout Options
GET /merchants/my/payout-methods

Short summary:
- Returns all added payout methods, ordered with default method first.

Query filters:
- None

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "current_methods": [
      {
        "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
        "merchant_id": "df32ef2e-96fe-4a1d-8723-78372129a05e",
        "method_type": "BANK_ACCOUNT",
        "status": "VERIFIED",
        "is_default": true,
        "bank_name": "Dutch Bangla Bank",
        "branch_name": "Dhaka Main Branch",
        "account_holder_name": "John Doe",
        "account_number": "1234567890",
        "routing_number": "090123456",
        "verified_at": "2026-04-01T10:00:00.000Z",
        "created_at": "2026-03-25T09:00:00.000Z",
        "updated_at": "2026-04-01T10:00:00.000Z"
      }
    ]
  },
  "message": "Payout methods retrieved successfully"
}
```

------------------------------------------------------------

## 4.3 Add Payout Method
POST /merchants/my/payout-methods

Short summary:
- Adds one payout method. Only one method per method_type is allowed per merchant.

Method types:
- BANK_ACCOUNT
- BKASH
- NAGAD
- CASH

Body variants:

Variant A (Bank Account):
```json
{
  "method_type": "BANK_ACCOUNT",
  "bank_name": "Dutch Bangla Bank",
  "branch_name": "Dhaka Main Branch",
  "account_holder_name": "John Doe",
  "account_number": "1234567890",
  "routing_number": "090123456"
}
```

Variant B (bKash):
```json
{
  "method_type": "BKASH",
  "bkash_number": "01712345678",
  "bkash_account_holder_name": "John Doe",
  "bkash_account_type": "PERSONAL"
}
```

Variant C (Nagad):
```json
{
  "method_type": "NAGAD",
  "nagad_number": "01812345678",
  "nagad_account_holder_name": "John Doe",
  "nagad_account_type": "PERSONAL"
}
```

Variant D (Cash):
```json
{
  "method_type": "CASH"
}
```

Validation rules:
- BKASH and NAGAD numbers must match 01[3-9]XXXXXXXX format.
- BANK_ACCOUNT requires all bank_* and account_* fields.
- BKASH account type: PERSONAL | MERCHANT | AGENT.
- NAGAD account type: PERSONAL | MERCHANT.

Success response example:
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
      "method_type": "BKASH",
      "status": "PENDING",
      "is_default": false,
      "bkash_number": "01712345678"
    }
  },
  "message": "Payout method added successfully"
}
```

Common errors:
- 409 when same method_type already exists for merchant
- 400 validation errors for missing required fields

------------------------------------------------------------

## 4.4 Update Payout Method
PATCH /merchants/my/payout-methods/:id

Short summary:
- Updates an existing payout method using partial fields.

Path param:
- id: payout method UUID

Body:
- Partial update of add fields. Example:
```json
{
  "branch_name": "Gulshan Branch",
  "account_holder_name": "John A. Doe"
}
```

Success response example:
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
      "method_type": "BANK_ACCOUNT",
      "status": "VERIFIED",
      "is_default": true,
      "branch_name": "Gulshan Branch"
    }
  },
  "message": "Payout method updated successfully"
}
```

Common errors:
- 404 payout method not found

------------------------------------------------------------

## 4.5 Set Default Payment Method
PATCH /merchants/my/payout-methods/:id/set-default

Short summary:
- Sets a verified method as merchant default payout method.

Path param:
- id: payout method UUID

Request body:
- None

Success response example:
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
      "method_type": "BANK_ACCOUNT",
      "status": "VERIFIED",
      "is_default": true
    }
  },
  "message": "Default payout method set successfully"
}
```

Common errors:
- 400 only verified methods can be set as default
- 404 payout method not found

Important collection mismatch:
- Postman item currently uses POST for this action.
- Backend route is PATCH and should be used by frontend.

------------------------------------------------------------

## 4.6 Delete Method
DELETE /merchants/my/payout-methods/:id

Short summary:
- Deletes a payout method owned by merchant.

Path param:
- id: payout method UUID

Request body:
- None

Success response example:
```json
{
  "success": true,
  "message": "Payout method deleted successfully"
}
```

Common errors:
- 404 payout method not found

Important collection mismatch:
- Postman URL currently shows :d.
- Backend route uses :id.

------------------------------------------------------------

## 4.7 Get My Payout Transactions
GET /merchants/my/payout-transactions

Short summary:
- Returns paginated payout transaction history for merchant.

Query filters:
- page: number (default 1)
- limit: number (default 10)

Request body:
- None

Transaction status values:
- PENDING
- PROCESSING
- COMPLETED
- FAILED
- CANCELLED

Success response example:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "5ff99618-ebac-45b9-9d9b-1458d62f53d9",
        "merchant_id": "df32ef2e-96fe-4a1d-8723-78372129a05e",
        "payout_method_id": "41fe2012-bfd5-4591-a51f-f4a5a11bb1c0",
        "amount": 111750,
        "reference_number": "PAYOUT-20260409-001",
        "status": "COMPLETED",
        "admin_notes": "Paid via bank transfer",
        "initiated_at": "2026-04-09T08:00:00.000Z",
        "processed_at": "2026-04-09T08:05:00.000Z",
        "completed_at": "2026-04-09T08:10:00.000Z",
        "created_at": "2026-04-09T08:00:00.000Z",
        "updated_at": "2026-04-09T08:10:00.000Z"
      }
    ],
    "pagination": {
      "total": 24,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  },
  "message": "Payout transactions retrieved successfully"
}
```

============================================================

# 5) Merchant Profile Settings & Security APIs

## 5.1 Get Merchant Settings (Profile + Documents)
GET /merchants/settings

Short summary:
- Returns merchant profile settings and uploaded document status data.

Query filters:
- None

Request body:
- None

Success response example:
```json
{
  "profile_img_url": "https://cdn.example.com/merchants/logo/merchant-profile.jpg",
  "business_name": "My Electronics Store",
  "contact_person_name": "John Doe",
  "contact_number": "+8801712345678",
  "contact_email": "merchant@example.com",
  "optional_phone_number": "+8801812345678",
  "documents": {
    "nid": {
      "number": "10045798798",
      "front": "https://cdn.example.com/merchants/nid/front.jpg",
      "back": "https://cdn.example.com/merchants/nid/back.jpg",
      "verified": false
    },
    "trade_license": {
      "number": "TL-10045798798",
      "url": "https://cdn.example.com/merchants/trade-license/trade-license.jpg",
      "verified": false
    },
    "tin": {
      "number": "123456",
      "url": "https://cdn.example.com/merchants/tin/tin.jpg",
      "verified": false
    },
    "bin": {
      "number": "123456",
      "url": "https://cdn.example.com/merchants/bin/bin.jpg",
      "verified": false
    }
  }
}
```

------------------------------------------------------------

## 5.2 Update Merchant Profile Details
PATCH /merchants/profile-details

Short summary:
- Merchant can update business name, contact person, contact email, phone, optional phone, and profile photo URL.

Request body (all optional):
```json
{
  "business_name": "My Electronics Store",
  "contact_person_name": "John Doe",
  "contact_email": "merchant@example.com",
  "contact_number": "+8801712345678",
  "optional_phone_number": "+8801812345678",
  "profile_img_url": "https://cdn.example.com/merchants/logo/merchant-profile.jpg"
}
```

Alias support:
- secondary_number can be sent instead of optional_phone_number.

Validation:
- contact_number and optional_phone_number accept Bangladesh format: 01XXXXXXXXX or +8801XXXXXXXXX.
- contact_email must be valid email.
- If both optional_phone_number and secondary_number are sent, both values must be same.

Success response example:
```json
{
  "success": true,
  "message": "Profile details updated"
}
```

Common errors:
- 409 phone already registered
- 409 email already registered

------------------------------------------------------------

## 5.3 Update NID Document (Required)
PATCH /merchants/documents/nid

Short summary:
- Upload NID data with required number, front image/pdf URL, and back image/pdf URL.

Request body:
```json
{
  "nid_number": "10045798798",
  "nid_front_url": "https://cdn.example.com/merchants/nid/front.jpg",
  "nid_back_url": "https://cdn.example.com/merchants/nid/back.jpg"
}
```

Success response:
- Returns updated merchant profile entity.

------------------------------------------------------------

## 5.4 Update Trade License (Required)
PATCH /merchants/documents/trade-license

Short summary:
- Upload trade license number and front document URL.

Request body:
```json
{
  "trade_license_number": "10045798798",
  "trade_license_url": "https://cdn.example.com/merchants/trade-license/front.jpg"
}
```

Success response:
- Returns updated merchant profile entity.

------------------------------------------------------------

## 5.5 Update TIN (Optional)
PATCH /merchants/documents/tin

Short summary:
- Upload TIN number and document URL when merchant has TIN.

Request body:
```json
{
  "tin_number": "123456",
  "tin_certificate_url": "https://cdn.example.com/merchants/tin/front.jpg"
}
```

Success response:
- Returns updated merchant profile entity.

------------------------------------------------------------

## 5.6 Update BIN (Optional)
PATCH /merchants/documents/bin

Short summary:
- Upload BIN number and document URL when merchant has BIN.

Request body:
```json
{
  "bin_number": "123456",
  "bin_certificate_url": "https://cdn.example.com/merchants/bin/front.jpg"
}
```

Success response:
- Returns updated merchant profile entity.

------------------------------------------------------------

## 5.7 Change Merchant Password
PATCH /merchants/profile/password

Short summary:
- Merchant changes password using current_password, new_password, confirm_new_password.

Request body:
```json
{
  "current_password": "CurrentPassword@123",
  "new_password": "NewPassword@123",
  "confirm_new_password": "NewPassword@123"
}
```

Validation:
- new_password min length is 8.
- new_password must match confirm_new_password.
- new_password must be different from current_password.

Success response:
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

Common errors:
- 401 current password is incorrect
- 400 password mismatch or invalid new password

------------------------------------------------------------

## 5.8 File Upload Flow (Profile Photo + Documents)

Step 1: Get signed upload URL
- POST /upload/signed-url

Body example:
```json
{
  "fileName": "merchant-nid-front.jpg",
  "fileType": "image/jpeg",
  "module": "merchants/nid"
}
```

Supported module values for merchant settings:
- merchants/logo
- merchants/nid
- merchants/trade-license
- merchants/tin
- merchants/bin

Step 2:
- Upload file using returned signedUrl (PUT to S3).

Step 3:
- Save returned readUrl in profile/document endpoint body fields.

Upload response example:
```json
{
  "success": true,
  "message": "Signed URL generated successfully",
  "signedUrl": "https://...",
  "fileKey": "merchants/nid/uuid-timestamp.jpg",
  "readUrl": "https://..."
}
```

Frontend file validation rules (UI level):
- NID and document files: PNG, JPEG, PDF
- Max size: 2MB per file

============================================================

# Final Frontend Notes
- Use merchant token only for these endpoints.
- Keep snake_case query keys where shown (from_date, to_date, sort_by).
- For invoice-details endpoint, use invoice_id in query only when you want a single invoice detail view; otherwise omit it for all order rows.
- For lifetime summary, send both startDate and endDate together, or send neither.
- For Customer Fraud removal, do not send action/admin_note body; path param is enough.
- For payout set-default, frontend must call PATCH /merchants/my/payout-methods/:id/set-default.
- CASH payout method is auto-verified in backend and can become default immediately if no default exists.
- Merchant profile endpoints for settings/documents are under /merchants/settings, /merchants/profile-details, and /merchants/documents/*.
- Merchant password change endpoint is /merchants/profile/password with current/new/confirm fields.
