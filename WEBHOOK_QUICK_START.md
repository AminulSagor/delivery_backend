# 🎯 Quick Start: Testing Carrybee Webhooks in Postman

## ⚡ 3-Minute Setup

### 1. Get Your Consignment ID
Run this query in your database:
```sql
SELECT id, tracking_number, carrybee_consignment_id 
FROM parcels 
WHERE carrybee_consignment_id IS NOT NULL 
LIMIT 1;
```
**Copy the `carrybee_consignment_id`** (format: `CCONSIGN-xxxxx`)

### 2. Open Postman

**URL:** `http://localhost:3000/webhooks/carrybee`  
**Method:** `POST`

### 3. Add Headers

| Key | Value |
|-----|-------|
| `Content-Type` | `application/json` |
| `X-Carrybee-Webhook-Signature` | `carrybee-webhook-secret-change-in-production` |

### 4. Add Body (Raw JSON)

**Test Delivered Event:**
```json
{
  "event": "order.delivered",
  "store_id": "CSTORE-123456",
  "consignment_id": "PASTE_YOUR_CONSIGNMENT_ID_HERE",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T14:00:00Z",
  "collectable_amount": "500.00",
  "collected_amount": "500.00",
  "cod_fee": 10,
  "delivery_fee": "60.00"
}
```

### 5. Send & Verify

**✅ Success Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Check Database:**
```sql
SELECT status, payment_status, cod_collected_amount 
FROM parcels 
WHERE carrybee_consignment_id = 'YOUR_ID';
```

**Expected:** Status = `DELIVERED`, COD = 500

---

## 🎪 9 Webhook Events You Can Test

| # | Event | New Status | What It Does |
|---|-------|------------|--------------|
| 1 | `order.picked` | PICKED_UP | Parcel picked up from merchant |
| 2 | `order.at-the-sorting-hub` | IN_HUB | Arrived at hub |
| 3 | `order.in-transit` | IN_TRANSIT | On the way to customer |
| 4 | `order.assigned-for-delivery` | OUT_FOR_DELIVERY | Assigned to rider |
| 5 | `order.delivered` | DELIVERED | ✅ COD collected |
| 6 | `order.delivery-failed` | FAILED_DELIVERY | Failed attempt |
| 7 | `order.returned` | RETURNED | ❌ Return charges apply |
| 8 | `order.returned-to-merchant` | RETURNED | Back to merchant |
| 9 | `order.pickup-cancelled` | CANCELLED | Pickup cancelled |

---

## 📦 Sample Payloads

### Delivered (with COD)
```json
{
  "event": "order.delivered",
  "store_id": "CSTORE-123456",
  "consignment_id": "YOUR_CONSIGNMENT_ID",
  "timestamptz": "2026-02-06T14:00:00Z",
  "collected_amount": "500.00",
  "cod_fee": 10,
  "delivery_fee": "60.00"
}
```

### Returned (with charges)
```json
{
  "event": "order.returned",
  "store_id": "CSTORE-123456",
  "consignment_id": "YOUR_CONSIGNMENT_ID",
  "timestamptz": "2026-02-06T15:00:00Z",
  "reason": "Customer refused",
  "delivery_fee": "60.00"
}
```

### In Transit
```json
{
  "event": "order.in-transit",
  "store_id": "CSTORE-123456",
  "consignment_id": "YOUR_CONSIGNMENT_ID",
  "timestamptz": "2026-02-06T12:00:00Z"
}
```

---

## 🚨 Common Issues

### ❌ "Invalid webhook signature"
**Fix:** Header must be exactly:
```
X-Carrybee-Webhook-Signature: carrybee-webhook-secret-change-in-production
```

### ❌ "Parcel not found"
**Fix:** Make sure the consignment_id exists in your database

### ❌ "Webhook already processed"
**Fix:** This is normal (idempotency). Try a different event type.

---

## ✅ What to Verify After Each Webhook

### After `order.delivered`
```sql
SELECT status, payment_status, cod_collected_amount, delivered_at
FROM parcels WHERE carrybee_consignment_id = 'YOUR_ID';
```
**Expected:**
- status = `DELIVERED`
- payment_status = `COD_COLLECTED`
- cod_collected_amount = 500
- delivered_at = [timestamp]

### After `order.returned`
```sql
SELECT status, return_charge, return_charge_applicable, return_reason
FROM parcels WHERE carrybee_consignment_id = 'YOUR_ID';
```
**Expected:**
- status = `RETURNED`
- return_charge = [calculated amount]
- return_charge_applicable = true
- return_reason = "Customer refused"

---

## 🔥 Pro Tips

1. **Test Complete Flow:** Send events in sequence (picked → in-transit → delivered)
2. **Test Idempotency:** Send same webhook twice, second returns "already processed"
3. **Watch Server Logs:** Look for `[CARRYBEE WEBHOOK]` entries
4. **No Auth Needed:** Webhooks use signature, not JWT token
5. **Required Fields Only:** `event`, `store_id`, `consignment_id`, `timestamptz`

---

## 📖 Full Documentation

For complete details, see: [WEBHOOK_TESTING_POSTMAN_GUIDE.md](WEBHOOK_TESTING_POSTMAN_GUIDE.md)

**Ready to test?** Just replace the `consignment_id` and click Send! 🚀
