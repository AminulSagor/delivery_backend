# 📮 Postman Collection Updates Summary

## ✅ What Was Added

### **New Section: "Location Management (NEW)"**

Added 5 new endpoints under **"11. Carrybee Integration"**:

---

## 🆕 New Endpoints

### **1. Sync Locations from Carrybee**
```
POST {{base_url}}/carrybee-locations/sync
Authorization: Bearer {{admin_token}}
```

**Features:**
- Admin only
- Syncs all cities, zones, and areas from Carrybee
- Safe to run multiple times (uses upsert)
- Auto-saves response counts in test script

**Test Script:**
```javascript
pm.test('Status code is 200', function () {
    pm.response.to.have.status(200);
});

pm.test('Response has sync counts', function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('cities');
    pm.expect(jsonData).to.have.property('zones');
    pm.expect(jsonData).to.have.property('areas');
});
```

---

### **2. Get All Cities**
```
GET {{base_url}}/carrybee-locations/cities
Authorization: Bearer {{merchant_token}}
```

**Features:**
- Available to Merchant, Admin, Hub Manager
- Returns cities from local database (fast!)
- Auto-saves first city ID to `{{carrybee_city_id}}`

**Test Script:**
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.cities && jsonData.cities.length > 0) {
        pm.collectionVariables.set('carrybee_city_id', jsonData.cities[0].carrybee_id);
        console.log('Set carrybee_city_id to: ' + jsonData.cities[0].carrybee_id);
    }
}
```

---

### **3. Get Zones by City**
```
GET {{base_url}}/carrybee-locations/cities/{{carrybee_city_id}}/zones
Authorization: Bearer {{merchant_token}}
```

**Features:**
- Cascading dropdown support
- Filters zones by selected city
- Auto-saves first zone ID to `{{carrybee_zone_id}}`

**Test Script:**
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.zones && jsonData.zones.length > 0) {
        pm.collectionVariables.set('carrybee_zone_id', jsonData.zones[0].carrybee_id);
        console.log('Set carrybee_zone_id to: ' + jsonData.zones[0].carrybee_id);
    }
}
```

---

### **4. Get Areas by Zone**
```
GET {{base_url}}/carrybee-locations/zones/{{carrybee_zone_id}}/areas
Authorization: Bearer {{merchant_token}}
```

**Features:**
- Cascading dropdown support
- Filters areas by selected zone
- Auto-saves first area ID to `{{carrybee_area_id}}`

**Test Script:**
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    if (jsonData.areas && jsonData.areas.length > 0) {
        pm.collectionVariables.set('carrybee_area_id', jsonData.areas[0].carrybee_id);
        console.log('Set carrybee_area_id to: ' + jsonData.areas[0].carrybee_id);
    }
}
```

---

### **5. Search Locations**
```
GET {{base_url}}/carrybee-locations/search?q=Gulshan
Authorization: Bearer {{merchant_token}}
```

**Features:**
- Search across all location types
- Minimum 2 characters required
- Returns cities, zones, and areas matching search term

**Query Parameters:**
- `q` - Search term (min 2 chars)

---

## 🔄 Updated Endpoints

### **Create Store** (Updated)
```
POST {{base_url}}/stores
Authorization: Bearer {{merchant_token}}
```

**New Required Fields:**
```json
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
  "carrybee_city_id": {{carrybee_city_id}},      // ✨ NEW
  "carrybee_zone_id": {{carrybee_zone_id}},      // ✨ NEW
  "carrybee_area_id": {{carrybee_area_id}}       // ✨ NEW
}
```

**Updated Description:**
```
DTO: create-store.dto.ts | phone_number: 01XXXXXXXXX | 
REQUIRED: carrybee_city_id, carrybee_zone_id, carrybee_area_id 
(get from /carrybee-locations endpoints) | 
Store will be auto-created in Carrybee!
```

---

## 📊 Collection Structure

```
11. Carrybee Integration
├── Location Management (NEW) ✨
│   ├── Sync Locations from Carrybee
│   ├── Get All Cities
│   ├── Get Zones by City
│   ├── Get Areas by Zone
│   └── Search Locations
├── Location APIs (Legacy - Direct Carrybee)
│   ├── Get Cities
│   ├── Get Zones by City
│   ├── Get Areas by Zone
│   └── Search Area Suggestion
├── Store Sync
│   └── Sync Store to Carrybee
└── Parcel Assignment
    ├── Get Parcels for Third-Party Assignment
    └── Assign Parcel to Carrybee
```

---

## 🔧 Collection Variables Used

The new endpoints use these collection variables:

| Variable | Set By | Used By |
|----------|--------|---------|
| `carrybee_city_id` | Get All Cities (test script) | Get Zones, Create Store |
| `carrybee_zone_id` | Get Zones (test script) | Get Areas, Create Store |
| `carrybee_area_id` | Get Areas (test script) | Create Store |
| `merchant_token` | Login endpoint | All location endpoints |
| `admin_token` | Login endpoint | Sync endpoint |

---

## 🎯 Testing Flow

### **Recommended Order:**

1. **Admin Login** → Get `admin_token`
2. **Sync Locations** → Populate database
3. **Merchant Login** → Get `merchant_token`
4. **Get Cities** → Auto-saves `carrybee_city_id`
5. **Get Zones** → Auto-saves `carrybee_zone_id`
6. **Get Areas** → Auto-saves `carrybee_area_id`
7. **Create Store** → Uses saved IDs, auto-syncs to Carrybee!

---

## ✨ Key Features

### **1. Automatic Variable Management**
All endpoints have test scripts that auto-save IDs to collection variables. No manual copying needed!

### **2. Cascading Dropdowns**
The flow mimics frontend behavior:
- Select City → Get Zones
- Select Zone → Get Areas
- Select Area → Create Store

### **3. Smart Descriptions**
Each endpoint has detailed descriptions explaining:
- DTO used
- Required fields
- Role requirements
- What happens automatically

### **4. Legacy Support**
Old Carrybee endpoints kept under "Legacy" folder for backward compatibility.

---

## 📝 How to Use

### **Import Collection:**
1. Open Postman
2. Click "Import"
3. Select `Delivery_Backend_API.postman_collection.json`
4. Collection will appear with all new endpoints

### **Set Environment:**
1. Create/Select environment
2. Set `base_url` = `http://localhost:3000`
3. Run login endpoints to get tokens

### **Run Tests:**
1. Start with "Sync Locations from Carrybee"
2. Follow the testing flow above
3. Watch console for auto-saved variables

---

## 🎊 Summary

**Total Endpoints Added:** 5  
**Total Endpoints Updated:** 1  
**New Collection Variables:** 3  
**Test Scripts Added:** 4  

**Benefits:**
- ✅ Complete location management workflow
- ✅ Automatic variable management
- ✅ Frontend-ready API testing
- ✅ Auto-sync store creation
- ✅ Comprehensive test coverage

**Your Postman collection is now ready for complete Carrybee integration testing!** 🚀
