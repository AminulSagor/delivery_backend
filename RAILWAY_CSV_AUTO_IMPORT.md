# 🚀 Railway Auto-Import Coverage Areas CSV

## Overview

The `finalcsv-area.csv` file is now automatically synced to the `coverage_areas` database table during Railway deployment. This happens automatically without any manual intervention.

## 🔄 How It Works

### Deployment Flow

When you deploy to Railway:

1. **Docker Build** - The Dockerfile includes the CSV file in the production image
2. **Container Start** - The `start-with-migrations.js` script runs automatically
3. **CSV Import** - Coverage areas are imported from CSV (if table is empty)
4. **App Starts** - NestJS application starts with data ready

### Import Logic

The import script (`scripts/import-coverage-production.js`) is smart and safe:

- ✅ **Checks if CSV exists** - Skips if file not found
- ✅ **Checks if table exists** - Skips if table hasn't been created by migrations yet
- ✅ **Checks for existing data** - Skips if coverage_areas table already has data
- ✅ **Batch inserts** - Imports in batches of 500 rows for performance
- ✅ **Error handling** - Continues app startup even if import fails

### Database Structure

The CSV imports to this table structure:

```sql
CREATE TABLE coverage_areas (
  id UUID PRIMARY KEY,
  division VARCHAR(100),
  city VARCHAR(100),
  city_id INTEGER,
  zone VARCHAR(100),
  zone_id INTEGER,
  area VARCHAR(255),
  area_id INTEGER,
  inside_dhaka_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT UQ_coverage_areas_carrybee_ids UNIQUE (city_id, zone_id, area_id)
);
```

## 📝 CSV Format

The CSV file (`finalcsv-area.csv`) has this format:

```csv
division,city,city_id,zone,zone_id,area,area_id,inside_dhaka_flag
Dhaka,Dhaka,1,Gulshan,101,Gulshan 1,1001,true
Dhaka,Dhaka,1,Banani,102,Banani DOHS,1002,true
...
```

## 🔧 Files Modified

### 1. `Dockerfile`
- Added line to copy `finalcsv-area.csv` to production image

### 2. `.gitignore`
- Removed `finalcsv-area.csv` from ignore list (now tracked in Git)

### 3. `scripts/start-with-migrations.js`
- Updated to import CSV before starting the app
- Handles errors gracefully

### 4. `scripts/import-coverage-production.js` (NEW)
- Production-ready CSV import script
- Can be run standalone or imported as a module

## 📦 What Gets Deployed

The Railway deployment now includes:

```
/app
  ├── dist/                  (compiled NestJS app)
  ├── scripts/
  │   ├── start-with-migrations.js
  │   └── import-coverage-production.js
  ├── finalcsv-area.csv     (coverage areas data)
  ├── node_modules/
  └── package.json
```

## 🎯 Key Features

### ✅ Safe Import
- Only imports if table is empty
- Won't overwrite existing data
- Won't break deployment if CSV is missing

### ✅ Performance
- Batch inserts (500 rows at a time)
- Efficient CSV parsing with quote handling
- Minimal memory footprint

### ✅ Logging
- Clear deployment logs showing import progress
- Summary statistics after import
- Error messages if something goes wrong

## 📊 Example Deployment Log

```
========================================
Railway Deployment - Starting
========================================

DATABASE_URL: SET ✅
PORT: 3000
NODE_ENV: production

========================================
Step 1: Import Coverage Areas
========================================

✅ CSV file found
✅ Database connected

📖 Reading CSV file...
📋 Total lines in CSV: 68531

   ✓ Inserted 500 rows...
   ✓ Inserted 1000 rows...
   ...
   ✓ Inserted 68530 rows...

✅ CSV Import Complete!
📊 Summary:
   - Total rows processed: 68530
   - Successfully imported: 68530
   - Errors: 0
   - Records in database: 68530

========================================
Step 2: Starting NestJS Application
========================================

[NestJS app starts here...]
```

## 🔄 When Data Updates

If you need to update the coverage areas:

### Option 1: Update CSV and Redeploy
1. Update `finalcsv-area.csv` locally
2. Commit and push to Git
3. **IMPORTANT**: Clear the `coverage_areas` table first (or delete and recreate)
4. Redeploy on Railway

### Option 2: Manual Import
Run locally and let it sync:
```bash
npm run import:coverage
```

### Option 3: Use the API
Use the existing API endpoint:
```bash
POST /coverage-areas/sync
```
This syncs from Carrybee API (different source).

## 🚨 Important Notes

1. **First Deployment**: Import happens automatically on first deploy
2. **Subsequent Deployments**: Import is skipped if data already exists
3. **Data Persistence**: Railway PostgreSQL data persists between deployments
4. **CSV Updates**: To reimport, you must clear the table first

## 🧪 Testing Locally

To test the import script locally:

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export NODE_ENV="development"

# Run the import script
node scripts/import-coverage-production.js
```

## 📱 Railway Dashboard

In Railway, you'll see the import happening in the deployment logs:
1. Go to your web service
2. Click "Deployments"
3. Select the latest deployment
4. View logs - you'll see the CSV import step

## ✅ Verification

To verify the import worked:

1. Check deployment logs for "CSV Import Complete!"
2. Use Railway PostgreSQL shell:
   ```sql
   SELECT COUNT(*) FROM coverage_areas;
   ```
3. Call your API:
   ```bash
   GET /coverage-areas/divisions
   ```

## 🎉 Benefits

- ✅ **Zero Manual Work** - Everything happens automatically
- ✅ **Consistent Data** - Same CSV across all deployments
- ✅ **Version Controlled** - CSV is tracked in Git
- ✅ **Fast Deployment** - Batch import is efficient
- ✅ **Safe** - Won't overwrite existing data

---

**Deployment Status**: ✅ Ready for Railway

**Last Updated**: 2026-01-08

**Git Branch**: `sifat`

**Commit**: `cd3a2f1`

