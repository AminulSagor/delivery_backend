# 📮 Postman Testing Guide - Carrybee Locations Integration

## 🎯 Quick Start Testing Flow

### **Step 1: Admin - Sync Locations (One-Time Setup)**

```http
POST {{base_url}}/carrybee-locations/sync
Authorization: Bearer {{admin_token}}
```

**Expected Response:**
```json
{
  "message": "Locations synced successfully",
  "cities": 8,
  "zones": 45,
  "areas": 523
}
```

**What it does:**
- Fetches all cities from Carrybee
- For each city, fetches all zones
- For each zone, fetches all areas
- Stores everything in `carrybee_locations` table

---

### **Step 2: Merchant - Get Cities for Dropdown**

```http
GET {{base_url}}/carrybee-locations/cities
Authorization: Bearer {{merchant_token}}
```

**Expected Response:**
```json
{
  "cities": [
    {
      "id": "uuid-1",
      "carrybee_id": 1,
      "name": "Dhaka",
      "type": "CITY",
      "is_active": true
    },
    {
      "id": "uuid-2",
      "carrybee_id": 2,
      "name": "Chittagong",
      "type": "CITY",
      "is_active": true
    }
  ],
  "count": 8
}
```

**Postman Test Script:**
```javascript
// Auto-save first city ID
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.cities && jsonData.cities.length > 0) {
        pm.collectionVariables.set('carrybee_city_id', jsonData.cities[0].carrybee_id);
        console.log('Set carrybee_city_id to: ' + jsonData.cities[0].carrybee_id);
    }
}
```

---

### **Step 3: Merchant - Get Zones for Selected City**

```http
GET {{base_url}}/carrybee-locations/cities/{{carrybee_city_id}}/zones
Authorization: Bearer {{merchant_token}}
```

**Expected Response:**
```json
{
  "zones": [
    {
      "id": "uuid-4",
      "carrybee_id": 5,
      "name": "Gulshan",
      "type": "ZONE",
      "parent_id": 1,
      "city_id": 1,
      "is_active": true
    },
    {
      "id": "uuid-5",
      "carrybee_id": 6,
      "name": "Dhanmondi",
      "type": "ZONE",
      "parent_id": 1,
      "city_id": 1,
      "is_active": true
    }
  ],
  "count": 12
}
```

**Postman Test Script:**
```javascript
// Auto-save first zone ID
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.zones && jsonData.zones.length > 0) {
        pm.collectionVariables.set('carrybee_zone_id', jsonData.zones[0].carrybee_id);
        console.log('Set carrybee_zone_id to: ' + jsonData.zones[0].carrybee_id);
    }
}
```

---

### **Step 4: Merchant - Get Areas for Selected Zone**

```http
GET {{base_url}}/carrybee-locations/zones/{{carrybee_zone_id}}/areas
Authorization: Bearer {{merchant_token}}
```

**Expected Response:**
```json
{
  "areas": [
    {
      "id": "uuid-7",
      "carrybee_id": 23,
      "name": "Gulshan 1",
      "type": "AREA",
      "parent_id": 5,
      "city_id": 1,
      "is_active": true
    },
    {
      "id": "uuid-8",
      "carrybee_id": 24,
      "name": "Gulshan 2",
      "type": "AREA",
      "parent_id": 5,
      "city_id": 1,
      "is_active": true
    }
  ],
  "count": 8
}
```

**Postman Test Script:**
```javascript
// Auto-save first area ID
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.areas && jsonData.areas.length > 0) {
        pm.collectionVariables.set('carrybee_area_id', jsonData.areas[0].carrybee_id);
        console.log('Set carrybee_area_id to: ' + jsonData.areas[0].carrybee_id);
    }
}
```

---

### **Step 5: Merchant - Create Store (Auto-Syncs to Carrybee!)**

```http
POST {{base_url}}/stores
Authorization: Bearer {{merchant_token}}
Content-Type: application/json

{
  "business_name": "My Store",
  "business_address": "House 45, Road 12, Gulshan 1, Dhaka",
  "district": "Dhaka",
  "thana": "Gulshan",
  "area": "Gulshan 1",
  "phone_number": "01712345678",
  "email": "store@example.com",
  "facebook_page": "https://facebook.com/mystore",
  "is_default": true,
  "carrybee_city_id": {{carrybee_city_id}},
  "carrybee_zone_id": {{carrybee_zone_id}},
  "carrybee_area_id": {{carrybee_area_id}}
}
```

**Expected Response:**
```json
{
  "id": "uuid-store",
  "business_name": "My Store",
  "business_address": "House 45, Road 12, Gulshan 1, Dhaka",
  "district": "Dhaka",
  "thana": "Gulshan",
  "area": "Gulshan 1",
  "phone_number": "01712345678",
  "carrybee_city_id": 1,
  "carrybee_zone_id": 5,
  "carrybee_area_id": 23,
  "is_carrybee_synced": true,
  "carrybee_store_id": "12345",
  "carrybee_synced_at": "2025-11-24T10:30:00Z"
}
```

**What happens automatically:**
1. ✅ Validates location IDs exist in database
2. ✅ Creates store in your database
3. ✅ **Automatically creates store in Carrybee API**
4. ✅ Saves `carrybee_store_id` from Carrybee response
5. ✅ Sets `is_carrybee_synced = true`

---

### **Step 6: Search Locations (Optional)**

```http
GET {{base_url}}/carrybee-locations/search?q=Gulshan
Authorization: Bearer {{merchant_token}}
```

**Expected Response:**
```json
{
  "locations": [
    {
      "id": "uuid-4",
      "carrybee_id": 5,
      "name": "Gulshan",
      "type": "ZONE",
      "parent_id": 1,
      "city_id": 1
    },
    {
      "id": "uuid-7",
      "carrybee_id": 23,
      "name": "Gulshan 1",
      "type": "AREA",
      "parent_id": 5,
      "city_id": 1
    },
    {
      "id": "uuid-8",
      "carrybee_id": 24,
      "name": "Gulshan 2",
      "type": "AREA",
      "parent_id": 5,
      "city_id": 1
    }
  ],
  "count": 3
}
```

---

## 📋 Complete Testing Checklist

### **Admin Tasks:**
- [ ] Login as Admin
- [ ] Run `/carrybee-locations/sync`
- [ ] Verify response shows cities/zones/areas counts
- [ ] Check database: `SELECT COUNT(*) FROM carrybee_locations;`

### **Merchant Tasks:**
- [ ] Login as Merchant
- [ ] Get cities list
- [ ] Select a city, get zones
- [ ] Select a zone, get areas
- [ ] Create store with location IDs
- [ ] Verify `is_carrybee_synced = true` in response
- [ ] Verify `carrybee_store_id` is present

### **Hub Manager Tasks:**
- [ ] Login as Hub Manager
- [ ] Create parcel for synced store
- [ ] Receive parcel at hub
- [ ] Assign parcel to Carrybee
- [ ] Verify `carrybee_consignment_id` saved

---

## 🔧 Postman Collection Variables

Make sure these variables are set in your collection:

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3000` | API base URL |
| `admin_token` | `eyJhbGc...` | Admin JWT token |
| `merchant_token` | `eyJhbGc...` | Merchant JWT token |
| `hub_manager_token` | `eyJhbGc...` | Hub Manager JWT token |
| `carrybee_city_id` | `1` | Auto-set by test scripts |
| `carrybee_zone_id` | `5` | Auto-set by test scripts |
| `carrybee_area_id` | `23` | Auto-set by test scripts |
| `store_id` | `uuid-store` | Auto-set after store creation |
| `parcel_id` | `uuid-parcel` | Auto-set after parcel creation |
| `provider_id` | `uuid-provider` | Carrybee provider ID |

---

## 🎯 Testing Scenarios

### **Scenario 1: Happy Path - Complete Flow**
1. Admin syncs locations
2. Merchant creates store with valid location IDs
3. Store auto-created in Carrybee
4. Hub Manager assigns parcel to Carrybee
5. Webhook updates parcel status

### **Scenario 2: Invalid Location IDs**
```http
POST {{base_url}}/stores
{
  "business_name": "Test Store",
  "carrybee_city_id": 999,  // Invalid
  "carrybee_zone_id": 999,
  "carrybee_area_id": 999
}
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Invalid Carrybee location IDs. Please select valid city, zone, and area."
}
```

### **Scenario 3: Mismatched Hierarchy**
```http
POST {{base_url}}/stores
{
  "carrybee_city_id": 1,    // Dhaka
  "carrybee_zone_id": 50,   // Zone from Chittagong
  "carrybee_area_id": 23
}
```

**Expected Error:**
```json
{
  "statusCode": 400,
  "message": "Invalid Carrybee location IDs. Please select valid city, zone, and area."
}
```

### **Scenario 4: Carrybee API Failure**
If Carrybee API is down during store creation:
- Store still created in your database
- `is_carrybee_synced = false`
- `carrybee_store_id = null`
- Will auto-sync during parcel assignment

---

## 🚀 Quick Test Runner

Run these requests in order:

```bash
# 1. Admin - Sync locations
POST /carrybee-locations/sync

# 2. Merchant - Get cities
GET /carrybee-locations/cities

# 3. Merchant - Get zones (use city_id from step 2)
GET /carrybee-locations/cities/1/zones

# 4. Merchant - Get areas (use zone_id from step 3)
GET /carrybee-locations/zones/5/areas

# 5. Merchant - Create store (use IDs from steps 2-4)
POST /stores

# 6. Hub Manager - Assign parcel
POST /carrybee/parcels/{parcel_id}/assign
```

---

## 📊 Expected Database State After Testing

```sql
-- Check locations synced
SELECT type, COUNT(*) FROM carrybee_locations GROUP BY type;
-- Result: CITY (8), ZONE (45), AREA (523)

-- Check store created
SELECT 
  business_name, 
  is_carrybee_synced, 
  carrybee_store_id,
  carrybee_city_id,
  carrybee_zone_id,
  carrybee_area_id
FROM stores 
WHERE business_name = 'My Store';

-- Check parcel assigned
SELECT 
  tracking_number,
  status,
  carrybee_consignment_id,
  third_party_provider_id
FROM parcels
WHERE carrybee_consignment_id IS NOT NULL;
```

---

## ✅ Success Indicators

**Location Sync:**
- ✅ Response shows counts for cities/zones/areas
- ✅ Database has 500+ location records
- ✅ Can query locations by type

**Store Creation:**
- ✅ Store created with status 200
- ✅ `is_carrybee_synced = true`
- ✅ `carrybee_store_id` is not null
- ✅ `carrybee_synced_at` has timestamp

**Parcel Assignment:**
- ✅ Parcel status = `ASSIGNED_TO_THIRD_PARTY`
- ✅ `carrybee_consignment_id` saved
- ✅ `third_party_provider_id` set to Carrybee

---

## 🐛 Troubleshooting

### **Issue: Sync returns 0 locations**
**Solution:** Check Carrybee API credentials in `.env`:
```env
CARRYBEE_CLIENT_ID=your_client_id
CARRYBEE_CLIENT_SECRET=your_secret
CARRYBEE_CLIENT_CONTEXT=your_context
```

### **Issue: Store creation fails with 400**
**Solution:** Ensure location IDs are valid:
```sql
SELECT * FROM carrybee_locations 
WHERE carrybee_id = 1 AND type = 'CITY';
```

### **Issue: Store not synced to Carrybee**
**Solution:** Check logs for Carrybee API errors:
```bash
# Look for:
# "Failed to create store in Carrybee: ..."
```

---

## 📞 API Endpoints Summary

| Endpoint | Method | Role | Description |
|----------|--------|------|-------------|
| `/carrybee-locations/sync` | POST | Admin | Sync all locations from Carrybee |
| `/carrybee-locations/cities` | GET | All | Get all cities |
| `/carrybee-locations/cities/:id/zones` | GET | All | Get zones by city |
| `/carrybee-locations/zones/:id/areas` | GET | All | Get areas by zone |
| `/carrybee-locations/search?q=term` | GET | All | Search locations |
| `/stores` | POST | Merchant | Create store (auto-syncs to Carrybee) |
| `/carrybee/parcels/:id/assign` | POST | Hub Manager | Assign parcel to Carrybee |

---

## 🎊 Testing Complete!

Once all tests pass:
1. ✅ Locations synced to database
2. ✅ Frontend can use dropdown APIs
3. ✅ Stores auto-create in Carrybee
4. ✅ Parcels can be assigned to Carrybee
5. ✅ Webhooks update parcel status

**Your Carrybee integration is production-ready!** 🚀
