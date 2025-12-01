# 🚀 Coverage Area Migration - Quick Guide

## ⚡ TL;DR

Your coverage area system now uses **Carrybee IDs directly** - no more manual mapping needed!

---

## 📝 What You Need

1. **CSV file** with this exact format:
```csv
division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
Dhaka,Dhaka,1,Gulshan,5,Gulshan 1,23,true
Dhaka,Dhaka,1,Gulshan,5,Gulshan 2,24,true
```

2. **Carrybee IDs** - Get these from your Carrybee account or use the exported locations

---

## 🎯 Migration Steps

### **Step 1: Prepare CSV**
```bash
# Place your CSV file here:
delivery_backend/coverage-areas.csv
```

### **Step 2: Run Migration**
```bash
npm run typeorm:migrate
```

### **Step 3: Import Data**
```bash
npm run import:coverage
```

### **Step 4: Verify**
```bash
# Test the API
GET http://localhost:3000/coverage/divisions
GET http://localhost:3000/coverage/divisions/Dhaka/cities
GET http://localhost:3000/coverage/cities/1/zones
GET http://localhost:3000/coverage/zones/5/areas
```

---

## ✅ What Changed

| Old | New |
|-----|-----|
| `district` | `city` + `city_id` |
| `zone` (nullable) | `zone` + `zone_id` (required) |
| `area` | `area` + `area_id` |
| Manual Carrybee ID mapping | Auto-populated from coverage area |

---

## 🎨 Frontend Changes

### **Old Flow:**
```
1. Select area from autocomplete
2. Manually provide Carrybee IDs
3. Create parcel
```

### **New Flow:**
```
1. Select Division → City → Zone → Area (cascading dropdowns)
2. System auto-populates Carrybee IDs
3. Create parcel ✅
```

### **New Endpoints:**
```
GET /coverage/divisions
GET /coverage/divisions/{division}/cities
GET /coverage/cities/{cityId}/zones
GET /coverage/zones/{zoneId}/areas
GET /coverage/search?area=Gulshan&city=Dhaka
```

---

## 📦 Parcel Creation

### **Before:**
```json
{
  "delivery_coverage_area_id": "uuid-123",
  "recipient_carrybee_city_id": 1,      // ❌ Manual
  "recipient_carrybee_zone_id": 5,      // ❌ Manual
  "recipient_carrybee_area_id": 23      // ❌ Manual
}
```

### **After:**
```json
{
  "delivery_coverage_area_id": "uuid-123"
  // ✅ Carrybee IDs auto-populated!
}
```

---

## 🔍 How to Get Carrybee IDs for CSV

### **Option 1: Use Exported Locations**
```bash
# Export all Carrybee locations
npm run export:locations

# Open carrybee-locations.csv
# Copy city_id, zone_id, area_id to your coverage CSV
```

### **Option 2: Use Carrybee API**
```bash
# Already synced in database
GET http://localhost:3000/carrybee-locations/cities
GET http://localhost:3000/carrybee-locations/cities/1/zones
GET http://localhost:3000/carrybee-locations/zones/5/areas
```

---

## ⚠️ Important Notes

1. **Backup First:** Backup your existing `coverage_areas` table
2. **CSV Format:** Must match exactly (headers are case-sensitive)
3. **Required Fields:** All fields except `inside_dhaka_flag` are required
4. **IDs Must Match:** city_id, zone_id, area_id must match Carrybee exactly
5. **Clear Old Data:** Import script clears existing data

---

## 🧪 Testing

### **Test 1: Check Divisions**
```bash
curl http://localhost:3000/coverage/divisions
```

**Expected:**
```json
{
  "divisions": ["Dhaka", "Chittagong", "Sylhet", ...]
}
```

### **Test 2: Check Cities**
```bash
curl http://localhost:3000/coverage/divisions/Dhaka/cities
```

**Expected:**
```json
{
  "cities": [
    { "city": "Dhaka", "city_id": 1 },
    { "city": "Gazipur", "city_id": 20 }
  ]
}
```

### **Test 3: Create Parcel**
```bash
POST http://localhost:3000/parcels
{
  "delivery_coverage_area_id": "uuid-from-areas-endpoint",
  "customer_name": "Test Customer",
  "customer_phone": "01712345678",
  "delivery_address": "Test Address"
}
```

**Check Response:**
```json
{
  "recipient_carrybee_city_id": 1,    // ✅ Auto-populated
  "recipient_carrybee_zone_id": 5,    // ✅ Auto-populated
  "recipient_carrybee_area_id": 23    // ✅ Auto-populated
}
```

### **Test 4: Assign to Carrybee**
```bash
POST http://localhost:3000/carrybee/parcels/{parcel_id}/assign
{
  "provider_id": "carrybee-provider-uuid"
}
```

**Expected:** ✅ Success (no "Wrong data provided" error)

---

## 📊 CSV Example

```csv
division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
Dhaka,Dhaka,1,Gulshan,5,Gulshan 1,23,true
Dhaka,Dhaka,1,Gulshan,5,Gulshan 2,24,true
Dhaka,Dhaka,1,Dhanmondi,6,Dhanmondi 15,30,true
Dhaka,Dhaka,1,Banani,7,Banani DOHS,35,true
Dhaka,Gazipur,20,Gazipur Sadar,100,Tongi,150,false
Chittagong,Chittagong,2,Agrabad,15,Agrabad Commercial,45,false
Sylhet,Sylhet,62,Sylhet Sadar,542,Zindabazar,1234,false
```

---

## 🎉 Benefits

✅ **No Manual Mapping** - IDs are in the database  
✅ **Auto-Population** - Parcels get Carrybee IDs automatically  
✅ **Guaranteed Accuracy** - No typos or mismatches  
✅ **Better Performance** - Indexed integer lookups  
✅ **Single Source** - One unified coverage system  

---

## 🆘 Need Help?

**Check the detailed guide:**
- `COVERAGE_AREA_CARRYBEE_INTEGRATION.md` - Complete documentation
- `scripts/import-coverage-areas.ts` - Import script source code

**Common Issues:**
- CSV not found → Place in project root
- Invalid headers → Check CSV format exactly
- Import fails → Check data types (IDs must be numbers)

---

## ✅ Migration Checklist

- [ ] Backup `coverage_areas` table
- [ ] Prepare CSV with Carrybee IDs
- [ ] Place CSV as `coverage-areas.csv` in project root
- [ ] Run `npm run typeorm:migrate`
- [ ] Run `npm run import:coverage`
- [ ] Test API endpoints
- [ ] Test parcel creation
- [ ] Test Carrybee assignment
- [ ] Update frontend code
- [ ] Deploy to production

---

**Ready to migrate? Follow the steps above!** 🚀
