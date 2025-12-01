# 🔧 Carrybee Parcel Assignment Fix

## ❌ Problem Identified:

**Error Message:**
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Failed to assign parcel to Carrybee: Wrong data provided in request path or body"
}
```

**Root Cause:**
The code was sending the **store's location** (pickup location) as the **recipient's delivery location** to Carrybee API.

```typescript
// ❌ WRONG - Line 346-348 in carrybee.service.ts
city_id: store.carrybee_city_id,      // Store's city (pickup location)
zone_id: store.carrybee_zone_id,      // Store's zone (pickup location)
area_id: store.carrybee_area_id,      // Store's area (pickup location)
```

**Why this is wrong:**
- **Store location** = Where the parcel is picked up from (merchant's store)
- **Recipient location** = Where the parcel is delivered to (customer's address)
- Carrybee needs **both** locations, but we were sending the same location for both!

---

## ✅ Solution Implemented:

### **1. Added Recipient Location Fields to Parcel Entity**

**File:** `src/parcels/entities/parcel.entity.ts`

```typescript
// Recipient/Delivery location for Carrybee
@Column({ type: 'int', nullable: true })
recipient_carrybee_city_id: number | null;

@Column({ type: 'int', nullable: true })
recipient_carrybee_zone_id: number | null;

@Column({ type: 'int', nullable: true })
recipient_carrybee_area_id: number | null;
```

---

### **2. Added Fields to CreateParcelDto**

**File:** `src/parcels/dto/create-parcel.dto.ts`

```typescript
// ===== RECIPIENT CARRYBEE LOCATION (for Carrybee delivery) =====
@IsOptional()
@IsInt()
@Type(() => Number)
recipient_carrybee_city_id?: number;

@IsOptional()
@IsInt()
@Type(() => Number)
recipient_carrybee_zone_id?: number;

@IsOptional()
@IsInt()
@Type(() => Number)
recipient_carrybee_area_id?: number;
```

---

### **3. Updated Carrybee Service to Use Recipient Location**

**File:** `src/carrybee/carrybee.service.ts`

**Before:**
```typescript
// ❌ Using store's location for delivery
city_id: store.carrybee_city_id,
zone_id: store.carrybee_zone_id,
area_id: store.carrybee_area_id,
```

**After:**
```typescript
// ✅ Using recipient's location for delivery
city_id: parcel.recipient_carrybee_city_id,
zone_id: parcel.recipient_carrybee_zone_id,
area_id: parcel.recipient_carrybee_area_id,
```

---

### **4. Created Database Migration**

**File:** `src/migrations/1732520000000-AddRecipientCarrybeeLocationToParcel.ts`

Adds three new columns to `parcels` table:
- `recipient_carrybee_city_id` (int, nullable)
- `recipient_carrybee_zone_id` (int, nullable)
- `recipient_carrybee_area_id` (int, nullable)

---

## 🚀 How to Apply the Fix:

### **Step 1: Run the Migration**

```bash
npm run migration:run
```

This will add the new columns to the `parcels` table.

---

### **Step 2: Update Existing Parcels (Optional)**

If you have existing parcels that need to be assigned to Carrybee, you'll need to update them with recipient location data.

**Option A: Manual SQL Update (if all parcels go to same location)**
```sql
UPDATE parcels 
SET 
  recipient_carrybee_city_id = 1,    -- Dhaka
  recipient_carrybee_zone_id = 5,    -- Gulshan
  recipient_carrybee_area_id = 23    -- Gulshan 1
WHERE recipient_carrybee_city_id IS NULL;
```

**Option B: Update via API (recommended)**
Update each parcel individually with the correct recipient location.

---

### **Step 3: Create New Parcels with Recipient Location**

**Example Request:**
```json
POST /parcels
{
  "merchant_order_id": "ORD123",
  "store_id": "{{store_id}}",
  "pickup_address": "123 Store St, Dhaka",
  "customer_name": "John Doe",
  "customer_phone": "01912345678",
  "delivery_address": "House 45, Road 12, Gulshan 1, Dhaka",
  
  // ✨ NEW: Recipient's Carrybee location
  "recipient_carrybee_city_id": 1,     // Dhaka
  "recipient_carrybee_zone_id": 5,     // Gulshan
  "recipient_carrybee_area_id": 23,    // Gulshan 1
  
  "product_description": "Electronics",
  "product_weight": 1.5,
  "is_cod": true,
  "cod_amount": 1000
}
```

---

## 📋 Complete Flow:

### **For Merchants Creating Parcels:**

1. **Get recipient's city** (where customer lives)
   ```
   GET /carrybee-locations/cities
   → Select city (e.g., Dhaka, id=1)
   ```

2. **Get recipient's zone**
   ```
   GET /carrybee-locations/cities/1/zones
   → Select zone (e.g., Gulshan, id=5)
   ```

3. **Get recipient's area**
   ```
   GET /carrybee-locations/zones/5/areas
   → Select area (e.g., Gulshan 1, id=23)
   ```

4. **Create parcel with recipient location**
   ```json
   POST /parcels
   {
     "store_id": "...",  // Store location (pickup)
     "delivery_address": "House 45, Gulshan 1",
     "recipient_carrybee_city_id": 1,
     "recipient_carrybee_zone_id": 5,
     "recipient_carrybee_area_id": 23,
     ...
   }
   ```

5. **Hub Manager assigns to Carrybee**
   ```
   POST /carrybee/parcels/{parcel_id}/assign
   {
     "provider_id": "{{carrybee_provider_id}}"
   }
   ```

---

## 🎯 Key Points:

### **Two Different Locations:**

| Location Type | Purpose | Source | Used For |
|---------------|---------|--------|----------|
| **Store Location** | Pickup | `store.carrybee_city_id` | Where Carrybee picks up parcel |
| **Recipient Location** | Delivery | `parcel.recipient_carrybee_city_id` | Where Carrybee delivers parcel |

### **Why Both Are Needed:**

- **Store location**: Tells Carrybee where to collect the parcel from (merchant's store)
- **Recipient location**: Tells Carrybee where to deliver the parcel to (customer's address)

### **Example:**

```
Store (Pickup):
- City: Dhaka (id=1)
- Zone: Dhanmondi (id=6)
- Area: Dhanmondi 15 (id=30)

Recipient (Delivery):
- City: Dhaka (id=1)
- Zone: Gulshan (id=5)
- Area: Gulshan 1 (id=23)
```

---

## ⚠️ Important Notes:

1. **Required for Carrybee Assignment:**
   - Parcels MUST have `recipient_carrybee_city_id`, `recipient_carrybee_zone_id`, and `recipient_carrybee_area_id` set before assigning to Carrybee
   - The service will throw an error if these fields are missing

2. **Optional for Internal Delivery:**
   - If using internal riders, these fields are optional
   - Only required when assigning to Carrybee

3. **Frontend Implementation:**
   - Add three cascading dropdowns for recipient location during parcel creation
   - City → Zone → Area (same as store creation flow)

---

## 🧪 Testing:

### **Test Case 1: Create Parcel with Recipient Location**

```bash
POST /parcels
{
  "store_id": "{{store_id}}",
  "customer_name": "Test Customer",
  "customer_phone": "01912345678",
  "delivery_address": "House 45, Gulshan 1, Dhaka",
  "recipient_carrybee_city_id": 1,
  "recipient_carrybee_zone_id": 5,
  "recipient_carrybee_area_id": 23,
  "product_weight": 1.5,
  "is_cod": true,
  "cod_amount": 1000
}
```

**Expected:** Parcel created with recipient location fields populated.

---

### **Test Case 2: Assign to Carrybee**

```bash
POST /carrybee/parcels/{{parcel_id}}/assign
{
  "provider_id": "{{carrybee_provider_id}}"
}
```

**Expected:** 
- ✅ Parcel assigned successfully
- ✅ `carrybee_consignment_id` saved
- ✅ Status = `ASSIGNED_TO_THIRD_PARTY`

---

### **Test Case 3: Missing Recipient Location**

```bash
POST /carrybee/parcels/{{parcel_id}}/assign
{
  "provider_id": "{{carrybee_provider_id}}"
}
```

**If parcel has no recipient location:**

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Parcel must have recipient Carrybee location (city_id, zone_id, area_id). Please provide recipient location when creating parcel."
}
```

---

## 📊 Database Schema:

### **Before:**
```sql
CREATE TABLE parcels (
  id UUID PRIMARY KEY,
  customer_name VARCHAR(255),
  delivery_address TEXT,
  -- No recipient location fields
  ...
);
```

### **After:**
```sql
CREATE TABLE parcels (
  id UUID PRIMARY KEY,
  customer_name VARCHAR(255),
  delivery_address TEXT,
  recipient_carrybee_city_id INT,     -- ✨ NEW
  recipient_carrybee_zone_id INT,     -- ✨ NEW
  recipient_carrybee_area_id INT,     -- ✨ NEW
  ...
);
```

---

## ✅ Summary:

**Problem:** Using store location for delivery location  
**Solution:** Added separate recipient location fields  
**Impact:** Carrybee API now receives correct delivery location  
**Status:** ✅ Fixed and ready to test  

**Next Steps:**
1. Run migration
2. Update frontend to collect recipient location
3. Test parcel creation and Carrybee assignment
4. Update existing parcels if needed

---

## 🎉 Result:

After this fix, when you assign a parcel to Carrybee:

```typescript
// Carrybee API receives:
{
  store_id: "12345",              // ✅ Store location (pickup)
  recipient_address: "...",
  city_id: 1,                     // ✅ Recipient location (delivery)
  zone_id: 5,                     // ✅ Recipient location (delivery)
  area_id: 23,                    // ✅ Recipient location (delivery)
  ...
}
```

**No more "Wrong data provided" errors!** 🚀
