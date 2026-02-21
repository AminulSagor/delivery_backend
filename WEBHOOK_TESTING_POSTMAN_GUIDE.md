# 🔔 Carrybee Webhook Testing Guide (Postman)

**Date:** February 6, 2026  
**Endpoint:** `POST /webhooks/carrybee`  
**Authentication:** Signature-based (no JWT required)

---

## 📋 Overview

The Carrybee webhook endpoint allows you to simulate webhook events from Carrybee without needing actual deliveries. This is perfect for testing status transitions, COD collection, and return charge calculations.

---

## 🔧 Setup Instructions

### Step 1: Get a Test Parcel with Carrybee Assignment

First, you need a parcel that's assigned to Carrybee. You can either:

**Option A: Create and assign a new parcel**
```http
POST http://localhost:3000/carrybee/parcels/:parcelId/assign
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "provider_id": "{{carrybee_provider_id}}"
}
```

**Option B: Query for existing Carrybee parcels**
```sql
SELECT id, tracking_number, carrybee_consignment_id, status 
FROM parcels 
WHERE delivery_provider = 'CARRYBEE' 
AND carrybee_consignment_id IS NOT NULL
LIMIT 5;
```

**You'll need the `carrybee_consignment_id` for webhook testing!**

---

## 🔐 Authentication

The webhook uses **signature-based authentication** (not JWT).

### Required Header
```
X-Carrybee-Webhook-Signature: carrybee-webhook-secret-change-in-production
```

**From .env file:**
```env
CARRYBEE_WEBHOOK_SIGNATURE=carrybee-webhook-secret-change-in-production
```

⚠️ **Important:** This signature must match exactly. If it doesn't, you'll get `401 Unauthorized`.

---

## 📦 Webhook Payload Structure

All webhook payloads follow this structure:

```json
{
  "event": "order.delivered",
  "store_id": "CSTORE-xxx",
  "consignment_id": "CCONSIGN-xxx",
  "merchant_order_id": "TRK-xxx",
  "timestamptz": "2026-02-06T15:30:00Z",
  "collectable_amount": "500.00",
  "cod_fee": 10,
  "delivery_fee": "60.00",
  "collected_amount": "500.00",
  "reason": "Customer refused",
  "attempt": 1,
  "invoice_id": "INV-xxx"
}
```

**Required Fields:**
- `event` - Event type (see list below)
- `store_id` - Carrybee store ID
- `consignment_id` - Carrybee consignment ID (MUST exist in your database)
- `timestamptz` - ISO 8601 timestamp

**Optional Fields:**
- `merchant_order_id` - Your tracking number
- `collectable_amount` - COD amount to collect
- `cod_fee` - Carrybee's COD handling fee
- `delivery_fee` - Delivery charge
- `collected_amount` - Actual amount collected
- `reason` - Return/failure reason
- `attempt` - Delivery attempt number
- `invoice_id` - Carrybee invoice reference

---

## 🎯 Supported Webhook Events

### 1. Order Picked Up
**Event:** `order.picked`  
**New Status:** `PICKED_UP`

```json
{
  "event": "order.picked",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T10:00:00Z"
}
```

---

### 2. At Sorting Hub
**Event:** `order.at-the-sorting-hub`  
**New Status:** `IN_HUB`

```json
{
  "event": "order.at-the-sorting-hub",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T11:00:00Z"
}
```

---

### 3. In Transit
**Event:** `order.in-transit`  
**New Status:** `IN_TRANSIT`

```json
{
  "event": "order.in-transit",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T12:00:00Z"
}
```

---

### 4. Assigned for Delivery
**Event:** `order.assigned-for-delivery`  
**New Status:** `OUT_FOR_DELIVERY`

```json
{
  "event": "order.assigned-for-delivery",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T13:00:00Z"
}
```

---

### 5. ✅ Delivered (COD Collected)
**Event:** `order.delivered`  
**New Status:** `DELIVERED`  
**Important:** Sets `payment_status` to `COD_COLLECTED`

```json
{
  "event": "order.delivered",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T14:00:00Z",
  "collectable_amount": "500.00",
  "collected_amount": "500.00",
  "cod_fee": 10,
  "delivery_fee": "60.00"
}
```

**What happens:**
- ✅ Status changed to `DELIVERED`
- ✅ `delivered_at` timestamp set
- ✅ `cod_collected_amount` = 500
- ✅ `payment_status` = `COD_COLLECTED`
- ✅ `delivery_charge_applicable` = true
- ✅ `return_charge_applicable` = false
- ✅ `paid_to_merchant` = false (ready for settlement)

---

### 6. Delivery Failed
**Event:** `order.delivery-failed`  
**New Status:** `FAILED_DELIVERY`

```json
{
  "event": "order.delivery-failed",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T14:30:00Z",
  "reason": "Customer not available",
  "attempt": 1
}
```

---

### 7. ❌ Returned (with Return Charge)
**Event:** `order.returned`  
**New Status:** `RETURNED`  
**Important:** Calculates return charges automatically

```json
{
  "event": "order.returned",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T15:00:00Z",
  "reason": "Customer refused delivery",
  "delivery_fee": "60.00"
}
```

**What happens:**
- ✅ Status changed to `RETURNED`
- ✅ `delivered_at` timestamp set
- ✅ `cod_collected_amount` = 0
- ✅ `payment_status` = `UNPAID`
- ✅ `return_reason` stored
- ✅ `return_charge` calculated based on zone
- ✅ `delivery_charge_applicable` = false
- ✅ `return_charge_applicable` = true

---

### 8. Returned to Merchant
**Event:** `order.returned-to-merchant`  
**New Status:** `RETURNED`

```json
{
  "event": "order.returned-to-merchant",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T16:00:00Z",
  "reason": "Return completed"
}
```

---

### 9. Pickup Cancelled
**Event:** `order.pickup-cancelled`  
**New Status:** `CANCELLED`

```json
{
  "event": "order.pickup-cancelled",
  "store_id": "CSTORE-123456",
  "consignment_id": "CCONSIGN-789012",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T09:30:00Z",
  "reason": "Merchant cancelled"
}
```

---

## 🚀 Step-by-Step Testing in Postman

### Prerequisites
1. ✅ Server running on `http://localhost:3000`
2. ✅ Database has a parcel with `carrybee_consignment_id`
3. ✅ You know the `consignment_id` value

### Step 1: Create New Request in Postman

**Method:** `POST`  
**URL:** `http://localhost:3000/webhooks/carrybee`

### Step 2: Add Headers

Click on the "Headers" tab and add:

| Key | Value |
|-----|-------|
| `Content-Type` | `application/json` |
| `X-Carrybee-Webhook-Signature` | `carrybee-webhook-secret-change-in-production` |

### Step 3: Add Request Body

Click on the "Body" tab → select "raw" → choose "JSON"

**Example: Test Delivered Event**
```json
{
  "event": "order.delivered",
  "store_id": "CSTORE-123456",
  "consignment_id": "REPLACE_WITH_YOUR_CONSIGNMENT_ID",
  "merchant_order_id": "TRK-001",
  "timestamptz": "2026-02-06T14:00:00Z",
  "collectable_amount": "500.00",
  "collected_amount": "500.00",
  "cod_fee": 10,
  "delivery_fee": "60.00"
}
```

⚠️ **IMPORTANT:** Replace `REPLACE_WITH_YOUR_CONSIGNMENT_ID` with actual consignment ID from your database!

### Step 4: Send Request

Click **"Send"** button.

### Step 5: Check Response

**✅ Success Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**✅ Idempotent Response (already processed):**
```json
{
  "success": true,
  "message": "Webhook already processed (idempotent)"
}
```

**❌ Error Responses:**

**Invalid Signature:**
```json
{
  "statusCode": 401,
  "message": "Invalid webhook signature"
}
```

**Parcel Not Found:**
```json
{
  "success": false,
  "message": "Parcel not found"
}
```

**Unknown Event:**
```json
{
  "success": false,
  "message": "Unknown event type"
}
```

---

## ✅ Verification Steps

After sending webhook, verify changes in database:

### Check Parcel Status
```sql
SELECT 
  id,
  tracking_number,
  status,
  payment_status,
  cod_collected_amount,
  delivery_charge_applicable,
  return_charge_applicable,
  return_charge,
  delivered_at,
  paid_to_merchant
FROM parcels
WHERE carrybee_consignment_id = 'YOUR_CONSIGNMENT_ID';
```

### Expected Results

**After `order.delivered` webhook:**
- `status` = `DELIVERED`
- `payment_status` = `COD_COLLECTED`
- `cod_collected_amount` = 500.00
- `delivery_charge_applicable` = true
- `return_charge_applicable` = false
- `delivered_at` = [timestamp]
- `paid_to_merchant` = false

**After `order.returned` webhook:**
- `status` = `RETURNED`
- `payment_status` = `UNPAID`
- `cod_collected_amount` = 0
- `delivery_charge_applicable` = false
- `return_charge_applicable` = true
- `return_charge` = [calculated amount]
- `delivered_at` = [timestamp]

---

## 🧪 Complete Test Sequence

Test a complete parcel lifecycle:

### 1. Picked Up
```json
{"event": "order.picked", "consignment_id": "XXX", ...}
```
**Expected:** Status = `PICKED_UP`

### 2. At Hub
```json
{"event": "order.at-the-sorting-hub", "consignment_id": "XXX", ...}
```
**Expected:** Status = `IN_HUB`

### 3. In Transit
```json
{"event": "order.in-transit", "consignment_id": "XXX", ...}
```
**Expected:** Status = `IN_TRANSIT`

### 4. Out for Delivery
```json
{"event": "order.assigned-for-delivery", "consignment_id": "XXX", ...}
```
**Expected:** Status = `OUT_FOR_DELIVERY`

### 5. Delivered
```json
{"event": "order.delivered", "consignment_id": "XXX", "collected_amount": "500", ...}
```
**Expected:** Status = `DELIVERED`, COD = 500

---

## 🔍 Idempotency Testing

The webhook is **idempotent** - sending the same webhook twice won't change the status again.

**Test:**
1. Send `order.delivered` webhook → Status changes to `DELIVERED`
2. Send same webhook again → Response: "Webhook already processed (idempotent)"
3. Status remains `DELIVERED` (no duplicate processing)

---

## 📋 Postman Collection

Save this as a Postman collection for easy testing:

```json
{
  "info": {
    "name": "Carrybee Webhooks",
    "description": "Test Carrybee webhook events"
  },
  "item": [
    {
      "name": "1. Order Picked",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "X-Carrybee-Webhook-Signature",
            "value": "carrybee-webhook-secret-change-in-production"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"event\": \"order.picked\",\n  \"store_id\": \"CSTORE-123456\",\n  \"consignment_id\": \"{{consignment_id}}\",\n  \"merchant_order_id\": \"TRK-001\",\n  \"timestamptz\": \"2026-02-06T10:00:00Z\"\n}"
        },
        "url": {
          "raw": "http://localhost:3000/webhooks/carrybee",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["webhooks", "carrybee"]
        }
      }
    },
    {
      "name": "5. Order Delivered (COD)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "X-Carrybee-Webhook-Signature",
            "value": "carrybee-webhook-secret-change-in-production"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"event\": \"order.delivered\",\n  \"store_id\": \"CSTORE-123456\",\n  \"consignment_id\": \"{{consignment_id}}\",\n  \"merchant_order_id\": \"TRK-001\",\n  \"timestamptz\": \"2026-02-06T14:00:00Z\",\n  \"collectable_amount\": \"500.00\",\n  \"collected_amount\": \"500.00\",\n  \"cod_fee\": 10,\n  \"delivery_fee\": \"60.00\"\n}"
        },
        "url": {
          "raw": "http://localhost:3000/webhooks/carrybee",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["webhooks", "carrybee"]
        }
      }
    },
    {
      "name": "7. Order Returned",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "X-Carrybee-Webhook-Signature",
            "value": "carrybee-webhook-secret-change-in-production"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"event\": \"order.returned\",\n  \"store_id\": \"CSTORE-123456\",\n  \"consignment_id\": \"{{consignment_id}}\",\n  \"merchant_order_id\": \"TRK-001\",\n  \"timestamptz\": \"2026-02-06T15:00:00Z\",\n  \"reason\": \"Customer refused delivery\",\n  \"delivery_fee\": \"60.00\"\n}"
        },
        "url": {
          "raw": "http://localhost:3000/webhooks/carrybee",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["webhooks", "carrybee"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "consignment_id",
      "value": "REPLACE_WITH_YOUR_CONSIGNMENT_ID"
    }
  ]
}
```

**To import:**
1. Open Postman
2. Click "Import"
3. Paste the JSON above
4. Update the `consignment_id` variable

---

## 🐛 Troubleshooting

### Issue 1: "Invalid webhook signature"
**Solution:** Check the signature header matches exactly:
```
X-Carrybee-Webhook-Signature: carrybee-webhook-secret-change-in-production
```

### Issue 2: "Parcel not found"
**Solution:** Verify the consignment_id exists:
```sql
SELECT * FROM parcels WHERE carrybee_consignment_id = 'YOUR_ID';
```

### Issue 3: "Unknown event type"
**Solution:** Check event name is one of these:
- `order.picked`
- `order.at-the-sorting-hub`
- `order.in-transit`
- `order.assigned-for-delivery`
- `order.delivered`
- `order.delivery-failed`
- `order.returned`
- `order.returned-to-merchant`
- `order.pickup-cancelled`

### Issue 4: "Webhook already processed"
**Solution:** This is normal (idempotency). Change the event type to test a different status transition.

---

## 📊 Test Checklist

Use this checklist for comprehensive webhook testing:

- [ ] Test all 9 webhook events
- [ ] Verify status changes in database
- [ ] Test idempotency (send same webhook twice)
- [ ] Test invalid signature (should get 401)
- [ ] Test with non-existent consignment_id
- [ ] Test order.delivered with COD amount
- [ ] Verify cod_collected_amount is stored
- [ ] Test order.returned and check return_charge calculation
- [ ] Test delivery_charge_applicable flag
- [ ] Test return_charge_applicable flag
- [ ] Test webhook with all optional fields
- [ ] Test webhook with minimal fields only
- [ ] Verify timestamps are stored correctly
- [ ] Test complete lifecycle (picked → delivered)
- [ ] Test failed delivery → retry → delivered flow

---

## 🎉 Summary

**Webhook Endpoint:** `POST /webhooks/carrybee`  
**Auth Header:** `X-Carrybee-Webhook-Signature: carrybee-webhook-secret-change-in-production`  
**Events Supported:** 9 different event types  
**Features:** Idempotency, transaction safety, automatic charge calculation  

**Ready to test!** Just replace `consignment_id` in the payloads and start sending webhooks through Postman.

---

**Need Help?**
- Check server logs for detailed webhook processing messages
- Look for `[CARRYBEE WEBHOOK]` log entries
- Verify database changes after each webhook
- Use the test checklist above to ensure complete coverage
