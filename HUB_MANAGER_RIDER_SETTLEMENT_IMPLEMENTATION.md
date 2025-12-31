# Hub Manager Rider Settlement System - Implementation Plan

## 📋 Overview

This system allows Hub Managers to settle cash collected by riders from COD deliveries.

### Settlement Flow:
1. Hub Manager selects a rider from their hub
2. Views rider profile with collection summary
3. Views all parcels with collected amounts
4. Enters cash received from rider
5. System calculates discrepancy and updates due amount
6. Records settlement transaction

---

## ✅ Existing APIs (Use These - Don't Create Again!)

### 1. Get Riders List
**Already exists:** `GET /riders`

```http
GET /riders?page=1&limit=20
Authorization: Bearer <hub_manager_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": "rider-uuid-1",
        "user": {
          "id": "user-uuid-1",
          "full_name": "Karim Rahman",
          "phone": "01712345678"
        },
        "hub_id": "hub-uuid",
        "bike_type": "MOTORCYCLE",
        "is_active": true,
        "photo": "https://...",
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Riders retrieved successfully"
}
```

**Note:** Hub Managers automatically get only their hub's riders.

---

### 2. Get Delivery Outcomes
**Already exists:** `GET /hubs/parcels/delivery-outcomes`

```http
GET /hubs/parcels/delivery-outcomes?status=DELIVERED&page=1&limit=50
Authorization: Bearer <hub_manager_token>
```

**Query Parameters:**
- `status`: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED
- `zone`: Filter by coverage area
- `merchantId`: Filter by merchant
- `page`: Default 1
- `limit`: Default 10, max 100

**Response:**
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "parcel-uuid-1",
        "tracking_number": "TRK123456",
        "status": "DELIVERED",
        "payment_status": "COD_COLLECTED",
        "cod_amount": 1500.00,
        "assigned_rider": {
          "id": "rider-uuid-1",
          "user": {
            "full_name": "Karim Rahman"
          }
        },
        "delivered_at": "2024-12-22T14:30:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

---

## 🆕 New APIs to Create

### 3. Get Rider Settlement Summary
**NEW:** `GET /hubs/riders/:riderId/settlement-summary`

Get rider's collection summary for settlement.

```http
GET /hubs/riders/rider-uuid-1/settlement-summary
Authorization: Bearer <hub_manager_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "rider-uuid-1",
      "user": {
        "id": "user-uuid-1",
        "full_name": "Karim Rahman",
        "phone": "01712345678",
        "email": "karim@example.com"
      },
      "hub_id": "hub-uuid",
      "bike_type": "MOTORCYCLE",
      "photo": "https://...",
      "is_active": true
    },
    "settlement_period": {
      "from": "2024-12-15T00:00:00.000Z",
      "to": "2024-12-22T23:59:59.999Z",
      "last_settlement_date": "2024-12-15T10:30:00.000Z"
    },
    "collections": {
      "total_collected_amount": 45500.00,
      "completed_deliveries_count": 23,
      "status_breakdown": {
        "DELIVERED": {
          "count": 18,
          "collected_amount": 38000.00
        },
        "PARTIAL_DELIVERY": {
          "count": 2,
          "collected_amount": 3500.00
        },
        "EXCHANGE": {
          "count": 1,
          "collected_amount": 2000.00
        },
        "PAID_RETURN": {
          "count": 1,
          "collected_amount": 1500.00
        },
        "RETURNED": {
          "count": 1,
          "collected_amount": 500.00
        }
      }
    },
    "previous_due_amount": 0.00,
    "total_due_to_hub": 45500.00,
    "last_settlement": {
      "id": "settlement-uuid",
      "settlement_date": "2024-12-15T10:30:00.000Z",
      "collected_amount_period": 32000.00,
      "cash_received": 32000.00,
      "discrepancy_amount": 0.00
    }
  },
  "message": "Rider settlement summary retrieved successfully"
}
```

---

### 4. Get Rider Collection Details (Parcels)
**NEW:** `GET /hubs/riders/:riderId/collections`

Get detailed list of parcels with collection amounts for a specific rider.

```http
GET /hubs/riders/rider-uuid-1/collections?status=DELIVERED&page=1&limit=50
Authorization: Bearer <hub_manager_token>
```

**Query Parameters:**
- `status`: Filter by parcel status (optional)
- `fromDate`: Start date (default: last settlement date or rider creation)
- `toDate`: End date (default: now)
- `page`: Default 1
- `limit`: Default 20, max 100

**Response:**
```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "rider-uuid-1",
      "full_name": "Karim Rahman"
    },
    "period": {
      "from": "2024-12-15T00:00:00.000Z",
      "to": "2024-12-22T23:59:59.999Z"
    },
    "collections": [
      {
        "parcel_id": "parcel-uuid-1",
        "tracking_number": "TRK123456",
        "status": "DELIVERED",
        "merchant": {
          "store_name": "Fashion Store",
          "merchant_name": "John Doe"
        },
        "customer": {
          "name": "Customer Name",
          "phone": "01812345678"
        },
        "delivery_details": {
          "verification_id": "verification-uuid-1",
          "expected_cod_amount": 1500.00,
          "collected_amount": 1500.00,
          "difference_amount": 0.00,
          "difference_reason": null,
          "delivered_at": "2024-12-22T14:30:00.000Z"
        }
      },
      {
        "parcel_id": "parcel-uuid-2",
        "tracking_number": "TRK123457",
        "status": "PARTIAL_DELIVERY",
        "merchant": {
          "store_name": "Electronics Hub",
          "merchant_name": "Jane Smith"
        },
        "customer": {
          "name": "Another Customer",
          "phone": "01912345678"
        },
        "delivery_details": {
          "verification_id": "verification-uuid-2",
          "expected_cod_amount": 3000.00,
          "collected_amount": 2000.00,
          "difference_amount": -1000.00,
          "difference_reason": "Customer paid partial amount, will pay rest later",
          "delivered_at": "2024-12-22T16:45:00.000Z"
        }
      },
      {
        "parcel_id": "parcel-uuid-3",
        "tracking_number": "TRK123458",
        "status": "RETURNED",
        "merchant": {
          "store_name": "Gadget World",
          "merchant_name": "Mike Johnson"
        },
        "customer": {
          "name": "Customer Three",
          "phone": "01612345678"
        },
        "delivery_details": {
          "verification_id": "verification-uuid-3",
          "expected_cod_amount": 2500.00,
          "collected_amount": 0.00,
          "difference_amount": -2500.00,
          "difference_reason": "Customer refused delivery - wrong item",
          "delivered_at": "2024-12-22T18:20:00.000Z"
        }
      },
      {
        "parcel_id": "parcel-uuid-4",
        "tracking_number": "TRK123459",
        "status": "EXCHANGE",
        "merchant": {
          "store_name": "Book Store",
          "merchant_name": "Sara Ali"
        },
        "customer": {
          "name": "Customer Four",
          "phone": "01712345679"
        },
        "delivery_details": {
          "verification_id": "verification-uuid-4",
          "expected_cod_amount": 800.00,
          "collected_amount": 800.00,
          "difference_amount": 0.00,
          "difference_reason": "Size exchange, same amount collected",
          "delivered_at": "2024-12-22T11:15:00.000Z"
        }
      }
    ],
    "summary": {
      "total_parcels": 23,
      "total_expected": 46500.00,
      "total_collected": 45500.00,
      "total_difference": -1000.00
    },
    "pagination": {
      "total": 23,
      "page": 1,
      "limit": 50,
      "totalPages": 1
    }
  },
  "message": "Rider collections retrieved successfully"
}
```

---

### 5. Calculate Settlement (Preview)
**NEW:** `POST /hubs/riders/:riderId/settlement/calculate`

Calculate discrepancy before recording settlement.

```http
POST /hubs/riders/rider-uuid-1/settlement/calculate
Authorization: Bearer <hub_manager_token>
Content-Type: application/json

{
  "cash_received": 44000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rider_id": "rider-uuid-1",
    "rider_name": "Karim Rahman",
    "settlement_period": {
      "from": "2024-12-15T00:00:00.000Z",
      "to": "2024-12-22T23:59:59.999Z"
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
      "completed_deliveries": 23,
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

**Note:** 
- **Discrepancy Amount** = `cash_received` - (`total_collected_amount` + `previous_due_amount`)
- **Negative discrepancy** = Rider owes money to hub (shortage)
- **Positive discrepancy** = Hub owes money to rider (excess - rare)

---

### 6. Record Settlement
**NEW:** `POST /hubs/riders/:riderId/settlement/record`

Record the settlement transaction.

```http
POST /hubs/riders/rider-uuid-1/settlement/record
Authorization: Bearer <hub_manager_token>
Content-Type: application/json

{
  "cash_received": 44000.00,
  "notes": "Rider will pay remaining 1500 tomorrow"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settlement": {
      "id": "settlement-uuid-new",
      "rider_id": "rider-uuid-1",
      "hub_id": "hub-uuid",
      "settlement_period": {
        "from": "2024-12-15T00:00:00.000Z",
        "to": "2024-12-22T23:59:59.999Z"
      },
      "collected_amount_period": 45500.00,
      "previous_due_amount": 0.00,
      "cash_received": 44000.00,
      "discrepancy_amount": -1500.00,
      "current_due_amount": 1500.00,
      "settlement_date": "2024-12-22T18:00:00.000Z",
      "settled_by_hub_manager_id": "hub-manager-user-id",
      "status": "COMPLETED",
      "notes": "Rider will pay remaining 1500 tomorrow",
      "created_at": "2024-12-22T18:00:00.000Z"
    }
  },
  "message": "Settlement recorded successfully"
}
```

---

### 7. Get Settlement History
**NEW:** `GET /hubs/riders/:riderId/settlement/history`

Get rider's settlement history.

```http
GET /hubs/riders/rider-uuid-1/settlement/history?page=1&limit=10
Authorization: Bearer <hub_manager_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "rider-uuid-1",
      "full_name": "Karim Rahman"
    },
    "settlements": [
      {
        "id": "settlement-uuid-new",
        "settlement_date": "2024-12-22T18:00:00.000Z",
        "period": {
          "from": "2024-12-15T00:00:00.000Z",
          "to": "2024-12-22T23:59:59.999Z"
        },
        "collected_amount_period": 45500.00,
        "previous_due_amount": 0.00,
        "cash_received": 44000.00,
        "discrepancy_amount": -1500.00,
        "current_due_amount": 1500.00,
        "status": "COMPLETED",
        "settled_by": {
          "id": "hub-manager-user-id",
          "full_name": "Hub Manager Name"
        },
        "notes": "Rider will pay remaining 1500 tomorrow"
      },
      {
        "id": "settlement-uuid-old",
        "settlement_date": "2024-12-15T10:30:00.000Z",
        "period": {
          "from": "2024-12-08T00:00:00.000Z",
          "to": "2024-12-15T10:30:00.000Z"
        },
        "collected_amount_period": 32000.00,
        "previous_due_amount": 0.00,
        "cash_received": 32000.00,
        "discrepancy_amount": 0.00,
        "current_due_amount": 0.00,
        "status": "COMPLETED",
        "settled_by": {
          "id": "hub-manager-user-id",
          "full_name": "Hub Manager Name"
        },
        "notes": null
      }
    ],
    "pagination": {
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Settlement history retrieved successfully"
}
```

---

## 🗄️ Database Schema

### New Table: `rider_settlements`

```sql
CREATE TABLE rider_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationships
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  hub_id UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  
  -- Settlement Period
  period_start_date TIMESTAMP NOT NULL,
  period_end_date TIMESTAMP NOT NULL,
  
  -- Financial Details
  collected_amount_period DECIMAL(10, 2) NOT NULL DEFAULT 0,  -- Total collected in this period
  previous_due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,      -- Due from previous settlements
  cash_received DECIMAL(10, 2) NOT NULL,                      -- Cash handed by rider
  discrepancy_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,       -- Difference (can be +/-)
  current_due_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,       -- New due amount
  
  -- Metadata
  settlement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_by_hub_manager_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',  -- COMPLETED, PARTIAL, CANCELLED
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_rider_settlements_rider (rider_id),
  INDEX idx_rider_settlements_hub (hub_id),
  INDEX idx_rider_settlements_date (settlement_date),
  INDEX idx_rider_settlements_status (status)
);
```

**Key Fields Explanation:**
- `collected_amount_period`: Total COD collected by rider since last settlement
- `previous_due_amount`: Any outstanding amount from previous settlement
- `cash_received`: Actual cash handed over by rider to hub manager
- `discrepancy_amount`: `cash_received` - (`collected_amount_period` + `previous_due_amount`)
  - Negative = Rider owes money (shortage)
  - Positive = Overpayment (rare, needs investigation)
- `current_due_amount`: Carried forward to next settlement

---

## 📊 Calculation Logic

### Total Amount Due to Hub:
```
total_due_to_hub = collected_amount_period + previous_due_amount
```

### Discrepancy:
```
discrepancy_amount = cash_received - total_due_to_hub
```

### New Due Amount:
```
current_due_amount = abs(discrepancy_amount) if discrepancy_amount < 0 else 0
```

### SQL Query for Period Collections:
```sql
SELECT 
  COUNT(*) as completed_deliveries_count,
  COALESCE(SUM(dv.collected_amount), 0) as total_collected_amount,
  p.status,
  COUNT(CASE WHEN p.status = 'DELIVERED' THEN 1 END) as delivered_count,
  COUNT(CASE WHEN p.status = 'PARTIAL_DELIVERY' THEN 1 END) as partial_delivery_count,
  COUNT(CASE WHEN p.status = 'EXCHANGE' THEN 1 END) as exchange_count,
  COUNT(CASE WHEN p.status = 'PAID_RETURN' THEN 1 END) as paid_return_count,
  COUNT(CASE WHEN p.status = 'RETURNED' THEN 1 END) as returned_count
FROM delivery_verifications dv
INNER JOIN parcels p ON p.id = dv.parcel_id
WHERE 
  dv.rider_id = :riderId
  AND dv.verification_status = 'COMPLETED'
  AND dv.delivery_completed_at >= :periodStartDate
  AND dv.delivery_completed_at <= :periodEndDate
GROUP BY p.status;
```

---

## 🔧 Implementation Steps

### 1. Create Entity
File: `src/hubs/entities/rider-settlement.entity.ts`

### 2. Create DTOs
- `src/hubs/dto/calculate-settlement.dto.ts`
- `src/hubs/dto/record-settlement.dto.ts`

### 3. Update Hubs Service
File: `src/hubs/hubs.service.ts`
- Add settlement methods

### 4. Update Hubs Controller
File: `src/hubs/hubs.controller.ts`
- Add new endpoints

### 5. Create Migration
File: `src/migrations/[timestamp]-CreateRiderSettlementsTable.ts`

### 6. Update Hubs Module
File: `src/hubs/hubs.module.ts`
- Register new entity

---

## 🎯 Settlement Statuses

### Parcel Statuses Where Rider Has Money:
- ✅ `DELIVERED` - Full COD collected
- ✅ `PARTIAL_DELIVERY` - Partial amount collected
- ✅ `EXCHANGE` - Exchange amount collected
- ✅ `PAID_RETURN` - Return fee collected
- ✅ `RETURNED` - May have collected return fee (usually 0)
- ✅ `DELIVERY_RESCHEDULED` - Rare, but may have partial payment

### Settlement Status Enum:
- `COMPLETED` - Full settlement done
- `PARTIAL` - Partial cash received, has due amount
- `CANCELLED` - Settlement cancelled (rare)

---

## 🔐 Authorization

- **Hub Manager** can only:
  - View riders in their own hub
  - View collections for their hub's riders
  - Record settlements for their hub's riders
  - View settlement history for their hub's riders

---

## 📱 UI Flow

### 1. Rider List Screen
- Show all active riders in hub
- Display: Name, Photo, Phone, Active status
- Action: "View Settlement" button

### 2. Rider Settlement Screen
**Top Section - Rider Profile:**
- Rider photo, name, phone
- Last settlement date

**Summary Cards:**
- 💰 Total Collected: ৳45,500
- 📦 Completed Deliveries: 23
- ⚠️ Previous Due: ৳0
- 💳 Total Due to Hub: ৳45,500

**Cash Settlement Form:**
- Input: Cash Received from Rider
- Button: "Calculate" (shows preview)
- Display: Discrepancy Amount (auto-calculated)
- Display: New Due Amount (auto-calculated)
- Input: Notes (optional)
- Button: "Record Settlement"

### 3. Collections Detail Tab
Table with columns:
- Parcel ID
- Status
- Merchant
- Customer
- Collectable Amount (Expected COD)
- Collected Amount (Actual)
- Difference
- Reason
- Delivered At

### 4. Settlement History Tab
List of previous settlements:
- Date
- Period
- Collected Amount
- Cash Received
- Discrepancy
- Notes

---

## 🧪 Testing Checklist

- [ ] Hub Manager can view riders in their hub
- [ ] Hub Manager cannot view riders from other hubs
- [ ] Settlement summary shows correct totals
- [ ] Collections list shows all statuses correctly
- [ ] Discrepancy calculation is accurate
- [ ] Settlement records are saved correctly
- [ ] Previous due amount carries forward
- [ ] Settlement history is displayed correctly
- [ ] Authorization works (hub manager only access their hub)

---

## 📝 Notes

1. **Settlement Period**: Automatically starts from last settlement date (or rider creation date if first settlement)
2. **Previous Due**: Automatically fetched from last settlement's `current_due_amount`
3. **Discrepancy Handling**: 
   - Negative discrepancy (shortage) is most common
   - Positive discrepancy (overpayment) should be investigated
4. **Parcel Inclusion**: Only parcels with `verification_status = 'COMPLETED'` are included
5. **Real-time Calculation**: Use calculate endpoint before recording to show hub manager what will happen

---

This implementation reuses existing APIs and adds only necessary new endpoints for the settlement flow! 🚀


