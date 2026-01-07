# Railway Database Migration Fix ✅

## 🐛 Problem Identified

Your deployment was successful, but **migrations were not running** on Railway, leaving your PostgreSQL database empty (no tables created).

### Root Cause
The migration file paths in `src/data-source.ts` were configured with **absolute paths from project root** instead of **relative paths from the compiled file location**.

When running in production:
- Your app runs from: `dist/src/main.js`
- Your data-source is at: `dist/src/data-source.js`
- Your migrations are at: `dist/src/migrations/*.js`
- But the code was looking for: `dist/migrations/*.js` ❌ (doesn't exist!)

---

## ✅ Solution Applied

Fixed the migration and entity paths to use **relative paths** that work in both development and production:

### Before (❌ Broken):
```typescript
entities: isTs
  ? [path.join(__dirname, '**/*.entity.ts')]
  : ['dist/**/*.entity.js'],  // Absolute path - WRONG!
migrations: isTs
  ? [path.join(__dirname, 'migrations/*.ts')]
  : ['dist/migrations/*.js'],  // Absolute path - WRONG!
```

### After (✅ Fixed):
```typescript
entities: isTs
  ? [path.join(__dirname, '**/*.entity.ts')]
  : [path.join(__dirname, '**/*.entity.js')],  // Relative path - CORRECT!
migrations: isTs
  ? [path.join(__dirname, 'migrations/*.ts')]
  : [path.join(__dirname, 'migrations/*.js')],  // Relative path - CORRECT!
```

This ensures that regardless of where the compiled code is executed from, it will correctly find:
- `dist/src/migrations/*.js`
- `dist/src/**/*.entity.js`

---

## 🚀 Deploy to Railway

### Step 1: Commit and Push Changes

```bash
git add src/data-source.ts
git commit -m "Fix: Railway migration paths - use relative paths"
git push
```

### Step 2: Railway Will Auto-Deploy

Railway will automatically detect the push and start a new deployment.

### Step 3: Monitor Deployment Logs

In Railway Dashboard:
1. Go to your **web service**
2. Click on the **Deployments** tab
3. Click on the latest deployment
4. Watch the **Deploy Logs**

### Step 4: Verify Migrations Ran

Look for these log messages in your deployment logs:

```
=============================================================
[DATABASE CONFIG]
=============================================================
Environment: PRODUCTION
Mode: JavaScript (compiled)
DATABASE_URL: ✅ SET
Migrations Auto-Run: ✅ ENABLED
Migration Path: ["/app/dist/src/migrations/*.js"]
Entity Path: ["/app/dist/src/**/*.entity.js"]
Database Host: containers-us-west-xxx.railway.app
Database Port: 6379
Database Name: railway
Database User: postgres
=============================================================
```

And then you should see TypeORM executing migrations:

```
query: SELECT * FROM "information_schema"."tables" WHERE "table_schema" = 'public' AND "table_name" = 'migrations'
query: CREATE TABLE "migrations" ...
query: SELECT * FROM "migrations" ...
query: START TRANSACTION
query: CREATE TABLE "users" ...
... (more migration queries)
query: COMMIT
```

---

## 🔍 Troubleshooting

### If migrations still don't run:

#### 1. Check DATABASE_URL is properly set

In Railway Dashboard → Your Web Service → Variables:

✅ **Correct Setup:**
- Variable: `DATABASE_URL`
- Value: `${{Postgres.DATABASE_URL}}` (shows as a purple reference badge)

❌ **Incorrect Setup:**
- Variable: `DATABASE_URL`
- Value: Contains literal text `${{Postgres.DATABASE_URL}}` (shows as plain text)

**Fix:** Delete the variable and add it again as a **Reference** (not raw variable).

#### 2. Set NODE_ENV to production

Add this environment variable in Railway:
- Variable: `NODE_ENV`
- Value: `production`

#### 3. Check PostgreSQL service is running

In Railway Dashboard:
- Verify your PostgreSQL service status is **Active**
- Check PostgreSQL logs for any errors

#### 4. Manual Migration (Last Resort)

If automatic migrations still fail, you can run them manually:

1. **Connect to Railway PostgreSQL using Railway CLI:**
   ```bash
   railway link
   railway run psql -h $PGHOST -U $PGUSER -d $PGDATABASE
   ```

2. **Or use Railway's built-in psql:**
   - Go to PostgreSQL service → Data tab
   - Click "Connect via psql"
   - This opens a terminal with psql connected

3. **Check if tables exist:**
   ```sql
   \dt
   ```

4. **If empty, redeploy with enhanced logging:**
   - The new logging will show exactly what's happening
   - Check deployment logs for migration execution

---

## 📊 What Should Happen Now

1. ✅ Railway detects your code push
2. ✅ Builds Docker image with migrations in `dist/src/migrations/`
3. ✅ Starts container with `node scripts/start-with-migrations.js`
4. ✅ Script runs `node dist/src/main`
5. ✅ NestJS app boots up
6. ✅ TypeORM loads config from `data-source.js`
7. ✅ TypeORM finds migrations at `dist/src/migrations/*.js` (using relative path)
8. ✅ TypeORM runs all 36 pending migrations
9. ✅ Database tables are created
10. ✅ App is ready to serve requests

---

## 🎯 Expected Result

After deployment completes:

### In Railway Logs:
```
Migration Path: ["/app/dist/src/migrations/*.js"]
query: CREATE TABLE "users" ...
query: CREATE TABLE "merchants" ...
query: CREATE TABLE "hubs" ...
... (all 36 migrations executed)
Application listening on port 3000
```

### In PostgreSQL:
```sql
\dt
```

Should show all tables:
- users
- merchants
- hubs
- riders
- stores
- parcels
- pickup_requests
- coverage_areas
- delivery_verifications
- merchant_payouts
- rider_settlements
- hub_transfer_records
- merchant_invoices
- merchant_finance_records
- customers
... and more (30+ tables)

---

## 📝 Additional Notes

### Why `migrationsRun: true`?

Your app is configured with `migrationsRun: true` in `data-source.ts`, which means:
- TypeORM automatically runs pending migrations on app startup
- No need for a separate migration command
- Migrations run before the app starts accepting requests
- Safe for Railway's deployment model

### Your 36 Migrations

Your project has 36 migration files that will be executed in order:
1. `1699999999999-InitialSchema.ts` - Creates base tables
2. `1732022300000-CreateStoresTable.ts` - Store management
3. ... (32 more migrations)
36. `1763291344115-UpdateParcelTable.ts` - Latest schema updates

All of these will run automatically on first deployment, setting up your complete database schema.

---

## ✅ Verification Checklist

After deployment, verify everything is working:

- [ ] Railway deployment shows "Active" status
- [ ] Deployment logs show migration execution
- [ ] PostgreSQL contains all expected tables
- [ ] API health endpoint returns 200 OK
- [ ] You can make API requests (e.g., GET /api/auth/health)
- [ ] No database connection errors in logs

---

## 🆘 Need Help?

If you're still having issues:

1. **Share your deployment logs** - Copy the full log output from Railway
2. **Check PostgreSQL logs** - Look for connection errors
3. **Verify environment variables** - Ensure DATABASE_URL is a reference
4. **Check Railway status** - Sometimes Railway has platform issues

---

## 📚 Related Documentation

- `RAILWAY_DEPLOYMENT.md` - Complete Railway deployment guide
- `RAILWAY_DATABASE_CONNECTION_FIX.md` - DATABASE_URL reference fix
- `RAILWAY_FIXES_COMPLETE.md` - All Railway optimizations applied

---

**Status:** ✅ Fix Applied - Ready to Deploy

Last Updated: {{ timestamp }}

