# Railway Database Connection Fix Guide

## 🚨 Problem Identified

Your Railway deployment is failing with `ECONNRESET` errors because the `DATABASE_URL` environment variable contains **unresolved Railway template syntax** instead of actual values.

### What You're Seeing:

**Database logs show:**
```
DATABASE_URL="postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}"
```

**Application logs show:**
```
[Nest] 9  - 01/05/2026, 8:11:42 PM   ERROR [TypeOrmModule] Unable to connect to the database. Retrying (1)...
Error: read ECONNRESET
```

### What Should Happen:

The `DATABASE_URL` should contain **actual values** like:
```
postgresql://postgres:VSykuoZgPudCssECoHUUgVSEElxgPckV@postgres.railway.internal:5432/railway
```

---

## ✅ Solution: Properly Link Database to Web Service

Follow these steps **exactly** in your Railway dashboard:

### Step 1: Go to Your Web Service

1. Open your Railway project dashboard
2. Click on your **web service** (the one running your NestJS app)
   - **NOT** the PostgreSQL database service
3. Click the **"Variables"** tab

### Step 2: Check Current DATABASE_URL

Look for a variable named `DATABASE_URL`:

- **If it exists and shows template syntax (`${{...}}`):**
  - Click the **trash icon** to delete it
  - Proceed to Step 3

- **If it doesn't exist:**
  - Proceed to Step 3

- **If it exists but shows "Referenced from [PostgreSQL Service]":**
  - This is correct! Your issue might be something else
  - Skip to Step 5

### Step 3: Add DATABASE_URL as a Reference

1. Click **"New Variable"**
2. **IMPORTANT:** Click **"Add a Reference"** (dropdown at top)
   - **DO NOT** click "Add a Variable"
   - **DO NOT** manually type a DATABASE_URL
3. In the "Service" dropdown, select your **PostgreSQL service**
4. In the "Variable" dropdown, select **`DATABASE_URL`**
5. Click **"Add"**

### Step 4: Verify the Reference

After adding, you should see:
- **Variable name:** `DATABASE_URL`
- **Source:** `Referenced from [Your PostgreSQL Service Name]`
- **Value preview:** Should show actual connection string (not `${{...}}`)

### Step 5: Redeploy

1. Click **"Deploy"** or **"Redeploy"** button
2. Wait for the deployment to complete
3. Check the logs

---

## 🔍 Verification Steps

### 1. Check Deployment Logs

After redeploying, your logs should show:
```
DATABASE_URL: SET ✅
[DATABASE] Railway | DATABASE_URL: SET
```

And then successfully connect:
```
[Nest] 9  - LOG [InstanceLoader] TypeOrmModule dependencies initialized +52ms
[Nest] 9  - LOG [RoutesResolver] Application started successfully
```

### 2. Run Diagnostic Tool (Optional)

If you have the Railway CLI installed, you can run:

```bash
# From your local machine
railway link  # Link to your Railway project
railway run npm run railway:diagnose
```

This will test the database connection and show detailed diagnostics.

---

## 🔧 Alternative: Use Railway CLI

If the dashboard method doesn't work, try using the Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Check current variables
railway variables

# Add DATABASE_URL reference (if not already present)
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Deploy
railway up
```

---

## 🚨 Common Mistakes to Avoid

### ❌ DON'T: Manually Enter DATABASE_URL

```
DATABASE_URL=postgresql://postgres:password@host:5432/railway
```

This won't work because the values (password, host) will change if you restart services.

### ❌ DON'T: Use Template Syntax

```
DATABASE_URL=${{PGUSER}}:${{POSTGRES_PASSWORD}}...
```

Railway only resolves references when you use the "Add a Reference" feature.

### ❌ DON'T: Reference from Web Service

```
DATABASE_URL=${{WebService.DATABASE_URL}}
```

The `DATABASE_URL` must come from the **PostgreSQL service**, not your web service.

### ✅ DO: Use Railway's Reference System

```
DATABASE_URL referenced from PostgreSQL service
```

This allows Railway to automatically update the URL if anything changes.

---

## 🐛 Still Not Working?

### Check #1: Services in Same Project

- Your web service and PostgreSQL database **must be in the same Railway project**
- Railway's private networking only works within a single project

### Check #2: Database is Running

1. Go to your PostgreSQL service
2. Check that it shows **"Active"** (green dot)
3. Check deploy logs for any errors

### Check #3: Railway Status

- Visit: https://status.railway.app/
- Check if there are any platform issues

### Check #4: Enable Public Database URL (Temporary Test)

As a **temporary test** to verify your app works:

1. Go to PostgreSQL service → **"Settings"** → **"Networking"**
2. Toggle **"Public Networking"** ON
3. Copy the **"Public DATABASE_URL"**
4. In your web service, temporarily set `DATABASE_URL` to this public URL
5. Redeploy

⚠️ **Security Warning:** Public URLs expose your database to the internet. Use only for testing, then switch back to private networking.

---

## 📊 Understanding Railway's Reference System

When you use "Add a Reference":

```
Web Service Variable:
  DATABASE_URL → References → PostgreSQL.DATABASE_URL

Railway automatically resolves this to:
  postgresql://postgres:[PASSWORD]@[PRIVATE_HOST]:5432/railway
```

Benefits:
- ✅ Automatic updates if database credentials change
- ✅ Uses private networking (faster and secure)
- ✅ No manual configuration needed

When you manually set a variable:

```
Web Service Variable:
  DATABASE_URL = "postgresql://${{PGUSER}}:..."

Railway does NOT resolve ${{...}} syntax
  → Your app sees the literal string "${{PGUSER}}"
  → Connection fails
```

---

## 📝 Summary Checklist

Before redeploying, verify:

- [ ] PostgreSQL service is **Active** (green)
- [ ] Web service and database are in the **same Railway project**
- [ ] `DATABASE_URL` in web service is **Referenced from** PostgreSQL service
- [ ] `DATABASE_URL` shows actual connection string (not `${{...}}`)
- [ ] All other required environment variables are set (JWT_SECRET, etc.)

---

## 💬 Need More Help?

### Railway Discord
Join Railway's Discord and ask in #help:
- https://discord.gg/railway
- Mention: "DATABASE_URL contains unresolved template syntax"

### Railway Support
Open a ticket in Railway dashboard:
- Dashboard → Help → Contact Support

### Provide This Information
```
Issue: DATABASE_URL contains unresolved template syntax
Environment: Railway
Error: ECONNRESET on all database connection attempts
Services: PostgreSQL + NestJS Web Service
Same Project: [Yes/No]
DATABASE_URL Referenced: [Yes/No]
```

---

## ✅ Expected Outcome

After fixing, your deployment should show:

```
========================================
Railway Deployment - Starting App
========================================
DATABASE_URL: SET ✅
PORT: 8080
NODE_ENV: production
========================================

[DATABASE] Railway | DATABASE_URL: SET
[Nest] 9  - LOG [NestFactory] Starting Nest application...
[Nest] 9  - LOG [InstanceLoader] TypeOrmModule dependencies initialized +52ms
[Nest] 9  - LOG [RoutesResolver] ApplicationController {/}:
[Nest] 9  - LOG [RouterExplorer] Mapped {/, GET} route +5ms
[Nest] 9  - LOG [NestApplication] Nest application successfully started +2ms
Application is running on: http://[::]:8080
```

And your health check should pass:

```
====================
Starting Healthcheck
====================
Path: /
Retry window: 5m0s

✅ Healthcheck passed!
```

Good luck! 🚀

