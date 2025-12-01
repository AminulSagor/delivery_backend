# 🧪 Carrybee Integration Testing Guide

Complete step-by-step guide to test the Carrybee third-party delivery integration.

---

## 📋 Prerequisites

### 1. Environment Setup
Ensure `.env` has:
```env
CARRYBEE_ENV=sandbox
CARRYBEE_WEBHOOK_SIGNATURE=default-signature
```

### 2. Database Setup
Run migration:
```bash
npm run typeorm:migrate
```

### 3. Start Server
```bash
npm run start:dev
```

### 4. Import Postman Collection
Import `Delivery_Backend_API.postman_collection.json` into Postman

---

## 🎯 Test Scenarios

### **Scenario 1: Complete Store Setup & Sync**

#### Step 1: Login as Merchant
- **Request:** `1. Authentication > Login - MERCHANT`
- **Body:** Use your merchant credentials
- **Expected:** 200 OK, access_token saved
- **Verify:** `{{access_token}}` variable is set

#### Step 2: Create Store with Location
- **Request:** `4. Stores > Create Store (Merchant)`
- **Body:**
```json
{
  "business_name": "Test Electronics Shop",
  "business_address": "House 45, Road 12, Gulshan 1, Dhaka",
  "phone_number": "01712345678",
  "district": "Dhaka",
  "thana": "Gulshan",
  "area": "Gulshan 1"
}
```
- **Expected:** 201 Created, store_id saved
- **Verify:** 
  - `{{store_id}}` variable is set
  - Response has `district`, `thana`, `area`

#### Step 3: Search Carrybee Location
- **Request:** `11. Carrybee Integration > Location APIs > Search Area Suggestion`
- **Query:** `?search=Gulshan`
- **Expected:** 200 OK, list of matching areas
- **Verify:** Find matching location for "Gulshan 1, Dhaka"

#### Step 4: Get Carrybee Cities
- **Request:** `11. Carrybee Integration > Location APIs > Get Cities`
- **Expected:** 200 OK, list of cities
- **Verify:** `{{carrybee_city_id}}` auto-saved from first city

#### Step 5: Get Zones for City
- **Request:** `11. Carrybee Integration > Location APIs > Get Zones by City`
- **Expected:** 200 OK, list of zones
- **Verify:** `{{carrybee_zone_id}}` auto-saved

#### Step 6: Get Areas for Zone
- **Request:** `11. Carrybee Integration > Location APIs > Get Areas by Zone`
- **Expected:** 200 OK, list of areas
- **Verify:** `{{carrybee_area_id}}` auto-saved

#### Step 7: Sync Store to Carrybee
- **Request:** `11. Carrybee Integration > Store Sync > Sync Store to Carrybee`
- **Body:**
```json
{
  "carrybee_city_id": 1,
  "carrybee_zone_id": 1,
  "carrybee_area_id": 1
}
```
- **Expected:** 200 OK
- **Verify:**
  - `is_carrybee_synced: true`
  - `carrybee_store_id` is present

#### Step 8: Try to Sync Again (Should Fail)
- **Request:** Same as Step 7
- **Expected:** 400 Bad Request
- **Error:** "Store is already synced to Carrybee"

---

### **Scenario 2: Parcel Assignment to Carrybee**

#### Step 1: Login as Merchant
- **Request:** `1. Authentication > Login - MERCHANT`

#### Step 2: Create Parcel
- **Request:** `6. Parcels > Calculate Pricing` (get pricing first)
- **Then:** `6. Parcels > Create Parcel (Merchant)`
- **Body:**
```json
{
  "store_id": "{{store_id}}",
  "merchant_order_id": "ORD-TEST-001",
  "customer_name": "John Doe",
  "customer_phone": "01812345678",
  "delivery_address": "House 10, Road 5, Banani, Dhaka",
  "delivery_coverage_area_id": "{{coverage_area_id}}",
  "product_description": "Samsung Galaxy Phone",
  "product_weight": 0.5,
  "product_price": 50000,
  "is_cod": true,
  "cod_amount": 50000,
  "delivery_type": "REGULAR"
}
```
- **Expected:** 201 Created, parcel_id saved
- **Verify:** 
  - `status: "PENDING"`
  - `product_weight: 0.5`

#### Step 3: Login as Hub Manager
- **Request:** `1. Authentication > Login - HUB_MANAGER`

#### Step 4: Receive Parcel at Hub
- **Request:** `6. Parcels > Hub Receive Parcel`
- **Expected:** 200 OK
- **Verify:** `status: "IN_HUB"`

#### Step 5: Get Active Providers
- **Request:** `10. Third-Party Providers > Get Active Providers`
- **Expected:** 200 OK, Carrybee in list
- **Verify:** `{{provider_id}}` auto-saved

#### Step 6: Get Parcels for Assignment
- **Request:** `11. Carrybee Integration > Parcel Assignment > Get Parcels for Third-Party Assignment`
- **Expected:** 200 OK, list includes your parcel
- **Verify:** Parcel has `status: "IN_HUB"`

#### Step 7: Assign to Carrybee
- **Request:** `11. Carrybee Integration > Parcel Assignment > Assign Parcel to Carrybee`
- **Body:**
```json
{
  "provider_id": "{{provider_id}}",
  "notes": "Urgent delivery required"
}
```
- **Expected:** 200 OK
- **Verify:**
  - `carrybee_consignment_id` present (e.g., "FX1212124433")
  - `delivery_fee` present (e.g., 60)
  - `cod_fee` present (e.g., 15.92)
  - `status: "ASSIGNED_TO_THIRD_PARTY"`

#### Step 8: Try to Assign Again (Should Fail)
- **Request:** Same as Step 7
- **Expected:** 400 Bad Request
- **Error:** "Parcel is already assigned to Carrybee"

---

### **Scenario 3: Webhook Status Updates**

#### Step 1: Send Webhook - Order Picked
- **Request:** `12. Webhooks > Carrybee Webhook (Test)`
- **Headers:** `x-carrybee-webhook-signature: default-signature`
- **Body:**
```json
{
  "event": "order.picked",
  "store_id": "12345",
  "consignment_id": "FX1212124433",
  "merchant_order_id": "ORD-TEST-001",
  "timestamptz": "2024-11-24T10:30:00Z"
}
```
- **Expected:** 200 OK
- **Verify:** Check parcel status changed to `PICKED_UP`

#### Step 2: Send Webhook - In Transit
- **Body:**
```json
{
  "event": "order.in-transit",
  "store_id": "12345",
  "consignment_id": "FX1212124433",
  "timestamptz": "2024-11-24T11:00:00Z"
}
```
- **Expected:** 200 OK
- **Verify:** Status changed to `IN_TRANSIT`

#### Step 3: Send Webhook - Out for Delivery
- **Body:**
```json
{
  "event": "order.assigned-for-delivery",
  "store_id": "12345",
  "consignment_id": "FX1212124433",
  "timestamptz": "2024-11-24T14:00:00Z"
}
```
- **Expected:** 200 OK
- **Verify:** Status changed to `OUT_FOR_DELIVERY`

#### Step 4: Send Webhook - Delivered
- **Body:**
```json
{
  "event": "order.delivered",
  "store_id": "12345",
  "consignment_id": "FX1212124433",
  "timestamptz": "2024-11-24T16:00:00Z",
  "collected_amount": "50000"
}
```
- **Expected:** 200 OK
- **Verify:** 
  - Status changed to `DELIVERED`
  - `delivered_at` timestamp set

#### Step 5: Test Invalid Signature
- **Headers:** `x-carrybee-webhook-signature: wrong-signature`
- **Expected:** 401 Unauthorized
- **Error:** "Invalid webhook signature"

---

### **Scenario 4: Validation Tests**

#### Test 1: Assign Parcel with No Weight
- Create parcel without `product_weight`
- Try to assign to Carrybee
- **Expected:** 400 Bad Request
- **Error:** "Parcel weight is required"

#### Test 2: Assign from Unsynced Store
- Create store without syncing to Carrybee
- Create parcel for that store
- Try to assign to Carrybee
- **Expected:** 400 Bad Request
- **Error:** "Store must be synced to Carrybee"

#### Test 3: Assign Parcel Not in Hub
- Create parcel (status: PENDING)
- Try to assign without receiving at hub
- **Expected:** 400 Bad Request
- **Error:** "Parcel must be in hub"

#### Test 4: Assign with Excessive COD
- Create parcel with `cod_amount: 150000` (over limit)
- Try to assign to Carrybee
- **Expected:** 400 Bad Request
- **Error:** "COD amount exceeds Carrybee limit"

#### Test 5: Assign with Invalid Weight
- Create parcel with `product_weight: 30` (over 25kg limit)
- Try to assign to Carrybee
- **Expected:** 400 Bad Request
- **Error:** "Weight exceeds maximum"

---

## ✅ Success Criteria

### Store Sync
- [x] Store created with location fields
- [x] Carrybee locations searchable
- [x] Store synced successfully
- [x] `carrybee_store_id` saved
- [x] Cannot sync twice

### Parcel Assignment
- [x] Parcel created with weight
- [x] Hub receives parcel
- [x] Providers list shows Carrybee
- [x] Parcel assigned successfully
- [x] `carrybee_consignment_id` saved
- [x] Delivery fee calculated
- [x] Cannot assign twice

### Webhooks
- [x] Webhook received successfully
- [x] Parcel status updated
- [x] Invalid signature rejected
- [x] Non-existent parcel handled gracefully

### Validations
- [x] Weight validation works
- [x] Store sync validation works
- [x] Hub status validation works
- [x] COD limit validation works
- [x] Duplicate assignment prevented

---

## 🐛 Common Issues & Solutions

### Issue 1: "Store not found"
**Solution:** Ensure `{{store_id}}` variable is set. Check Step 2 of Scenario 1.

### Issue 2: "Provider not found"
**Solution:** Run migration to seed Carrybee provider. Check database has `third_party_providers` table.

### Issue 3: "Carrybee API error"
**Solution:** Check `.env` has correct Carrybee credentials. Verify sandbox is accessible.

### Issue 4: "Webhook signature invalid"
**Solution:** Ensure header `x-carrybee-webhook-signature` matches `CARRYBEE_WEBHOOK_SIGNATURE` in `.env`.

### Issue 5: "Parcel not found by consignment_id"
**Solution:** Use the actual `carrybee_consignment_id` from Step 7 of Scenario 2 in webhook body.

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

Scenario 1: Store Setup & Sync
- Step 1-8: [ ] PASS [ ] FAIL
- Notes: _____________________

Scenario 2: Parcel Assignment
- Step 1-8: [ ] PASS [ ] FAIL
- Notes: _____________________

Scenario 3: Webhook Updates
- Step 1-5: [ ] PASS [ ] FAIL
- Notes: _____________________

Scenario 4: Validations
- Test 1-5: [ ] PASS [ ] FAIL
- Notes: _____________________

Overall Status: [ ] PASS [ ] FAIL
```

---

## 🚀 Next Steps After Testing

1. **Production Setup:**
   - Update `.env` with production Carrybee credentials
   - Set `CARRYBEE_ENV=production`
   - Update webhook signature

2. **Configure Carrybee:**
   - Register webhook URL: `https://your-domain.com/webhooks/carrybee`
   - Provide webhook signature to Carrybee

3. **Monitor:**
   - Check logs for Carrybee API calls
   - Monitor webhook events
   - Track parcel status updates

4. **Frontend Integration:**
   - Implement store sync UI
   - Add parcel assignment interface
   - Show Carrybee tracking info

---

**Testing Complete!** 🎉
