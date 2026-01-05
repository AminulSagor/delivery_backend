# Railway Deployment Troubleshooting

## Current Issue: Persistent ECONNRESET Errors

If you're getting **persistent `ECONNRESET`** errors (every single connection attempt fails), this indicates a **Railway configuration issue**, not a code issue.

---

## ✅ Checklist - Please Verify These in Railway Dashboard

### 1. **Database Service is Running**
- Go to your Railway project dashboard
- Check if your PostgreSQL database service shows as "Active" (green)
- If it's "Deploying" or "Failed", wait or redeploy it

### 2. **Database is Linked to Your App**
- In your web service settings, check "Service Variables"
- You should see a variable named `DATABASE_URL` 
- It should be **Referenced from** your PostgreSQL service (not manually set)
- Format: `postgresql://username:password@hostname:port/database`

**How to Link:**
```
1. Go to your web service
2. Click "Variables" tab
3. Look for DATABASE_URL
4. If it's NOT there or shows as empty:
   - Click "New Variable"
   - Select "Add a reference"
   - Choose your PostgreSQL service
   - Select DATABASE_URL
```

### 3. **Services in Same Project**
- Both your web app and database **must be in the same Railway project**
- Railway's private networking only works within the same project

### 4. **Database Has Been Deployed**
- Your database service must have completed at least one successful deployment
- Check the database service's deployment logs for errors

### 5. **Check Database Connection String**
You can verify the DATABASE_URL format in Railway:

**Expected format:**
```
postgresql://postgres:PASSWORD@HOSTNAME:5432/railway
```

**Railway uses internal hostnames like:**
```
postgresql://postgres:xxx@postgres.railway.internal:5432/railway
```

---

## 🔧 Quick Fixes to Try

### Fix 1: Redeploy Database Service
1. Go to PostgreSQL service in Railway
2. Click "Redeploy" 
3. Wait for it to become "Active"
4. Then redeploy your web service

### Fix 2: Recreate DATABASE_URL Variable
1. In web service, delete the `DATABASE_URL` variable
2. Click "New Variable" → "Add a reference"
3. Select your PostgreSQL service → DATABASE_URL
4. Redeploy web service

### Fix 3: Use Railway CLI to Check
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Check variables
railway variables

# You should see DATABASE_URL with actual value
```

### Fix 4: Check Database Logs
```
1. Go to PostgreSQL service
2. Click "Deploy Logs"
3. Look for errors like:
   - "Out of memory"
   - "Cannot allocate"
   - "Connection refused"
```

---

## 🚀 Alternative: Use Railway's Public URL (Temporary Test)

If private network isn't working, you can temporarily use the public database URL:

1. Go to PostgreSQL service
2. Click "Settings" → "Networking"  
3. Enable "Public Networking"
4. Copy the public DATABASE_URL
5. In web service, manually set DATABASE_URL to this public URL
6. Redeploy

**⚠️ Security Note:** This is for testing only. Use private networking in production.

---

## 📊 Check Railway Status

Visit: https://status.railway.app/

If there's a platform outage affecting networking or databases, wait for Railway to resolve it.

---

## 🔍 Get Database Connection Details

Add this temporary route to your app to debug:

```typescript
// In app.controller.ts
@Get('/debug/env')
getEnv() {
  const dbUrl = process.env.DATABASE_URL;
  return {
    hasDatabaseUrl: !!dbUrl,
    host: dbUrl ? new URL(dbUrl).hostname : 'not set',
    port: dbUrl ? new URL(dbUrl).port : 'not set',
    database: dbUrl ? new URL(dbUrl).pathname : 'not set',
  };
}
```

Then visit: `https://your-app.railway.app/debug/env`

---

## 💬 Still Not Working?

### Option 1: Railway Discord
Join Railway's Discord server and ask in #help:
https://discord.gg/railway

### Option 2: Railway Support
Open a support ticket in Railway dashboard:
Dashboard → Help → Contact Support

### Option 3: Check Specific Error Pattern
If you see specific patterns like:
- **ECONNRESET on all attempts** = Configuration issue (database not linked)
- **ECONNRESET then success** = Timing issue (our retry logic should handle)
- **ETIMEDOUT** = Network issue (check Railway status)
- **ENOTFOUND** = DNS issue (database hostname not resolving)

---

## ✅ What We've Already Fixed in Code

- ✅ Removed pre-connection checks (let NestJS handle it)
- ✅ Added TypeORM retry logic (10 attempts, 3s delay)
- ✅ Simplified startup script
- ✅ Added proper SSL configuration
- ✅ Set `migrationsRun: true` for auto-migrations
- ✅ Added connection pool settings
- ✅ Added keep-alive configuration

**The code is ready. The issue is now Railway configuration.**

---

## 📧 What to Share if Asking for Help

```
Environment: Railway
Region: europe-west4
Error: ECONNRESET (persistent on all attempts)
DATABASE_URL: [SET/NOT SET]
Database service status: [Active/Failed/Deploying]
Services in same project: [Yes/No]
```

