# Railway Database Connection - Quick Fix

## ⚡ The Problem

Your deployment logs show:
```
DATABASE_URL="postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}"
```

The `${{...}}` syntax means the database is **NOT properly linked** to your web service.

---

## ⚡ The 5-Step Fix

### 1. Go to Web Service
Open your Railway dashboard → Click your **web service** (not the database)

### 2. Open Variables Tab
Click **"Variables"** in the top menu

### 3. Delete Old DATABASE_URL (if exists)
If you see `DATABASE_URL` with template syntax, click the **trash icon** to delete it

### 4. Add Database Reference
1. Click **"New Variable"**
2. Select **"Add a Reference"** from the dropdown
3. Choose your **PostgreSQL service**
4. Select **`DATABASE_URL`**
5. Click **"Add"**

### 5. Redeploy
Click **"Redeploy"** button

---

## ✅ How to Verify It Worked

After redeploying, check your deployment logs:

**✅ Good:**
```
DATABASE_URL: SET ✅
Database Host: postgres.railway.internal
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
```

**❌ Bad:**
```
DATABASE_URL: postgresql://${{PGUSER}}...
ERROR [TypeOrmModule] Unable to connect to the database
Error: read ECONNRESET
```

---

## 🔍 Visual Guide

### ❌ Wrong: Manual Variable
```
Variable Name: DATABASE_URL
Type: Manual
Value: postgresql://${{PGUSER}}:...
```

### ✅ Correct: Referenced Variable
```
Variable Name: DATABASE_URL
Type: Referenced from PostgreSQL
Value: postgresql://postgres:xxx@postgres.railway.internal:5432/railway
```

---

## 🆘 Still Not Working?

Run the diagnostic tool:
```bash
railway run npm run railway:diagnose
```

Or read the full guide:
- **RAILWAY_DATABASE_CONNECTION_FIX.md** - Detailed step-by-step guide

---

## 📞 Get Help

**Railway Discord:** https://discord.gg/railway
**Railway Support:** Dashboard → Help → Contact Support

Mention: "DATABASE_URL contains unresolved template syntax"

