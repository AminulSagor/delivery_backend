# 🗺️ Coverage Area with Carrybee Integration

## 🎯 Overview

The coverage area system has been **completely redesigned** to use **Carrybee-compatible IDs** directly in the database. This eliminates the need for ID mapping and ensures seamless integration with Carrybee's delivery system.

---

## 🔄 What Changed

### **Old System:**
```
coverage_areas table:
- division (nullable)
- district (nullable)
- zone (nullable)
- area (required)
- coverage, delivery_type, pickup (extra fields)
- inside_dhaka_flag

❌ No Carrybee IDs
❌ Required manual mapping
❌ Prone to errors
```

### **New System:**
```
coverage_areas table:
- division (required)
- city (required) + city_id (Carrybee ID)
- zone (required) + zone_id (Carrybee ID)
- area (required) + area_id (Carrybee ID)
- inside_dhaka_flag

✅ Direct Carrybee IDs
✅ No mapping needed
✅ Auto-populated in parcels
```

---

## 📊 New Database Schema

### **Coverage Area Entity:**

```typescript
@Entity('coverage_areas')
export class CoverageArea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  division: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'int' })
  city_id: number;  // ✨ Carrybee city ID

  @Column({ type: 'varchar', length: 100 })
  zone: string;

  @Column({ type: 'int' })
  zone_id: number;  // ✨ Carrybee zone ID

  @Column({ type: 'varchar', length: 255 })
  area: string;

  @Column({ type: 'int' })
  area_id: number;  // ✨ Carrybee area ID

  @Column({ type: 'boolean', default: false })
  inside_dhaka_flag: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### **Indexes Created:**
```sql
CREATE INDEX "IDX_coverage_areas_city_id" ON "coverage_areas" ("city_id");
CREATE INDEX "IDX_coverage_areas_zone_id" ON "coverage_areas" ("zone_id");
CREATE INDEX "IDX_coverage_areas_area_id" ON "coverage_areas" ("area_id");
CREATE INDEX "IDX_coverage_areas_carrybee_ids" ON "coverage_areas" ("city_id", "zone_id", "area_id");
```

---

## 📥 CSV Import Process

### **Step 1: Prepare Your CSV**

**Required Format:**
```csv
division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
Dhaka,Dhaka,1,Gulshan,5,Gulshan 1,23,true
Dhaka,Dhaka,1,Gulshan,5,Gulshan 2,24,true
Dhaka,Dhaka,1,Dhanmondi,6,Dhanmondi 15,30,true
Chittagong,Chittagong,2,Agrabad,15,Agrabad Commercial Area,45,false
```

**Field Descriptions:**
- `division` - Division name (e.g., Dhaka, Chittagong)
- `city` - City name (e.g., Dhaka, Chittagong)
- `city_id` - **Carrybee city ID** (must match Carrybee)
- `zone` - Zone/Thana name (e.g., Gulshan, Dhanmondi)
- `zone_id` - **Carrybee zone ID** (must match Carrybee)
- `area` - Area name (e.g., Gulshan 1, Dhanmondi 15)
- `area_id` - **Carrybee area ID** (must match Carrybee)
- `inside_dhaka_flag` - `true` or `false` (or `1`/`0`)

---

### **Step 2: Place CSV File**

Place your CSV file in the project root:
```
delivery_backend/
├── coverage-areas.csv  ← Your CSV file here
├── src/
├── scripts/
└── package.json
```

---

### **Step 3: Run Migration**

```bash
npm run typeorm:migrate
```

This will:
- Drop old columns (district, coverage, delivery_type, pickup)
- Add new columns (city, city_id, zone_id, area_id)
- Create indexes for performance

---

### **Step 4: Import CSV Data**

```bash
npm run import:coverage
```

**What happens:**
1. ✅ Validates CSV format
2. ✅ Clears existing coverage areas
3. ✅ Parses CSV rows
4. ✅ Validates data (required fields, valid IDs)
5. ✅ Batch inserts (500 rows at a time)
6. ✅ Shows progress and summary

**Example Output:**
```
🚀 Starting Coverage Areas Import from CSV...

✅ Database connected

📖 Reading CSV file...
📋 CSV Headers: division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
✅ CSV validation passed

🗑️  Clearing existing coverage areas...
✅ Existing data cleared

📥 Importing coverage areas...

   ✓ Processed 1000 rows...
   ✓ Processed 2000 rows...
   ✓ Processed 3000 rows...

📊 Parsing Summary:
   - Total rows: 3500
   - Successful: 3500
   - Errors: 0

💾 Saving to database...
   ✓ Saved 500/3500 coverage areas...
   ✓ Saved 1000/3500 coverage areas...
   ✓ Saved 1500/3500 coverage areas...
   ✓ Saved 2000/3500 coverage areas...
   ✓ Saved 2500/3500 coverage areas...
   ✓ Saved 3000/3500 coverage areas...
   ✓ Saved 3500/3500 coverage areas...

✅ Import Complete!
📊 Final Summary:
   - Total imported: 3500
   - Divisions: 8
   - Cities: 64
   - Zones: 1076
   - Areas: 3500
   - Inside Dhaka: 1200
   - Outside Dhaka: 2300

📋 Sample Data (first 5 rows):
   1. Dhaka > Dhaka (1) > Gulshan (5) > Gulshan 1 (23)
   2. Dhaka > Dhaka (1) > Gulshan (5) > Gulshan 2 (24)
   3. Dhaka > Dhaka (1) > Dhanmondi (6) > Dhanmondi 15 (30)
   4. Chittagong > Chittagong (2) > Agrabad (15) > Agrabad Commercial Area (45)
   5. Sylhet > Sylhet (62) > Sylhet Sadar (542) > Zindabazar (1234)

✅ Database connection closed
✨ Import completed successfully!
```

---

## 🚀 New API Endpoints

### **1. Search Coverage Areas**
```http
GET /coverage/search?area=Gulshan&city=Dhaka&division=Dhaka&zone=Gulshan
```

**Response:**
```json
[
  {
    "id": "uuid-123",
    "division": "Dhaka",
    "city": "Dhaka",
    "city_id": 1,
    "zone": "Gulshan",
    "zone_id": 5,
    "area": "Gulshan 1",
    "area_id": 23,
    "inside_dhaka_flag": true,
    "created_at": "2025-11-26T06:00:00Z",
    "updated_at": "2025-11-26T06:00:00Z"
  }
]
```

---

### **2. Get All Divisions**
```http
GET /coverage/divisions
```

**Response:**
```json
{
  "divisions": [
    "Dhaka",
    "Chittagong",
    "Sylhet",
    "Rajshahi",
    "Khulna",
    "Barisal",
    "Rangpur",
    "Mymensingh"
  ]
}
```

---

### **3. Get Cities by Division**
```http
GET /coverage/divisions/Dhaka/cities
```

**Response:**
```json
{
  "cities": [
    {
      "city": "Dhaka",
      "city_id": 1
    },
    {
      "city": "Gazipur",
      "city_id": 20
    },
    {
      "city": "Narayanganj",
      "city_id": 40
    }
  ]
}
```

---

### **4. Get Zones by City**
```http
GET /coverage/cities/1/zones
```

**Response:**
```json
{
  "zones": [
    {
      "zone": "Gulshan",
      "zone_id": 5
    },
    {
      "zone": "Dhanmondi",
      "zone_id": 6
    },
    {
      "zone": "Banani",
      "zone_id": 7
    }
  ]
}
```

---

### **5. Get Areas by Zone**
```http
GET /coverage/zones/5/areas
```

**Response:**
```json
{
  "areas": [
    {
      "area": "Gulshan 1",
      "area_id": 23,
      "id": "uuid-123"
    },
    {
      "area": "Gulshan 2",
      "area_id": 24,
      "id": "uuid-124"
    }
  ]
}
```

---

### **6. Get Coverage Area by ID**
```http
GET /coverage/{coverage_area_id}
```

**Response:**
```json
{
  "id": "uuid-123",
  "division": "Dhaka",
  "city": "Dhaka",
  "city_id": 1,
  "zone": "Gulshan",
  "zone_id": 5,
  "area": "Gulshan 1",
  "area_id": 23,
  "inside_dhaka_flag": true,
  "created_at": "2025-11-26T06:00:00Z",
  "updated_at": "2025-11-26T06:00:00Z"
}
```

---

## 📦 Parcel Creation with Auto-Population

### **How It Works:**

When you create a parcel with `delivery_coverage_area_id`, the system **automatically populates** the Carrybee IDs:

```typescript
// User provides:
{
  "delivery_coverage_area_id": "uuid-123",
  "customer_name": "John Doe",
  "customer_phone": "01712345678",
  "delivery_address": "House 45, Gulshan 1, Dhaka"
}

// System automatically adds:
{
  "recipient_carrybee_city_id": 1,      // ✨ From coverage area
  "recipient_carrybee_zone_id": 5,      // ✨ From coverage area
  "recipient_carrybee_area_id": 23      // ✨ From coverage area
}
```

### **Parcel Creation Flow:**

```
1. Merchant selects delivery area from dropdown
   ↓
2. Frontend sends delivery_coverage_area_id
   ↓
3. Backend fetches coverage area
   ↓
4. Backend extracts city_id, zone_id, area_id
   ↓
5. Backend saves parcel with Carrybee IDs
   ↓
6. ✅ Parcel ready for Carrybee assignment!
```

---

## 🎯 Frontend Integration

### **Step 1: Division Dropdown**
```typescript
// GET /coverage/divisions
const divisions = await fetch('/coverage/divisions');
// Show in dropdown
```

### **Step 2: City Dropdown (when division selected)**
```typescript
// GET /coverage/divisions/{division}/cities
const cities = await fetch(`/coverage/divisions/${division}/cities`);
// Show in dropdown
```

### **Step 3: Zone Dropdown (when city selected)**
```typescript
// GET /coverage/cities/{cityId}/zones
const zones = await fetch(`/coverage/cities/${cityId}/zones`);
// Show in dropdown
```

### **Step 4: Area Dropdown (when zone selected)**
```typescript
// GET /coverage/zones/{zoneId}/areas
const areas = await fetch(`/coverage/zones/${zoneId}/areas`);
// Show in dropdown
```

### **Step 5: Create Parcel**
```typescript
// POST /parcels
{
  "delivery_coverage_area_id": selectedAreaId,  // UUID from step 4
  "customer_name": "John Doe",
  "customer_phone": "01712345678",
  "delivery_address": "House 45, Gulshan 1, Dhaka",
  // ... other fields
}

// ✅ Carrybee IDs auto-populated!
```

---

## ✅ Benefits

### **1. No Manual Mapping**
- ❌ **Before:** Had to manually match area names to Carrybee IDs
- ✅ **After:** IDs are already in the database

### **2. Guaranteed Accuracy**
- ❌ **Before:** Typos in area names caused mismatches
- ✅ **After:** Using numeric IDs ensures exact matches

### **3. Automatic Population**
- ❌ **Before:** Had to manually provide Carrybee IDs
- ✅ **After:** System auto-populates from coverage area

### **4. Single Source of Truth**
- ❌ **Before:** Coverage areas and Carrybee locations were separate
- ✅ **After:** One unified system

### **5. Better Performance**
- ❌ **Before:** String matching on area names
- ✅ **After:** Indexed integer lookups

---

## 🔧 Troubleshooting

### **Error: "CSV file not found"**
**Solution:** Place `coverage-areas.csv` in project root

### **Error: "Missing required headers"**
**Solution:** Ensure CSV has all required columns:
```
division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
```

### **Error: "Invalid ID values"**
**Solution:** Ensure city_id, zone_id, area_id are valid numbers

### **Error: "Missing required fields"**
**Solution:** Ensure no empty values in required columns

---

## 📋 Migration Checklist

- [ ] Backup existing coverage_areas table
- [ ] Prepare CSV with Carrybee IDs
- [ ] Place CSV in project root as `coverage-areas.csv`
- [ ] Run migration: `npm run typeorm:migrate`
- [ ] Import CSV: `npm run import:coverage`
- [ ] Verify data in database
- [ ] Test parcel creation
- [ ] Test Carrybee assignment
- [ ] Update frontend to use new endpoints

---

## 🎉 Summary

**Old System:**
```
Coverage Area → Manual Mapping → Carrybee IDs
❌ Error-prone
❌ Manual work
❌ Slow
```

**New System:**
```
Coverage Area (with Carrybee IDs) → Auto-populate → Parcel
✅ Automatic
✅ Accurate
✅ Fast
```

**Result:** Seamless Carrybee integration with zero manual mapping! 🚀
