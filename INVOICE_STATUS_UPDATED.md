# 🔄 Invoice Status System - Updated

## ✅ Status Values Changed

### Old Status Values:
- ❌ GENERATED
- ✅ PAID
- ❌ CANCELLED

### New Status Values:
- ✅ **UNPAID** (replaces GENERATED)
- ✅ **PROCESSING** (new intermediate state)
- ✅ **PAID** (unchanged)

---

## 📊 Status Flow

```
UNPAID (Invoice Created)
   ↓
   ├─→ PROCESSING (Admin is processing payment)
   │      ↓
   │   PAID (Payment completed)
   │
   └─→ PAID (Direct payment, skip PROCESSING)
```

---

## 🎯 Status Descriptions

### 1. **UNPAID**
**When:** Invoice is created
**Meaning:** Invoice generated but payment not started
**Actions Available:**
- ✅ View invoice details
- ✅ Change to PROCESSING
- ✅ Mark as PAID
- ❌ Cannot modify parcels

**Example:**
```json
{
  "invoice_no": "INV-2024-12-0034",
  "invoice_status": "UNPAID",
  "payable_amount": 51416.00,
  "created_at": "2024-12-24T10:30:00Z"
}
```

---

### 2. **PROCESSING**
**When:** Admin is processing the payment
**Meaning:** Payment transfer in progress
**Actions Available:**
- ✅ View invoice details
- ✅ Change back to UNPAID (if needed)
- ✅ Mark as PAID
- ❌ Cannot modify parcels

**Example:**
```json
{
  "invoice_no": "INV-2024-12-0034",
  "invoice_status": "PROCESSING",
  "payable_amount": 51416.00,
  "created_at": "2024-12-24T10:30:00Z"
}
```

**Use Case:**
- Admin clicks "Process Payment"
- Status changes to PROCESSING
- Admin transfers money via bank/bKash
- Admin marks as PAID

---

### 3. **PAID**
**When:** Payment is completed
**Meaning:** Merchant has been paid
**Actions Available:**
- ✅ View invoice details only
- ❌ Cannot change status
- ❌ Cannot modify parcels
- ❌ Cannot delete

**Example:**
```json
{
  "invoice_no": "INV-2024-12-0034",
  "invoice_status": "PAID",
  "payable_amount": 51416.00,
  "paid_at": "2024-12-24T14:00:00Z",
  "paid_by": "admin-user-id",
  "payment_reference": "BANK-TRX-123"
}
```

---

## 🔄 Updated API Endpoints

### **7 Total Endpoints** (1 new added)

| # | Method | Endpoint | Status Change |
|---|--------|----------|---------------|
| 1 | GET | `/unpaid-by-store` | - |
| 2 | GET | `/eligible-parcels` | - |
| 3 | POST | `/` | Creates with UNPAID |
| 4 | GET | `/` | Filter by status |
| 5 | GET | `/:id` | - |
| 6 | **PATCH** | `/:id/status` | **NEW!** Update status |
| 7 | POST | `/:id/pay` | Changes to PAID |

---

## 🆕 New Endpoint: Update Invoice Status

### **Endpoint:**
```http
PATCH /merchant-invoices/:id/status
```

### **Authorization:**
- Admin Only

### **Purpose:**
Update invoice status (e.g., UNPAID → PROCESSING)

### **Request Body:**
```json
{
  "invoice_status": "PROCESSING"
}
```

### **Validation:**
- ✅ Can change UNPAID → PROCESSING
- ✅ Can change PROCESSING → UNPAID
- ✅ Can change UNPAID → PAID (but use /pay endpoint instead)
- ❌ Cannot change PAID to anything else

### **Request Example:**
```bash
curl -X PATCH \
  "http://localhost:3000/merchant-invoices/invoice-uuid/status" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_status": "PROCESSING"
  }'
```

### **Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_no": "INV-2024-12-0034",
      "invoice_status": "PROCESSING",
      "payable_amount": 51416.00,
      "updated_at": "2024-12-24T13:00:00Z"
    }
  },
  "message": "Invoice status updated successfully"
}
```

---

## 🔄 Complete Workflow Examples

### Workflow 1: Direct Payment (Skip PROCESSING)

```bash
# 1. Create invoice
POST /merchant-invoices
→ Status: UNPAID

# 2. Transfer money immediately
# (External bank/bKash transfer)

# 3. Mark as paid
POST /merchant-invoices/:id/pay
→ Status: PAID

✅ Done!
```

---

### Workflow 2: With PROCESSING State

```bash
# 1. Create invoice
POST /merchant-invoices
→ Status: UNPAID

# 2. Admin starts processing
PATCH /merchant-invoices/:id/status
Body: { "invoice_status": "PROCESSING" }
→ Status: PROCESSING

# 3. Admin transfers money
# (External bank/bKash transfer)

# 4. Mark as paid
POST /merchant-invoices/:id/pay
→ Status: PAID

✅ Done!
```

---

### Workflow 3: Cancel PROCESSING (Go Back)

```bash
# Invoice is in PROCESSING state
Status: PROCESSING

# Admin needs to cancel/undo
PATCH /merchant-invoices/:id/status
Body: { "invoice_status": "UNPAID" }
→ Status: UNPAID

# Can restart process later
```

---

## 📊 Filtering by Status

### Get UNPAID Invoices:
```bash
GET /merchant-invoices?invoice_status=UNPAID
```

### Get PROCESSING Invoices:
```bash
GET /merchant-invoices?invoice_status=PROCESSING
```

### Get PAID Invoices:
```bash
GET /merchant-invoices?invoice_status=PAID
```

### Get All Unpaid + Processing:
```bash
# Call twice and merge results
GET /merchant-invoices?invoice_status=UNPAID
GET /merchant-invoices?invoice_status=PROCESSING
```

---

## 🎨 Frontend Display Suggestions

### Status Badge Colors:

```javascript
const statusConfig = {
  UNPAID: {
    color: 'red',
    icon: '⏳',
    text: 'Unpaid'
  },
  PROCESSING: {
    color: 'orange',
    icon: '⚙️',
    text: 'Processing'
  },
  PAID: {
    color: 'green',
    icon: '✅',
    text: 'Paid'
  }
};
```

### Example UI:
```
╔══════════════════════════════════════════════════════╗
║  Invoice: INV-2024-12-0034                           ║
║  Status: [⏳ UNPAID]                                 ║
║  Amount: ৳51,416                                     ║
║  Created: 24 Dec 2024, 10:30 AM                      ║
║                                                      ║
║  [Process Payment] [View Details]                    ║
╚══════════════════════════════════════════════════════╝

After clicking "Process Payment":

╔══════════════════════════════════════════════════════╗
║  Invoice: INV-2024-12-0034                           ║
║  Status: [⚙️ PROCESSING]                            ║
║  Amount: ৳51,416                                     ║
║  Created: 24 Dec 2024, 10:30 AM                      ║
║                                                      ║
║  [Mark as Paid] [Cancel] [View Details]              ║
╚══════════════════════════════════════════════════════╝

After clicking "Mark as Paid":

╔══════════════════════════════════════════════════════╗
║  Invoice: INV-2024-12-0034                           ║
║  Status: [✅ PAID]                                   ║
║  Amount: ৳51,416                                     ║
║  Paid: 24 Dec 2024, 2:00 PM                          ║
║  Reference: BANK-TRX-123                             ║
║                                                      ║
║  [View Details] [Print]                              ║
╚══════════════════════════════════════════════════════╝
```

---

## 🔒 Status Change Validations

### ✅ Allowed Transitions:

```
UNPAID → PROCESSING  ✅
UNPAID → PAID        ✅
PROCESSING → UNPAID  ✅
PROCESSING → PAID    ✅
```

### ❌ Not Allowed:

```
PAID → UNPAID        ❌ (Error: Cannot change paid invoice)
PAID → PROCESSING    ❌ (Error: Cannot change paid invoice)
```

---

## 📋 Updated Query Response

### Before (Old):
```json
{
  "invoice_status": "GENERATED"  ❌
}
```

### After (New):
```json
{
  "invoice_status": "UNPAID"  ✅
}
```

---

## 🔄 Migration Notes

### Existing Data:
- All existing `GENERATED` invoices → automatically treated as `UNPAID`
- All existing `CANCELLED` invoices → automatically treated as `UNPAID`
- All existing `PAID` invoices → remain `PAID`

### Database:
- Enum values stored as strings in PostgreSQL
- Application code uses new values
- No data loss

---

## ✅ Summary

### What Changed:
- ✅ Status enum updated: UNPAID, PROCESSING, PAID
- ✅ New endpoint added: PATCH /:id/status
- ✅ Default status changed: UNPAID (was GENERATED)
- ✅ Validation updated: Cannot change PAID invoices

### What Stayed Same:
- ✅ All other endpoints work as before
- ✅ Database structure unchanged
- ✅ Parcel update logic unchanged
- ✅ Financial calculations unchanged

### Total Endpoints Now:
**7 API Endpoints**
1. GET /unpaid-by-store
2. GET /eligible-parcels
3. POST / (create invoice)
4. GET / (list invoices)
5. GET /:id (invoice details)
6. **PATCH /:id/status** (NEW!)
7. POST /:id/pay (mark as paid)

---

## 🚀 Ready to Use!

All changes implemented and tested. Build successful!

**Status:** ✅ Complete  
**Date:** December 24, 2024

