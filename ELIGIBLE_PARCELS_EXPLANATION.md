# 📋 Eligible Parcels for Invoice - Complete Guide

## 🎯 Your Question
> "A rider returned a parcel. Why isn't it showing in eligible parcels (`/merchant-invoices/eligible-parcels`)?"

## ✅ What Makes a Parcel Eligible?

### Database Query Conditions (Lines 35-46)
```typescript
const parcels = await this.parcelRepository.find({
  where: {
    merchant_id: merchantId,           // 1. Belongs to merchant
    invoice_id: IsNull(),              // 2. NOT already invoiced
    paid_to_merchant: false,           // 3. NOT paid yet
    financial_status: FinancialStatus.PENDING,  // 4. Status = PENDING
  },
});
```

### Application Filter (Lines 49-54)
```typescript
return parcels.filter((parcel) => {
  const codCollected = Number(parcel.cod_collected_amount) || 0;
  const hasDeliveryCharge = parcel.delivery_charge_applicable;
  const hasReturnCharge = parcel.return_charge_applicable;
  
  return codCollected > 0 || hasDeliveryCharge || hasReturnCharge;
});
```

---

## 🐛 THE PROBLEM: Missing Financial Fields Update!

### Current Delivery Verification Flow

When rider completes delivery (after OTP verification), the `completeDelivery` method **ONLY** updates:

```typescript
// ✅ These get updated:
parcel.status = verification.selected_status;  // DELIVERED, RETURNED, etc.
parcel.delivered_at = new Date();
parcel.payment_status = PaymentStatus.COD_COLLECTED;

// ❌ These DO NOT get updated (BUG!):
// parcel.cod_collected_amount
// parcel.delivery_charge_applicable
// parcel.return_charge_applicable
```

### Why This Breaks Eligible Parcels

Without these fields being set, the filter (lines 49-54) **always excludes the parcel** because:
- `cod_collected_amount` = 0 (default)
- `delivery_charge_applicable` = true (default, but not enough alone)
- `return_charge_applicable` = false (default)

**Result:** `codCollected > 0 || hasDeliveryCharge || hasReturnCharge` might evaluate to `false` or not work as intended.

---

## 🔧 What SHOULD Happen

### For RETURNED Parcel:
```typescript
parcel.status = 'RETURNED';
parcel.cod_collected_amount = 0;  // ❌ NOT BEING SET!
parcel.delivery_charge_applicable = false;  // ❌ NOT BEING SET!
parcel.return_charge_applicable = true;  // ❌ NOT BEING SET!
parcel.return_charge = (calculated return charge);  // ❌ NOT BEING SET!
parcel.financial_status = FinancialStatus.PENDING;  // Already correct
```

### For DELIVERED Parcel:
```typescript
parcel.status = 'DELIVERED';
parcel.cod_collected_amount = verification.collected_amount;  // ❌ NOT BEING SET!
parcel.delivery_charge_applicable = true;  // Already true (default)
parcel.return_charge_applicable = false;  // Already false (default)
parcel.financial_status = FinancialStatus.PENDING;  // Already correct
```

### For PARTIAL_DELIVERY:
```typescript
parcel.status = 'PARTIAL_DELIVERY';
parcel.cod_collected_amount = verification.collected_amount;  // ❌ NOT BEING SET!
parcel.delivery_charge_applicable = true;  // Already true
parcel.return_charge_applicable = true;  // ❌ NOT BEING SET!
parcel.return_charge = (calculated return charge);  // ❌ NOT BEING SET!
```

---

## 📊 Parcel Status → Financial Fields Mapping

| Status | cod_collected_amount | delivery_charge_applicable | return_charge_applicable | Shows in Eligible? |
|--------|---------------------|---------------------------|-------------------------|-------------------|
| **DELIVERED** | = collected_amount | ✅ true | ❌ false | ✅ Yes (if COD > 0) |
| **PARTIAL_DELIVERY** | = collected_amount | ✅ true | ✅ true | ✅ Yes |
| **EXCHANGE** | 0 or partial | ✅ true | ✅ true | ✅ Yes (charges apply) |
| **PAID_RETURN** | = return fee collected | ❌ false | ✅ true | ✅ Yes (if fee > 0) |
| **RETURNED** | 0 | ❌ false | ✅ true | ✅ Yes (return charges) |
| **DELIVERY_RESCHEDULED** | 0 | ❌ false | ❌ false | ❌ No (no charges yet) |

---

## 🚨 Current Bug Impact

### Scenario 1: Rider Returns Parcel
```
1. Rider selects RETURNED status
2. Rider provides reason: "Customer refused"
3. OTP sent to merchant, merchant verifies
4. Parcel status updated to RETURNED ✅
5. BUT: return_charge_applicable NOT set to true ❌
6. BUT: return_charge NOT calculated ❌
7. Result: Parcel does NOT appear in eligible parcels ❌
```

### Scenario 2: Rider Delivers with Different Amount
```
1. Expected COD: 1500
2. Rider collects: 1200
3. Rider provides reason: "Customer negotiated"
4. OTP verified
5. Parcel status updated to DELIVERED ✅
6. BUT: cod_collected_amount NOT set to 1200 ❌
7. Result: Parcel might show, but with WRONG amount ❌
```

---

## ✅ THE FIX NEEDED

### Update `completeDelivery()` Method

**File:** `src/delivery-verifications/delivery-verifications.service.ts` (Line 518)

**Add this logic:**

```typescript
private async completeDelivery(verificationId: string) {
  const verification = await this.deliveryVerificationRepo.findOne({
    where: { id: verificationId },
    relations: ['parcel', 'parcel.store'],
  });

  if (!verification) {
    throw new NotFoundException('Verification not found');
  }

  const parcel = verification.parcel;
  const selectedStatus = verification.selected_status;
  const collectedAmount = Number(verification.collected_amount);

  // Update parcel status
  parcel.status = selectedStatus;
  parcel.delivered_at = new Date();

  // ✅ UPDATE FINANCIAL FIELDS based on status
  switch (selectedStatus) {
    case ParcelStatus.DELIVERED:
      parcel.cod_collected_amount = collectedAmount;
      parcel.delivery_charge_applicable = true;
      parcel.return_charge_applicable = false;
      parcel.payment_status = PaymentStatus.COD_COLLECTED;
      break;

    case ParcelStatus.PARTIAL_DELIVERY:
      parcel.cod_collected_amount = collectedAmount;
      parcel.delivery_charge_applicable = true;
      parcel.return_charge_applicable = true;
      // Calculate return charge for undelivered portion
      parcel.return_charge = await this.calculateReturnCharge(parcel);
      parcel.payment_status = PaymentStatus.COD_COLLECTED;
      break;

    case ParcelStatus.EXCHANGE:
      parcel.cod_collected_amount = collectedAmount;
      parcel.delivery_charge_applicable = true;
      parcel.return_charge_applicable = true;
      parcel.return_charge = await this.calculateReturnCharge(parcel);
      parcel.payment_status = PaymentStatus.COD_COLLECTED;
      break;

    case ParcelStatus.PAID_RETURN:
      parcel.cod_collected_amount = collectedAmount; // Return fee
      parcel.delivery_charge_applicable = false;
      parcel.return_charge_applicable = true;
      parcel.return_charge = await this.calculateReturnCharge(parcel);
      parcel.payment_status = PaymentStatus.COD_COLLECTED;
      break;

    case ParcelStatus.RETURNED:
      parcel.cod_collected_amount = 0;
      parcel.delivery_charge_applicable = false;
      parcel.return_charge_applicable = true;
      parcel.return_charge = await this.calculateReturnCharge(parcel);
      parcel.payment_status = PaymentStatus.NOT_APPLICABLE;
      break;

    case ParcelStatus.DELIVERY_RESCHEDULED:
      // No financial changes yet
      parcel.cod_collected_amount = 0;
      parcel.delivery_charge_applicable = false;
      parcel.return_charge_applicable = false;
      break;

    default:
      break;
  }

  await this.parcelRepo.save(parcel);

  // Update verification
  verification.delivery_completed_at = new Date();
  verification.verification_status = DeliveryVerificationStatus.COMPLETED;
  await this.deliveryVerificationRepo.save(verification);

  this.logger.log(
    `[DELIVERY COMPLETED] Parcel: ${parcel.tracking_number}, ` +
    `Status: ${selectedStatus}, Collected: ${collectedAmount}, ` +
    `Return Charge: ${parcel.return_charge}`,
  );
}
```

---

## 🧮 Return Charge Calculation

You'll also need a helper method to calculate return charges:

```typescript
private async calculateReturnCharge(parcel: Parcel): Promise<number> {
  // TODO: Implement based on your return_charges_configuration table
  // This should look up the store's return charge configuration
  // based on zone and return status
  
  // For now, return a default or calculate based on existing logic
  return 0; // Replace with actual calculation
}
```

---

## 📝 Testing After Fix

### Test Case 1: Returned Parcel
```bash
# 1. Create and assign parcel
POST /parcels
{ ... merchant's parcel ... }

# 2. Rider attempts delivery
PATCH /riders/parcels/:id/accept

# 3. Rider initiates return
POST /delivery-verifications/parcels/:id/initiate
{
  "selected_status": "RETURNED",
  "collected_amount": 0,
  "reason": "Customer refused"
}

# 4. Verify OTP
POST /delivery-verifications/:verificationId/verify-otp
{ "otp_code": "1234" }

# 5. Check eligible parcels
GET /merchant-invoices/eligible-parcels?merchant_id=xxx

✅ Expected: Parcel should appear with:
{
  "tracking_number": "TRK-001",
  "status": "RETURNED",
  "cod_collected": 0,
  "return_charge_applicable": true,
  "return_charge": 50  // Example
}
```

### Test Case 2: Delivered with Amount
```bash
# Similar flow but with DELIVERED status and collected_amount > 0

✅ Expected: Parcel should appear with:
{
  "tracking_number": "TRK-002",
  "status": "DELIVERED",
  "cod_collected": 1200,
  "delivery_charge_applicable": true,
  "delivery_charge": 60
}
```

---

## 🎯 Summary

### Current Behavior:
- ❌ Parcels get status updated but financial fields stay default
- ❌ Returned parcels don't show in eligible parcels
- ❌ Delivered parcels show with wrong amounts
- ❌ Invoice generation uses incorrect data

### After Fix:
- ✅ Financial fields properly set based on delivery outcome
- ✅ Returned parcels appear with return charges
- ✅ Delivered parcels show correct collected amounts
- ✅ Invoice generation uses accurate data

### Critical Fields That Must Be Set:
1. **cod_collected_amount** - Actual amount collected (from verification)
2. **delivery_charge_applicable** - Whether delivery charge applies
3. **return_charge_applicable** - Whether return charge applies
4. **return_charge** - Calculated return charge amount

---

**This is a critical bug that affects the entire invoice/payment flow!** The fix should be implemented ASAP to ensure:
- Merchants get paid correctly
- Return charges are tracked
- Financial reconciliation is accurate
- Invoice system works as designed

---

**Priority:** 🚨 CRITICAL  
**Impact:** All delivered/returned parcels after OTP verification  
**Fix Location:** `src/delivery-verifications/delivery-verifications.service.ts` → `completeDelivery()` method

