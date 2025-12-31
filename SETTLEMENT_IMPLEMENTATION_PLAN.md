# Hub Manager Rider Settlement Flow - Implementation Plan

## 📋 Overview

This document outlines the implementation plan for the **Hub Manager Rider Settlement Flow**, which allows Hub Managers to manage cash settlements with riders at the hub level.

---

## 🎯 Requirements Summary

### Functional Requirements

1. **Hub Manager selects a rider** from the hub's rider list
2. **System displays rider settlement details**:
   - Rider profile information
   - Total collected amount (from completed deliveries)
   - Total completed deliveries count
   - Previous due amount (if any)
3. **Hub Manager enters cash received** from rider
4. **System calculates discrepancy**:
   - Discrepancy = Total collected amount - Cash received
5. **System updates and displays current due amount** in real-time

---

## 🗄️ Database Design

### New Table: `rider_settlements`

```sql
CREATE TABLE rider_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  hub_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  
  -- Settlement Period
  settlement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Financial Details
  total_collected_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cash_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discrepancy_amount DECIMAL(10, 2) GENERATED ALWAYS AS (total_collected_amount - cash_received) STORED,
  
  -- Due Amount Tracking
  previous_due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  current_due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Delivery Statistics
  total_completed_deliveries INTEGER NOT NULL DEFAULT 0,
  
  -- Settlement Status
  settlement_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, DISPUTED
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_rider_settlements_rider_id (rider_id),
  INDEX idx_rider_settlements_hub_id (hub_id),
  INDEX idx_rider_settlements_settlement_date (settlement_date)
);
```

### Add to `riders` table (optional enhancement)

```sql
ALTER TABLE riders ADD COLUMN current_due_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE riders ADD COLUMN last_settlement_date TIMESTAMP;
```

---

## 📁 File Structure

```
src/
├── hubs/
│   ├── entities/
│   │   ├── hub.entity.ts
│   │   ├── hub-manager.entity.ts
│   │   └── rider-settlement.entity.ts (NEW)
│   ├── dto/
│   │   ├── create-hub.dto.ts
│   │   ├── update-hub.dto.ts
│   │   ├── record-cash-received.dto.ts (NEW)
│   │   └── settlement-query.dto.ts (NEW)
│   ├── hubs.controller.ts (UPDATE - add settlement endpoints)
│   ├── hubs.service.ts (UPDATE - add settlement methods)
│   └── hubs.module.ts (UPDATE - add RiderSettlement entity)
└── migrations/
    └── [timestamp]-CreateRiderSettlementsTable.ts
```

**Note**: Settlement functionality will be added to the existing `hubs` module, following the pattern of other Hub Manager operations (like `/hubs/parcels/*` endpoints).

---

## 🔧 Implementation Steps

### Step 1: Create Rider Settlement Entity

**File**: `src/settlements/entities/rider-settlement.entity.ts`

- Define TypeORM entity with all settlement fields
- Add relationships to Rider, Hub, and User (hub manager)
- Include enums for settlement status
- Add indexes for performance

**Key Fields**:
- `rider_id`, `hub_id`, `hub_manager_id`
- `total_collected_amount`, `cash_received`
- `discrepancy_amount` (generated column)
- `previous_due_amount`, `current_due_amount`
- `total_completed_deliveries`
- `settlement_status`, `notes`

---

### Step 2: Create Database Migration

**File**: `src/migrations/[timestamp]-CreateRiderSettlementsTable.ts`

- Create `rider_settlements` table
- Add foreign key constraints
- Add indexes
- Optionally add `current_due_amount` to `riders` table

---

### Step 3: Create DTOs

#### 3.1 Get Rider Settlement DTO
**File**: `src/settlements/dto/get-rider-settlement.dto.ts`

```typescript
// Response DTO for rider settlement details
export class RiderSettlementDetailsDto {
  rider: {
    id: string;
    full_name: string;
    phone: string;
    // ... other rider profile fields
  };
  total_collected_amount: number;
  total_completed_deliveries: number;
  previous_due_amount: number;
  current_due_amount: number;
  // ... other fields
}
```

#### 3.2 Record Cash Received DTO
**File**: `src/settlements/dto/record-cash-received.dto.ts`

```typescript
export class RecordCashReceivedDto {
  @IsNumber()
  @IsPositive()
  @Min(0)
  cash_received: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

#### 3.3 Settlement Query DTO
**File**: `src/settlements/dto/settlement-query.dto.ts`

```typescript
export class SettlementQueryDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsEnum(SettlementStatus)
  status?: SettlementStatus;
}
```

---

### Step 4: Update Hubs Service (Add Settlement Methods)

**File**: `src/hubs/hubs.service.ts`

#### Add Settlement Methods:

1. **`getHubRiders(hubId: string)`**
   - Get list of riders assigned to hub
   - Include basic rider info
   - Return simplified list for selection

2. **`getRiderSettlementDetails(riderId: string, hubId: string)`**
   - Get rider profile information
   - Calculate total collected amount from delivery verifications:
     ```sql
     SELECT SUM(collected_amount) 
     FROM delivery_verifications 
     WHERE rider_id = ? 
     AND verification_status = 'COMPLETED'
     AND delivery_completed_at >= (last settlement date or rider creation)
     ```
   - Count completed deliveries:
     ```sql
     SELECT COUNT(*) 
     FROM delivery_verifications 
     WHERE rider_id = ? 
     AND verification_status = 'COMPLETED'
     AND selected_status IN ('DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'PAID_RETURN')
     ```
   - Get previous due amount from last settlement or rider's `current_due_amount`
   - Return comprehensive settlement details

3. **`calculateDiscrepancy(riderId: string, hubId: string, cashReceived: number)`**
   - Get total collected amount
   - Get previous due amount
   - Calculate: `discrepancy = totalCollected - cashReceived`
   - Calculate: `currentDue = previousDue + discrepancy`
   - Return discrepancy and current due amount

4. **`recordCashReceived(riderId: string, hubId: string, hubManagerId: string, cashReceived: number, notes?: string)`**
   - Get rider settlement details
   - Calculate discrepancy and current due
   - Create settlement record
   - Update rider's `current_due_amount` (if added to riders table)
   - Return settlement record with calculated values

5. **`getRiderSettlementHistory(riderId: string, hubId: string, query?: SettlementQueryDto)`**
   - Get historical settlements for a rider
   - Support date range filtering
   - Support status filtering
   - Pagination support

---

### Step 5: Update Hubs Controller (Add Settlement Endpoints)

**File**: `src/hubs/hubs.controller.ts`

#### New Endpoints (following existing pattern):

1. **`GET /hubs/riders`** (Hub Manager only)
   - Get list of riders in hub for settlement selection
   - Returns: `{ success: true, data: { riders: [{ id, full_name, phone, ... }] } }`
   - Follows pattern: `/hubs/parcels/*`

2. **`GET /hubs/riders/:riderId/settlement`** (Hub Manager only)
   - Get rider settlement details
   - Returns: `RiderSettlementDetailsDto`
   - Validates rider belongs to hub manager's hub
   - Follows pattern: `/hubs/parcels/:id/*`

3. **`POST /hubs/riders/:riderId/settlement/record-cash`** (Hub Manager only)
   - Record cash received from rider
   - Request Body: `RecordCashReceivedDto`
   - Returns: Settlement record with calculated discrepancy and current due
   - Validates rider belongs to hub manager's hub
   - Follows pattern: `/hubs/parcels/:id/assign-rider`

4. **`GET /hubs/riders/:riderId/settlement/history`** (Hub Manager only)
   - Get settlement history for rider
   - Query params: `start_date`, `end_date`, `status`, `page`, `limit`
   - Returns: Paginated settlement history

5. **`GET /hubs/riders/:riderId/settlement/calculate-discrepancy`** (Hub Manager only)
   - Real-time discrepancy calculation endpoint
   - Query params: `cash_received`
   - Returns: `{ discrepancy_amount, current_due_amount }`
   - Used for real-time UI updates

---

### Step 6: Update Hubs Service

**File**: `src/hubs/hubs.service.ts`

#### Add Settlement Methods:

1. **`getHubRiders(hubId: string)`**
   - Get all active riders assigned to hub
   - Include basic rider and user information
   - Returns simplified list for settlement selection

2. **`getRiderSettlementDetails(riderId: string, hubId: string)`**
   - Get rider profile information
   - Calculate total collected amount from delivery verifications
   - Count completed deliveries
   - Get previous due amount
   - Return comprehensive settlement details

3. **`recordCashReceived(riderId: string, hubId: string, hubManagerId: string, cashReceived: number, notes?: string)`**
   - Get rider settlement details
   - Calculate discrepancy and current due
   - Create settlement record
   - Update rider's current_due_amount (if added to riders table)
   - Return settlement record with calculated values

4. **`getRiderSettlementHistory(riderId: string, hubId: string, query?: SettlementQueryDto)`**
   - Get historical settlements for a rider
   - Support date range filtering
   - Support status filtering
   - Pagination support

5. **`calculateDiscrepancy(riderId: string, hubId: string, cashReceived: number)`**
   - Real-time discrepancy calculation
   - Returns discrepancy and current due amount

---

### Step 7: Update Hubs Module

**File**: `src/hubs/hubs.module.ts`

- Add `RiderSettlement` entity to TypeORM imports
- Import `RidersModule` for rider repository access
- Import `DeliveryVerificationsModule` for delivery verification repository access (if needed)
- No new module needed - everything stays in hubs module

---

## 🔐 Authorization & Validation

### Authorization Rules

1. **Hub Manager** can only:
   - View riders from their assigned hub
   - Record settlements for riders in their hub
   - View settlement history for their hub's riders

2. **Admin** can:
   - View all riders and settlements
   - Access all settlement records

### Validation Rules

1. **Rider must belong to hub manager's hub**
   - Check `rider.hub_id === hubManager.hubId`

2. **Cash received must be non-negative**
   - `cash_received >= 0`

3. **Settlement date must be current or past**
   - Cannot create future-dated settlements

4. **Total collected amount calculation**
   - Only count completed delivery verifications
   - Only count deliveries since last settlement (or rider creation)
   - Exclude cancelled/returned parcels that weren't delivered

---

## 📊 Data Flow

### Settlement Flow Diagram

```
1. Hub Manager → GET /hubs/riders
   ↓
2. Select Rider → GET /hubs/riders/:riderId/settlement
   ↓
3. System calculates:
   - Total collected from delivery_verifications
   - Completed deliveries count
   - Previous due amount
   ↓
4. Hub Manager enters cash received
   ↓
5. POST /hubs/riders/:riderId/settlement/record-cash
   ↓
6. System calculates:
   - Discrepancy = Total collected - Cash received
   - Current due = Previous due + Discrepancy
   ↓
7. Create settlement record
   ↓
8. Update rider's current_due_amount
   ↓
9. Return settlement details with real-time calculations
```

---

## 🧮 Calculation Logic

### Total Collected Amount

```typescript
// Sum of collected_amount from completed delivery verifications
// Since last settlement (or rider creation if first settlement)
const totalCollected = await deliveryVerificationRepo
  .createQueryBuilder('dv')
  .select('COALESCE(SUM(dv.collected_amount), 0)', 'total')
  .where('dv.rider_id = :riderId', { riderId })
  .andWhere('dv.verification_status = :status', { status: 'COMPLETED' })
  .andWhere('dv.delivery_completed_at >= :since', { since: lastSettlementDate })
  .getRawOne();
```

### Completed Deliveries Count

```typescript
// Count of completed deliveries
const completedDeliveries = await deliveryVerificationRepo
  .createQueryBuilder('dv')
  .where('dv.rider_id = :riderId', { riderId })
  .andWhere('dv.verification_status = :status', { status: 'COMPLETED' })
  .andWhere('dv.selected_status IN (:...statuses)', { 
    statuses: ['DELIVERED', 'PARTIAL_DELIVERY', 'EXCHANGE', 'PAID_RETURN'] 
  })
  .andWhere('dv.delivery_completed_at >= :since', { since: lastSettlementDate })
  .getCount();
```

### Discrepancy Calculation

```typescript
discrepancyAmount = totalCollectedAmount - cashReceived;
currentDueAmount = previousDueAmount + discrepancyAmount;
```

---

## 📝 API Endpoints Summary

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/hubs/riders` | HUB_MANAGER | Get riders list for settlement |
| GET | `/hubs/riders/:riderId/settlement` | HUB_MANAGER | Get rider settlement details |
| POST | `/hubs/riders/:riderId/settlement/record-cash` | HUB_MANAGER | Record cash received from rider |
| GET | `/hubs/riders/:riderId/settlement/history` | HUB_MANAGER | Get settlement history |
| GET | `/hubs/riders/:riderId/settlement/calculate-discrepancy` | HUB_MANAGER | Real-time discrepancy calculation |

**Note**: All endpoints follow the existing pattern `/hubs/*` used for other Hub Manager operations.

---

## 🧪 Testing Considerations

### Unit Tests

1. **Settlement Service Tests**:
   - Test total collected amount calculation
   - Test completed deliveries count
   - Test discrepancy calculation
   - Test due amount tracking

2. **Settlement Controller Tests**:
   - Test authorization (hub manager can only access their hub's riders)
   - Test validation (cash received must be non-negative)
   - Test endpoint responses

### Integration Tests

1. **End-to-End Settlement Flow**:
   - Create delivery verifications
   - Calculate settlement details
   - Record cash received
   - Verify discrepancy calculation
   - Verify due amount update

2. **Authorization Tests**:
   - Hub manager cannot access other hub's riders
   - Hub manager cannot record settlements for other hub's riders

---

## 🚀 Implementation Order

1. ✅ **Step 1**: Create Rider Settlement Entity (in `hubs/entities/`)
2. ✅ **Step 2**: Create Database Migration
3. ✅ **Step 3**: Create DTOs (in `hubs/dto/`)
4. ✅ **Step 4**: Update Hubs Service (add settlement methods)
5. ✅ **Step 5**: Update Hubs Controller (add settlement endpoints)
6. ✅ **Step 6**: Update Hubs Module (register RiderSettlement entity)
7. ✅ **Step 7**: Test & Debug
8. ✅ **Step 8**: Update Documentation

**Note**: No new module needed - all functionality added to existing `hubs` module.

---

## 📚 Additional Considerations

### Future Enhancements

1. **Settlement Periods**: Group settlements by date ranges (daily, weekly, monthly)
2. **Settlement Reports**: Generate PDF/Excel reports for settlements
3. **Settlement Disputes**: Allow riders to dispute settlements
4. **Auto-Settlement**: Automatic settlement calculation at end of period
5. **SMS Notifications**: Notify riders when settlement is recorded
6. **Settlement Approval**: Multi-level approval for large discrepancies
7. **Audit Trail**: Track all settlement changes with timestamps

### Performance Optimization

1. **Indexes**: Add indexes on `rider_id`, `hub_id`, `settlement_date`
2. **Caching**: Cache rider settlement details for frequently accessed riders
3. **Batch Calculations**: Pre-calculate totals for faster response times

### Security

1. **Input Validation**: Validate all numeric inputs
2. **Authorization**: Strict hub-based access control
3. **Audit Logging**: Log all settlement operations
4. **Data Integrity**: Use database transactions for settlement operations

---

## ✅ Success Criteria

1. ✅ Hub Manager can view list of riders in their hub
2. ✅ Hub Manager can view rider settlement details
3. ✅ System correctly calculates total collected amount
4. ✅ System correctly counts completed deliveries
5. ✅ System tracks previous due amount
6. ✅ Hub Manager can record cash received
7. ✅ System calculates discrepancy correctly
8. ✅ System updates current due amount in real-time
9. ✅ All calculations are accurate and validated
10. ✅ Authorization is properly enforced

---

## 📞 Support & Questions

For questions or clarifications about this implementation plan, please refer to:
- Existing codebase patterns in `hubs/`, `riders/`, and `delivery-verifications/` modules
- TypeORM documentation for entity relationships
- NestJS documentation for module structure

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Status**: Ready for Implementation


