# 🚨 URGENT: Railway Database Connection Fix

## Your Problem

Deployment logs show:
```
DATABASE_URL="postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@..."
ERROR: read ECONNRESET
```

## The Fix (5 Minutes)

### In Railway Dashboard:

1. **Go to your WEB SERVICE** (not database)
   
2. **Click "Variables" tab**

3. **Delete DATABASE_URL** (if it shows `${{...}}`)

4. **Click "New Variable" → "Add a Reference"**
   - Select: **PostgreSQL service**
   - Choose: **DATABASE_URL**
   - Click: **Add**

5. **Click "Redeploy"**

---

## ✅ How to Know It Worked

**Deployment logs should show:**
```
DATABASE_URL: SET ✅
Database Host: postgres.railway.internal
[Nest] LOG [NestApplication] Nest application successfully started
```

---

## 📖 Detailed Instructions

- **Quick Guide:** `RAILWAY_QUICK_FIX.md`
- **Full Guide:** `RAILWAY_DATABASE_CONNECTION_FIX.md`
- **Summary:** `RAILWAY_FIX_SUMMARY.md`

---

## 🔍 Diagnostic Tool

Run this to test your connection:
```bash
npm run railway:diagnose
```

---

## Why This Happens

Railway won't resolve template syntax like `${{PGUSER}}` in manual variables.

You must use **"Add a Reference"** feature to link variables between services.

---

## Still Stuck?

1. Verify both services are in the **same Railway project**
2. Check PostgreSQL service is **Active** (green)
3. Read: `RAILWAY_DATABASE_CONNECTION_FIX.md`
4. Ask Railway Discord: https://discord.gg/railway

---

**This is a configuration issue in Railway, not a code issue.**

**The code is already fixed and ready to deploy once you link the database properly.**

🚀 Fix the Railway configuration above and redeploy!

