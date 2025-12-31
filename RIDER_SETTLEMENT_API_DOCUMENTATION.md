# Rider Settlement System - API Documentation

## 📋 Overview

The **Rider Settlement System** allows Hub Managers to manage cash settlements with riders who collect COD (Cash on Delivery) payments from customers. The system tracks collected amounts, handles cash reconciliation, and maintains settlement history.

---

## 🔄 Settlement Flow

1. **Rider collects COD** from customers during deliveries
2. **System tracks** all COD collections via delivery verifications
3. **Hub Manager views** rider's total collected amount and delivery breakdown
4. **Hub Manager enters** actual cash received from rider
5. **System calculates** discrepancy (shortage/excess) and updates due amount
6. **Settlement recorded** with complete transaction history

---

## 🎯 Key Concepts

### Settlement Status

| Status | Description |
|--------|-------------|
| **PENDING** | Settlement recorded but rider still owes money |
| **PARTIAL** | Partial payment received, some amount still due |
| **COMPLETED** | Full settlement, no outstanding due amount |

### Discrepancy Calculation

```
Total Due to Hub = Total Collected Amount + Previous Due Amount
Discrepancy Amount = Cash Received - Total Due to Hub
New Due Amount = Total Due to Hub - Cash Received (if positive)

Negative Discrepancy = Rider owes money (shortage)
Positive Discrepancy = Hub owes rider (excess - rare)
```

---

## 🛠️ API Endpoints

### Base URL
```
http://localhost:3000/hubs
```

All endpoints require JWT authentication and **HUB_MANAGER** role.

---

## 1️⃣ Get Riders List for Settlement

**GET** `/hubs/riders`

**Authorization**: Hub Manager Only

**Description**: Get list of all active riders in the hub for settlement selection.

### Example Request

```bash
GET /hubs/riders
Authorization: Bearer <hub_manager_token>
```

### Response

```json
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": "rider-uuid-1",
        "full_name": "Karim Rahman",
        "phone": "01712345678",
        "bike_type": "MOTORCYCLE",
        "is_active": true,
        "photo": "https://..."
      },
      {
        "id": "rider-uuid-2",
        "full_name": "Rahim Khan",
        "phone": "01798765432",
        "bike_type": "BICYCLE",
        "is_active": true,
        "photo": null
      }
    ]
  },
  "message": "Riders retrieved successfully"
}
```

---

## 2️⃣ Get Rider Settlement Details

**GET** `/hubs/riders/:riderId/settlement`

**Authorization**: Hub Manager Only

**Description**: Get comprehensive settlement information for a specific rider, including:
- Total collected amount since last settlement
- Completed deliveries count and breakdown by status
- Previous due amount
- List of all parcels with collected amounts

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `riderId` | UUID | Rider ID |

### Example Request

```bash
GET /hubs/riders/rider-uuid-1/settlement
Authorization: Bearer <hub_manager_token>
```

### Response

```json
{
  "success": true,
  "data": {
    "rider_id": "rider-uuid-1",
    "rider_name": "Karim Rahman",
    "rider_phone": "01712345678",
    "total_collected_amount": 45500.00,
    "completed_deliveries": 23,
    "previous_due_amount": 0.00,
    "current_due_amount": 0.00,
    "period_start": "2024-12-15T00:00:00.000Z",
    "period_end": "2024-12-22T15:00:00.000Z",
    "breakdown": {
      "delivered": 18,
      "partial_delivery": 2,
      "exchange": 1,
      "paid_return": 1,
      "returned": 1
    },
    "parcels": [
      {
        "parcel_id": "parcel-uuid-1",
        "tracking_number": "TRK20241215001",
        "status": "DELIVERED",
        "collected_amount": 2500.00,
        "expected_cod_amount": 2500.00,
        "amount_difference": 0.00,
        "delivery_completed_at": "2024-12-20T14:30:00.000Z"
      },
      {
        "parcel_id": "parcel-uuid-2",
        "tracking_number": "TRK20241215002",
        "status": "PARTIAL_DELIVERY",
        "collected_amount": 1500.00,
        "expected_cod_amount": 2000.00,
        "amount_difference": -500.00,
        "delivery_completed_at": "2024-12-21T10:15:00.000Z"
      }
      // ... more parcels
    ]
  },
  "message": "Settlement details retrieved successfully"
}
```

---

## 3️⃣ Calculate Settlement Discrepancy (Preview)

**POST** `/hubs/riders/:riderId/settlement/calculate`

**Authorization**: Hub Manager Only

**Description**: Calculate settlement before recording. Provides real-time preview of discrepancy and new due amount. Use this for UI updates as hub manager enters cash amount.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `riderId` | UUID | Rider ID |

### Request Body

```json
{
  "cash_received": 44000.00
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cash_received` | Decimal | Yes | Actual cash handed over by rider |

### Example Request

```bash
POST /hubs/riders/rider-uuid-1/settlement/calculate
Authorization: Bearer <hub_manager_token>
Content-Type: application/json

{
  "cash_received": 44000.00
}
```

### Response

```json
{
  "success": true,
  "data": {
    "rider_id": "rider-uuid-1",
    "rider_name": "Karim Rahman",
    "settlement_period": {
      "from": "2024-12-15T00:00:00.000Z",
      "to": "2024-12-22T15:00:00.000Z"
    },
    "calculation": {
      "total_collected_amount": 45500.00,
      "previous_due_amount": 0.00,
      "total_due_to_hub": 45500.00,
      "cash_received": 44000.00,
      "discrepancy_amount": -1500.00,
      "new_due_amount": 1500.00
    },
    "breakdown": {
      "delivered": 18,
      "partial_delivery": 2,
      "exchange": 1,
      "paid_return": 1,
      "returned": 1
    }
  },
  "message": "Settlement calculation completed"
}
```

**Interpretation:**
- `discrepancy_amount: -1500.00` means rider owes 1500 BDT (shortage)
- `new_due_amount: 1500.00` will be carried forward to next settlement
- Next settlement will include this 1500 BDT as `previous_due_amount`

---

## 4️⃣ Record Settlement Transaction

**POST** `/hubs/riders/:riderId/settlement/record`

**Authorization**: Hub Manager Only

**Description**: Record the actual settlement transaction. Creates a permanent record in the database with all calculated values and delivery breakdown.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `riderId` | UUID | Rider ID |

### Request Body

```json
{
  "cash_received": 44000.00,
  "notes": "Rider will pay remaining 1500 BDT tomorrow"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cash_received` | Decimal | Yes | Actual cash handed over by rider |
| `notes` | String | No | Additional notes (e.g., payment plan for shortage) |

### Example Request

```bash
POST /hubs/riders/rider-uuid-1/settlement/record
Authorization: Bearer <hub_manager_token>
Content-Type: application/json

{
  "cash_received": 44000.00,
  "notes": "Rider will pay remaining 1500 BDT tomorrow"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "settlement_id": "settlement-uuid-123",
    "rider_id": "rider-uuid-1",
    "total_collected_amount": 45500.00,
    "cash_received": 44000.00,
    "discrepancy_amount": -1500.00,
    "previous_due_amount": 0.00,
    "new_due_amount": 1500.00,
    "settlement_status": "PARTIAL",
    "settled_at": "2024-12-22T15:30:00.000Z",
    "notes": "Rider will pay remaining 1500 BDT tomorrow"
  },
  "message": "Settlement recorded successfully"
}
```

**Settlement Status Logic:**
- `COMPLETED`: `new_due_amount = 0` (full payment)
- `PARTIAL`: `new_due_amount > 0` and `cash_received > 0` (partial payment)
- `PENDING`: `new_due_amount > 0` and `cash_received = 0` (no payment yet)

---

## 5️⃣ Get Settlement History

**GET** `/hubs/riders/:riderId/settlement/history`

**Authorization**: Hub Manager Only

**Description**: View historical settlements for a rider with filtering and pagination.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `riderId` | UUID | Rider ID |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_date` | ISO Date | No | Filter settlements from this date |
| `end_date` | ISO Date | No | Filter settlements until this date |
| `status` | Enum | No | PENDING, COMPLETED, PARTIAL |
| `page` | Integer | No | Page number (default: 1) |
| `limit` | Integer | No | Items per page (default: 20) |

### Example Request

```bash
GET /hubs/riders/rider-uuid-1/settlement/history?start_date=2024-12-01&end_date=2024-12-31&page=1&limit=20
Authorization: Bearer <hub_manager_token>
```

### Response

```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "settlement_id": "settlement-uuid-123",
        "total_collected_amount": 45500.00,
        "cash_received": 44000.00,
        "discrepancy_amount": -1500.00,
        "previous_due_amount": 0.00,
        "new_due_amount": 1500.00,
        "completed_deliveries": 23,
        "settlement_status": "PARTIAL",
        "settled_at": "2024-12-22T15:30:00.000Z",
        "settled_by": "Hub Manager Name",
        "notes": "Rider will pay remaining 1500 BDT tomorrow"
      },
      {
        "settlement_id": "settlement-uuid-122",
        "total_collected_amount": 38000.00,
        "cash_received": 38000.00,
        "discrepancy_amount": 0.00,
        "previous_due_amount": 0.00,
        "new_due_amount": 0.00,
        "completed_deliveries": 19,
        "settlement_status": "COMPLETED",
        "settled_at": "2024-12-15T16:00:00.000Z",
        "settled_by": "Hub Manager Name",
        "notes": null
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Settlement history retrieved successfully"
}
```

---

## 📊 Complete API Summary

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | GET | `/hubs/riders` | List all riders for settlement |
| 2 | GET | `/hubs/riders/:riderId/settlement` | Get settlement details |
| 3 | POST | `/hubs/riders/:riderId/settlement/calculate` | Preview settlement calculation |
| 4 | POST | `/hubs/riders/:riderId/settlement/record` | Record settlement transaction |
| 5 | GET | `/hubs/riders/:riderId/settlement/history` | View settlement history |

---

## 💡 Usage Scenarios

### Scenario 1: Complete Settlement (No Shortage)

```bash
# 1. Get settlement details
GET /hubs/riders/rider-uuid-1/settlement
# Response: total_collected_amount = 45000

# 2. Calculate
POST /hubs/riders/rider-uuid-1/settlement/calculate
{ "cash_received": 45000.00 }
# Response: discrepancy_amount = 0, new_due_amount = 0

# 3. Record settlement
POST /hubs/riders/rider-uuid-1/settlement/record
{ "cash_received": 45000.00 }
# Response: settlement_status = "COMPLETED"
```

---

### Scenario 2: Partial Settlement (Shortage)

```bash
# 1. Get settlement details
GET /hubs/riders/rider-uuid-1/settlement
# Response: total_collected_amount = 45500

# 2. Rider gives 44000, short by 1500
POST /hubs/riders/rider-uuid-1/settlement/calculate
{ "cash_received": 44000.00 }
# Response: discrepancy_amount = -1500, new_due_amount = 1500

# 3. Record with notes
POST /hubs/riders/rider-uuid-1/settlement/record
{
  "cash_received": 44000.00,
  "notes": "Remaining 1500 to be paid tomorrow"
}
# Response: settlement_status = "PARTIAL", new_due_amount = 1500
```

**Next Settlement:**
The 1500 BDT will appear as `previous_due_amount` in the next settlement.

---

### Scenario 3: Settlement with Previous Due

```bash
# Rider had 1500 due from last settlement
GET /hubs/riders/rider-uuid-1/settlement
# Response:
# total_collected_amount = 30000 (new collections)
# previous_due_amount = 1500 (from last time)
# current_due_amount = 1500

# Rider pays everything
POST /hubs/riders/rider-uuid-1/settlement/record
{ "cash_received": 31500.00 }
# Response:
# total_due_to_hub = 31500 (30000 + 1500)
# discrepancy_amount = 0
# new_due_amount = 0
# settlement_status = "COMPLETED"
```

---

## 🔍 Data Sources

The settlement system pulls data from:

1. **Delivery Verifications** (`delivery_verifications` table)
   - `collected_amount`: Actual COD collected
   - `expected_cod_amount`: Expected COD amount
   - `amount_difference`: Difference between expected and collected
   - `verification_status = 'COMPLETED'`: Only completed deliveries

2. **Last Settlement** (`rider_settlements` table)
   - `settled_at`: When last settlement occurred
   - `new_due_amount`: Becomes `previous_due_amount` in next settlement

3. **Settlement Period**
   - Starts: Last settlement date OR rider join date
   - Ends: Current timestamp

---

## ⚠️ Important Notes

1. **Hub Scope**: Hub Managers can only access riders from their assigned hub
2. **Active Riders Only**: List only shows active riders (`is_active = true`)
3. **Completed Deliveries**: Only counts deliveries with `verification_status = 'COMPLETED'`
4. **Cascade Delete**: Deleting a rider will delete all their settlements
5. **Due Amount Tracking**: Always carries forward to next settlement
6. **Read-only Calculation**: `/calculate` endpoint doesn't create any records
7. **Transaction Recording**: `/record` endpoint creates permanent settlement record

---

## 🗄️ Database Schema

### Table: `rider_settlements`

```sql
CREATE TABLE rider_settlements (
  id UUID PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  hub_manager_id UUID NOT NULL REFERENCES hub_managers(id) ON DELETE SET NULL,
  
  -- Settlement amounts
  total_collected_amount DECIMAL(10,2) DEFAULT 0,
  cash_received DECIMAL(10,2) DEFAULT 0,
  discrepancy_amount DECIMAL(10,2) DEFAULT 0,
  previous_due_amount DECIMAL(10,2) DEFAULT 0,
  new_due_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Delivery breakdown
  completed_deliveries INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  partial_delivery_count INT DEFAULT 0,
  exchange_count INT DEFAULT 0,
  paid_return_count INT DEFAULT 0,
  returned_count INT DEFAULT 0,
  
  -- Settlement info
  settlement_status ENUM('PENDING', 'COMPLETED', 'PARTIAL') DEFAULT 'PENDING',
  period_start TIMESTAMP NULL,
  period_end TIMESTAMP NULL,
  notes TEXT NULL,
  settled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IDX_rider_settlement_rider_settled ON rider_settlements(rider_id, settled_at);
CREATE INDEX IDX_rider_settlement_hub_settled ON rider_settlements(hub_id, settled_at);
CREATE INDEX IDX_rider_settlement_status ON rider_settlements(settlement_status);
```

---

## 🧪 Testing Guide

### Test 1: Get Riders List

```bash
curl -X GET http://localhost:3000/hubs/riders \
  -H "Authorization: Bearer <hub_manager_token>"
```

### Test 2: View Settlement Details

```bash
curl -X GET http://localhost:3000/hubs/riders/<rider-id>/settlement \
  -H "Authorization: Bearer <hub_manager_token>"
```

### Test 3: Calculate Settlement

```bash
curl -X POST http://localhost:3000/hubs/riders/<rider-id>/settlement/calculate \
  -H "Authorization: Bearer <hub_manager_token>" \
  -H "Content-Type: application/json" \
  -d '{"cash_received": 44000.00}'
```

### Test 4: Record Settlement

```bash
curl -X POST http://localhost:3000/hubs/riders/<rider-id>/settlement/record \
  -H "Authorization: Bearer <hub_manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cash_received": 44000.00,
    "notes": "Paid in full"
  }'
```

### Test 5: View History

```bash
curl -X GET "http://localhost:3000/hubs/riders/<rider-id>/settlement/history?page=1&limit=10" \
  -H "Authorization: Bearer <hub_manager_token>"
```

---

## 🎉 Summary

The Rider Settlement System provides:

✅ **Complete COD Tracking** - Tracks every COD collection  
✅ **Real-time Calculation** - Preview settlements before recording  
✅ **Due Amount Management** - Carries forward shortages automatically  
✅ **Detailed Breakdown** - Shows deliveries by status  
✅ **Settlement History** - Complete audit trail  
✅ **Hub Isolation** - Hub Managers only see their riders  
✅ **Flexible Notes** - Record payment agreements  

**Implementation Date**: December 22, 2024  
**Status**: ✅ Complete and Production-Ready

For questions or issues, please contact the development team.

