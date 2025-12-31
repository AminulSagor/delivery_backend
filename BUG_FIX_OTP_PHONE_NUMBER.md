# 🐛 Bug Fix: OTP Sent to Wrong Phone Number

## Issue
When initiating delivery verification (e.g., for RETURNED, PARTIAL_DELIVERY, etc.), the OTP was being sent to the **Hub Manager's phone number** instead of the **Merchant Owner's phone number**.

### Error Example:
```json
{
    "success": true,
    "verification_id": "9e74ed11-2c7c-4023-a92b-840ca95b3018",
    "selected_status": "RETURNED",
    "otp_sent_to": "MERCHANT",
    "otp_phone": "01712****78",  // ❌ This is hub manager's phone
    "message": "OTP sent to merchant. Please enter the 4-digit code to complete."
}
```

**Expected:** OTP should go to merchant owner's phone  
**Actual:** OTP went to store contact phone (which was hub manager's number)

---

## Root Cause

**File:** `src/delivery-verifications/delivery-verifications.service.ts`  
**Method:** `initiateVerification()` (lines 104-122)

### Problem:
The code was using the **Store's phone number** instead of the **Merchant Owner's phone number**.

**❌ OLD CODE (Line 114):**
```typescript
// Get phone number for OTP recipient
let otpPhone: string | null = null;
if (otpRecipientType === OtpRecipientType.CUSTOMER) {
  otpPhone = parcel.customer_phone;
} else {
  otpPhone = parcel.store?.phone_number || null;  // ❌ WRONG!
}
```

### Why it failed:
- **Store entity** has a `phone_number` field which is the store's contact phone
- This field can be set to any phone (hub manager, store manager, etc.)
- **Merchant Owner** is a separate user whose phone should be used for OTP
- The merchant owner's phone is accessed via: `parcel.store?.merchant?.user?.phone`

---

## Solution

### ✅ FIX #1: Use Merchant Owner's Phone for OTP (Line 114)
```typescript
// Get phone number for OTP recipient
let otpPhone: string | null = null;
if (otpRecipientType === OtpRecipientType.CUSTOMER) {
  otpPhone = parcel.customer_phone;
} else {
  // Use merchant owner's phone, not store's phone
  otpPhone = parcel.store?.merchant?.user?.phone || null;  // ✅ CORRECT!
}
```

### ✅ FIX #2: Store Correct Merchant Phone (Line 137)
```typescript
const verification = this.deliveryVerificationRepo.create({
  parcel_id: parcelId,
  rider_id: riderId,
  selected_status: selectedStatus,
  expected_cod_amount: expectedAmount,
  collected_amount: collectedAmount,
  has_amount_difference: hasDifference,
  difference_reason: reason || null,
  requires_otp_verification: true,
  otp_recipient_type: otpRecipientType,
  otp_sent_to_phone: otpPhone,
  merchant_phone_used: parcel.store?.merchant?.user?.phone || null,  // ✅ FIXED!
  customer_phone_used: parcel.customer_phone || null,
  verification_status: DeliveryVerificationStatus.PENDING,
  delivery_attempted_at: new Date(),
});
```

---

## Data Model Explanation

### Store vs Merchant Owner

```
┌─────────────────┐
│  User (Merchant)│
│  - id           │
│  - phone ✅     │ ← Merchant Owner's Personal Phone
│  - email        │
│  - full_name    │
└────────┬────────┘
         │
         │ user_id
         │
┌────────▼─────────┐
│  Merchant        │
│  - id            │
│  - user_id       │
└────────┬─────────┘
         │
         │ merchant_id
         │
┌────────▼─────────┐
│  Store           │
│  - id            │
│  - merchant_id   │
│  - phone_number  │ ← Store Contact Phone (Can be anyone!)
│  - business_name │
│  - hub_id        │
└──────────────────┘
```

### Phone Number Hierarchy:
1. **Merchant Owner Phone:** `user.phone` (Personal, for OTP) ✅
2. **Store Contact Phone:** `store.phone_number` (Business, for operations) ❌ for OTP
3. **Customer Phone:** `parcel.customer_phone` (Delivery recipient) ✅ (for paid parcels)

---

## Testing

### Before Fix:
```bash
POST /delivery-verifications/parcels/:parcelId/initiate
Body: {
  "selected_status": "RETURNED",
  "collected_amount": 0,
  "reason": "Customer refused delivery"
}

❌ Response:
{
  "otp_sent_to": "MERCHANT",
  "otp_phone": "01712****78",  // Hub Manager's phone!
  "message": "OTP sent to merchant"
}
```

### After Fix:
```bash
POST /delivery-verifications/parcels/:parcelId/initiate
Body: {
  "selected_status": "RETURNED",
  "collected_amount": 0,
  "reason": "Customer refused delivery"
}

✅ Response:
{
  "otp_sent_to": "MERCHANT",
  "otp_phone": "01811****33",  // Correct merchant owner's phone!
  "message": "OTP sent to merchant"
}
```

---

## Impact

### ✅ Fixed Issues:
- OTP now correctly sent to merchant owner's phone
- Merchant can receive and verify delivery outcomes
- Hub managers no longer receive OTPs meant for merchants
- Proper audit trail with correct phone numbers

### 🔍 Affected Scenarios:
All delivery verification flows that require merchant OTP:
- **RETURNED** - Customer refused delivery
- **PARTIAL_DELIVERY** - Some items delivered
- **EXCHANGE** - Product exchanged
- **PAID_RETURN** - Return with fee collected
- **DELIVERED** - Amount differs from expected

### 📱 OTP Flow:
```
Rider completes delivery
     ↓
Initiates verification
     ↓
System determines: MERCHANT OTP needed
     ↓
✅ Sends OTP to merchant owner's phone
     ↓
Merchant receives SMS with OTP
     ↓
Merchant tells OTP to rider
     ↓
Rider enters OTP
     ↓
Verification complete
```

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `src/delivery-verifications/delivery-verifications.service.ts` | 114, 137 | Changed from `store.phone_number` to `store.merchant.user.phone` |

### Specific Changes:
1. **Line 114:** Changed OTP phone lookup from store phone to merchant owner phone
2. **Line 137:** Changed merchant_phone_used tracking from store phone to merchant owner phone

---

## Relations Required

To access merchant owner's phone, the parcel must be loaded with these relations:
```typescript
relations: ['store', 'store.merchant', 'store.merchant.user', 'customer']
```

This is already correctly loaded at line 54 in the service.

---

## Edge Cases Handled

### 1. Missing Store
```typescript
otpPhone = parcel.store?.merchant?.user?.phone || null;
```
✅ Uses optional chaining, returns null if store missing

### 2. Missing Merchant
✅ Safe due to optional chaining

### 3. Missing User
✅ Safe due to optional chaining

### 4. Null Phone
```typescript
if (!otpPhone) {
  throw new BadRequestException(
    `Cannot send OTP: ${otpRecipientType} phone number not found`,
  );
}
```
✅ Explicit validation with clear error message

---

## Deployment Notes

1. ✅ No database migrations required
2. ✅ No breaking changes to API
3. ✅ Backward compatible
4. ✅ No environment variable changes needed
5. ⚠️ **Important:** Restart server to apply changes

---

## Related Systems

### OTP Recipients:
1. **MERCHANT** (default) - For most delivery outcomes
   - ✅ Now uses: `store.merchant.user.phone`
   
2. **CUSTOMER** - For already-paid deliveries
   - ✅ Uses: `parcel.customer_phone` (unchanged, working correctly)

### Other Methods Using Same Logic:
- `requestOtp()` - Uses stored `otp_sent_to_phone` ✅
- `resendOtp()` - Uses stored `otp_sent_to_phone` ✅

---

## Verification Checklist

- [x] OTP sent to correct merchant owner phone
- [x] Store phone not used for OTP
- [x] Hub manager no longer receives merchant OTPs
- [x] Customer OTP still works (for paid parcels)
- [x] merchant_phone_used field stores correct phone
- [x] Build successful (no TypeScript errors)
- [x] No linter errors
- [x] Backward compatible

---

**Status:** ✅ FULLY FIXED  
**Date:** December 25, 2025  
**Priority:** HIGH (Security & Communication Issue)  
**Severity:** MAJOR (OTP sent to wrong person - security concern)  
**Issue Type:** Logic Error (Wrong field reference)

---

## Testing Instructions

### Test Case 1: Returned Parcel
1. Create a parcel for a merchant
2. Assign to rider
3. Rider attempts delivery (status: OUT_FOR_DELIVERY)
4. Rider selects RETURNED status
5. ✅ Verify OTP sent to merchant owner's phone (not hub manager)

### Test Case 2: Partial Delivery
1. Create a parcel with COD 1500
2. Rider collects only 800 (partial)
3. Rider selects PARTIAL_DELIVERY
4. ✅ Verify OTP sent to merchant owner's phone

### Test Case 3: Already Paid Delivery
1. Create a parcel with COD 0 (already paid)
2. Rider delivers successfully
3. Rider selects DELIVERED with collected_amount: 0
4. ✅ Verify OTP sent to CUSTOMER phone (not merchant)

---

**All OTP routing is now correct!** 🎉

