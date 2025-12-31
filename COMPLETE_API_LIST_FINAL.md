# 🎯 Complete Merchant Invoice API - Final List

## Base URL
```
http://localhost:3000/merchant-invoices
```

---

## 📊 All 8 API Endpoints

### 1. **Get Unpaid Parcels by Store**
```http
GET /merchant-invoices/unpaid-by-store?merchant_id={uuid}
```
**Auth:** Merchant/Admin  
**Purpose:** Store-wise unpaid parcels summary  
**Response:** JSON with store grouping

---

### 2. **Get Eligible Parcels**
```http
GET /merchant-invoices/eligible-parcels?merchant_id={uuid}
```
**Auth:** Merchant/Admin  
**Purpose:** Detailed parcel list with IDs  
**Response:** JSON with parcel array

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
**Initial Status:** UNPAID  
**Response:** JSON with invoice details

---

### 4. **List All Invoices**
```http
GET /merchant-invoices?invoice_status=UNPAID&page=1&limit=10
```
**Auth:** Merchant/Admin  
**Purpose:** Invoice history with pagination  
**Filters:** status, merchant, date range  
**Response:** JSON with paginated invoices

---

### 5. **Get Invoice Details**
```http
GET /merchant-invoices/{invoice_id}
```
**Auth:** Merchant/Admin  
**Purpose:** Full invoice with all parcels  
**Response:** JSON with complete details

---

### 6. **Update Invoice Status**
```http
PATCH /merchant-invoices/{invoice_id}/status
Body: {
  "invoice_status": "PROCESSING"
}
```
**Auth:** Admin Only  
**Purpose:** Change invoice status  
**Allowed:** UNPAID ↔ PROCESSING  
**Response:** JSON with updated invoice

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
**Purpose:** Complete payment  
**Final Status:** PAID  
**Response:** JSON with paid invoice

---

### 8. **Export Pending Invoices** ⭐ NEW
```http
GET /merchant-invoices/export/pending
```
**Auth:** Admin Only  
**Purpose:** Export UNPAID + PROCESSING invoices to Excel  
**Response:** Excel file (.xlsx)  
**Filename:** `pending-invoices-YYYY-MM-DD.xlsx`

---

## 📊 Export Features

### Excel File Includes:
- ✅ All UNPAID invoices
- ✅ All PROCESSING invoices
- ✅ Professional formatting with colors
- ✅ Currency formatting (৳#,##0.00)
- ✅ Summary totals row
- ✅ Color-coded status

### Columns in Excel:
1. Invoice No
2. Merchant Name
3. Merchant Phone
4. Status (color-coded)
5. Total Parcels
6. Delivered Count
7. Returned Count
8. COD Collected
9. Delivery Charges
10. Return Charges
11. Payable Amount
12. Created Date

---

## 🔄 Complete Workflow with Export

### Daily Operations:

```bash
# 1. View pending invoices
GET /unpaid-by-store?merchant_id=xxx

# 2. Export for review
GET /export/pending
→ Downloads Excel file

# 3. Review in Excel
# Check amounts, verify data

# 4. Generate new invoices
POST /
Body: {merchant_id, parcel_ids}

# 5. Process payments
PATCH /:id/status → PROCESSING
POST /:id/pay → PAID

# 6. Export again to verify
GET /export/pending
→ Should show fewer invoices
```

---

## 📱 Frontend Integration

### Export Button Component:
```tsx
import React, { useState } from 'react';

function ExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(
        '/merchant-invoices/export/pending',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pending-invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      alert('Exported successfully!');
    } catch (error) {
      alert('Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleExport} disabled={loading}>
      {loading ? 'Exporting...' : '📊 Export Pending Invoices'}
    </button>
  );
}
```

---

## 🎨 UI Suggestion

```
╔═══════════════════════════════════════════════════════╗
║  Pending Invoices Dashboard                           ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  [📊 Export to Excel]  [🔄 Refresh]  [+ New Invoice]║
║                                                       ║
║  ┌───────────────────────────────────────────────┐   ║
║  │ Invoice No          │ Merchant     │ Amount   │   ║
║  ├───────────────────────────────────────────────┤   ║
║  │ INV-2024-12-0034   │ Booklet BD   │ ৳51,416 │   ║
║  │ INV-2024-12-0033   │ ABC Store    │ ৳22,360 │   ║
║  │ INV-2024-12-0032   │ XYZ Fashion  │ ৳38,500 │   ║
║  └───────────────────────────────────────────────┘   ║
║                                                       ║
║  Total Pending: ৳112,276                             ║
╚═══════════════════════════════════════════════════════╝
```

---

## 📊 Quick Reference Table

| # | Method | Endpoint | Response Type | Purpose |
|---|--------|----------|---------------|---------|
| 1 | GET | `/unpaid-by-store` | JSON | Store summary |
| 2 | GET | `/eligible-parcels` | JSON | Parcel list |
| 3 | POST | `/` | JSON | Create invoice |
| 4 | GET | `/` | JSON | List invoices |
| 5 | GET | `/:id` | JSON | Invoice details |
| 6 | PATCH | `/:id/status` | JSON | Update status |
| 7 | POST | `/:id/pay` | JSON | Mark paid |
| 8 | GET | `/export/pending` | **Excel** | Export to Excel ⭐ |

---

## 🔐 Authorization Summary

| Endpoint | Merchant | Admin | Response |
|----------|----------|-------|----------|
| GET unpaid-by-store | ✅ Own | ✅ All | JSON |
| GET eligible-parcels | ✅ Own | ✅ All | JSON |
| POST create | ❌ | ✅ | JSON |
| GET list | ✅ Own | ✅ All | JSON |
| GET details | ✅ Own | ✅ All | JSON |
| PATCH status | ❌ | ✅ | JSON |
| POST pay | ❌ | ✅ | JSON |
| **GET export** | ❌ | ✅ | **Excel** ⭐ |

---

## 💡 Use Cases for Export

### 1. Weekly Reports
```bash
# Every Monday
GET /export/pending
→ pending-invoices-2024-12-30.xlsx
# Email to finance team
```

### 2. Before Payment
```bash
# Review before paying
GET /export/pending
→ Open in Excel
→ Verify amounts
→ Process payments
```

### 3. Month-End
```bash
# Financial closing
GET /export/pending
→ Include in reports
→ Track outstanding amounts
```

### 4. Audit Trail
```bash
# Keep records
GET /export/pending
→ Save in shared drive
→ Maintain history
```

---

## 📦 Package Dependencies

```json
{
  "dependencies": {
    "exceljs": "^4.x.x"
  }
}
```

**Installation:**
```bash
npm install exceljs
```

---

## ✅ Complete Feature List

### Data Operations:
- ✅ View unpaid by store
- ✅ Get eligible parcels
- ✅ Generate invoices
- ✅ List invoices with filters
- ✅ View invoice details
- ✅ Update invoice status
- ✅ Mark as paid
- ✅ **Export to Excel** ⭐

### Export Features:
- ✅ Export pending invoices
- ✅ Professional Excel formatting
- ✅ Color-coded status
- ✅ Currency formatting
- ✅ Summary totals
- ✅ Auto-generated filename
- ✅ Direct download

---

## 🎉 Summary

**Total Endpoints:** 8 (1 new export endpoint)  
**Status Values:** 3 (UNPAID, PROCESSING, PAID)  
**Export Format:** Excel (.xlsx)  
**Build Status:** ✅ Successful  
**Ready:** ✅ Production Ready  

**All features implemented and working!**

**Date:** December 24, 2024  
**Version:** 1.3.0 (Added Excel export)

