# Railway Deployment Guide

## Quick Deploy Steps

### 1. Create Railway Project
```bash
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in this directory
railway init
```

### 2. Add PostgreSQL Service
1. Go to your Railway dashboard
2. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
3. Wait for the database to provision

### 3. Set Environment Variables
In Railway dashboard, go to your **service** (not database) → **Variables** and add:

```env
# Required - Railway will auto-populate these from your PostgreSQL service
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Application Settings
NODE_ENV=production
PORT=3000

# JWT Settings (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this
JWT_REFRESH_EXPIRES_IN=7d

# SMS Provider (if using)
SMS_API_KEY=your-sms-api-key
SMS_SENDER_ID=your-sender-id

# Email Settings (if using)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Carrybee API (if using)
CARRYBEE_API_URL=https://api.carrybee.com
CARRYBEE_API_KEY=your-carrybee-api-key
```

### 4. Deploy
```bash
# Deploy to Railway
railway up
```

Or connect your GitHub repo for automatic deployments.

---

## Environment Variables Reference

### Database (Railway PostgreSQL)
Railway automatically provides these when you link a PostgreSQL service:
- `DATABASE_URL` - Full connection string (use this)
- `PGHOST` - Database host
- `PGPORT` - Database port (5432)
- `PGUSER` - Database user (postgres)
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name (railway)

### Your Railway PostgreSQL Config
```env
DATABASE_URL=postgresql://postgres:VSykuoZgPudCssECoHUUgVSEElxgPckV@<RAILWAY_PRIVATE_DOMAIN>:5432/railway
POSTGRES_DB=railway
POSTGRES_PASSWORD=VSykuoZgPudCssECoHUUgVSEElxgPckV
POSTGRES_USER=postgres
```

---

## Local Development Setup

Create a `.env` file in project root:

```env
# Local PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=courier_db

# Development mode
NODE_ENV=development

# JWT
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=dev-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
```

---

## Files Created for Railway

| File | Purpose |
|------|---------|
| `railway.json` | Railway deployment configuration |
| `Procfile` | Process definition for Railway |
| `nixpacks.toml` | Nixpacks build configuration |

---

## Database Migrations

Migrations run automatically on deploy via `railway.json` start command.

To run manually:
```bash
# On Railway (via CLI)
railway run npm run typeorm:migrate:prod

# Locally
npm run typeorm:migrate
```

---

## Troubleshooting

### Connection Issues
1. Ensure `DATABASE_URL` is set correctly
2. Check if PostgreSQL service is running
3. Verify SSL is enabled (handled automatically)

### Build Failures
```bash
# Check build logs
railway logs
```

### Migration Issues
```bash
# Revert last migration
railway run npm run typeorm:revert
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Railway                         │
│  ┌─────────────┐       ┌──────────────────────┐ │
│  │  PostgreSQL │◄──────│   NestJS Backend     │ │
│  │   Service   │       │   (Your App)         │ │
│  │             │       │                      │ │
│  │ Port: 5432  │       │ Port: 3000           │ │
│  └─────────────┘       └──────────────────────┘ │
│        │                        │               │
│        └──── Private Network ───┘               │
└─────────────────────────────────────────────────┘
                      │
                      ▼
              Public Internet
              (Your API URL)
```

---

## Useful Commands

```bash
# View logs
railway logs

# Open Railway dashboard
railway open

# Run command on Railway
railway run <command>

# Check status
railway status

# Connect to Railway shell
railway shell
```
