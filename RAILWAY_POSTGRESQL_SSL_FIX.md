# Railway PostgreSQL SSL & Connection Fix

## 🔴 The Real Problem

Railway PostgreSQL + TypeORM `ECONNRESET` errors are caused by:

1. ❌ **Running in development mode on Railway** (wrong SSL/pooling)
2. ❌ **Pool size too large** (Railway has strict connection limits)
3. ❌ **Connection timeout too long** (Railway proxy aggressive)
4. ❌ **Missing NODE_ENV=production** (causes wrong behavior)

---

## ✅ What I've Fixed in Code

### 1. Reduced Pool Size (max: 10 → 5)
**File:** `src/data-source.ts`

Railway PostgreSQL (especially free/hobby tiers) has strict connection limits. Large pools cause:
- Connection exhaustion
- Aggressive connection resets
- ECONNRESET errors

```typescript
extra: {
  max: 5,  // ✅ Small pool for Railway (was 10)
}
```

### 2. Reduced Connection Timeout (30s → 5s)
**File:** `src/data-source.ts`

Railway uses a PostgreSQL proxy that's aggressive about timeouts:

```typescript
extra: {
  connectionTimeoutMillis: 5000,  // ✅ 5s for Railway proxy (was 30s)
}
```

### 3. Improved Environment Detection
**File:** `src/data-source.ts`

Now properly detects Railway environment:

```typescript
const isProduction = !!(
  process.env.NODE_ENV === 'production' ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PRIVATE_DOMAIN ||
  databaseUrl
);
```

### 4. Reduced Retry Attempts (10 → 5)
**File:** `src/app.module.ts`

Fail faster if misconfigured:

```typescript
TypeOrmModule.forRoot({
  ...dataSourceOptions,
  retryAttempts: 5,   // ✅ Reduced (was 10)
  retryDelay: 2000,   // ✅ 2s between retries (was 3s)
})
```

### 5. Cleaned Up Extra SSL Config
**File:** `src/data-source.ts`

Removed duplicate SSL settings from `extra` object (already at top level):

```typescript
// Before (duplicate)
ssl: { rejectUnauthorized: false },
extra: {
  ssl: { rejectUnauthorized: false },  // ❌ Duplicate
}

// After (single, correct)
ssl: { rejectUnauthorized: false },  // ✅ At top level only
extra: {
  max: 5,
  connectionTimeoutMillis: 5000,
}
```

---

## 🚨 CRITICAL: What You MUST Do in Railway Dashboard

### 1️⃣ Set NODE_ENV=production

This is **MANDATORY** for Railway PostgreSQL to work correctly!

**Steps:**
1. Go to your **web service** in Railway dashboard
2. Click **"Variables"** tab
3. Click **"New Variable"**
4. Add:
   - Name: `NODE_ENV`
   - Value: `production`
5. Click **"Add"**

**Why this matters:**
- Without this, your app runs in "development" mode on Railway
- Development mode uses wrong SSL settings
- Development mode doesn't enable connection pooling optimizations
- Railway PostgreSQL proxy expects production SSL behavior

### 2️⃣ Link Database Properly (if not already done)

1. In **web service** → **"Variables"** tab
2. Ensure `DATABASE_URL` shows **"Referenced from PostgreSQL"**
3. If it shows template syntax (`${{...}}`), delete it and re-add as reference:
   - Click **"New Variable"** → **"Add a Reference"**
   - Select **PostgreSQL service** → **`DATABASE_URL`**

### 3️⃣ Verify Other Required Variables

Make sure these are set:

```env
NODE_ENV=production           # ⚠️ REQUIRED
DATABASE_URL=[Reference]      # ⚠️ From PostgreSQL service
PORT=3000                     # Optional (Railway sets automatically)
JWT_SECRET=your-secret        # Your app secrets
JWT_EXPIRES_IN=1d
```

---

## 📊 Before & After

### ❌ Before (Logs showing errors)

```
[BOOTSTRAP] Environment: development  ⬅️ WRONG on Railway!
[Nest] ERROR [TypeOrmModule] Unable to connect to the database. Retrying (1)...
Error: read ECONNRESET
[Nest] ERROR [TypeOrmModule] Unable to connect to the database. Retrying (2)...
Error: read ECONNRESET
...
[EXIT] Application exited with code 1
```

### ✅ After (Expected logs)

```
[BOOTSTRAP] Environment: production  ⬅️ CORRECT!
[BOOTSTRAP] Platform: Railway
[DATABASE] Railway | DATABASE_URL: SET
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized +52ms
[Nest] LOG [RoutesResolver] ApplicationController {/}:
[Nest] LOG [NestApplication] Nest application successfully started +3ms
🚀 Server running on port 8080 [production]
```

---

## 🔧 Complete Railway Configuration

### Required Environment Variables:

```env
# ⚠️ CRITICAL - Must be set
NODE_ENV=production

# 🔗 Reference from PostgreSQL service
DATABASE_URL=${{Postgres.DATABASE_URL}}

# 🔒 Your application secrets
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this
JWT_REFRESH_EXPIRES_IN=7d

# 📱 SMS Provider (optional)
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=your-sender-id

# 📧 Email Settings (optional)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password

# 🚚 Carrybee API (optional)
CARRYBEE_API_URL=https://api.carrybee.com
CARRYBEE_API_KEY=your-api-key
```

---

## 🎯 Why This ONLY Happens on Railway

| Aspect | Local Development | Railway |
|--------|------------------|---------|
| **SSL** | Not required | **Required** (proxy) |
| **Database** | Direct connection | **Proxy connection** |
| **Connections** | Unlimited | **Strict limits** |
| **Timeouts** | Long-lived | **Aggressive resets** |
| **Pool Size** | Large OK | **Must be small (5)** |
| **NODE_ENV** | development OK | **Must be production** |

---

## ✅ Summary of Changes

### Code Changes (Already Applied):
- ✅ Reduced pool size: `max: 10` → `max: 5`
- ✅ Reduced connection timeout: `30000ms` → `5000ms`
- ✅ Improved environment detection
- ✅ Reduced retry attempts: `10` → `5`
- ✅ Cleaned up duplicate SSL config
- ✅ Removed unnecessary `keepAlive` settings

### Railway Dashboard (YOU MUST DO):
- ⚠️ **Set `NODE_ENV=production`** (CRITICAL!)
- ⚠️ **Verify `DATABASE_URL` is referenced from PostgreSQL service**
- ⚠️ **Set all required environment variables**
- ⚠️ **Redeploy after setting variables**

---

## 🧪 Test the Fix

### 1. Local Test (Optional)
```bash
# Run diagnostic locally
npm run railway:diagnose
```

### 2. Railway Test
After setting `NODE_ENV=production` and redeploying:

1. **Check Deployment Logs:**
   ```
   [BOOTSTRAP] Environment: production  ✅
   [Nest] LOG [TypeOrmModule dependencies initialized  ✅
   [Nest] LOG [NestApplication] Nest application successfully started  ✅
   ```

2. **Check Health:**
   Visit: `https://your-app.railway.app/`
   Should return: `200 OK`

3. **No More ECONNRESET:**
   No more connection reset errors in logs

---

## 🐛 If Still Not Working

### Check #1: NODE_ENV is set to production
```bash
# In Railway deployment logs, should show:
[BOOTSTRAP] Environment: production
```

If it still shows "development", the variable isn't set correctly.

### Check #2: Database is Active
- PostgreSQL service shows **"Active"** (green)
- Check PostgreSQL deployment logs for errors

### Check #3: Services in Same Project
- Both web service and PostgreSQL must be in **same Railway project**

### Check #4: Railway Status
- Visit: https://status.railway.app/
- Check for platform issues

---

## 📖 Related Documentation

- **RAILWAY_QUICK_FIX.md** - 5-step database linking guide
- **RAILWAY_DATABASE_CONNECTION_FIX.md** - Template syntax fix
- **RAILWAY_TROUBLESHOOTING.md** - General troubleshooting

---

## 💡 Key Takeaways

1. **NODE_ENV=production is MANDATORY on Railway**
2. **Railway requires small pool sizes (max: 5)**
3. **Railway proxy needs short timeouts (5s)**
4. **SSL must be enabled (rejectUnauthorized: false)**
5. **Database must be linked as reference, not manual variable**

---

## ✅ Deployment Checklist

Before redeploying, verify:

- [ ] `NODE_ENV=production` is set in Railway variables
- [ ] `DATABASE_URL` is referenced from PostgreSQL service
- [ ] PostgreSQL service is "Active" (green)
- [ ] Both services in same Railway project
- [ ] All required environment variables are set
- [ ] Code changes have been pulled/deployed

Once all checked, **redeploy** and monitor logs for successful connection!

---

**The code is now optimized for Railway. Set NODE_ENV=production and you're good to go!** 🚀

