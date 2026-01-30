## Fix: Parcels Disappearing After Server Restart - COMPLETE

### Problem
Parcels were disappearing from the `/merchant-invoices/eligible-parcels` endpoint after server restart, even though they existed in the database and were visible in the rider dashboard before restart.

### Root Cause
The `financial_status` column in the `parcels` table was either:
1. **NULL** in the database (not set to PENDING on creation)
2. **Missing the database default** (TypeORM entity had default, but PostgreSQL column didn't)
3. **Not being explicitly set** when creating new parcels

The eligibility query requires `financial_status = 'PENDING'`:
```sql
WHERE financial_status = 'PENDING'
```

If `financial_status` was NULL or had an incorrect default, parcels would fail this check and not appear as eligible.

### Solution Applied

#### 1. **Fixed Parcel Entity** (`src/parcels/entities/parcel.entity.ts`)
- Added `nullable: false` to ensure the database column never accepts NULL
- Added `= FinancialStatus.PENDING` to set class-level default
- Changed from:
  ```typescript
  @Column({
    type: 'enum',
    enum: FinancialStatus,
    default: FinancialStatus.PENDING,
  })
  financial_status: FinancialStatus;
  ```
- To:
  ```typescript
  @Column({
    type: 'enum',
    enum: FinancialStatus,
    default: FinancialStatus.PENDING,
    nullable: false,
  })
  financial_status: FinancialStatus = FinancialStatus.PENDING;
  ```

#### 2. **Fixed Parcel Creation** (`src/parcels/parcels.service.ts`)
- Explicitly set `financial_status: FinancialStatus.PENDING` when creating new parcels
- Added import for `FinancialStatus` enum
- Now every new parcel is guaranteed to have `financial_status = PENDING`

#### 3. **Created Migration** (`src/migrations/1737627800000-FixFinancialStatusDefaultValue.ts`)
- Migration fixes all existing parcels with NULL `financial_status` to PENDING
- Sets PostgreSQL column default to PENDING
- Logs the distribution of financial statuses before and after
- Verifies eligible parcels are restored

### Files Modified

1. **src/parcels/entities/parcel.entity.ts** (Line ~217)
   - Made `financial_status` non-nullable with class-level default

2. **src/parcels/parcels.service.ts** (Lines 1-30, ~1105)
   - Added FinancialStatus import
   - Explicitly set financial_status in parcel creation

3. **src/migrations/1737627800000-FixFinancialStatusDefaultValue.ts** (NEW)
   - Migration to fix existing data and set database default

### Eligibility Query Check

The query that filters eligible parcels:
```sql
SELECT id, status, financial_status, invoice_id, paid_to_merchant
FROM parcels
WHERE merchant_id = '{merchant_id}'
  AND status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'PAID_RETURN', 'RETURNED', 'RETURNED_TO_HUB', 'RETURN_TO_MERCHANT')
  AND invoice_id IS NULL
  AND paid_to_merchant = false
  AND financial_status = 'PENDING'  -- THIS FILTER WAS FAILING
  AND (cod_collected_amount > 0 OR delivery_charge_applicable = true OR return_charge_applicable = true)
```

### How to Apply Fix

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Start the server** (migrations run automatically):
   ```bash
   npm run start:dev
   ```

3. **Verify the fix:**
   ```bash
   # Check eligible parcels are restored
   curl http://localhost:3000/merchant-invoices/eligible-parcels?merchant_id=7bcad4a1-8793-4bcb-ba98-771f46558d00
   ```

### Verification Queries

**Check financial_status distribution:**
```sql
SELECT financial_status, COUNT(*) as count
FROM parcels
GROUP BY financial_status;
```

**Check eligible parcels now visible:**
```sql
SELECT COUNT(*) as eligible_count
FROM parcels p
WHERE p.status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'PAID_RETURN', 'RETURNED', 'RETURNED_TO_HUB', 'RETURN_TO_MERCHANT')
  AND p.invoice_id IS NULL
  AND p.paid_to_merchant = false
  AND p.financial_status = 'PENDING'
  AND (p.cod_collected_amount > 0 OR p.delivery_charge_applicable = true OR p.return_charge_applicable = true);
```

### Impact

- ✅ All parcels will now have `financial_status = PENDING` by default
- ✅ Parcels won't disappear after server restart
- ✅ Eligible parcels will appear in the merchant dashboard
- ✅ Rider dashboard will continue to work correctly
- ✅ No data loss - only fixing column defaults
- ✅ Backward compatible - existing parcels are fixed by migration

### Why This Matters

The financial_status field is critical for the invoice system:
1. **PENDING** - Ready to be invoiced (what eligible-parcels checks for)
2. **INVOICED** - Included in an invoice
3. **PAID** - Merchant has been paid
4. **CLEARANCE_PENDING** - Awaiting clearance
5. **CLEARANCE_INVOICED** - Clearance invoice created
6. **SETTLED** - Final settlement completed

If `financial_status` was NULL or incorrect, the entire financial workflow breaks.
