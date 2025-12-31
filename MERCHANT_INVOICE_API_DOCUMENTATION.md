# Merchant Invoice System - API Documentation

## 📋 Overview

The **Merchant Invoice System** allows admins to generate invoices for merchants based on delivered parcels, track payments, and handle clearances. This system ensures accurate financial tracking and prevents double payments.

---

## 🎯 Key Features

✅ **Eligible Parcel Detection** - Automatically identify parcels ready for invoicing  
✅ **Invoice Generation** - Batch multiple parcels into a single invoice  
✅ **Financial Calculations** - Accurate COD, delivery charges, and return charges  
✅ **Payment Tracking** - Mark invoices as paid and update parcel statuses  
✅ **Double Payment Prevention** - Parcels can only be invoiced once  
✅ **Audit Trail** - Complete history of all financial transactions  

---

## 🗄️ Database Schema

### New Fields in `parcels` Table

| Field | Type | Description |
|-------|------|-------------|
| `cod_collected_amount` | DECIMAL(10,2) | Actual COD collected (may differ from cod_amount) |
| `return_charge` | DECIMAL(10,2) | Calculated return charge |
| `delivery_charge_applicable` | BOOLEAN | Whether delivery charge applies |
| `return_charge_applicable` | BOOLEAN | Whether return charge applies |
| `financial_status` | ENUM | PENDING, INVOICED, PAID, etc. |
| `invoice_id` | UUID | Link to merchant_invoices (prevents double payment) |
| `clearance_required` | BOOLEAN | Needs money recovery |
| `clearance_done` | BOOLEAN | Recovery completed |
| `clearance_invoice_id` | UUID | Link to clearance invoice |
| `paid_amount` | DECIMAL(10,2) | Actual amount paid in invoice |

### New Table: `merchant_invoices`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `invoice_no` | VARCHAR(50) | Unique invoice number (INV-YYYY-MM-XXXX) |
| `merchant_id` | UUID | Merchant reference |
| `total_parcels` | INTEGER | Total parcels in invoice |
| `delivered_count` | INTEGER | Count of delivered parcels |
| `partial_delivery_count` | INTEGER | Count of partial deliveries |
| `returned_count` | INTEGER | Count of returned parcels |
| `paid_return_count` | INTEGER | Count of paid returns |
| `total_cod_amount` | DECIMAL(12,2) | Expected COD total |
| `total_cod_collected` | DECIMAL(12,2) | Actually collected total |
| `total_delivery_charges` | DECIMAL(12,2) | Sum of delivery charges |
| `total_return_charges` | DECIMAL(12,2) | Sum of return charges |
| `payable_amount` | DECIMAL(12,2) | Net amount to pay merchant |
| `invoice_status` | ENUM | GENERATED, PAID, CANCELLED |
| `paid_at` | TIMESTAMP | When invoice was paid |
| `paid_by` | UUID | Admin who marked as paid |
| `payment_reference` | VARCHAR(100) | Payment reference number |
| `notes` | TEXT | Admin notes |

---

## 🔐 API Endpoints

### Base URL
```
http://localhost:3000/merchant-invoices
```

---

## 1️⃣ Get Eligible Parcels for Invoice

**GET** `/merchant-invoices/eligible-parcels`

**Authorization:** Merchant or Admin

**Description:** Get list of parcels that can be included in an invoice.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | No* | Merchant ID (required for admin, auto-filled for merchant) |

*Required for admin, automatically filled for merchants

### Eligibility Criteria

A parcel is eligible if:
- ✅ `invoice_id` IS NULL (not already invoiced)
- ✅ `paid_to_merchant` = false
- ✅ `financial_status` = PENDING
- ✅ Has money to pay OR charges to collect:
  - `cod_collected_amount` > 0, OR
  - `delivery_charge_applicable` = true, OR
  - `return_charge_applicable` = true

### Request Example

```http
GET /merchant-invoices/eligible-parcels?merchant_id=merchant-uuid-123
Authorization: Bearer {admin_token}
```

### Response

```json
{
  "success": true,
  "data": {
    "merchant_id": "merchant-uuid-123",
    "eligible_parcels": [
      {
        "parcel_id": "parcel-uuid-1",
        "tracking_number": "TRK123456",
        "status": "DELIVERED",
        "cod_amount": 5000.00,
        "cod_collected": 5000.00,
        "delivery_charge": 155.00,
        "return_charge": 0.00,
        "delivery_charge_applicable": true,
        "return_charge_applicable": false,
        "net_payable": 4845.00
      },
      {
        "parcel_id": "parcel-uuid-2",
        "tracking_number": "TRK123457",
        "status": "RETURNED",
        "cod_amount": 3000.00,
        "cod_collected": 0.00,
        "delivery_charge": 60.00,
        "return_charge": 80.00,
        "delivery_charge_applicable": false,
        "return_charge_applicable": true,
        "net_payable": -80.00
      }
    ],
    "total_count": 2,
    "summary": {
      "total_cod_collected": 5000.00,
      "total_delivery_charges": 155.00,
      "total_return_charges": 80.00,
      "estimated_payable": 4765.00
    }
  },
  "message": "Eligible parcels retrieved successfully"
}
```

**Note:** `net_payable` can be negative (merchant owes us for return charges)

---

## 2️⃣ Generate Merchant Invoice

**POST** `/merchant-invoices`

**Authorization:** Admin Only

**Description:** Generate an invoice for selected parcels.

### Request Body

```json
{
  "merchant_id": "merchant-uuid-123",
  "parcel_ids": [
    "parcel-uuid-1",
    "parcel-uuid-2",
    "parcel-uuid-3"
  ]
}
```

### Validation Rules

1. ✅ All parcels must belong to the specified merchant
2. ✅ All parcels must be eligible (not already invoiced or paid)
3. ✅ At least 1 parcel must be included
4. ✅ Transaction is atomic (all or nothing)

### Response

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid-456",
      "invoice_no": "INV-2024-12-0034",
      "merchant_id": "merchant-uuid-123",
      "total_parcels": 3,
      "delivered_count": 2,
      "partial_delivery_count": 0,
      "returned_count": 1,
      "paid_return_count": 0,
      "total_cod_amount": 13000.00,
      "total_cod_collected": 10000.00,
      "total_delivery_charges": 370.00,
      "total_return_charges": 80.00,
      "payable_amount": 9550.00,
      "invoice_status": "GENERATED",
      "created_at": "2024-12-24T10:00:00.000Z"
    },
    "breakdown": {
      "total_parcels": 3,
      "delivered_count": 2,
      "returned_count": 1,
      "parcel_breakdowns": [
        {
          "parcel_id": "parcel-uuid-1",
          "tracking_number": "TRK123456",
          "net_payable": 4845.00
        },
        {
          "parcel_id": "parcel-uuid-2",
          "tracking_number": "TRK123457",
          "net_payable": 4785.00
        },
        {
          "parcel_id": "parcel-uuid-3",
          "tracking_number": "TRK123458",
          "net_payable": -80.00
        }
      ]
    }
  },
  "message": "Invoice generated successfully"
}
```

### What Happens

1. ✅ Invoice created with unique invoice number
2. ✅ All parcels linked to invoice (`invoice_id` set)
3. ✅ Parcel `financial_status` changed to INVOICED
4. ✅ Financial calculations performed
5. ✅ Transaction committed atomically

---

## 3️⃣ Get Invoice List

**GET** `/merchant-invoices`

**Authorization:** Merchant or Admin

**Description:** Get paginated list of invoices.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | No* | Filter by merchant (auto-filled for merchants) |
| `invoice_status` | ENUM | No | GENERATED, PAID, CANCELLED |
| `fromDate` | ISO Date | No | Start date filter |
| `toDate` | ISO Date | No | End date filter |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Items per page (default: 10, max: 100) |

*Automatically filled for merchants

### Request Example

```http
GET /merchant-invoices?invoice_status=GENERATED&page=1&limit=20
Authorization: Bearer {admin_token}
```

### Response

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "invoice-uuid-456",
        "invoice_no": "INV-2024-12-0034",
        "merchant_id": "merchant-uuid-123",
        "total_parcels": 34,
        "delivered_count": 28,
        "returned_count": 6,
        "total_cod_collected": 87000.00,
        "payable_amount": 81500.00,
        "invoice_status": "GENERATED",
        "created_at": "2024-12-24T10:00:00.000Z",
        "merchant": {
          "id": "merchant-uuid-123",
          "full_name": "John Doe Store",
          "phone": "01712345678"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  },
  "message": "Invoices retrieved successfully"
}
```

---

## 4️⃣ Get Invoice Details

**GET** `/merchant-invoices/:id`

**Authorization:** Merchant (own invoices) or Admin

**Description:** Get detailed invoice with parcel breakdown.

### Request Example

```http
GET /merchant-invoices/invoice-uuid-456
Authorization: Bearer {token}
```

### Response

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid-456",
      "invoice_no": "INV-2024-12-0034",
      "merchant_id": "merchant-uuid-123",
      "total_parcels": 3,
      "delivered_count": 2,
      "returned_count": 1,
      "total_cod_amount": 13000.00,
      "total_cod_collected": 10000.00,
      "total_delivery_charges": 370.00,
      "total_return_charges": 80.00,
      "payable_amount": 9550.00,
      "invoice_status": "GENERATED",
      "paid_at": null,
      "paid_by": null,
      "payment_reference": null,
      "notes": null,
      "created_at": "2024-12-24T10:00:00.000Z",
      "merchant": {
        "id": "merchant-uuid-123",
        "full_name": "John Doe Store",
        "phone": "01712345678"
      }
    },
    "parcels": [
      {
        "parcel_id": "parcel-uuid-1",
        "tracking_number": "TRK123456",
        "status": "DELIVERED",
        "cod_amount": 5000.00,
        "cod_collected": 5000.00,
        "delivery_charge": 155.00,
        "return_charge": 0.00,
        "delivery_charge_applicable": true,
        "return_charge_applicable": false,
        "net_payable": 4845.00
      },
      {
        "parcel_id": "parcel-uuid-2",
        "tracking_number": "TRK123457",
        "status": "DELIVERED",
        "cod_amount": 5000.00,
        "cod_collected": 5000.00,
        "delivery_charge": 215.00,
        "return_charge": 0.00,
        "delivery_charge_applicable": true,
        "return_charge_applicable": false,
        "net_payable": 4785.00
      },
      {
        "parcel_id": "parcel-uuid-3",
        "tracking_number": "TRK123458",
        "status": "RETURNED",
        "cod_amount": 3000.00,
        "cod_collected": 0.00,
        "delivery_charge": 60.00,
        "return_charge": 80.00,
        "delivery_charge_applicable": false,
        "return_charge_applicable": true,
        "net_payable": -80.00
      }
    ]
  },
  "message": "Invoice details retrieved successfully"
}
```

---

## 5️⃣ Mark Invoice as Paid

**POST** `/merchant-invoices/:id/pay`

**Authorization:** Admin Only

**Description:** Mark an invoice as paid and update all associated parcels.

### Request Body

```json
{
  "payment_reference": "BANK-TRX-123456",
  "notes": "Paid via bank transfer on 2024-12-24"
}
```

**All fields are optional**

### Request Example

```http
POST /merchant-invoices/invoice-uuid-456/pay
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "payment_reference": "BANK-TRX-123456",
  "notes": "Paid via bank transfer"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid-456",
      "invoice_no": "INV-2024-12-0034",
      "invoice_status": "PAID",
      "paid_at": "2024-12-24T12:00:00.000Z",
      "paid_by": "admin-user-id",
      "payment_reference": "BANK-TRX-123456",
      "notes": "Paid via bank transfer",
      "payable_amount": 9550.00
    }
  },
  "message": "Invoice marked as paid successfully"
}
```

### What Happens

1. ✅ Invoice `invoice_status` → PAID
2. ✅ Invoice `paid_at` → current timestamp
3. ✅ Invoice `paid_by` → admin user ID
4. ✅ For each parcel in invoice:
   - `paid_to_merchant` → true
   - `paid_to_merchant_at` → current timestamp
   - `paid_amount` → calculated net payable
   - `financial_status` → PAID
5. ✅ Transaction committed atomically

---

## 💰 Financial Calculation Logic

### Net Payable Formula

```javascript
Net Payable = COD Collected - Applicable Charges

Where:
- COD Collected = cod_collected_amount
- Applicable Charges = 
    (delivery_charge_applicable ? total_charge : 0) +
    (return_charge_applicable ? return_charge : 0)
```

### Examples

#### Example 1: Normal Delivered Parcel
```
COD Collected: ৳5,000
Delivery Charge: ৳155 (applicable)
Return Charge: ৳0 (not applicable)

Net Payable = ৳5,000 - ৳155 = ৳4,845
```

#### Example 2: Returned Parcel
```
COD Collected: ৳0
Delivery Charge: ৳60 (NOT applicable for returns)
Return Charge: ৳80 (applicable)

Net Payable = ৳0 - ৳80 = -৳80 (merchant owes us)
```

#### Example 3: Partial Delivery
```
COD Collected: ৳3,000 (partial)
Delivery Charge: ৳155 (applicable)
Return Charge: ৳0 (not applicable)

Net Payable = ৳3,000 - ৳155 = ৳2,845
```

---

## 🚫 Error Responses

### 400 - Bad Request

**Parcels already invoiced:**
```json
{
  "statusCode": 400,
  "message": "Parcels already invoiced or paid: TRK123456, TRK123457",
  "error": "Bad Request"
}
```

**Invoice not in GENERATED status:**
```json
{
  "statusCode": 400,
  "message": "Invoice is not in GENERATED status",
  "error": "Bad Request"
}
```

### 404 - Not Found

```json
{
  "statusCode": 404,
  "message": "Invoice not found",
  "error": "Not Found"
}
```

### 401 - Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## 🔄 Complete Workflow

### Step 1: Check Eligible Parcels
```http
GET /merchant-invoices/eligible-parcels?merchant_id=merchant-123
```

### Step 2: Generate Invoice
```http
POST /merchant-invoices
{
  "merchant_id": "merchant-123",
  "parcel_ids": ["parcel-1", "parcel-2", "parcel-3"]
}
```

### Step 3: Review Invoice Details
```http
GET /merchant-invoices/invoice-456
```

### Step 4: Mark as Paid
```http
POST /merchant-invoices/invoice-456/pay
{
  "payment_reference": "BANK-TRX-123",
  "notes": "Paid via bank transfer"
}
```

---

## 🔒 Security & Validation

### Double Payment Prevention

✅ **Invoice ID Check:** Parcels with `invoice_id` set cannot be invoiced again  
✅ **Paid Status Check:** Parcels with `paid_to_merchant = true` cannot be invoiced  
✅ **Financial Status:** Only PENDING parcels can be invoiced  
✅ **Atomic Transactions:** All operations are transactional  

### Authorization

| Endpoint | Merchant | Admin |
|----------|----------|-------|
| GET eligible-parcels | ✅ (own) | ✅ (all) |
| POST generate invoice | ❌ | ✅ |
| GET invoice list | ✅ (own) | ✅ (all) |
| GET invoice details | ✅ (own) | ✅ (all) |
| POST mark as paid | ❌ | ✅ |

---

## 📊 Invoice Number Format

```
INV-YYYY-MM-XXXX

Where:
- YYYY = Year (2024)
- MM = Month (01-12)
- XXXX = Sequential number (0001, 0002, ...)

Examples:
- INV-2024-12-0001
- INV-2024-12-0034
- INV-2025-01-0001
```

---

## ✅ Implementation Complete!

**Created Files:**
- ✅ Entity: `merchant-invoice.entity.ts`
- ✅ Service: `merchant-invoice.service.ts`
- ✅ Service: `invoice-calculation.service.ts`
- ✅ Controller: `merchant-invoice.controller.ts`
- ✅ DTOs: 3 files (generate, pay, query)
- ✅ Enum: `financial-status.enum.ts`
- ✅ Migration: `AddInvoiceSystemFields.ts`

**Database:**
- ✅ Table `merchant_invoices` created
- ✅ 10 new fields added to `parcels` table
- ✅ 8 indexes created for performance
- ✅ Foreign keys configured

**API Endpoints:**
- ✅ GET `/merchant-invoices/eligible-parcels`
- ✅ POST `/merchant-invoices`
- ✅ GET `/merchant-invoices`
- ✅ GET `/merchant-invoices/:id`
- ✅ POST `/merchant-invoices/:id/pay`

**Ready to use!** 🚀

