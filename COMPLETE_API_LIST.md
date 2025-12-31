# 🎯 Complete Merchant Invoice API List

## Base URL
```
http://localhost:3000/merchant-invoices
```

---

## 📋 All 6 Endpoints

### 1. **Get Unpaid Parcels by Store** ⭐ NEW

```http
GET /merchant-invoices/unpaid-by-store
```

**Authorization:** Merchant (own) / Admin (all)

**Query Parameters:**
- `merchant_id` (UUID) - Optional for merchant, required for admin

**Purpose:** Shows unpaid parcels grouped by store/branch with financial summary

**Response:**
```json
{
  "success": true,
  "data": {
    "merchant_id": "xxx",
    "merchant_name": "Booklet Design BD",
    "stores": [
      {
        "store_name": "Dhaka Branch",
        "total_unpaid_parcels": 240,
        "total_cod_collected": 46656.00,
        "total_delivery_charges": 16400.00,
        "total_return_charges": 1200.00,
        "due_amount": 29056.00
      }
    ],
    "summary": {
      "total_stores": 2,
      "total_unpaid_parcels": 390,
      "total_due": 51416.00
    }
  }
}
```

**Use Case:** Admin/Merchant wants to see unpaid balance by store

---

### 2. **Get Eligible Parcels**

```http
GET /merchant-invoices/eligible-parcels
```

**Authorization:** Merchant (own) / Admin (all)

**Query Parameters:**
- `merchant_id` (UUID) - Optional for merchant, required for admin

**Purpose:** Get detailed list of all eligible parcels (not grouped)

**Response:**
```json
{
  "success": true,
  "data": {
    "eligible_parcels": [
      {
        "parcel_id": "xxx",
        "tracking_number": "TRK123456",
        "cod_collected": 5000.00,
        "delivery_charge": 155.00,
        "net_payable": 4845.00
      }
    ],
    "total_count": 240
  }
}
```

**Use Case:** Admin needs parcel IDs to generate invoice

---

### 3. **Generate Invoice**

```http
POST /merchant-invoices
```

**Authorization:** Admin Only

**Request Body:**
```json
{
  "merchant_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2"]
}
```

**Purpose:** Create invoice for selected parcels

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_no": "INV-2024-12-0034",
      "payable_amount": 51416.00,
      "invoice_status": "GENERATED"
    }
  }
}
```

**Use Case:** Admin generates invoice after reviewing unpaid parcels

---

### 4. **List Invoices**

```http
GET /merchant-invoices
```

**Authorization:** Merchant (own) / Admin (all)

**Query Parameters:**
- `merchant_id` (UUID) - Optional
- `invoice_status` (ENUM) - GENERATED, PAID, CANCELLED
- `fromDate` (ISO Date) - Optional
- `toDate` (ISO Date) - Optional
- `page` (Number) - Default: 1
- `limit` (Number) - Default: 10, Max: 100

**Purpose:** Get paginated list of invoices

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

**Use Case:** View invoice history

---

### 5. **Get Invoice Details**

```http
GET /merchant-invoices/:id
```

**Authorization:** Merchant (own) / Admin (all)

**Purpose:** Get complete invoice with all parcels

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_no": "INV-2024-12-0034",
      "total_parcels": 240,
      "payable_amount": 51416.00
    },
    "parcels": [...]
  }
}
```

**Use Case:** Review invoice before/after payment

---

### 6. **Mark Invoice as Paid**

```http
POST /merchant-invoices/:id/pay
```

**Authorization:** Admin Only

**Request Body:**
```json
{
  "payment_reference": "BANK-TRX-123",
  "notes": "Paid via bKash"
}
```

**Purpose:** Record payment and update all parcels

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "invoice_status": "PAID",
      "paid_at": "2024-12-24T12:00:00Z"
    }
  }
}
```

**Use Case:** Admin marks invoice as paid after transferring money

---

## 🔄 Complete Workflow

### Admin Use Case:

```bash
# 1. Check unpaid amount by store
GET /merchant-invoices/unpaid-by-store?merchant_id=xxx
# Shows: 2 stores, ৳51,416 total due

# 2. Get detailed parcel list
GET /merchant-invoices/eligible-parcels?merchant_id=xxx
# Shows: 390 parcels with IDs

# 3. Generate invoice
POST /merchant-invoices
{
  "merchant_id": "xxx",
  "parcel_ids": [all 390 IDs]
}
# Creates: INV-2024-12-0034

# 4. Transfer money to merchant
# (External bank/bKash transaction)

# 5. Mark as paid
POST /merchant-invoices/invoice-id/pay
{
  "payment_reference": "BANK-TRX-123",
  "notes": "Paid ৳51,416"
}
# Updates: All 390 parcels marked as paid

# 6. Verify
GET /merchant-invoices/unpaid-by-store?merchant_id=xxx
# Shows: ৳0 due (all paid)
```

---

## 📊 Quick Comparison

| Endpoint | Purpose | Grouping | Detail Level |
|----------|---------|----------|--------------|
| **unpaid-by-store** | Overview by branch | By Store | Summary |
| **eligible-parcels** | Get parcel IDs | None | Detailed |
| **invoices** | Invoice history | None | Summary |
| **invoices/:id** | Single invoice | None | Full Detail |

---

## 🎯 When to Use Which?

### Scenario 1: "Show me what I owe each store"
✅ Use: `GET /merchant-invoices/unpaid-by-store`

### Scenario 2: "I want to create an invoice"
1. `GET /merchant-invoices/eligible-parcels` (get parcel IDs)
2. `POST /merchant-invoices` (create invoice)

### Scenario 3: "Show invoice history"
✅ Use: `GET /merchant-invoices`

### Scenario 4: "I paid the merchant"
✅ Use: `POST /merchant-invoices/:id/pay`

---

## 🔐 Authorization Matrix

| Endpoint | Merchant | Admin |
|----------|----------|-------|
| GET unpaid-by-store | ✅ Own | ✅ All |
| GET eligible-parcels | ✅ Own | ✅ All |
| POST generate | ❌ | ✅ |
| GET invoices | ✅ Own | ✅ All |
| GET invoice/:id | ✅ Own | ✅ All |
| POST mark paid | ❌ | ✅ |

---

## ✅ Implementation Status

**Total Endpoints:** 6  
**Build Status:** ✅ Successful  
**Migration Status:** ✅ Executed  
**Documentation:** ✅ Complete  

**Last Updated:** December 24, 2024  
**Status:** 🚀 Production Ready

