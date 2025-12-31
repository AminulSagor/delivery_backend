# 🚀 Complete API Endpoints Summary

## Merchant Invoice System

### Base URL
```
http://localhost:3000
```

---

## 📋 All Endpoints

### 1. Get Eligible Parcels
```http
GET /merchant-invoices/eligible-parcels?merchant_id={uuid}
Authorization: Bearer {token}
Role: Merchant (own) / Admin (all)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "eligible_parcels": [...],
    "total_count": 25,
    "summary": {
      "total_cod_collected": 50000.00,
      "estimated_payable": 48500.00
    }
  }
}
```

---

### 2. Generate Invoice
```http
POST /merchant-invoices
Authorization: Bearer {admin_token}
Role: Admin Only
Content-Type: application/json

{
  "merchant_id": "merchant-uuid",
  "parcel_ids": ["parcel-1", "parcel-2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_no": "INV-2024-12-0034",
      "payable_amount": 9550.00,
      "invoice_status": "GENERATED"
    },
    "breakdown": {...}
  }
}
```

---

### 3. List Invoices
```http
GET /merchant-invoices?page=1&limit=10&invoice_status=GENERATED
Authorization: Bearer {token}
Role: Merchant (own) / Admin (all)
```

**Query Parameters:**
- `merchant_id` (UUID) - Filter by merchant
- `invoice_status` (ENUM) - GENERATED, PAID, CANCELLED
- `fromDate` (ISO Date) - Start date
- `toDate` (ISO Date) - End date
- `page` (Number) - Page number (default: 1)
- `limit` (Number) - Items per page (default: 10, max: 100)

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

---

### 4. Get Invoice Details
```http
GET /merchant-invoices/{invoice_id}
Authorization: Bearer {token}
Role: Merchant (own) / Admin (all)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_no": "INV-2024-12-0034",
      "total_parcels": 3,
      "payable_amount": 9550.00,
      "invoice_status": "GENERATED"
    },
    "parcels": [
      {
        "parcel_id": "parcel-1",
        "tracking_number": "TRK123456",
        "net_payable": 4845.00
      }
    ]
  }
}
```

---

### 5. Mark Invoice as Paid
```http
POST /merchant-invoices/{invoice_id}/pay
Authorization: Bearer {admin_token}
Role: Admin Only
Content-Type: application/json

{
  "payment_reference": "BANK-TRX-123456",
  "notes": "Paid via bank transfer"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "invoice_status": "PAID",
      "paid_at": "2024-12-24T12:00:00.000Z",
      "paid_by": "admin-user-id"
    }
  }
}
```

---

## 🔑 Authorization

### Headers Required
```http
Authorization: Bearer {jwt_token}
```

### Role Access Matrix

| Endpoint | Merchant | Admin |
|----------|----------|-------|
| GET eligible-parcels | ✅ Own | ✅ All |
| POST generate | ❌ | ✅ |
| GET list | ✅ Own | ✅ All |
| GET details | ✅ Own | ✅ All |
| POST pay | ❌ | ✅ |

---

## 💰 Financial Calculation

```
Net Payable = COD Collected - Delivery Charge - Return Charge
```

### Rules:
- **Delivered/Partial:** Delivery charge applies, return charge doesn't
- **Returned:** Return charge applies, delivery charge doesn't
- **Paid Return:** No charges apply

---

## 📊 Status Values

### Invoice Status
- `GENERATED` - Invoice created, not yet paid
- `PAID` - Payment recorded
- `CANCELLED` - Invoice cancelled

### Financial Status (Parcel)
- `PENDING` - Not yet invoiced
- `INVOICED` - Included in invoice
- `PAID` - Payment completed
- `CLEARANCE_PENDING` - Needs recovery
- `CLEARANCE_INVOICED` - In clearance invoice
- `SETTLED` - Fully settled

---

## 🚨 Common Errors

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Parcels already invoiced or paid: TRK123456",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Invoice not found",
  "error": "Not Found"
}
```

---

## 🧪 Testing with cURL

### Example 1: Get Eligible Parcels
```bash
curl -X GET \
  "http://localhost:3000/merchant-invoices/eligible-parcels?merchant_id=merchant-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 2: Generate Invoice
```bash
curl -X POST \
  "http://localhost:3000/merchant-invoices" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "merchant-123",
    "parcel_ids": ["parcel-1", "parcel-2"]
  }'
```

### Example 3: Mark as Paid
```bash
curl -X POST \
  "http://localhost:3000/merchant-invoices/invoice-456/pay" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_reference": "BANK-TRX-123",
    "notes": "Paid via bank"
  }'
```

---

## 📝 Quick Notes

### Invoice Number Format
```
INV-YYYY-MM-XXXX
Example: INV-2024-12-0034
```

### Pagination
- Default: 10 items per page
- Maximum: 100 items per page
- Page numbers start at 1

### Date Filters
- Use ISO 8601 format: `2024-12-24T00:00:00.000Z`
- Both `fromDate` and `toDate` are inclusive

### Double Payment Prevention
- Parcels with `invoice_id` set cannot be invoiced again
- Parcels with `paid_to_merchant = true` cannot be invoiced
- All operations are atomic (transaction-safe)

---

## ✅ Implementation Status

**Status:** ✅ Complete and Production Ready  
**Last Updated:** December 24, 2024  
**Version:** 1.0.0

**Files Created:** 11 new files  
**Database Tables:** 1 new table, 1 enhanced table  
**API Endpoints:** 5 endpoints  
**Documentation:** 4 comprehensive guides  

---

## 📚 Full Documentation

For complete details, see:
- `MERCHANT_INVOICE_API_DOCUMENTATION.md` - Full API specs
- `MERCHANT_INVOICE_QUICK_REFERENCE.md` - Quick start guide
- `MERCHANT_INVOICE_IMPLEMENTATION_SUMMARY.md` - Technical details

---

**Ready to use! 🚀**

