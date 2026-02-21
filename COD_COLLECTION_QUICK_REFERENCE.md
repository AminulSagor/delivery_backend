# Quick Reference: COD Collection System

## Changes Summary

### 1. Database
- Added `cod_cleared_at` timestamp to `parcels` table
- Run migration: `npm run migration:run`

### 2. COD Collection Endpoint (Modified)
```
POST /hubs/finance/collect-cod
```

**Before:**
```json
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2"],
  "cash_received": 5000,
  "discrepancy_amount": 100,
  "due_amount": 50,
  "notes": "Some notes"
}
```

**After (Simplified):**
```json
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2"],
  "counted_amount": 5000
}
```

**What Changed:**
- ✅ Only accepts `counted_amount` (what hub manager physically counted)
- ✅ Amount goes directly to hub's available balance
- ✅ Sets `cod_cleared_at` timestamp on parcels
- ❌ No more discrepancy/due tracking
- ❌ No more settlement records

### 3. New Endpoint: Cleared Deliveries
```
GET /hubs/parcels/cleared-deliveries?rider_id={uuid}&page=1&limit=10
```

**Purpose:** View parcels AFTER rider cleared COD

**Shows:**
- Only parcels where `cod_cleared_at IS NOT NULL`
- Completed deliveries (DELIVERED, PARTIAL_DELIVERY, EXCHANGE)
- Total collectable amount from all cleared parcels
- Per-rider filtering

**Before COD clearance:** Parcels don't appear here
**After COD clearance:** Parcels appear here

### 4. Enhanced Endpoint: Delivery Outcomes
```
GET /hubs/parcels/delivery-outcomes?page=1&limit=10
```

**What's New:**
- Returns `summary.total_collectable_amount`
- Shows COD from completed deliveries NOT yet cleared
- Only counts parcels where `cod_cleared_at IS NULL`

## Quick Test Flow

1. **Check uncollected COD:**
```bash
GET /hubs/parcels/delivery-outcomes
# Response includes: summary.total_collectable_amount
```

2. **Collect COD from rider:**
```bash
POST /hubs/finance/collect-cod
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2"],
  "counted_amount": 5000
}
# Hub balance immediately increases by 5000
# Parcels marked with cod_cleared_at timestamp
```

3. **View cleared parcels:**
```bash
GET /hubs/parcels/cleared-deliveries?rider_id=uuid
# Shows parcels from step 2 with cod_cleared_at set
# Returns total of all cleared amounts
```

## API Endpoints Summary

| Endpoint | Method | Purpose | When to Use |
|----------|--------|---------|-------------|
| `/hubs/finance/collect-cod` | POST | Collect COD from rider | When rider hands over cash |
| `/hubs/parcels/delivery-outcomes` | GET | View pending COD collections | To see what needs collection |
| `/hubs/parcels/cleared-deliveries` | GET | View cleared parcels | After collecting COD |

## Data Flow

```
Rider Completes Delivery
   ↓
Parcel: cod_cleared_at = NULL
   ↓
Appears in: /hubs/parcels/delivery-outcomes
   ↓
Hub Manager Collects COD
   ↓
POST /hubs/finance/collect-cod
   ↓
Parcel: cod_cleared_at = NOW()
Hub Balance += counted_amount
   ↓
Appears in: /hubs/parcels/cleared-deliveries
```

## Migration Command

```bash
# Development
npm run migration:run

# Production (Railway/other)
npx typeorm migration:run -d dist/data-source.js
```

## Files Modified

1. `src/parcels/entities/parcel.entity.ts` - Added cod_cleared_at field
2. `src/hubs/dto/collect-cod.dto.ts` - Simplified to counted_amount only
3. `src/hubs/hubs.service.ts` - Simplified collectCashFromRider logic
4. `src/parcels/parcels.service.ts` - Added getRiderClearedParcels + enhanced getDeliveryOutcomes
5. `src/hubs/hubs.controller.ts` - Added GET /hubs/parcels/cleared-deliveries endpoint

## Files Created

1. `src/migrations/20260201012808-AddCodClearedAtToParcel.ts` - Database migration
2. `COD_COLLECTION_CLEARED_DELIVERIES.md` - Full documentation
3. `COD_COLLECTION_QUICK_REFERENCE.md` - This file
