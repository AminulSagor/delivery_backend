# 🚀 Railway PostgreSQL Configuration for Local Development

## ✅ Configuration Complete!

Your `.env` file has been updated to use Railway PostgreSQL database instead of local PostgreSQL.

---

## 📋 Next Steps - Get Your Railway TCP Proxy Port

Your `.env` file currently has `YOUR_TCP_PROXY_PORT` as a placeholder. You need to replace it with the actual port from Railway.

### **How to Find Your TCP Proxy Port:**

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Login to your account

2. **Select Your PostgreSQL Service**
   - Click on your PostgreSQL database service
   - Go to the **"Connect"** tab

3. **Find the TCP Proxy Port**
   - Look for **"TCP Proxy"** section
   - You'll see a connection string like:
     ```
     postgresql://postgres:xxx@autorack.proxy.rlwy.net:12345/railway
     ```
   - The port is the number after the last `:` (e.g., `12345`)

4. **Update Your .env File**
   - Replace `YOUR_TCP_PROXY_PORT` with the actual port number
   - Example:
     ```bash
     # Before
     DATABASE_URL=postgresql://postgres:LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN@autorack.proxy.rlwy.net:YOUR_TCP_PROXY_PORT/railway
     
     # After (with actual port, e.g., 12345)
     DATABASE_URL=postgresql://postgres:LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN@autorack.proxy.rlwy.net:12345/railway
     ```

---

## 🔧 Configuration Details

### **Current Railway Database Settings:**

```bash
Host: autorack.proxy.rlwy.net (TCP Proxy - for external connections)
Port: YOUR_TCP_PROXY_PORT (Get from Railway Dashboard)
User: postgres
Password: LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN
Database: railway
```

### **What Changed:**

1. ✅ **DATABASE_URL** set to Railway PostgreSQL (via TCP Proxy)
2. ✅ **Individual connection params** (PGHOST, PGPORT, etc.) updated
3. ✅ **SSL enabled** in `data-source.ts` (already configured for Railway)
4. ✅ **Connection pooling** optimized for Railway limits
5. ✅ **Old local database config** commented out

---

## 🚀 How to Start Development

### **1. Update the TCP Proxy Port**
```bash
# Open .env file
# Replace YOUR_TCP_PROXY_PORT with actual port from Railway

# Example:
DATABASE_URL=postgresql://postgres:LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN@autorack.proxy.rlwy.net:12345/railway
PGPORT=12345
```

### **2. Install Dependencies (if needed)**
```bash
npm install
```

### **3. Start the Development Server**
```bash
npm run start:dev
```

### **4. Verify Connection**
You should see logs like:
```
[DATABASE] Railway | DATABASE_URL: SET
Database Host: autorack.proxy.rlwy.net
Database Port: 12345
Database Name: railway
Database User: postgres
✅ Database connection established
```

---

## 🔍 How Your App Connects to Railway

Your `data-source.ts` is already configured to:

1. **Detect DATABASE_URL** environment variable
2. **Enable SSL** automatically for Railway connections
3. **Use Railway-optimized settings**:
   - Small connection pool (max: 5)
   - Short timeouts (5s connection, 30s idle)
   - SSL with `rejectUnauthorized: false`

### **Connection Flow:**

```typescript
// In data-source.ts (already configured)
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  // Use Railway DATABASE_URL
  config = {
    url: databaseUrl,
    ssl: { rejectUnauthorized: false },
    extra: {
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  };
}
```

---

## 📊 Database Migration

Your app uses **automatic synchronization** (no manual migrations needed):

```typescript
// In data-source.ts
synchronize: true  // Auto-creates/updates tables
```

**This means:**
- ✅ Tables automatically created on startup
- ✅ Schema updates applied automatically
- ✅ No need to run migrations manually
- ⚠️ **Not recommended for production** (but OK for development)

---

## 🛠️ Troubleshooting

### **Issue: Connection Timeout**

**Cause:** Wrong TCP Proxy Port or Railway service is down

**Fix:**
1. Verify the port in Railway Dashboard
2. Check Railway service status
3. Ensure your IP is not blocked

### **Issue: SSL Connection Error**

**Cause:** SSL configuration mismatch

**Fix:** Already configured in `data-source.ts`:
```typescript
ssl: { rejectUnauthorized: false }
```

### **Issue: Database Not Found**

**Cause:** Wrong database name

**Fix:** Ensure `PGDATABASE=railway` in `.env`

### **Issue: Authentication Failed**

**Cause:** Wrong password

**Fix:** Verify password matches Railway dashboard:
```bash
PGPASSWORD=LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN
```

---

## 📝 Alternative: Using Railway CLI

You can also use Railway CLI to automatically inject environment variables:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run with Railway environment
railway run npm run start:dev
```

**Benefits:**
- Automatically uses Railway environment variables
- No need to manually copy DATABASE_URL
- Always up-to-date with Railway configuration

---

## 🔐 Security Notes

1. **Password in .env**: Your Railway password is committed. Consider:
   - Adding `.env` to `.gitignore` (should already be there)
   - Rotating password if exposed in git history

2. **TCP Proxy vs Private Network**:
   - TCP Proxy: For external connections (your local machine) ✅ You're using this
   - Private Network: For Railway service-to-service communication

3. **SSL Enabled**: Your connection is encrypted via SSL

---

## 📋 Quick Reference

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Full connection string | Primary connection method |
| `PGHOST` | `autorack.proxy.rlwy.net` | Railway TCP Proxy host |
| `PGPORT` | Get from Railway | TCP Proxy port |
| `PGUSER` | `postgres` | Database user |
| `PGPASSWORD` | `LmpWoIiybvBoGBnRUZbyOzWYlFWsAekN` | Database password |
| `PGDATABASE` | `railway` | Database name |

---

## ✅ Checklist

- [ ] Get TCP Proxy Port from Railway Dashboard
- [ ] Update `DATABASE_URL` in `.env` with actual port
- [ ] Update `PGPORT` in `.env` with actual port
- [ ] Run `npm run start:dev`
- [ ] Verify connection logs show "Railway | DATABASE_URL: SET"
- [ ] Test API endpoints to ensure database is working

---

## 🎯 Summary

Your NestJS application is now configured to use Railway PostgreSQL for local development:

✅ **Railway connection** configured  
✅ **SSL enabled** for secure connection  
✅ **Connection pooling** optimized  
✅ **Auto-sync** enabled for schema updates  
✅ **Old local database** preserved (commented out)  

**Next:** Get your TCP Proxy Port from Railway and update `.env`

---

**Need Help?** Check Railway documentation:
- https://docs.railway.app/databases/postgresql
- https://docs.railway.app/deploy/exposing-your-app
