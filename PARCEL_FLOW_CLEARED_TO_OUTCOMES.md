# Parcel Flow: Cleared Deliveries → Delivery Outcomes

## Overview

This document explains the complete flow of parcels from delivery initiation through COD collection, showing how parcels move between the `cleared-deliveries` and `delivery-outcomes` endpoints.

## Complete Flow

### 1. Rider Initiates Delivery
**Endpoint:** `POST /delivery-verifications/parcels/:parcelId/initiate`

**What happens:**
- Rider selects delivery status (DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED)
- Rider enters collected amount
- System sends OTP to merchant/customer for verification
- After OTP verification, parcel status is updated
- **IMPORTANT:** `cod_cleared_at` remains `NULL` (not set yet)

**Parcel State After:**
- Status: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, or RETURNED
- `cod_cleared_at`: NULL
- `payment_status`: COD_COLLECTED (for successful deliveries)
- `cod_collected_amount`: Set to actual collected amount

---

### 2. Parcel Appears in Cleared Deliveries
**Endpoint:** `GET /hubs/parcels/cleared-deliveries?rider_id={uuid}&page=1&limit=10`

**Query Criteria:**
```sql
WHERE parcel.current_hub_id = :hubId
  AND parcel.assigned_rider_id = :riderId
  AND parcel.cod_cleared_at IS NULL          -- ✅ NOT YET CLEARED
  AND parcel.status IN (
    'DELIVERED',
    'PARTIAL_DELIVERY',
    'EXCHANGE'
  )
```

**Purpose:**
- Shows parcels ready for COD collection from rider
- Hub manager can see which parcels need cash collection
- Displays total collectable amount from all pending parcels

**Response Includes:**
- List of completed deliveries awaiting COD collection
- Total collectable amount
- Parcel details (tracking number, merchant, amounts, etc.)

---

### 3. Hub Manager Collects COD
**Endpoint:** `POST /hubs/finance/collect-cod/:rider_id`

**Request Body:**
```json
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid1", "uuid2", "uuid3"],
  "counted_amount": 5000.00
}
```

**What happens:**
- Hub manager counts cash from rider
- System marks all selected parcels with `payment_status = COD_COLLECTED`
- **KEY CHANGE:** Sets `cod_cleared_at = NOW()` on all parcels
- Adds counted amount to hub's available balance
- Updates hub finance records

**Parcel State After:**
- Status: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, or RETURNED (unchanged)
- `cod_cleared_at`: **NOW()** ✅ Set to current timestamp
- `payment_status`: COD_COLLECTED (unchanged)
- `cod_collected_amount`: Unchanged

---

### 4. Parcel Moves to Delivery Outcomes
**Endpoint:** `GET /hubs/parcels/delivery-outcomes?page=1&limit=10`

**Query Criteria:**
```sql
WHERE parcel.current_hub_id = :hubId
  AND parcel.cod_cleared_at IS NOT NULL      -- ✅ ALREADY CLEARED
  AND parcel.status IN (
    'DELIVERED',
    'PARTIAL_DELIVERY',
    'EXCHANGE',
    'PAID_RETURN',
    'RETURNED'
  )
```

**Purpose:**
- Shows parcels AFTER COD has been collected from rider
- Track completed deliveries that have been settled
- Monitor cleared transactions
- Record keeping for settled parcels

**Response Includes:**
- List of all cleared deliveries
- Total amount already collected
- Parcel details with clearance timestamp

---

## Key Field: `cod_cleared_at`

### When NULL (before COD collection):
- Parcel appears in **cleared-deliveries** endpoint
- Indicates COD needs to be collected from rider
- Rider has completed delivery but hasn't cleared cash with hub

### When SET (after COD collection):
- Parcel appears in **delivery-outcomes** endpoint
- Indicates COD has been collected from rider
- Cash has been settled between rider and hub manager
- Transaction is complete

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. Rider Initiates Delivery                                │
│     POST /delivery-verifications/parcels/:id/initiate       │
│                                                              │
│     Result: Parcel status updated                           │
│             cod_cleared_at = NULL                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Parcel in Cleared Deliveries (Awaiting COD Collection)  │
│     GET /hubs/parcels/cleared-deliveries?rider_id={uuid}    │
│                                                              │
│     Shows: Parcels WHERE cod_cleared_at IS NULL             │
│     Purpose: Hub manager sees which riders need to settle   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Hub Manager Collects Cash
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Collect COD from Rider                                  │
│     POST /hubs/finance/collect-cod/:rider_id                │
│                                                              │
│     Action: Sets cod_cleared_at = NOW()                     │
│             Adds cash to hub balance                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Parcel in Delivery Outcomes (Already Cleared)           │
│     GET /hubs/parcels/delivery-outcomes                     │
│                                                              │
│     Shows: Parcels WHERE cod_cleared_at IS NOT NULL         │
│     Purpose: Record keeping, track settled deliveries       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### Parcel Entity Field
```typescript
@Column({ type: 'timestamp', nullable: true })
cod_cleared_at: Date | null; // When rider cleared COD with hub manager
```

**Default:** NULL (when parcel is created or delivery is completed)  
**Set by:** `collectCashFromRider()` method in `hubs.service.ts`  
**Used by:** 
- `getClearedDeliveries()` - filters WHERE `cod_cleared_at IS NULL`
- `getDeliveryOutcomes()` - filters WHERE `cod_cleared_at IS NOT NULL`

---

## API Endpoints Summary

| Endpoint | Shows Parcels With | Purpose |
|----------|-------------------|---------|
| `POST /delivery-verifications/parcels/:id/initiate` | N/A | Rider completes delivery |
| `GET /hubs/parcels/cleared-deliveries` | `cod_cleared_at IS NULL` | Ready for COD collection |
| `POST /hubs/finance/collect-cod/:rider_id` | N/A | Collect cash from rider |
| `GET /hubs/parcels/delivery-outcomes` | `cod_cleared_at IS NOT NULL` | Already cleared deliveries |

---

## Testing the Flow

### Step 1: Complete a delivery as rider
```bash
curl -X POST "http://localhost:3000/delivery-verifications/parcels/{parcelId}/initiate" \
  -H "Authorization: Bearer {rider_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "selected_status": "DELIVERED",
    "collected_amount": 2000.00
  }'
```

### Step 2: Verify OTP and complete
```bash
curl -X POST "http://localhost:3000/delivery-verifications/{verificationId}/verify-otp" \
  -H "Authorization: Bearer {rider_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "otp_code": "1234"
  }'
```

### Step 3: Check cleared-deliveries (should appear here)
```bash
curl -X GET "http://localhost:3000/hubs/parcels/cleared-deliveries?rider_id={riderId}&page=1&limit=10" \
  -H "Authorization: Bearer {hub_manager_token}"
```

**Expected:** Parcel appears in list with `cod_cleared_at: null`

### Step 4: Collect COD from rider
```bash
curl -X POST "http://localhost:3000/hubs/finance/collect-cod/{riderId}" \
  -H "Authorization: Bearer {hub_manager_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "rider_id": "{riderId}",
    "parcel_ids": ["{parcelId}"],
    "counted_amount": 2000.00
  }'
```

### Step 5: Check delivery-outcomes (should appear here now)
```bash
curl -X GET "http://localhost:3000/hubs/parcels/delivery-outcomes?page=1&limit=10" \
  -H "Authorization: Bearer {hub_manager_token}"
```

**Expected:** Parcel appears in list with `cod_cleared_at: "2026-02-01T10:30:00Z"`

### Step 6: Verify parcel disappeared from cleared-deliveries
```bash
curl -X GET "http://localhost:3000/hubs/parcels/cleared-deliveries?rider_id={riderId}&page=1&limit=10" \
  -H "Authorization: Bearer {hub_manager_token}"
```

**Expected:** Parcel should NOT appear here anymore

---

## Code Locations

### Controllers
- [hubs.controller.ts](src/hubs/hubs.controller.ts) - Lines 150-230 (endpoints)

### Services
- [parcels.service.ts](src/parcels/parcels.service.ts):
  - `getDeliveryOutcomes()` - Line ~3280
  - `getRiderClearedParcels()` - Line ~3390
- [hubs.service.ts](src/hubs/hubs.service.ts):
  - `collectCashFromRider()` - Line ~1307
- [delivery-verifications.service.ts](src/delivery-verifications/delivery-verifications.service.ts):
  - `initiateDelivery()` - Line ~48
  - `completeDelivery()` - Line ~524

### Entities
- [parcel.entity.ts](src/parcels/entities/parcel.entity.ts) - Line ~263 (`cod_cleared_at` field)

---

## Important Notes

1. **Status vs Clearance:**
   - Parcel `status` changes when delivery is completed (DELIVERED, etc.)
   - `cod_cleared_at` is set later when hub manager collects cash
   - These are independent fields tracking different stages

2. **Payment Status:**
   - `payment_status = COD_COLLECTED` is set when delivery completes
   - This indicates rider collected money from customer
   - `cod_cleared_at` indicates rider settled with hub manager

3. **Successful Delivery Statuses:**
   - DELIVERED - Full successful delivery
   - PARTIAL_DELIVERY - Some items delivered
   - EXCHANGE - Items exchanged with customer
   - PAID_RETURN - Customer paid return fee
   - RETURNED - Full return (no COD)

4. **Filtering Logic:**
   - **cleared-deliveries:** WHERE `cod_cleared_at IS NULL` (pending collection)
   - **delivery-outcomes:** WHERE `cod_cleared_at IS NOT NULL` (already collected)

---

## Migration

The `cod_cleared_at` field was added in migration:
- File: `src/migrations/20260201012808-AddCodClearedAtToParcel.ts`
- Column: `cod_cleared_at TIMESTAMP NULL`
- Index: Created for better query performance
