# Quick Fix: FK Constraint Error - Data Validation Guide

## The Problem
```
Error: insert or update on table "parcels" violates foreign key constraint "FK_84d3757f0e4a20f86842a05a0a2"
```

This means one of the referenced IDs in your parcel creation request doesn't exist in the database.

---

## Quick Test with These SQL Queries

Run these in your PostgreSQL client to verify the data exists:

### 1. Check if the Merchant Exists
```sql
SELECT id, user_id, business_name FROM merchants WHERE id = '7bcad4a1-8793-4bcb-ba98-771f46558d00';
```
**Expected:** 1 row returned  
**If 0 rows:** Merchant doesn't exist

---

### 2. Check if the Store Exists AND Belongs to the Merchant
```sql
SELECT id, merchant_id, store_code, business_name, status 
FROM stores 
WHERE id = 'e900df55-29f3-4f1e-89d3-913918b534b5' 
  AND merchant_id = '7bcad4a1-8793-4bcb-ba98-771f46558d00';
```
**Expected:** 1 row returned  
**If 0 rows:** Store doesn't exist OR doesn't belong to this merchant

---

### 3. Check if the Delivery Coverage Area Exists
```sql
SELECT id, area, zone, city, inside_dhaka_flag 
FROM coverage_areas 
WHERE id = 'b5a26b1f-7d44-4067-b7df-195dd41a14f2';
```
**Expected:** 1 row returned  
**If 0 rows:** Coverage area doesn't exist

---

### 4. Check if the Customer Exists (if customer_id was provided)
```sql
SELECT id, customer_name, customer_phone 
FROM customers 
WHERE id = '64ed78ff-fcdd-4c77-af7a-4c0d542cf466';
```
**Expected:** 1 row returned  
**If 0 rows:** Customer doesn't exist

---

## If Any Checks Return 0 Rows

### Get Valid Store IDs
```sql
SELECT id, store_code, business_name 
FROM stores 
WHERE merchant_id = '7bcad4a1-8793-4bcb-ba98-771f46558d00'
LIMIT 10;
```

### Get Valid Coverage Area IDs
```sql
SELECT id, area, zone, city 
FROM coverage_areas 
ORDER BY city, zone 
LIMIT 20;
```

### Get All Merchants
```sql
SELECT id, user_id, business_name 
FROM merchants 
LIMIT 10;
```

---

## Fix Your Request

**Use the IDs from the queries above in your parcel creation request:**

```json
{
  "store_id": "<use ID from store query>",
  "delivery_coverage_area_id": "<use ID from coverage_areas query>",
  "customer_name": "John Doe",
  "customer_phone": "01538386793",
  "customer_address": "House 15, Road 5, Gulshan-2, Dhaka",
  "product_description": "Electronics Item",
  "product_weight": 1.5,
  "product_price": 100
}
```

---

## What Changed (Improvements Made)

✅ **Added better validation** for merchant_id and customer_id before saving  
✅ **Improved error messages** to identify which FK constraint failed  
✅ **Better logging** of FK constraint details  

Now when a FK constraint fails, you'll get a clearer error message telling you exactly which ID is invalid!
