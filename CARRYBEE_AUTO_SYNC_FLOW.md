# 🔄 Carrybee Auto-Sync Flow (Updated)

## ✅ New Simplified Flow

Merchants **DON'T** need to manually sync stores to Carrybee. It happens **automatically** when Hub Manager assigns a parcel!

---

## 📊 Complete Workflow

### **Step 1: Merchant Creates Store**

```http
POST /stores
Authorization: Bearer <merchant_token>

{
  "business_name": "Test Electronics",
  "business_address": "House 45, Road 12, Gulshan 1, Dhaka",
  "phone_number": "01712345678",
  "district": "Dhaka",
  "thana": "Gulshan",
  "area": "Gulshan 1"
}
```

**Result:** Store saved in YOUR database (NOT synced to Carrybee yet)

---

### **Step 2: Admin/Hub Manager Sets Carrybee Location IDs**

```http
PATCH /stores/:storeId
Authorization: Bearer <admin_or_hub_manager_token>

{
  "carrybee_city_id": 1,
  "carrybee_zone_id": 2,
  "carrybee_area_id": 15
}
```

**How to get these IDs:**
- Call `GET /carrybee/cities` → get city_id
- Call `GET /carrybee/cities/1/zones` → get zone_id  
- Call `GET /carrybee/cities/1/zones/2/areas` → get area_id
- Or search: `GET /carrybee/area-suggestion?search=Gulshan`

**Result:** Store now has Carrybee location IDs but still NOT synced

---

### **Step 3: Merchant Creates Parcel**

```http
POST /parcels
Authorization: Bearer <merchant_token>

{
  "store_id": "{{store_id}}",
  "customer_name": "John Doe",
  "customer_phone": "01812345678",
  "delivery_address": "House 10, Road 5, Banani",
  "product_weight": 0.5,
  "cod_amount": 50000,
  ...
}
```

**Result:** Parcel created with status `PENDING`

---

### **Step 4: Hub Receives Parcel**

```http
PATCH /parcels/:parcelId/hub/receive
Authorization: Bearer <hub_manager_token>
```

**Result:** Parcel status → `IN_HUB`

---

### **Step 5: Hub Manager Assigns to Carrybee (AUTO-SYNC HAPPENS HERE!)**

```http
POST /carrybee/parcels/:parcelId/assign
Authorization: Bearer <hub_manager_token>

{
  "provider_id": "{{carrybee_provider_id}}"
}
```

**What Happens Automatically:**

1. ✅ System checks if store is synced to Carrybee
2. ❌ **NOT synced** → Auto-sync happens:
   - Validates store has `district`, `thana`, `area`
   - Validates store has `carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id`
   - Creates store in Carrybee API
   - Saves `carrybee_store_id` in database
   - Sets `is_carrybee_synced = true`
3. ✅ Creates order in Carrybee
4. ✅ Updates parcel with `carrybee_consignment_id`
5. ✅ Changes status to `ASSIGNED_TO_THIRD_PARTY`

**Result:** 
- Store synced to Carrybee (first time only)
- Parcel assigned to Carrybee
- Merchant gets Carrybee tracking

---

## 🎯 Key Points

### **Merchants DON'T Need:**
- ❌ Manual sync endpoint
- ❌ Access to `/carrybee/stores/:id/sync`
- ❌ Knowledge of Carrybee API

### **Merchants ONLY Need:**
- ✅ Create store with location (district, thana, area)
- ✅ Create parcels

### **Admin/Hub Manager Needs:**
- ✅ Set Carrybee location IDs on store (one-time)
- ✅ Assign parcels to Carrybee (triggers auto-sync)

---

## 🔧 What Changed

### **Before (Manual Sync):**
```
1. Merchant creates store
2. Merchant searches Carrybee locations
3. Merchant manually syncs: POST /carrybee/stores/:id/sync
4. Hub Manager assigns parcel
```

### **After (Auto-Sync):**
```
1. Merchant creates store
2. Admin/Hub sets Carrybee location IDs (via store update)
3. Hub Manager assigns parcel → AUTO-SYNC happens if needed
```

---

## 📝 API Endpoints Still Available

### **For Merchants:**
- `POST /stores` - Create store
- `POST /parcels` - Create parcel

### **For Admin/Hub Manager:**
- `GET /carrybee/cities` - Get cities
- `GET /carrybee/cities/:id/zones` - Get zones
- `GET /carrybee/cities/:id/zones/:id/areas` - Get areas
- `GET /carrybee/area-suggestion?search=` - Search locations
- `PATCH /stores/:id` - Update store (set Carrybee IDs)
- `GET /carrybee/parcels/for-assignment` - Get parcels
- `POST /carrybee/parcels/:id/assign` - **Assign (auto-syncs store)**

### **Optional (if you want manual sync):**
- `POST /carrybee/stores/:id/sync` - Manual sync (still works)

---

## ✅ Validation Flow

When assigning parcel to Carrybee, system checks:

1. ✅ Parcel exists
2. ✅ Parcel belongs to hub
3. ✅ Parcel status is `IN_HUB`
4. ✅ Not already assigned
5. ✅ Provider is valid
6. ✅ Store exists
7. **🔄 Store sync check:**
   - If NOT synced:
     - ✅ Has district, thana, area?
     - ✅ Has carrybee_city_id, zone_id, area_id?
     - 🔄 Create store in Carrybee
     - 💾 Save carrybee_store_id
   - If already synced:
     - ✅ Use existing carrybee_store_id
8. ✅ Weight validation
9. ✅ COD validation
10. ✅ Create order in Carrybee
11. ✅ Update parcel

---

## 🎊 Benefits

✅ **Simpler for merchants** - No manual sync step
✅ **Automatic** - Happens when needed
✅ **One-time only** - Store synced once, reused forever
✅ **Error handling** - Clear messages if location IDs missing
✅ **Backward compatible** - Manual sync still works if needed

---

**Status:** ✅ IMPLEMENTED & TESTED
