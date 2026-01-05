# Merchant Finance Module

## 📦 Overview

The **Merchant Finance Module** provides centralized financial tracking for merchants, including:
- Real-time balance tracking
- Transaction ledger with complete audit trail
- Integration with invoice system
- Admin balance adjustments and holds

---

## 🗄️ Database Schema

### Table: `merchant_finances`

Stores the financial summary for each merchant.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `merchant_id` | UUID | Reference to user (unique) |
| `current_balance` | DECIMAL(12,2) | Available balance |
| `pending_balance` | DECIMAL(12,2) | Money from parcels not yet invoiced |
| `invoiced_balance` | DECIMAL(12,2) | Money in unpaid invoices |
| `processing_balance` | DECIMAL(12,2) | Money in invoices being processed |
| `hold_amount` | DECIMAL(12,2) | Frozen/held amount |
| `total_earned` | DECIMAL(12,2) | Lifetime earnings |
| `total_withdrawn` | DECIMAL(12,2) | Lifetime withdrawals |
| `total_delivery_charges` | DECIMAL(12,2) | Lifetime delivery charges |
| `total_return_charges` | DECIMAL(12,2) | Lifetime return charges |
| `total_cod_collected` | DECIMAL(12,2) | Lifetime COD collected |
| `total_parcels_delivered` | INT | Lifetime delivered count |
| `total_parcels_returned` | INT | Lifetime returned count |
| `credit_limit` | DECIMAL(12,2) | Optional credit limit |
| `credit_used` | DECIMAL(12,2) | Used credit amount |
| `last_transaction_at` | TIMESTAMP | Last transaction time |
| `last_withdrawal_at` | TIMESTAMP | Last withdrawal time |

### Table: `merchant_finance_transactions`

Ledger of all financial transactions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `merchant_id` | UUID | Reference to merchant_finances |
| `transaction_type` | ENUM | CREDIT or DEBIT |
| `amount` | DECIMAL(12,2) | Transaction amount |
| `balance_before` | DECIMAL(12,2) | Balance before transaction |
| `balance_after` | DECIMAL(12,2) | Balance after transaction |
| `reference_type` | ENUM | Type of reference (PARCEL_DELIVERED, INVOICE_PAID, etc.) |
| `reference_id` | UUID | ID of referenced entity |
| `reference_code` | VARCHAR(100) | Code (tracking number, invoice number) |
| `description` | TEXT | Transaction description |
| `notes` | TEXT | Additional notes |
| `cod_amount` | DECIMAL(12,2) | COD amount (for parcel transactions) |
| `delivery_charge` | DECIMAL(12,2) | Delivery charge |
| `return_charge` | DECIMAL(12,2) | Return charge |
| `created_by` | UUID | User who created transaction |
| `metadata` | JSONB | Additional metadata |
| `created_at` | TIMESTAMP | Creation time |

---

## 🔄 Balance Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BALANCE FLOW                                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  PARCEL DELIVERED → pending_balance (increases)                        │
│         ↓                                                              │
│  INVOICE GENERATED → pending_balance (decreases)                       │
│                    → invoiced_balance (increases)                      │
│         ↓                                                              │
│  STATUS = PROCESSING → invoiced_balance (decreases)                    │
│                      → processing_balance (increases)                  │
│         ↓                                                              │
│  INVOICE PAID → processing_balance (decreases)                         │
│               → total_withdrawn (increases)                            │
│               → total_earned (increases)                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Endpoints

### Merchant Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/merchant-finance/my` | Get own finance overview |
| GET | `/merchant-finance/my/transactions` | Get own transaction history |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/merchant-finance/admin/all` | Get all merchants finance summary |
| GET | `/merchant-finance/admin/:merchantId` | Get specific merchant finance |
| GET | `/merchant-finance/admin/:merchantId/transactions` | Get merchant transactions |
| POST | `/merchant-finance/admin/:merchantId/adjust` | Adjust balance (credit/debit) |
| POST | `/merchant-finance/admin/:merchantId/hold` | Hold balance |
| POST | `/merchant-finance/admin/:merchantId/release-hold` | Release held balance |
| POST | `/merchant-finance/admin/:merchantId/sync` | Sync finance from parcels |
| POST | `/merchant-finance/admin/sync-all` | Sync all merchants finance |

---

## 📊 Response Examples

### GET /merchant-finance/my

```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "uuid",
      "user_id": "uuid",
      "name": "John Doe",
      "phone": "01712345678",
      "email": "john@example.com"
    },
    "balance": {
      "current_balance": 0,
      "pending_balance": 15420.00,
      "invoiced_balance": 8500.00,
      "processing_balance": 2000.00,
      "hold_amount": 0,
      "available_for_withdrawal": 0
    },
    "lifetime_stats": {
      "total_earned": 125000.00,
      "total_withdrawn": 125000.00,
      "total_cod_collected": 150000.00,
      "total_delivery_charges": 20000.00,
      "total_return_charges": 5000.00,
      "total_parcels_delivered": 450,
      "total_parcels_returned": 50
    },
    "credit": {
      "credit_limit": 0,
      "credit_used": 0,
      "credit_available": 0
    },
    "last_activity": {
      "last_transaction_at": "2025-01-04T10:30:00Z",
      "last_withdrawal_at": "2025-01-02T15:00:00Z"
    }
  }
}
```

### POST /merchant-finance/admin/:merchantId/adjust

**Request:**
```json
{
  "type": "CREDIT",
  "amount": 500.00,
  "reason": "Compensation for delayed delivery",
  "notes": "Ticket #12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transaction_id": "uuid",
    "type": "CREDIT",
    "amount": 500.00,
    "balance_after": 500.00
  },
  "message": "Balance credited successfully"
}
```

---

## 🔗 Integration with Invoice System

The finance module is automatically integrated with the invoice system:

1. **Invoice Generated**: Money moves from `pending_balance` to `invoiced_balance`
2. **Status → PROCESSING**: Money moves from `invoiced_balance` to `processing_balance`
3. **Status → UNPAID (revert)**: Money moves from `processing_balance` to `invoiced_balance`
4. **Invoice Paid**: Money deducted from balance, recorded in transaction ledger

---

## 🛠️ Migration

Run the migration to create the tables:

```bash
npm run migration:run
```

Or manually:
```bash
npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts
```

---

## 🔄 Syncing Existing Data

For existing merchants with parcels, use the sync endpoint:

```bash
# Sync single merchant
POST /merchant-finance/admin/{merchantId}/sync

# Sync all merchants
POST /merchant-finance/admin/sync-all
```

This will calculate and populate the finance records based on existing parcel data.

---

## 📁 File Structure

```
src/merchant-finance/
├── entities/
│   ├── merchant-finance.entity.ts
│   ├── merchant-finance-transaction.entity.ts
│   └── index.ts
├── dto/
│   ├── create-transaction.dto.ts
│   ├── get-transactions.dto.ts
│   ├── adjust-balance.dto.ts
│   ├── finance-dashboard.dto.ts
│   └── index.ts
├── merchant-finance.controller.ts
├── merchant-finance.service.ts
├── merchant-finance.module.ts
└── index.ts
```

---

## 🎯 Transaction Types

### Credit Transactions
- `PARCEL_DELIVERED` - Parcel delivered successfully
- `PARCEL_PARTIAL_DELIVERY` - Partial delivery
- `PARCEL_EXCHANGE` - Exchange delivery
- `PARCEL_PAID_RETURN` - Paid return
- `ADJUSTMENT_CREDIT` - Admin credit adjustment
- `REFUND` - Refund to merchant

### Debit Transactions
- `DELIVERY_CHARGE` - Delivery charge deduction
- `RETURN_CHARGE` - Return charge deduction
- `INVOICE_PAID` - Invoice payment/withdrawal
- `WITHDRAWAL` - Direct withdrawal
- `ADJUSTMENT_DEBIT` - Admin debit adjustment
- `CLEARANCE` - Clearance deduction

