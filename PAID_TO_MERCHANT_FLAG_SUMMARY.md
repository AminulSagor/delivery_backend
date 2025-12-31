# Paid to Merchant Flag - Quick Summary

## ✅ Implementation Complete!

A new payment tracking flag has been added to the parcels table to track merchant payments.

---

## 🎯 What Was Added

### Database Changes

**New Columns in `parcels` table:**
```sql
paid_to_merchant         BOOLEAN      DEFAULT false
paid_to_merchant_at      TIMESTAMP    NULL
```

**New Indexes:**
```sql
-- Single column index
CREATE INDEX idx_parcels_paid_to_merchant 
ON parcels(paid_to_merchant);

-- Composite index for merchant queries
CREATE INDEX idx_parcels_merchant_payment 
ON parcels(merchant_id, paid_to_merchant, delivered_at);
```

---

## 💡 Purpose

Track whether merchants have been paid for their delivered parcels.

### Payment Flow:
```
1. Parcel Delivered → paid_to_merchant: false
2. Rider Settles with Hub Manager → paid_to_merchant: false
3. Hub Manager Transfers to Admin → paid_to_merchant: false
4. Admin Pays Merchant → paid_to_merchant: true ✅
```

---

## 📊 Key Use Cases

### 1. Find Unpaid Parcels
```sql
SELECT * FROM parcels 
WHERE merchant_id = 'merchant-uuid'
  AND paid_to_merchant = false
  AND status = 'DELIVERED'
  AND payment_status = 'COD_COLLECTED';
```

### 2. Calculate Outstanding Amount
```sql
SELECT 
  SUM(cod_amount - total_charge) as net_payable
FROM parcels 
WHERE merchant_id = 'merchant-uuid'
  AND paid_to_merchant = false
  AND status IN ('DELIVERED', 'PARTIAL_DELIVERY');
```

### 3. Mark as Paid
```sql
UPDATE parcels 
SET 
  paid_to_merchant = true,
  paid_to_merchant_at = CURRENT_TIMESTAMP
WHERE id IN ('parcel-id-1', 'parcel-id-2', ...);
```

### 4. Payment History
```sql
SELECT 
  DATE(paid_to_merchant_at) as payment_date,
  COUNT(*) as parcels_count,
  SUM(cod_amount - total_charge) as total_paid
FROM parcels 
WHERE merchant_id = 'merchant-uuid'
  AND paid_to_merchant = true
GROUP BY DATE(paid_to_merchant_at)
ORDER BY payment_date DESC;
```

---

## 💰 Payment Calculation

```javascript
Net Payable to Merchant = COD Amount - Total Charges

Example:
- COD Amount: ৳5,000 (collected from customer)
- Delivery Charge: ৳60
- Weight Charge: ৳20
- COD Charge: ৳75
- Total Charge: ৳155

Net Payable = ৳5,000 - ৳155 = ৳4,845
```

---

## 📁 Files Modified

1. ✅ **Entity**: `src/parcels/entities/parcel.entity.ts`
   - Added `paid_to_merchant` boolean field
   - Added `paid_to_merchant_at` timestamp field

2. ✅ **Migration**: `src/migrations/1735100000000-AddPaidToMerchantFlagToParcels.ts`
   - Adds columns to parcels table
   - Creates indexes for performance

3. ✅ **Documentation**: 
   - `MERCHANT_PAYMENT_TRACKING.md` - Comprehensive guide
   - `PAID_TO_MERCHANT_FLAG_SUMMARY.md` - This file

---

## 🚀 Migration Status

✅ **Migration Executed Successfully**

```
Migration AddPaidToMerchantFlagToParcels1735100000000 
has been executed successfully.
```

**Changes Applied:**
- ✅ Column `paid_to_merchant` added (default: false)
- ✅ Column `paid_to_merchant_at` added (nullable)
- ✅ Index `idx_parcels_paid_to_merchant` created
- ✅ Index `idx_parcels_merchant_payment` created

---

## 🔄 Next Steps (Suggested)

### 1. Create Merchant Payout APIs

**For Merchants:**
```http
GET /merchants/my/parcels/unpaid
GET /merchants/my/payment-history
```

**For Admins:**
```http
POST /admin/merchants/payouts
GET /admin/merchants/outstanding-payments
```

### 2. Create Payout Transaction Table (Optional)

Track batch payments:
```sql
CREATE TABLE merchant_payout_transactions (
  id UUID PRIMARY KEY,
  merchant_id UUID,
  parcel_ids UUID[],
  total_amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(255),
  processed_by UUID,
  processed_at TIMESTAMP,
  ...
);
```

### 3. Add Business Logic

**Service Methods:**
- `getUnpaidParcels(merchantId)` - List unpaid parcels
- `calculateOutstandingAmount(merchantId)` - Calculate total owed
- `processMerchantPayout(merchantId, parcelIds)` - Mark as paid
- `getPaymentHistory(merchantId)` - View payment history

### 4. Add Notifications

- Email merchant when payment is processed
- SMS notification for payment confirmation
- Admin notification for pending payouts

---

## 📊 Query Performance

With the new indexes, these queries are optimized:

```sql
-- Fast: Uses idx_parcels_paid_to_merchant
SELECT COUNT(*) FROM parcels WHERE paid_to_merchant = false;

-- Fast: Uses idx_parcels_merchant_payment
SELECT * FROM parcels 
WHERE merchant_id = 'uuid' 
  AND paid_to_merchant = false 
ORDER BY delivered_at DESC;

-- Fast: Uses composite index
SELECT merchant_id, COUNT(*) 
FROM parcels 
WHERE paid_to_merchant = false 
GROUP BY merchant_id;
```

---

## ⚠️ Important Notes

1. **Only mark as paid when:**
   - Parcel is DELIVERED or PARTIAL_DELIVERY
   - Payment status is COD_COLLECTED
   - Admin has received money from hub manager
   - Merchant payout has been processed

2. **Data Integrity:**
   - Always set both `paid_to_merchant` and `paid_to_merchant_at` together
   - Use database transactions for bulk updates
   - Keep audit logs of payment operations

3. **Return Parcels:**
   - Return parcels should NOT be marked as paid to merchant
   - Return charges are handled separately

---

## ✅ Build Status

- ✅ TypeScript compilation: Success
- ✅ Linter errors: None
- ✅ Migration executed: Success
- ✅ Indexes created: Success

---

## 🎉 Summary

The `paid_to_merchant` flag is now ready to use! This provides:

✅ Clear tracking of merchant payments  
✅ Easy identification of unpaid parcels  
✅ Financial reconciliation capability  
✅ Payment history audit trail  
✅ Efficient queries with proper indexes  

**Ready for integration with merchant payout system!** 🚀

For detailed implementation guide, see `MERCHANT_PAYMENT_TRACKING.md`.

