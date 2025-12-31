# 📊 Unpaid Parcels by Store API - Documentation

## Overview

This API endpoint provides a **store-wise breakdown** of unpaid parcels for a merchant. It shows only parcels that have **NOT been paid** to the merchant yet, grouped by their store/branch.

---

## 🎯 API Endpoint

```http
GET /merchant-invoices/unpaid-by-store
```

**Authorization:** Merchant (own data) / Admin (all merchants)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchant_id` | UUID | No* | Merchant ID (required for admin, auto-filled for merchant) |

*Required for admin, automatically filled for merchants

---

## 📋 What This Shows

### ✅ Includes:
- Parcels **NOT yet paid** to merchant (`paid_to_merchant = false`)
- Parcels **NOT in any invoice** (`invoice_id = null`)
- Parcels with status: `DELIVERED`, `RETURNED`, `PARTIAL_DELIVERY`
- Grouped by **store/branch**

### ❌ Excludes:
- Parcels already paid to merchant
- Parcels already in an invoice
- Parcels in pending status (not yet delivered/returned)

---

## 📊 Response Structure

```json
{
  "success": true,
  "data": {
    "merchant_id": "merchant-uuid-123",
    "merchant_name": "Booklet Design BD",
    "stores": [
      {
        "store_id": "store-uuid-1",
        "store_name": "Dhaka Branch",
        "store_phone": "+8801229455789",
        "total_unpaid_parcels": 240,
        "delivered_count": 220,
        "partial_delivery_count": 5,
        "returned_count": 15,
        "paid_return_count": 0,
        "total_cod_collected": 46656.00,
        "total_delivery_charges": 16400.00,
        "total_return_charges": 1200.00,
        "due_amount": 29056.00,
        "last_payment_date": "2025-09-30T14:35:00Z"
      },
      {
        "store_id": "store-uuid-2",
        "store_name": "Chittagong Branch",
        "store_phone": "+8801712345678",
        "total_unpaid_parcels": 150,
        "delivered_count": 140,
        "partial_delivery_count": 2,
        "returned_count": 8,
        "paid_return_count": 0,
        "total_cod_collected": 35000.00,
        "total_delivery_charges": 12000.00,
        "total_return_charges": 640.00,
        "due_amount": 22360.00,
        "last_payment_date": "2025-09-30T12:00:00Z"
      }
    ],
    "summary": {
      "total_stores": 2,
      "total_unpaid_parcels": 390,
      "total_collected": 81656.00,
      "total_delivery_charges": 28400.00,
      "total_return_charges": 1840.00,
      "total_due": 51416.00
    }
  },
  "message": "Unpaid parcels by store retrieved successfully"
}
```

---

## 💰 Financial Calculation

### Per Store:

```javascript
due_amount = total_cod_collected - total_delivery_charges - total_return_charges
```

### Breakdown:

```
Example Store:
├─ Delivered Parcels: 220
│  ├─ COD Collected: ৳45,000
│  └─ Delivery Charges: ৳15,000
│
├─ Returned Parcels: 15
│  ├─ COD Collected: ৳0
│  └─ Return Charges: ৳1,200
│
└─ Partial Delivery: 5
   ├─ COD Collected: ৳1,656
   └─ Delivery Charges: ৳400

Calculation:
Total COD Collected = ৳45,000 + ৳0 + ৳1,656 = ৳46,656
Total Delivery Charges = ৳15,000 + ৳400 = ৳15,400
Total Return Charges = ৳1,200

Due Amount = ৳46,656 - ৳15,400 - ৳1,200 = ৳30,056
```

---

## 🔍 Field Descriptions

### Store Level Fields:

| Field | Type | Description |
|-------|------|-------------|
| `store_id` | UUID | Store identifier |
| `store_name` | String | Store business name |
| `store_phone` | String | Store phone number |
| `total_unpaid_parcels` | Number | Total parcels not yet paid |
| `delivered_count` | Number | Successfully delivered parcels |
| `partial_delivery_count` | Number | Partially delivered parcels |
| `returned_count` | Number | Returned parcels |
| `paid_return_count` | Number | Paid return parcels |
| `total_cod_collected` | Decimal | Total COD collected from customers |
| `total_delivery_charges` | Decimal | Total delivery charges (deducted from merchant) |
| `total_return_charges` | Decimal | Total return charges (deducted from merchant) |
| `due_amount` | Decimal | Net amount due to merchant |
| `last_payment_date` | Timestamp | Last delivery/return date |

### Summary Fields:

| Field | Type | Description |
|-------|------|-------------|
| `total_stores` | Number | Number of stores with unpaid parcels |
| `total_unpaid_parcels` | Number | Total unpaid parcels across all stores |
| `total_collected` | Decimal | Sum of all COD collected |
| `total_delivery_charges` | Decimal | Sum of all delivery charges |
| `total_return_charges` | Decimal | Sum of all return charges |
| `total_due` | Decimal | Total amount due to merchant |

---

## 📱 Use Cases

### Use Case 1: Admin View - All Stores
Admin wants to see unpaid parcels for "Booklet Design BD"

```bash
curl -X GET \
  "http://localhost:3000/merchant-invoices/unpaid-by-store?merchant_id=merchant-uuid" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Result:** Shows all stores of this merchant with unpaid parcels

### Use Case 2: Merchant View - Own Stores
Merchant logs in and wants to see their unpaid balance

```bash
curl -X GET \
  "http://localhost:3000/merchant-invoices/unpaid-by-store" \
  -H "Authorization: Bearer MERCHANT_TOKEN"
```

**Result:** Shows only their own stores (merchant_id auto-filled)

### Use Case 3: Generate Invoice from Store Data
Admin reviews unpaid amounts and decides to generate invoice

```bash
# Step 1: Get unpaid by store
GET /merchant-invoices/unpaid-by-store?merchant_id=xxx

# Step 2: Get detailed parcel list
GET /merchant-invoices/eligible-parcels?merchant_id=xxx

# Step 3: Generate invoice for selected parcels
POST /merchant-invoices
{
  "merchant_id": "xxx",
  "parcel_ids": ["id1", "id2", ...]
}
```

---

## 🎨 Frontend Display Example

### Display Format (Similar to Screenshot):

```
╔═══════════════════════════════════════════════════════════╗
║  Merchant: Booklet Design BD                              ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  📍 Dhaka Branch                                          ║
║  📞 +8801229455789                                        ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ Total Parcels:          240                         │ ║
║  │ Collected Amount:       ৳46,656                     │ ║
║  │ Delivery Charge:        ৳16,400                     │ ║
║  │ Return Charge:          ৳1,200                      │ ║
║  │ Due:                    ৳29,056                     │ ║
║  │ Last Paid:              30 Sep, 2025 2:35 PM        │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  📍 Chittagong Branch                                     ║
║  📞 +8801712345678                                        ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ Total Parcels:          150                         │ ║
║  │ Collected Amount:       ৳35,000                     │ ║
║  │ Delivery Charge:        ৳12,000                     │ ║
║  │ Return Charge:          ৳640                        │ ║
║  │ Due:                    ৳22,360                     │ ║
║  │ Last Paid:              30 Sep, 2025 12:00 PM       │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  ═══════════════════════════════════════════════════════ ║
║  TOTAL DUE: ৳51,416                                       ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🔐 Authorization

### For Merchants:
- ✅ Can view own stores only
- ✅ `merchant_id` automatically set to their ID
- ✅ Cannot view other merchants' data

### For Admins:
- ✅ Can view any merchant's stores
- ✅ Must provide `merchant_id` in query
- ✅ Can view all merchants

---

## ⚠️ Important Notes

### Return Charge Impact:
Return charges **reduce** the amount due to merchant:
```
If merchant has:
- ৳50,000 COD collected (delivered parcels)
- ৳10,000 delivery charges
- ৳1,000 return charges (from returned parcels)

Due = ৳50,000 - ৳10,000 - ৳1,000 = ৳39,000
```

### Store Without Name:
If parcel doesn't have store association:
```json
{
  "store_id": null,
  "store_name": "Unknown Store",
  "store_phone": "N/A",
  ...
}
```

### Empty Result:
If merchant has no unpaid parcels:
```json
{
  "success": true,
  "data": {
    "merchant_id": "xxx",
    "merchant_name": "ABC Store",
    "stores": [],
    "summary": {
      "total_stores": 0,
      "total_unpaid_parcels": 0,
      "total_collected": 0,
      "total_delivery_charges": 0,
      "total_return_charges": 0,
      "total_due": 0
    }
  },
  "message": "Unpaid parcels by store retrieved successfully"
}
```

---

## 🔄 Workflow Integration

### Step 1: Check Unpaid Amount by Store
```bash
GET /merchant-invoices/unpaid-by-store?merchant_id=xxx
```
*Shows: 2 stores, total due ৳51,416*

### Step 2: View Detailed Parcel List (Optional)
```bash
GET /merchant-invoices/eligible-parcels?merchant_id=xxx
```
*Shows: Individual parcel breakdown*

### Step 3: Generate Invoice
```bash
POST /merchant-invoices
{
  "merchant_id": "xxx",
  "parcel_ids": [all selected parcel IDs]
}
```
*Creates: Invoice for ৳51,416*

### Step 4: Pay Merchant
*Admin transfers ৳51,416 to merchant*

### Step 5: Mark as Paid
```bash
POST /merchant-invoices/:invoice_id/pay
{
  "payment_reference": "BANK-TRX-123",
  "notes": "Paid ৳51,416"
}
```
*Updates: All parcels marked as paid*

### Step 6: Verify
```bash
GET /merchant-invoices/unpaid-by-store?merchant_id=xxx
```
*Shows: Empty or reduced unpaid amount*

---

## 📊 Performance Considerations

- ✅ Uses database indexes on `merchant_id`, `paid_to_merchant`, `invoice_id`
- ✅ Single query to fetch all unpaid parcels
- ✅ In-memory grouping by store (efficient for typical dataset sizes)
- ✅ Sorted alphabetically by store name

---

## ✅ Complete API List

With this new endpoint, you now have **6 total endpoints**:

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/merchant-invoices/unpaid-by-store` | Get unpaid by store ⭐ NEW |
| 2 | GET | `/merchant-invoices/eligible-parcels` | Get eligible parcels |
| 3 | POST | `/merchant-invoices` | Generate invoice |
| 4 | GET | `/merchant-invoices` | List invoices |
| 5 | GET | `/merchant-invoices/:id` | Invoice details |
| 6 | POST | `/merchant-invoices/:id/pay` | Mark as paid |

---

## 🎉 Ready to Use!

The endpoint is fully implemented and ready for integration with your frontend to match the screenshot design.

**Status:** ✅ Implemented and Tested  
**Build:** ✅ Successful  
**Date:** December 24, 2024

