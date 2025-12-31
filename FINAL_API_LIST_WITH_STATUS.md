# 🎯 Final Merchant Invoice API - Complete List

## Base URL
```
http://localhost:3000/merchant-invoices
```

---

## 📊 Invoice Status Values

```
UNPAID      → Invoice created, not paid yet
PROCESSING  → Payment is being processed
PAID        → Payment completed
```

---

## 🔗 All 7 API Endpoints

### 1. **Get Unpaid Parcels by Store**
```http
GET /merchant-invoices/unpaid-by-store?merchant_id={uuid}
```
**Auth:** Merchant/Admin  
**Purpose:** Store-wise unpaid parcels summary  
**Status:** Always shows unpaid parcels only

---

### 2. **Get Eligible Parcels (Detailed)**
```http
GET /merchant-invoices/eligible-parcels?merchant_id={uuid}
```
**Auth:** Merchant/Admin  
**Purpose:** Individual parcel list with IDs  
**Status:** Always shows unpaid parcels only

---

### 3. **Generate Invoice**
```http
POST /merchant-invoices
Body: {
  "merchant_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2"]
}
```
**Auth:** Admin Only  
**Purpose:** Create new invoice  
**Initial Status:** `UNPAID`

---

### 4. **List All Invoices**
```http
GET /merchant-invoices?invoice_status=UNPAID&page=1&limit=10
```
**Auth:** Merchant/Admin  
**Purpose:** Invoice history with filters  
**Filter by Status:** `UNPAID`, `PROCESSING`, `PAID`

---

### 5. **Get Invoice Details**
```http
GET /merchant-invoices/{invoice_id}
```
**Auth:** Merchant/Admin  
**Purpose:** Full invoice with all parcels  
**Shows:** Complete details + current status

---

### 6. **Update Invoice Status** ⭐ NEW
```http
PATCH /merchant-invoices/{invoice_id}/status
Body: {
  "invoice_status": "PROCESSING"
}
```
**Auth:** Admin Only  
**Purpose:** Change invoice status  
**Allowed:** UNPAID ↔ PROCESSING  
**Not Allowed:** Cannot change PAID invoices

---

### 7. **Mark Invoice as Paid**
```http
POST /merchant-invoices/{invoice_id}/pay
Body: {
  "payment_reference": "BANK-TRX-123",
  "notes": "Paid via bKash"
}
```
**Auth:** Admin Only  
**Purpose:** Complete payment process  
**Final Status:** `PAID`  
**Effect:** Updates all parcels in invoice

---

## 🔄 Complete Workflow with Status

### Simple Flow (Direct Payment):
```bash
# 1. Check unpaid
GET /unpaid-by-store?merchant_id=xxx
→ Shows: ৳51,416 due

# 2. Get parcel IDs
GET /eligible-parcels?merchant_id=xxx
→ Gets: 390 parcel IDs

# 3. Generate invoice
POST /
Body: {merchant_id, parcel_ids}
→ Creates: INV-2024-12-0034
→ Status: UNPAID

# 4. Transfer money
(External bank/bKash)

# 5. Mark as paid
POST /:id/pay
Body: {payment_reference, notes}
→ Status: PAID
→ All parcels updated
```

### Advanced Flow (With Processing):
```bash
# 1-3. Same as above
→ Status: UNPAID

# 4. Start processing
PATCH /:id/status
Body: {"invoice_status": "PROCESSING"}
→ Status: PROCESSING

# 5. Transfer money
(External bank/bKash)

# 6. Mark as paid
POST /:id/pay
→ Status: PAID
→ All parcels updated
```

### Cancel Processing Flow:
```bash
# Invoice in PROCESSING state

# Revert to unpaid
PATCH /:id/status
Body: {"invoice_status": "UNPAID"}
→ Status: UNPAID

# Can restart later
```

---

## 📊 Status Transitions

### ✅ Allowed:
```
UNPAID → PROCESSING  ✅
UNPAID → PAID        ✅
PROCESSING → UNPAID  ✅
PROCESSING → PAID    ✅
```

### ❌ Not Allowed:
```
PAID → anything      ❌
```

---

## 📱 Filter Examples

### Get all unpaid invoices:
```bash
GET /merchant-invoices?invoice_status=UNPAID
```

### Get invoices being processed:
```bash
GET /merchant-invoices?invoice_status=PROCESSING
```

### Get paid invoices in December:
```bash
GET /merchant-invoices?invoice_status=PAID&fromDate=2024-12-01&toDate=2024-12-31
```

### Get unpaid invoices for specific merchant:
```bash
GET /merchant-invoices?merchant_id=xxx&invoice_status=UNPAID
```

---

## 🎨 Frontend Status Display

```javascript
// Status configuration
const statusConfig = {
  UNPAID: {
    color: '#ef4444',     // red
    bgColor: '#fee2e2',   // red-100
    icon: '⏳',
    label: 'Unpaid',
    actions: ['Process Payment', 'Mark as Paid', 'View']
  },
  PROCESSING: {
    color: '#f59e0b',     // orange
    bgColor: '#fed7aa',   // orange-100
    icon: '⚙️',
    label: 'Processing',
    actions: ['Mark as Paid', 'Cancel', 'View']
  },
  PAID: {
    color: '#10b981',     // green
    bgColor: '#d1fae5',   // green-100
    icon: '✅',
    label: 'Paid',
    actions: ['View', 'Print']
  }
};

// Display badge
<Badge color={statusConfig[invoice.invoice_status].color}>
  {statusConfig[invoice.invoice_status].icon} 
  {statusConfig[invoice.invoice_status].label}
</Badge>
```

---

## 🔐 Authorization Matrix

| Endpoint | Merchant | Admin | Status Impact |
|----------|----------|-------|---------------|
| GET unpaid-by-store | ✅ Own | ✅ All | - |
| GET eligible-parcels | ✅ Own | ✅ All | - |
| POST create | ❌ | ✅ | Creates UNPAID |
| GET list | ✅ Own | ✅ All | Filter by status |
| GET details | ✅ Own | ✅ All | - |
| PATCH status | ❌ | ✅ | Changes status |
| POST pay | ❌ | ✅ | Changes to PAID |

---

## 💡 Use Cases

### Use Case 1: Quick Payment
Admin wants to pay immediately without tracking progress
```
Create → Pay
(Skip PROCESSING)
```

### Use Case 2: Track Payment Process
Admin wants to mark when payment is being processed
```
Create → Set to PROCESSING → Pay
(Track progress)
```

### Use Case 3: Cancel Payment
Admin started processing but needs to stop
```
Create → Set to PROCESSING → Revert to UNPAID
(Cancel and restart later)
```

### Use Case 4: View Pending Payments
Admin wants to see invoices waiting for payment
```
Filter by: UNPAID + PROCESSING
(All non-paid invoices)
```

---

## ✅ Quick Reference

| Action | Endpoint | Method | Status |
|--------|----------|--------|--------|
| View unpaid by store | `/unpaid-by-store` | GET | - |
| Get parcel IDs | `/eligible-parcels` | GET | - |
| Create invoice | `/` | POST | → UNPAID |
| List invoices | `/` | GET | Filter |
| View invoice | `/:id` | GET | - |
| Start processing | `/:id/status` | PATCH | → PROCESSING |
| Cancel processing | `/:id/status` | PATCH | → UNPAID |
| Complete payment | `/:id/pay` | POST | → PAID |

---

## 🎉 Summary

**Total Endpoints:** 7 (1 new added)  
**Status Values:** 3 (UNPAID, PROCESSING, PAID)  
**New Feature:** Update invoice status endpoint  
**Build Status:** ✅ Successful  
**Ready:** ✅ Production Ready  

**Date:** December 24, 2024  
**Version:** 1.2.0

