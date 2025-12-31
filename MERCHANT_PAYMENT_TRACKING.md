# Merchant Payment Tracking - Implementation Guide

## 📋 Overview

A new flag has been added to the `parcels` table to track whether the merchant has been paid for delivered parcels. This helps manage merchant payouts and financial reconciliation.

---

## 🗄️ Database Schema Changes

### New Columns in `parcels` Table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `paid_to_merchant` | BOOLEAN | `false` | Whether merchant has been paid for this parcel |
| `paid_to_merchant_at` | TIMESTAMP | `NULL` | When the merchant was paid |

### Indexes Created

```sql
-- Index for filtering paid/unpaid parcels
CREATE INDEX idx_parcels_paid_to_merchant 
ON parcels(paid_to_merchant);

-- Composite index for merchant payment queries
CREATE INDEX idx_parcels_merchant_payment 
ON parcels(merchant_id, paid_to_merchant, delivered_at);
```

---

## 🎯 Use Cases

### 1. Track Unpaid Parcels
Get all delivered parcels that haven't been paid to merchant:

```sql
SELECT * FROM parcels 
WHERE status = 'DELIVERED' 
  AND paid_to_merchant = false 
  AND merchant_id = 'merchant-uuid'
ORDER BY delivered_at DESC;
```

### 2. Calculate Outstanding Amount
Calculate total amount owed to a merchant:

```sql
SELECT 
  merchant_id,
  COUNT(*) as unpaid_parcels_count,
  SUM(cod_amount) as total_cod_collected,
  SUM(total_charge) as total_delivery_charges,
  SUM(cod_amount - total_charge) as net_payable_amount
FROM parcels 
WHERE paid_to_merchant = false 
  AND status IN ('DELIVERED', 'PARTIAL_DELIVERY')
  AND payment_status = 'COD_COLLECTED'
  AND merchant_id = 'merchant-uuid'
GROUP BY merchant_id;
```

### 3. Mark Parcels as Paid
When processing merchant payout:

```sql
UPDATE parcels 
SET 
  paid_to_merchant = true,
  paid_to_merchant_at = CURRENT_TIMESTAMP
WHERE id IN (
  -- List of parcel IDs included in payout
  'parcel-uuid-1',
  'parcel-uuid-2',
  'parcel-uuid-3'
);
```

### 4. Payment History Report
Get payment history for a merchant:

```sql
SELECT 
  DATE(paid_to_merchant_at) as payment_date,
  COUNT(*) as parcels_paid,
  SUM(cod_amount - total_charge) as total_paid
FROM parcels 
WHERE paid_to_merchant = true 
  AND merchant_id = 'merchant-uuid'
GROUP BY DATE(paid_to_merchant_at)
ORDER BY payment_date DESC;
```

---

## 💰 Payment Calculation Logic

### Net Payable Amount to Merchant

```javascript
// For COD parcels
netPayable = cod_amount - total_charge

// Where:
// - cod_amount: Cash collected from customer
// - total_charge: delivery_charge + weight_charge + cod_charge
```

### Example Calculation

```javascript
Parcel Details:
- COD Amount: ৳5,000 (collected from customer)
- Delivery Charge: ৳60
- Weight Charge: ৳20
- COD Charge: ৳75 (1.5% of ৳5,000)
- Total Charge: ৳155

Net Payable to Merchant = ৳5,000 - ৳155 = ৳4,845
```

---

## 🔄 Workflow Integration

### Parcel Lifecycle with Payment Tracking

```
1. Parcel Created
   ├─ paid_to_merchant: false
   └─ paid_to_merchant_at: null

2. Parcel Delivered
   ├─ status: DELIVERED
   ├─ payment_status: COD_COLLECTED
   ├─ paid_to_merchant: false (still unpaid)
   └─ delivered_at: timestamp

3. Hub Manager Settles with Rider
   ├─ Rider gives cash to hub manager
   └─ paid_to_merchant: false (still unpaid to merchant)

4. Hub Manager Transfers to Admin
   ├─ Hub manager sends money to admin
   └─ paid_to_merchant: false (still unpaid to merchant)

5. Admin Processes Merchant Payout
   ├─ Admin reviews unpaid parcels
   ├─ Admin creates payout transaction
   ├─ Admin transfers money to merchant
   ├─ paid_to_merchant: true ✅
   └─ paid_to_merchant_at: timestamp
```

---

## 📊 API Endpoint Suggestions

### Get Unpaid Parcels for Merchant

```http
GET /merchants/my/parcels/unpaid
Authorization: Bearer {merchant_token}

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- fromDate: ISO date
- toDate: ISO date
```

**Response:**
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "parcel-uuid",
        "tracking_number": "TRK123456",
        "cod_amount": 5000.00,
        "total_charge": 155.00,
        "net_payable": 4845.00,
        "delivered_at": "2024-12-24T10:00:00.000Z",
        "paid_to_merchant": false
      }
    ],
    "summary": {
      "total_unpaid_parcels": 25,
      "total_cod_collected": 125000.00,
      "total_charges": 3875.00,
      "net_payable_amount": 121125.00
    },
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

---

### Get Payment History

```http
GET /merchants/my/payment-history
Authorization: Bearer {merchant_token}

Query Parameters:
- page: number
- limit: number
- month: YYYY-MM (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "payment_date": "2024-12-20",
        "parcels_count": 15,
        "total_paid": 75000.00,
        "parcel_ids": ["uuid1", "uuid2", "..."]
      },
      {
        "payment_date": "2024-12-15",
        "parcels_count": 10,
        "total_paid": 46125.00,
        "parcel_ids": ["uuid3", "uuid4", "..."]
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### Admin: Mark Parcels as Paid

```http
POST /admin/merchants/payouts
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "merchant_id": "merchant-uuid",
  "parcel_ids": [
    "parcel-uuid-1",
    "parcel-uuid-2",
    "parcel-uuid-3"
  ],
  "payment_method": "BANK_TRANSFER",
  "transaction_reference": "TRX123456",
  "notes": "Weekly payout batch"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payout": {
      "id": "payout-uuid",
      "merchant_id": "merchant-uuid",
      "parcels_count": 3,
      "total_amount": 14535.00,
      "payment_method": "BANK_TRANSFER",
      "transaction_reference": "TRX123456",
      "processed_at": "2024-12-24T12:00:00.000Z"
    },
    "updated_parcels": 3
  },
  "message": "Merchant payout processed successfully"
}
```

---

## 🔍 Query Examples

### 1. Get Unpaid Parcels Summary by Merchant

```typescript
// In service method
async getUnpaidParcelsSummary(merchantId: string) {
  const result = await this.parcelRepository
    .createQueryBuilder('parcel')
    .select([
      'COUNT(*) as unpaid_count',
      'SUM(parcel.cod_amount) as total_cod',
      'SUM(parcel.total_charge) as total_charges',
      'SUM(parcel.cod_amount - parcel.total_charge) as net_payable'
    ])
    .where('parcel.merchant_id = :merchantId', { merchantId })
    .andWhere('parcel.paid_to_merchant = :paid', { paid: false })
    .andWhere('parcel.status IN (:...statuses)', { 
      statuses: ['DELIVERED', 'PARTIAL_DELIVERY'] 
    })
    .andWhere('parcel.payment_status = :paymentStatus', { 
      paymentStatus: 'COD_COLLECTED' 
    })
    .getRawOne();

  return {
    unpaid_parcels: parseInt(result.unpaid_count),
    total_cod_collected: parseFloat(result.total_cod) || 0,
    total_charges: parseFloat(result.total_charges) || 0,
    net_payable_amount: parseFloat(result.net_payable) || 0
  };
}
```

---

### 2. Get Unpaid Parcels List

```typescript
async getUnpaidParcels(
  merchantId: string, 
  page: number = 1, 
  limit: number = 20
) {
  const [parcels, total] = await this.parcelRepository.findAndCount({
    where: {
      merchant_id: merchantId,
      paid_to_merchant: false,
      status: In(['DELIVERED', 'PARTIAL_DELIVERY']),
      payment_status: PaymentStatus.COD_COLLECTED
    },
    order: {
      delivered_at: 'DESC'
    },
    skip: (page - 1) * limit,
    take: limit,
    relations: ['store', 'customer']
  });

  return {
    parcels: parcels.map(p => ({
      ...p,
      net_payable: p.cod_amount - p.total_charge
    })),
    total
  };
}
```

---

### 3. Mark Parcels as Paid

```typescript
async markParcelsAsPaid(parcelIds: string[]) {
  const result = await this.parcelRepository.update(
    { 
      id: In(parcelIds),
      paid_to_merchant: false // Only update unpaid parcels
    },
    {
      paid_to_merchant: true,
      paid_to_merchant_at: new Date()
    }
  );

  return {
    updated_count: result.affected || 0
  };
}
```

---

### 4. Get Payment History

```typescript
async getPaymentHistory(
  merchantId: string,
  page: number = 1,
  limit: number = 10
) {
  const parcels = await this.parcelRepository
    .createQueryBuilder('parcel')
    .select([
      'DATE(parcel.paid_to_merchant_at) as payment_date',
      'COUNT(*) as parcels_count',
      'SUM(parcel.cod_amount - parcel.total_charge) as total_paid',
      'array_agg(parcel.id) as parcel_ids'
    ])
    .where('parcel.merchant_id = :merchantId', { merchantId })
    .andWhere('parcel.paid_to_merchant = :paid', { paid: true })
    .groupBy('DATE(parcel.paid_to_merchant_at)')
    .orderBy('payment_date', 'DESC')
    .offset((page - 1) * limit)
    .limit(limit)
    .getRawMany();

  return parcels;
}
```

---

## 📈 Reporting Queries

### Monthly Payment Report

```sql
SELECT 
  TO_CHAR(paid_to_merchant_at, 'YYYY-MM') as month,
  COUNT(*) as parcels_paid,
  SUM(cod_amount) as total_cod,
  SUM(total_charge) as total_charges,
  SUM(cod_amount - total_charge) as net_paid
FROM parcels 
WHERE paid_to_merchant = true 
  AND merchant_id = 'merchant-uuid'
  AND paid_to_merchant_at >= '2024-01-01'
GROUP BY TO_CHAR(paid_to_merchant_at, 'YYYY-MM')
ORDER BY month DESC;
```

---

### Merchant Payment Dashboard

```sql
SELECT 
  m.id as merchant_id,
  u.full_name as merchant_name,
  COUNT(CASE WHEN p.paid_to_merchant = false THEN 1 END) as unpaid_parcels,
  COUNT(CASE WHEN p.paid_to_merchant = true THEN 1 END) as paid_parcels,
  SUM(CASE WHEN p.paid_to_merchant = false 
      THEN p.cod_amount - p.total_charge 
      ELSE 0 END) as outstanding_amount,
  SUM(CASE WHEN p.paid_to_merchant = true 
      THEN p.cod_amount - p.total_charge 
      ELSE 0 END) as total_paid_amount
FROM merchants m
JOIN users u ON u.id = m.user_id
LEFT JOIN parcels p ON p.merchant_id = m.id 
  AND p.status IN ('DELIVERED', 'PARTIAL_DELIVERY')
  AND p.payment_status = 'COD_COLLECTED'
GROUP BY m.id, u.full_name
ORDER BY outstanding_amount DESC;
```

---

## 🚨 Important Notes

### 1. Payment Eligibility
Only mark parcels as paid when:
- ✅ Status is `DELIVERED` or `PARTIAL_DELIVERY`
- ✅ Payment status is `COD_COLLECTED`
- ✅ Cash has been received by admin (from hub manager)
- ✅ Merchant payout has been processed

### 2. Data Integrity
- Never manually set `paid_to_merchant = true` without recording `paid_to_merchant_at`
- Always validate parcel IDs belong to the merchant before marking as paid
- Keep audit logs of all payment transactions

### 3. Financial Reconciliation
- Match `paid_to_merchant_at` dates with bank transfer dates
- Cross-reference with merchant payout transactions
- Generate monthly reconciliation reports

### 4. Return Parcels
- Return parcels should NOT be marked as paid to merchant
- Return charges are handled separately via return charge configurations

---

## 🔐 Security Considerations

1. **Authorization**: Only admins should be able to mark parcels as paid
2. **Validation**: Verify merchant owns the parcels before payment
3. **Audit Trail**: Log all payment operations with admin user ID
4. **Idempotency**: Prevent double-payment by checking current status
5. **Transaction Safety**: Use database transactions for bulk updates

---

## ✅ Migration Status

- ✅ Migration created: `1735100000000-AddPaidToMerchantFlagToParcels.ts`
- ✅ Migration executed successfully
- ✅ Columns added: `paid_to_merchant`, `paid_to_merchant_at`
- ✅ Indexes created for performance
- ✅ Entity updated: `parcel.entity.ts`

---

## 📝 Next Steps

1. **Create Merchant Payout API**
   - Endpoint to view unpaid parcels
   - Endpoint to view payment history
   - Endpoint for admin to process payouts

2. **Create Payout Transaction Table** (Optional)
   - Track batch payments to merchants
   - Link multiple parcels to single payout
   - Store payment method and reference

3. **Add Notifications**
   - Email merchant when payment is processed
   - SMS notification for payment confirmation

4. **Create Reports**
   - Monthly payment summary
   - Outstanding payments dashboard
   - Payment reconciliation report

---

## 🎯 Summary

The `paid_to_merchant` flag provides:
- ✅ Clear tracking of merchant payments
- ✅ Easy identification of unpaid parcels
- ✅ Financial reconciliation capability
- ✅ Payment history audit trail
- ✅ Efficient queries with proper indexes

This flag is the foundation for a complete merchant payout system! 🚀

