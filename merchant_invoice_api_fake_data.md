# Merchant Invoice & Advance Payment APIs — Fake Data Guide

> **Auth**: All endpoints require **JWT** with role **MERCHANT**. The `merchant_id` is auto-injected from the token (`req.user.userId` or `@CurrentUser('merchantId')`).

---

## 1. `GET /merchant-invoices`

**DTO**: `InvoiceQueryDto` — merchant_id is auto-set from JWT.

| Query Param | Type | Required | Default |
|---|---|---|---|
| `invoice_status` | `UNPAID \| PROCESSING \| PAID` | No | — |
| `fromDate` | ISO date string | No | — |
| `toDate` | ISO date string | No | — |
| `page` | number | No | 1 |
| `limit` | number (1-100) | No | 10 |

### Fake Response

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "invoice_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "invoice_no": "MI050526X7K2",
        "merchant_name": "Karim Clothing",
        "merchant_phone": "01712345678",
        "total_parcels": 5,
        "financial_breakdown": {
          "collectable_amount": 12500.00,
          "collected_amount": 11800.00,
          "charges": {
            "delivery_charge": 350.00,
            "cod_charge": 118.00,
            "weight_charge": 50.00,
            "return_charge": 0.00,
            "discount": 20.00,
            "total_charges": 498.00
          }
        },
        "payable_amount": 11302.00,
        "payment_method": {
          "id": "pm-uuid-001",
          "method_type": "BKASH"
        }
      },
      {
        "invoice_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "invoice_no": "MI040526R3M1",
        "merchant_name": "Karim Clothing",
        "merchant_phone": "01712345678",
        "total_parcels": 3,
        "financial_breakdown": {
          "collectable_amount": 7200.00,
          "collected_amount": 7200.00,
          "charges": {
            "delivery_charge": 210.00,
            "cod_charge": 72.00,
            "weight_charge": 0.00,
            "return_charge": 60.00,
            "discount": 0.00,
            "total_charges": 342.00
          }
        },
        "payable_amount": 6858.00,
        "payment_method": null
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Invoices retrieved successfully"
}
```

---

## 2. `GET /merchant-invoices/invoice-details`

**DTO**: `InvoiceDetailsFlexQueryDto` — If `invoice_id` is provided → returns that single invoice details (same shape as endpoint #3). If omitted → returns parcel-level rows across ALL invoices.

| Query Param | Type | Required | Default |
|---|---|---|---|
| `invoice_id` | UUID | No | — |
| `invoice_status` | `UNPAID \| PROCESSING \| PAID` | No | — |
| `order_status` | ParcelStatus enum | No | — |
| `store_id` | UUID | No | — |
| `from_date` / `fromDate` | ISO date | No | — |
| `to_date` / `toDate` | ISO date | No | — |
| `search` | string | No | — |
| `sort_by` | `order_date \| receivable_amount` | No | `order_date` |
| `sort_order` | `ASC \| DESC` | No | `DESC` |
| `page` | number | No | 1 |
| `limit` | number (1-100) | No | 10 |

### Fake Response (without `invoice_id` — all invoice details)

```json
{
  "success": true,
  "data": {
    "invoice_details": [
      {
        "invoice": {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "invoice_no": "MI050526X7K2",
          "transaction_id": "TXN-M3K9R2-AB12CD",
          "status": "PAID",
          "invoice_date": "2026-05-01T10:30:00.000Z",
          "paid_at": "2026-05-03T14:20:00.000Z",
          "merchant_id": "merchant-uuid-001"
        },
        "parcel": {
          "parcel_id": "parcel-uuid-001",
          "parcel_tx_id": "#139679",
          "tracking_number": "TRK-2026050100001",
          "order_id": "MERCH-ORD-101",
          "order_date": "2026-04-28T08:15:00.000Z",
          "order_status": "DELIVERED",
          "invoice_type": "DELIVERY"
        },
        "customer": {
          "name": "Rahim Uddin",
          "phone": "01898765432",
          "address": "House 12, Road 5, Dhanmondi, Dhaka"
        },
        "store": {
          "store_id": "store-uuid-001",
          "store_name": "Karim Fashion Hub",
          "store_phone": "01712345678"
        },
        "financial": {
          "collectable_amount": 2500.00,
          "collected_amount": 2500.00,
          "delivery_fee": 70.00,
          "cod_fee": 25.00,
          "weight_charge": 10.00,
          "total_fee": 100.00,
          "return_charge": 0,
          "receivable_amount": 2400.00,
          "currency": "BDT"
        },
        "payment_method": {
          "id": "pm-uuid-001",
          "method_type": "BKASH"
        }
      },
      {
        "invoice": {
          "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "invoice_no": "MI040526R3M1",
          "transaction_id": "TXN-N4L0S3-EF34GH",
          "status": "UNPAID",
          "invoice_date": "2026-05-02T12:00:00.000Z",
          "paid_at": null,
          "merchant_id": "merchant-uuid-001"
        },
        "parcel": {
          "parcel_id": "parcel-uuid-005",
          "parcel_tx_id": "#139683",
          "tracking_number": "TRK-2026050200005",
          "order_id": null,
          "order_date": "2026-04-30T09:00:00.000Z",
          "order_status": "RETURNED",
          "invoice_type": "RETURN"
        },
        "customer": {
          "name": "Fatima Begum",
          "phone": "01656789012",
          "address": "Apt 4B, Mirpur-10, Dhaka"
        },
        "store": {
          "store_id": "store-uuid-002",
          "store_name": "Karim Accessories",
          "store_phone": "01798765432"
        },
        "financial": {
          "collectable_amount": 1800.00,
          "collected_amount": 0,
          "delivery_fee": 70.00,
          "cod_fee": 0,
          "weight_charge": 0,
          "total_fee": 70.00,
          "return_charge": 60.00,
          "receivable_amount": -130.00,
          "currency": "BDT"
        },
        "payment_method": null
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    },
    "summary": {
      "total_orders": 2,
      "total_invoices": 2,
      "total_collected_amount": 2500.00,
      "total_fee": 170.00,
      "total_return_charge": 60.00,
      "total_receivable": 2270.00
    }
  },
  "message": "All invoice details retrieved successfully"
}
```

---

## 3. `GET /merchant-invoices/:id`

**Param**: `id` — UUID of the invoice.  
**DTO**: `InvoiceDetailsQueryDto`

| Query Param | Type | Required | Default |
|---|---|---|---|
| `page` | number | No | 1 |
| `limit` | number | No | 10 |
| `order_status` | ParcelStatus enum | No | — |
| `invoice_status` | `UNPAID \| PROCESSING \| PAID` | No | — |
| `store_id` | UUID | No | — |
| `from_date` | string | No | — |
| `to_date` | string | No | — |
| `sort_by` | `order_date \| receivable_amount` | No | `order_date` |
| `sort_order` | `ASC \| DESC` | No | `DESC` |

### Fake Response

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "invoice_no": "MI050526X7K2",
      "transaction_id": "TXN-M3K9R2-AB12CD",
      "date": "2026-05-01T10:30:00.000Z",
      "status": "PAID",
      "paid_at": "2026-05-03T14:20:00.000Z",
      "payment_reference": "BKASH-TXN-98765",
      "notes": null,
      "created_at": "2026-05-01T10:30:00.000Z",
      "updated_at": "2026-05-03T14:20:00.000Z"
    },
    "merchant": {
      "id": "merchant-uuid-001",
      "profile_id": "profile-uuid-001",
      "name": "Karim Clothing",
      "phone": "01712345678"
    },
    "payment_method": {
      "id": "pm-uuid-001",
      "method_type": "BKASH",
      "details": {
        "bkash_number": "01712345678",
        "bkash_account_holder_name": "Karim Hossain",
        "bkash_account_type": "PERSONAL"
      }
    },
    "summary": {
      "total_parcels": 5,
      "delivered_count": 4,
      "partial_delivery_count": 0,
      "returned_count": 1,
      "paid_return_count": 0,
      "total_cod_amount": 12500.00,
      "total_cod_collected": 11800.00,
      "total_delivery_charges": 498.00,
      "total_return_charges": 60.00,
      "payable_amount": 11302.00
    },
    "parcels": [
      {
        "parcel_info": {
          "parcel_id": "parcel-uuid-001",
          "parcel_tx_id": "#139679",
          "tracking_number": "TRK-2026050100001",
          "order_id": "MERCH-ORD-101",
          "order_date": "2026-04-28T08:15:00.000Z"
        },
        "customer_info": {
          "customer_id": "cust-uuid-001",
          "customer_name": "Rahim Uddin",
          "customer_phone": "01898765432",
          "customer_address": "House 12, Road 5, Dhanmondi, Dhaka"
        },
        "store_info": {
          "store_id": "store-uuid-001",
          "store_name": "Karim Fashion Hub",
          "store_phone": "01712345678"
        },
        "financial_info": {
          "receivable_amount": 2400.00,
          "currency": "BDT",
          "breakdown": {
            "collectable_amount": 2500.00,
            "collected_amount": 2500.00,
            "delivery_fee": 70.00,
            "cod_fee": 25.00,
            "weight_charge": 10.00,
            "discount": 0,
            "total_fee": 100.00,
            "return_charge": 0
          }
        },
        "status_info": {
          "order_status": "DELIVERED",
          "invoice_type": "DELIVERY",
          "invoice_status": "PAID"
        }
      },
      {
        "parcel_info": {
          "parcel_id": "parcel-uuid-002",
          "parcel_tx_id": "#139680",
          "tracking_number": "TRK-2026050100002",
          "order_id": "MERCH-ORD-102",
          "order_date": "2026-04-29T10:00:00.000Z"
        },
        "customer_info": {
          "customer_id": "cust-uuid-002",
          "customer_name": "Fatima Begum",
          "customer_phone": "01656789012",
          "customer_address": "Apt 4B, Mirpur-10, Dhaka"
        },
        "store_info": {
          "store_id": "store-uuid-001",
          "store_name": "Karim Fashion Hub",
          "store_phone": "01712345678"
        },
        "financial_info": {
          "receivable_amount": -130.00,
          "currency": "BDT",
          "breakdown": {
            "collectable_amount": 1800.00,
            "collected_amount": 0,
            "delivery_fee": 70.00,
            "cod_fee": 0,
            "weight_charge": 0,
            "discount": 0,
            "total_fee": 70.00,
            "return_charge": 60.00
          }
        },
        "status_info": {
          "order_status": "RETURNED",
          "invoice_type": "RETURN",
          "invoice_status": "PAID"
        }
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Invoice details retrieved successfully"
}
```

> [!NOTE]
> `payment_method.details` shape varies by `method_type`:
> - **BKASH**: `{ bkash_number, bkash_account_holder_name, bkash_account_type }`
> - **NAGAD**: `{ nagad_number, nagad_account_holder_name, nagad_account_type }`
> - **BANK_ACCOUNT**: `{ bank_name, branch_name, account_holder_name, account_number, routing_number }`
> - **CASH**: `{ type: "CASH" }`

---

## 4. `GET /advance-payments/merchant/invoice/list`

**Auth**: `@CurrentUser('merchantId')` — auto-scoped to merchant.  
**DTO**: `GetAdvancePaymentsQueryDto` extends `PaginationDto`

| Query Param | Type | Required | Default |
|---|---|---|---|
| `status` | `PENDING_MERCHANT_APPROVAL \| MERCHANT_REVIEW_REQUESTED \| APPROVED_BY_MERCHANT \| PAID \| CANCELLED` | No | — |
| `start_date` | string | No | — |
| `end_date` | string | No | — |
| `search` | string | No | — |
| `page` | number | No | 1 |
| `limit` | number (1-100) | No | 20 |
| `sortBy` | string | No | `created_at` |
| `order` | `ASC \| DESC` | No | `DESC` |

### Fake Response

```json
{
  "success": true,
  "data": [
    {
      "id": "adv-uuid-001",
      "invoice_id": "ADV-567890",
      "created_at": "2026-05-01T09:00:00.000Z",
      "merchant_name": "Karim Clothing",
      "merchant_phone": "01712345678",
      "total_parcels": 10,
      "net_amount": 8500.00,
      "status": "PENDING_MERCHANT_APPROVAL",
      "is_paid": false,
      "paid_at": null
    },
    {
      "id": "adv-uuid-002",
      "invoice_id": "ADV-234567",
      "created_at": "2026-04-25T15:30:00.000Z",
      "merchant_name": "Karim Clothing",
      "merchant_phone": "01712345678",
      "total_parcels": 7,
      "net_amount": 5200.00,
      "status": "PAID",
      "is_paid": true,
      "paid_at": "2026-04-27T11:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "My advance payments retrieved successfully"
}
```

---

## 5. `GET /advance-payments/merchant/invoice/:id`

**Param**: `id` — UUID of the advance payment.  
**Auth**: Ownership verified via `merchantId` from JWT.

### Fake Response

```json
{
  "success": true,
  "data": {
    "id": "adv-uuid-001",
    "invoice_id": "ADV-567890",
    "status": "PENDING_MERCHANT_APPROVAL",
    "created_at": "2026-05-01T09:00:00.000Z",
    "paid_at": null,
    "is_paid": false,
    "merchant": {
      "id": "merchant-entity-uuid-001",
      "name": "Karim Clothing",
      "phone": "01712345678"
    },
    "breakdown": {
      "total_parcels": 10,
      "total_collectable": 15000.00,
      "deductions": {
        "delivery_fee": 3500.00,
        "cod_charge": 1500.00,
        "weight_charge": 500.00,
        "return_charge": 1000.00
      },
      "net_payable": 8500.00
    },
    "payment_method": "BKASH",
    "admin_note": "Advance for bulk order batch",
    "merchant_review_note": null,
    "created_by": "Admin User"
  },
  "message": "Advance payment details retrieved successfully"
}
```

---

## Quick Reference — Enum Values

| Enum | Values |
|---|---|
| **InvoiceStatus** | `UNPAID`, `PROCESSING`, `PAID` |
| **AdvancePaymentStatus** | `PENDING_MERCHANT_APPROVAL`, `MERCHANT_REVIEW_REQUESTED`, `APPROVED_BY_MERCHANT`, `PAID`, `CANCELLED` |
| **ParcelStatus** | `PENDING`, `PICKED_UP`, `IN_HUB`, `ASSIGNED_TO_RIDER`, `OUT_FOR_DELIVERY`, `IN_TRANSIT`, `DELIVERED`, `PARTIAL_DELIVERY`, `EXCHANGE`, `FAILED_DELIVERY`, `RETURNED_TO_HUB`, `CANCELLED`, `RETURNED`, `PAID_RETURN`, `RETURN_TO_MERCHANT`, `DELIVERY_RESCHEDULED` |
| **PayoutMethodType** | `BANK_ACCOUNT`, `BKASH`, `NAGAD`, `CASH` |

## Key Notes for Frontend

1. **All UUIDs** are v4 format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
2. **All amounts** are numbers (not strings), with 2 decimal precision, currency is always `BDT`.
3. **`payment_method` can be `null`** — handle gracefully.
4. **Negative `receivable_amount`** is valid for returned parcels (merchant owes charges).
5. **`invoice_type`** is either `"DELIVERY"` or `"RETURN"` — derived from `order_status`.
6. **Pagination** shape differs slightly between modules:
   - Merchant invoices: `{ total, page, limit, totalPages }`
   - Advance payments: `{ total, page, limit, totalPages, hasNext, hasPrev }`
