# Carrybee Integration Test Results

## ✅ Pre-Test Checklist

- [x] Environment variables configured (.env file)
- [ ] Database has Carrybee provider record
- [ ] Database has coverage areas with Carrybee location IDs
- [ ] Application is running (`npm run start:dev`)
- [ ] Database is accessible

## 🧪 Test Execution

### Test 1: Environment Setup
**Run:** Check .env file has Carrybee configuration
```bash
Get-Content .env | Select-String -Pattern "CARRYBEE"
```
**Expected:** 6 CARRYBEE_* variables shown
**Status:** ✅ PASS / ❌ FAIL
**Notes:** _______________________________

---

### Test 2: Database Setup
**Run:** Execute `test-carrybee-setup.sql`
```bash
psql -h localhost -U postgres -d delivery_db -f test-carrybee-setup.sql
```
**Expected:** Carrybee provider created/verified
**Status:** ✅ PASS / ❌ FAIL
**Provider ID:** _______________________________

---

### Test 3: Get Carrybee Cities
**Run:** Step 3 from test-carrybee.http
```
GET /api/carrybee/locations/cities
```
**Expected:** List of cities with id, name
**Status:** ✅ PASS / ❌ FAIL
**Dhaka City ID:** _______________________________

---

### Test 4: Create Store with Carrybee Sync
**Run:** Step 7 from test-carrybee.http
**Expected Response:**
```json
{
  "id": "...",
  "carrybee_store_id": "CSTORE...",
  "is_carrybee_synced": true
}
```
**Status:** ✅ PASS / ❌ FAIL
**Store ID:** _______________________________
**Carrybee Store ID:** _______________________________

**Check Logs:**
```
[STORE CREATED] Creating store in Carrybee...
[STORE CREATED] Store synced to Carrybee with ID: CSTORE...
```
**Logs Match:** ✅ YES / ❌ NO

---

### Test 5: Create Parcel with Carrybee IDs
**Run:** Step 9 from test-carrybee.http
**Expected:** Parcel created with recipient_carrybee_city_id, zone_id, area_id populated
**Status:** ✅ PASS / ❌ FAIL
**Parcel ID:** _______________________________
**Tracking Number:** _______________________________

**Verify in DB:**
```sql
SELECT recipient_carrybee_city_id, recipient_carrybee_zone_id, recipient_carrybee_area_id
FROM parcels WHERE id = 'parcel-id';
```
**All IDs Populated:** ✅ YES / ❌ NO

---

### Test 6: Assign Parcel to Carrybee
**Run:** Step 10 from test-carrybee.http
**Expected Response:**
```json
{
  "parcel_id": "...",
  "carrybee_consignment_id": "CB...",
  "delivery_fee": "60.00",
  "cod_fee": "10.00"
}
```
**Status:** ✅ PASS / ❌ FAIL
**Consignment ID:** _______________________________

**Check Logs:**
```
[CARRYBEE] Creating Carrybee order with data: {...}
[CARRYBEE] Parcel ... assigned to Carrybee
```
**Logs Match:** ✅ YES / ❌ NO

**Verify in DB:**
```sql
SELECT status, delivery_provider, third_party_provider_id, carrybee_consignment_id
FROM parcels WHERE id = 'parcel-id';
```
- **status:** Expected = ASSIGNED_TO_THIRD_PARTY, Actual = _______________
- **delivery_provider:** Expected = CARRYBEE, Actual = _______________
- **carrybee_consignment_id:** Expected = CB..., Actual = _______________

---

### Test 7: Webhook - Order Picked
**Run:** Step 12 from test-carrybee.http
**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```
**Status:** ✅ PASS / ❌ FAIL

**Verify in DB:**
```sql
SELECT status, picked_up_at FROM parcels 
WHERE carrybee_consignment_id = 'CB...';
```
- **status:** Expected = PICKED_UP, Actual = _______________
- **picked_up_at:** Populated = ✅ YES / ❌ NO

**Check Logs:**
```
[CARRYBEE WEBHOOK] Received Carrybee webhook: order.picked
[CARRYBEE WEBHOOK] Parcel ... updated from Carrybee webhook
```
**Logs Match:** ✅ YES / ❌ NO

---

### Test 8: Webhook - Order Delivered
**Run:** Step 14 from test-carrybee.http
**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```
**Status:** ✅ PASS / ❌ FAIL

**Verify in DB:**
```sql
SELECT status, payment_status, cod_collected_amount, delivery_charge_applicable
FROM parcels WHERE carrybee_consignment_id = 'CB...';
```
- **status:** Expected = DELIVERED, Actual = _______________
- **payment_status:** Expected = COD_COLLECTED, Actual = _______________
- **cod_collected_amount:** Expected = 1000, Actual = _______________
- **delivery_charge_applicable:** Expected = true, Actual = _______________

---

### Test 9: View Carrybee Cleared Deliveries
**Run:** Step 16 from test-carrybee.http
**Expected:** List of delivered Carrybee parcels with cod_cleared_at = null
**Status:** ✅ PASS / ❌ FAIL
**Parcel Count:** _______________________________

---

### Test 10: Collect COD from Carrybee
**Run:** Step 17 from test-carrybee.http
**Expected Response:**
```json
{
  "provider_name": "Carrybee",
  "parcel_count": 1,
  "counted_amount": 1000,
  "current_balance": 1000
}
```
**Status:** ✅ PASS / ❌ FAIL

**Verify in DB:**
```sql
SELECT cod_cleared_at FROM parcels WHERE carrybee_consignment_id = 'CB...';
SELECT current_balance, total_collected_from_third_party 
FROM hub_manager_finance WHERE hub_manager_id = '...';
```
- **cod_cleared_at:** Populated = ✅ YES / ❌ NO
- **Hub balance increased:** ✅ YES / ❌ NO

---

### Test 11: Webhook Idempotency
**Run:** Send same webhook twice (repeat Step 14)
**Expected:** Second webhook returns success but doesn't change parcel
**Status:** ✅ PASS / ❌ FAIL

**Check Logs:**
```
Parcel ... already in status DELIVERED. Skipping duplicate webhook.
```
**Idempotency Working:** ✅ YES / ❌ NO

---

### Test 12: Test Return Webhook
**Run:** Step 15 from test-carrybee.http (create new parcel first)
**Expected Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```
**Status:** ✅ PASS / ❌ FAIL

**Verify in DB:**
```sql
SELECT status, payment_status, return_charge_applicable, return_charge, return_reason
FROM parcels WHERE carrybee_consignment_id = 'CB...';
```
- **status:** Expected = RETURNED, Actual = _______________
- **payment_status:** Expected = UNPAID, Actual = _______________
- **return_charge_applicable:** Expected = true, Actual = _______________
- **return_charge:** Expected > 0, Actual = _______________

---

### Test 13: Mixed Invoice (Rider + Carrybee)
**Run:** Step 18 from test-carrybee.http
**Prerequisites:** Have both rider-delivered and Carrybee-delivered parcels
**Expected:** Invoice includes parcels from both delivery providers
**Status:** ✅ PASS / ❌ FAIL
**Invoice Number:** _______________________________
**Total Parcels:** _______ (Rider: _____, Carrybee: _____)

---

### Test 14: Auto-Assignment (Optional)
**Setup:** Enable auto-assignment for a store
```sql
UPDATE stores SET auto_assign_to_carrybee = true WHERE id = 'store-id';
```
**Run:** Create new parcel for that store
**Expected:** Parcel automatically assigns to Carrybee after creation
**Status:** ✅ PASS / ❌ FAIL / ⏭️ SKIPPED

**Check Logs:**
```
[AUTO-ASSIGN CARRYBEE] Attempting auto-assignment for parcel TRK-...
[AUTO-ASSIGN SUCCESS] Parcel TRK-... assigned to Carrybee
```
**Auto-Assignment Working:** ✅ YES / ❌ NO / ⏭️ SKIPPED

---

## 📊 Test Summary

| Test | Status | Notes |
|------|--------|-------|
| Environment Setup | ⬜ | |
| Database Setup | ⬜ | |
| Get Cities | ⬜ | |
| Store Sync | ⬜ | |
| Parcel Creation | ⬜ | |
| Manual Assignment | ⬜ | |
| Webhook: Picked | ⬜ | |
| Webhook: Delivered | ⬜ | |
| View Cleared | ⬜ | |
| Collect COD | ⬜ | |
| Idempotency | ⬜ | |
| Return Flow | ⬜ | |
| Mixed Invoice | ⬜ | |
| Auto-Assignment | ⬜ | |

**Total Tests:** 14
**Passed:** _____
**Failed:** _____
**Skipped:** _____

**Overall Status:** ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

---

## 🐛 Issues Found

1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

---

## ✅ Sign-off

**Tester:** _______________________________
**Date:** _______________________________
**Version:** _______________________________
**Environment:** Development / Staging / Production
