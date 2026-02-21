# COD Collection & Cleared Deliveries Implementation

## Overview

This implementation provides a streamlined COD collection system where hub managers can:
1. Collect COD from riders with a simple counted amount
2. View cleared deliveries after COD collection
3. Track total collectable amounts from completed deliveries

## Key Changes

### 1. Database Schema Changes

#### Parcels Table
- **New Column**: `cod_cleared_at` (timestamp, nullable)
  - Tracks when rider cleared COD with hub manager
  - Used to filter parcels that have completed COD clearance
  - Indexed for better query performance

### 2. API Endpoints

#### A. Collect COD from Rider
```
POST /hubs/finance/collect-cod
Role: HUB_MANAGER
```

**Request Body:**
```json
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2", "uuid3"],
  "counted_amount": 5000.00
}
```

**What it does:**
- Accepts only the counted amount from hub manager
- Adds the counted amount directly to hub's available balance
- Marks all selected parcels with `payment_status = COD_COLLECTED`
- Sets `cod_cleared_at` timestamp on all parcels
- Updates hub finance balance immediately

**Response:**
```json
{
  "success": true,
  "message": "Cash collected successfully",
  "data": {
    "rider_id": "uuid",
    "parcel_count": 3,
    "counted_amount": 5000.00,
    "cod_cleared_at": "2026-02-01T10:30:00Z",
    "current_balance": 25000.00
  }
}
```

#### B. Get Cleared Deliveries
```
GET /hubs/parcels/cleared-deliveries?rider_id={uuid}&page=1&limit=10
Role: HUB_MANAGER
```

**Query Parameters:**
- `rider_id` (required): UUID of the rider
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 10, max 100

**What it does:**
- Shows parcels AFTER rider has cleared COD (cod_cleared_at IS NOT NULL)
- Only shows completed deliveries: DELIVERED, PARTIAL_DELIVERY, EXCHANGE
- Returns total collectable amount from all cleared parcels
- Filtered by specific rider and hub

**Response:**
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "parcel_id": "uuid",
        "tracking_number": "TRK123456",
        "status": "DELIVERED",
        "destination": {
          "address": "123 Main St",
          "zone": "Dhaka, Mirpur"
        },
        "merchant": {
          "name": "Store ABC",
          "phone": "+8801712345678"
        },
        "cod": {
          "total_charge": 120.00,
          "delivery_charge": 60.00,
          "cod_charge": 20.00,
          "weight_charge": 40.00,
          "cod_amount": 2000.00,
          "collected_amount": 2000.00
        },
        "age": {
          "display": "2 days 3h",
          "created_at": "2026-01-30T08:00:00Z",
          "updated_at": "2026-02-01T10:30:00Z"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    },
    "summary": {
      "total_collectable_amount": 45000.00,
      "total_cleared_parcels": 25
    }
  },
  "message": "Cleared deliveries retrieved successfully"
}
```

#### C. Get Delivery Outcomes (Enhanced)
```
GET /hubs/parcels/delivery-outcomes?page=1&limit=10
Role: HUB_MANAGER
```

**What it does:**
- Shows parcels with delivery outcomes (PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED)
- Now includes `summary.total_collectable_amount` - shows total COD from completed deliveries that haven't been cleared yet
- Only counts DELIVERED, PARTIAL_DELIVERY, EXCHANGE statuses
- Only counts parcels where `cod_cleared_at IS NULL`

**Response:**
```json
{
  "success": true,
  "data": {
    "parcels": [...],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    },
    "summary": {
      "total_collectable_amount": 12500.00
    }
  },
  "message": "Delivery outcomes retrieved successfully"
}
```

## Workflow

### Hub Manager Perspective

1. **View Uncollected COD**
   - Use `/hubs/parcels/delivery-outcomes` to see all completed deliveries
   - Check `summary.total_collectable_amount` to know how much to collect
   - These parcels have `cod_cleared_at = NULL`

2. **Collect COD from Rider**
   - Select rider and their completed parcels
   - Count the physical cash
   - POST to `/hubs/finance/collect-cod` with only the counted amount
   - System immediately:
     - Adds counted amount to hub's available balance
     - Marks parcels as `COD_COLLECTED`
     - Sets `cod_cleared_at` timestamp

3. **View Cleared Parcels**
   - Use `/hubs/parcels/cleared-deliveries?rider_id={uuid}` to see what's been cleared
   - Shows only parcels where `cod_cleared_at IS NOT NULL`
   - Before clearance, parcels won't appear here
   - After clearance, parcels move from "delivery-outcomes" to "cleared-deliveries"

### Data Flow

```
1. Rider completes delivery
   └─> Parcel status = DELIVERED
   └─> cod_collected_amount = actual amount collected
   └─> payment_status = UNPAID
   └─> cod_cleared_at = NULL

2. Hub manager views delivery outcomes
   └─> GET /hubs/parcels/delivery-outcomes
   └─> Shows parcels with cod_cleared_at = NULL
   └─> Returns total_collectable_amount

3. Hub manager collects COD
   └─> POST /hubs/finance/collect-cod
   └─> Input: counted_amount only
   └─> System sets cod_cleared_at = NOW()
   └─> System sets payment_status = COD_COLLECTED
   └─> Hub balance += counted_amount

4. Hub manager views cleared deliveries
   └─> GET /hubs/parcels/cleared-deliveries?rider_id={uuid}
   └─> Shows parcels with cod_cleared_at IS NOT NULL
   └─> Returns total of all cleared amounts
```

## Code Changes

### Modified Files

1. **src/parcels/entities/parcel.entity.ts**
   - Added `cod_cleared_at: Date | null` field

2. **src/hubs/dto/collect-cod.dto.ts**
   - Changed `cash_received` to `counted_amount`
   - Removed `discrepancy_amount`, `due_amount` fields (simplified)

3. **src/hubs/hubs.service.ts**
   - `collectCashFromRider()` simplified:
     - Takes only counted_amount
     - Adds directly to hub balance
     - Sets cod_cleared_at timestamp
     - No settlement record creation

4. **src/parcels/parcels.service.ts**
   - `getDeliveryOutcomes()` enhanced:
     - Calculates total_collectable_amount
     - Only counts parcels where cod_cleared_at IS NULL
   - New method `getRiderClearedParcels()`:
     - Shows cleared parcels for specific rider
     - Returns total collectable amount

5. **src/hubs/hubs.controller.ts**
   - New endpoint: `GET /hubs/parcels/cleared-deliveries`
   - Updated: `GET /hubs/parcels/delivery-outcomes` response includes summary

### New Files

1. **src/migrations/20260201012808-AddCodClearedAtToParcel.ts**
   - Adds `cod_cleared_at` column to parcels table
   - Creates index for better performance

## Migration

Run the migration to add the new column:

```bash
npm run migration:run
```

Or using TypeORM CLI:
```bash
npx typeorm migration:run -d dist/data-source.js
```

## Testing

### Test COD Collection
```bash
# 1. Collect COD
curl -X POST http://localhost:3000/hubs/finance/collect-cod \
  -H "Authorization: Bearer {hub_manager_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "rider_id": "rider-uuid",
    "parcel_ids": ["parcel1", "parcel2"],
    "counted_amount": 5000.00
  }'

# 2. View cleared deliveries
curl -X GET "http://localhost:3000/hubs/parcels/cleared-deliveries?rider_id=rider-uuid&page=1&limit=10" \
  -H "Authorization: Bearer {hub_manager_token}"

# 3. View pending deliveries
curl -X GET "http://localhost:3000/hubs/parcels/delivery-outcomes?page=1&limit=10" \
  -H "Authorization: Bearer {hub_manager_token}"
```

## Key Features

✅ **Simplified COD Collection** - Hub manager only enters counted amount
✅ **Immediate Balance Update** - Amount added to hub's available balance instantly
✅ **Clear Separation** - Parcels move from "pending" to "cleared" after COD collection
✅ **Total Collectable Tracking** - Always shows how much COD is available to collect
✅ **Rider-Specific View** - See cleared parcels per rider
✅ **Timestamp Tracking** - Know exactly when COD was cleared

## Important Notes

- Before COD clearance: `cod_cleared_at = NULL` → Shows in delivery-outcomes
- After COD clearance: `cod_cleared_at = timestamp` → Shows in cleared-deliveries
- Total collectable amount only counts successful deliveries (DELIVERED, PARTIAL_DELIVERY, EXCHANGE)
- Hub balance is updated immediately when COD is collected
- System no longer creates settlement records (simplified approach)
