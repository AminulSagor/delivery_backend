# Admin API Documentation — Part 2

> Auth: `Authorization: Bearer <access_token>` | Role: `ADMIN`

---

# 5. MERCHANT MANAGEMENT (`/merchants`)

### 5.1 Get All Merchants
`GET /merchants`
**Query:** `status` (enum: PENDING|APPROVED|REJECTED), `district` (string), `page`, `limit`

```json
{
  "merchants": [{ "id": "uuid", "full_name": "...", "phone": "...", "status": "APPROVED", "is_active": true }],
  "pagination": { "total": 50, "page": 1, "limit": 10 },
  "message": "Merchants retrieved successfully"
}
```

### 5.2 Get Merchant by ID
`GET /merchants/:id`

### 5.3 Update Merchant
`PATCH /merchants/:id` — Access: Admin + Merchant

| Field           | Type   | Required |
|-----------------|--------|----------|
| fullAddress     | string | ❌       |
| secondaryNumber | string | ❌       |
| thana           | string | ❌       |
| district        | string | ❌       |

### 5.4 Approve Merchant
`PATCH /merchants/:id/approve`
```json
{ "id": "uuid", "status": "APPROVED", "message": "Merchant approved successfully" }
```

### 5.5 Deactivate Merchant
`PATCH /merchants/:id/deactivate`
```json
{ "id": "uuid", "status": "APPROVED", "is_active": false, "message": "Merchant deactivated successfully" }
```

### 5.6 Activate Merchant
`PATCH /merchants/:id/activate`

### 5.7 Decline Merchant
`PATCH /merchants/:id/decline`
```json
{ "id": "uuid", "status": "REJECTED", "is_active": false, "message": "Merchant declined permanently" }
```

### 5.8 Get Merchants with Pending Documents
`GET /merchants/pending-documents`

### 5.9 Approve NID Document
`PATCH /merchants/:id/documents/nid/approve`

### 5.10 Approve Trade License
`PATCH /merchants/:id/documents/trade-license/approve`

### 5.11 Approve TIN Document
`PATCH /merchants/:id/documents/tin/approve`

### 5.12 Approve BIN Document
`PATCH /merchants/:id/documents/bin/approve`

### 5.13 Verify Payout Method
`PATCH /merchants/payout-methods/:id/verify`
```json
{ "success": true, "data": { "method": { /* payout method object */ } }, "message": "Payout method verified successfully" }
```

### 5.14 Get Merchant Overview
`GET /merchants/:id/overview` — Access: Admin + Hub Manager

**Query:** `range` (string), `month` (string)

### 5.15 Toggle Advance Payments
`PATCH /merchants/:id/advance-payments/toggle` — Access: Admin + Hub Manager

| Field                       | Type    | Required | Validation |
|-----------------------------|---------|----------|------------|
| is_advance_payment_disabled | boolean | ✅       | IsBoolean  |

```json
{ "is_advance_payment_disabled": true }
```

---

# 6. STAFF MANAGEMENT (`/staff`)

### 6.1 Create Staff
`POST /staff`

| Field                | Type   | Required | Validation                                  |
|----------------------|--------|----------|---------------------------------------------|
| full_name            | string | ✅       | IsNotEmpty                                  |
| phone                | string | ✅       | Pattern: `^01[0-9]{9}$`                    |
| email                | string | ❌       | IsEmail                                     |
| password             | string | ✅       | MinLength(8)                                |
| position             | enum   | ✅       | RIDER, COURIER, DISPATCHER, WAREHOUSE_ASSISTANT, CUSTOMER_SERVICE, ADMIN_STAFF, OTHER |
| photo                | string | ❌       |                                             |
| secondary_phone      | string | ❌       | Pattern: `^01[0-9]{9}$`                    |
| guardian_mobile_no   | string | ✅       | Pattern: `^01[0-9]{9}$`                    |
| bike_type            | enum   | ✅       | BICYCLE, MOTORCYCLE, SCOOTER, VAN           |
| nid_number           | string | ✅       | IsNotEmpty                                  |
| license_no           | string | ❌       |                                             |
| present_address      | string | ✅       | IsNotEmpty                                  |
| permanent_address    | string | ✅       | IsNotEmpty                                  |
| fixed_salary         | number | ✅       | Min(0)                                      |
| bank_name            | string | ❌       |                                             |
| bank_account_number  | string | ❌       |                                             |
| bank_branch          | string | ❌       |                                             |
| nid_front_photo      | string | ✅       | IsNotEmpty                                  |
| nid_back_photo       | string | ✅       | IsNotEmpty                                  |
| license_front_photo  | string | ❌       |                                             |
| license_back_photo   | string | ❌       |                                             |
| parent_nid_front_photo| string| ✅       | IsNotEmpty                                  |
| parent_nid_back_photo| string | ✅       | IsNotEmpty                                  |
| hub_id               | string | ✅       | IsNotEmpty                                  |

### 6.2 Get All Staff
`GET /staff` — **Query:** `PaginationDto` (page, limit, search, sortBy, order)

### 6.3 Get Staff Counts
`GET /staff/counts`

### 6.4 Get Staff by ID
`GET /staff/:id`

### 6.5 Update Staff
`PATCH /staff/:id` — All CreateStaffDto fields optional + `is_active` (boolean)

### 6.6 Deactivate Staff
`PATCH /staff/:id/deactivate`

### 6.7 Activate Staff
`PATCH /staff/:id/activate`

---

# 7. RIDER MANAGEMENT (`/riders`)

### 7.1 Create Rider
`POST /riders`

| Field                 | Type   | Required | Validation                       |
|-----------------------|--------|----------|----------------------------------|
| full_name             | string | ✅       | IsNotEmpty                       |
| phone                 | string | ✅       | Pattern: `^01[0-9]{9}$`         |
| email                 | string | ❌       | IsEmail                          |
| password              | string | ✅       | MinLength(8)                     |
| photo                 | string | ❌       |                                  |
| guardian_mobile_no    | string | ✅       | Pattern: `^01[0-9]{9}$`         |
| bike_type             | enum   | ✅       | BICYCLE, MOTORCYCLE, SCOOTER, VAN|
| nid_number            | string | ✅       | IsNotEmpty                       |
| license_no            | string | ❌       |                                  |
| present_address       | string | ✅       | IsNotEmpty                       |
| permanent_address     | string | ✅       | IsNotEmpty                       |
| fixed_salary          | number | ✅       | Min(0)                           |
| commission_per_delivery| number| ✅       | Min(0), flat BDT per delivery    |
| bank_name             | string | ❌       |                                  |
| bank_account_number   | string | ❌       |                                  |
| bank_branch           | string | ❌       |                                  |
| nid_front_photo       | string | ❌       |                                  |
| nid_back_photo        | string | ❌       |                                  |
| license_front_photo   | string | ❌       |                                  |
| license_back_photo    | string | ❌       |                                  |
| parent_nid_front_photo| string | ❌       |                                  |
| parent_nid_back_photo | string | ❌       |                                  |
| hub_id                | string | ❌       |                                  |

### 7.2 Get All Riders
`GET /riders` — **Query:** `PaginationDto` + `hubId` (UUID), `approvalStatus` (PENDING|APPROVED|REJECTED)

### 7.3 Get Rider Counts
`GET /riders/counts`

### 7.4 Get Rider by ID
`GET /riders/:id`

### 7.5 Update Rider
`PATCH /riders/:id` — All CreateRiderDto fields optional + `is_active` (boolean)

### 7.6 Approve Rider
`PATCH /riders/:id/approve`
```json
{ "id": "uuid", "approval_status": "APPROVED", "message": "Rider approved successfully" }
```

### 7.7 Reject Rider
`PATCH /riders/:id/reject`

### 7.8 Deactivate Rider
`PATCH /riders/:id/deactivate`

### 7.9 Activate Rider
`PATCH /riders/:id/activate`

---

# 8. STORE MANAGEMENT (`/stores`)

### 8.1 Approve Store
`PATCH /stores/:id/approve`
```json
{ "success": true, "data": { "id": "uuid", "status": "APPROVED" }, "message": "Store approved successfully" }
```

### 8.2 Reject Store
`PATCH /stores/:id/reject`

### 8.3 Assign Hub to Store
`PATCH /stores/:id/assign-hub`

| Field  | Type   | Required |
|--------|--------|----------|
| hub_id | string | ✅       |

```json
{ "hub_id": "uuid-of-hub" }
```

---

# 9. PRICING (`/pricing`)

### 9.1 Create Pricing Configuration
`POST /pricing`

| Field               | Type   | Required | Validation                                     |
|---------------------|--------|----------|------------------------------------------------|
| store_id            | string | ✅       | UUID v4                                        |
| zone                | enum   | ✅       | INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA         |
| delivery_charge     | number | ✅       | Min(0), maxDecimalPlaces(2)                    |
| weight_step_kg      | number | ✅       | Min(0.1), maxDecimalPlaces(2)                  |
| cod_percentage      | number | ✅       | Min(0), Max(100), maxDecimalPlaces(2)          |
| discount_percentage | number | ❌       | Min(0), Max(100)                               |
| start_date          | string | ❌       | ISO date (YYYY-MM-DD)                          |
| end_date            | string | ❌       | ISO date                                       |

### 9.2 Get All Pricing Configs
`GET /pricing`

### 9.3 Get Pricing by Store
`GET /pricing/store/:storeId`

### 9.4 Get Pricing Config by ID
`GET /pricing/:id`

### 9.5 Update Pricing Config
`PATCH /pricing/:id` — All fields optional (same as create minus store_id)

### 9.6 Delete Pricing Config
`DELETE /pricing/:id`

### 9.7 Calculate Weight Charge
`POST /pricing/calculate-weight`

| Field    | Type   | Required | Validation               |
|----------|--------|----------|--------------------------|
| store_id | string | ❌       | UUID                     |
| zone     | enum   | ✅       | INSIDE_DHAKA, etc.       |
| weight_kg| number | ✅       | Min(0), maxDecimalPlaces(2)|

#### Response
```json
{
  "zone": "INSIDE_DHAKA", "parcel_weight_kg": 2.5, "free_weight_kg": 0.5,
  "billable_weight_kg": 2.0, "weight_step_kg": 0.5, "charge_per_step": 10,
  "total_steps": 4, "weight_charge": 40,
  "breakdown": "Weight: 2.5kg → Free: 0.5kg → Billable: 2.0kg → 4 steps × ৳10 = ৳40"
}
```

### 9.8 Create Return Charge Config
`POST /pricing/return-charges`

| Field                     | Type   | Required | Validation                                              |
|---------------------------|--------|----------|---------------------------------------------------------|
| store_id                  | string | ✅       | UUID v4                                                 |
| return_status             | enum   | ✅       | PARTIAL_DELIVERY, EXCHANGE, RETURNED, PAID_RETURN        |
| zone                      | enum   | ✅       | INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA                  |
| return_delivery_charge    | number | ✅       | Min(0)                                                  |
| return_weight_charge_per_kg| number| ✅       | Min(0)                                                  |
| return_cod_percentage     | number | ❌       | Min(0), Max(100)                                        |
| discount_percentage       | number | ❌       | Min(0), Max(100)                                        |
| start_date                | string | ❌       | ISO date                                                |
| end_date                  | string | ❌       | ISO date                                                |

### 9.9 Bulk Create Return Charges
`POST /pricing/return-charges/bulk`

| Field               | Type   | Required |
|---------------------|--------|----------|
| store_id            | string | ✅       |
| zone                | enum   | ✅       |
| discount_percentage | number | ❌       |
| status_charges (or configurations) | StatusChargeDto[] | ✅ |
| start_date          | string | ❌       |
| end_date            | string | ❌       |

**StatusChargeDto:** `{ return_status, return_delivery_charge, return_weight_charge_per_kg, return_cod_percentage?, discount_percentage?, start_date?, end_date? }`

### 9.10 Get Return Charges by Store
`GET /pricing/return-charges/store/:storeId`

### 9.11 Update Return Charge
`PATCH /pricing/return-charges/:id` — All fields optional

### 9.12 Delete Return Charge
`DELETE /pricing/return-charges/:id`

---

# 10. BANK MANAGEMENT (`/banks`)

### 10.1 Create Bank
`POST /banks`

| Field         | Type    | Required | Validation     |
|---------------|---------|----------|----------------|
| name          | string  | ✅       | MaxLength(255) |
| short_name    | string  | ✅       | MaxLength(255) |
| district      | string  | ❌       | MaxLength(255) |
| branch_name   | string  | ❌       | MaxLength(255) |
| routing       | string  | ❌       | MaxLength(255) |
| logo_url      | string  | ❌       | MaxLength(500) |
| swift_code    | string  | ❌       | MaxLength(20)  |
| is_active     | boolean | ❌       |                |
| display_order | number  | ❌       | Min(0)         |

### 10.2 Get All Banks
`GET /banks`

### 10.3 Get Bank by ID
`GET /banks/:id`

### 10.4 Update Bank
`PATCH /banks/:id` — All fields optional

### 10.5 Delete Bank
`DELETE /banks/:id`

### 10.6 Seed Default Banks
`POST /banks/seed`
```json
{ "message": "Banks seeded successfully", "count": 62 }
```

---

# 11. THIRD-PARTY PROVIDERS (`/third-party-providers`)

### 11.1 Create Provider
`POST /third-party-providers`

| Field         | Type    | Required | Validation                         |
|---------------|---------|----------|------------------------------------|
| provider_code | string  | ✅       | MaxLength(50), Pattern: `^[A-Z0-9_]+$` |
| provider_name | string  | ✅       | MaxLength(100)                     |
| description   | string  | ❌       |                                    |
| is_active     | boolean | ❌       |                                    |

### 11.2 Get All Providers
`GET /third-party-providers`

### 11.3 Get Provider by ID
`GET /third-party-providers/:id`

### 11.4 Update Provider
`PATCH /third-party-providers/:id`

### 11.5 Delete Provider
`DELETE /third-party-providers/:id`

---

# 12. COVERAGE AREAS (`/coverage-areas`)

### 12.1 Test Connection
`GET /coverage-areas/test-connection`

### 12.2 Sync Coverage Areas
`POST /coverage-areas/sync`

---

# 13. PARCEL MANAGEMENT (`/parcels`)

### 13.1 Get All Parcels
`GET /parcels`

**Query (`ParcelQueryDto`):**

| Param         | Type   | Required | Notes                           |
|---------------|--------|----------|---------------------------------|
| status        | enum   | ❌       | ParcelStatus or `ACTIVE`        |
| days          | number | ❌       | 1-365                           |
| paymentStatus | enum   | ❌       | PaymentStatus                   |
| storeId       | string | ❌       | UUID                            |
| merchantId    | string | ❌       | UUID                            |
| hubId         | string | ❌       | UUID                            |
| customerName  | string | ❌       |                                 |
| customerPhone | string | ❌       |                                 |
| merchantName  | string | ❌       |                                 |
| area          | string | ❌       |                                 |
| minAmount     | number | ❌       |                                 |
| maxAmount     | number | ❌       |                                 |
| deliveryType  | enum   | ❌       | 0=NORMAL, 1=EXPRESS, 2=SAME_DAY |
| page          | number | ❌       | default: 1                      |
| limit         | number | ❌       | default: 20, max: 100           |
| search        | string | ❌       |                                 |
| sortBy        | string | ❌       | default: created_at             |
| order         | string | ❌       | ASC or DESC                     |

### 13.2 Get Parcel by ID
`GET /parcels/:id`

### 13.3 Update Parcel
`PATCH /parcels/:id` — All CreateParcelDto fields optional + `status` (ParcelStatus), `payment_status` (PaymentStatus)

### 13.4 Update Parcel Charges (Admin)
`PATCH /parcels/:id/charges`

| Field           | Type   | Required | Validation       |
|-----------------|--------|----------|------------------|
| product_weight  | number | ❌       | Min(0), max 2 dp |
| delivery_charge | number | ❌       | Min(0), max 2 dp |
| weight_charge   | number | ❌       | Min(0), max 2 dp |

---

# 14. ADVANCE PAYMENTS (`/advance-payments`)

### 14.1 Create Advance Payment Invoice
`POST /advance-payments/admin/create/invoice`

| Field                    | Type   | Required | Validation |
|--------------------------|--------|----------|------------|
| merchant_id              | string | ✅       | UUID       |
| total_parcels            | number | ✅       | Min(0)     |
| payment_method           | string | ✅       | IsNotEmpty |
| total_collectable_amount | number | ✅       |            |
| delivery_fee             | number | ✅       |            |
| cod_charge               | number | ✅       |            |
| previous_weight_charge   | number | ✅       |            |
| return_amount            | number | ✅       |            |
| admin_note               | string | ❌       |            |

### 14.2 Get All Advance Payments
`GET /advance-payments/admin/invoice/list`

**Query (`GetAdvancePaymentsQueryDto` extends PaginationDto):**

| Param       | Type   | Notes                                                                    |
|-------------|--------|--------------------------------------------------------------------------|
| status      | enum   | PENDING_MERCHANT_APPROVAL, MERCHANT_REVIEW_REQUESTED, APPROVED_BY_MERCHANT, PAID, CANCELLED |
| merchant_id | string | UUID                                                                     |
| start_date  | string |                                                                          |
| end_date    | string |                                                                          |

### 14.3 Get Advance Payment by ID
`GET /advance-payments/admin/invoice/:id`

### 14.4 Update Advance Payment
`PATCH /advance-payments/admin/invoice/:id/update` — Same body as Create

### 14.5 Mark as Paid
`PATCH /advance-payments/admin/invoice/:id/pay`

---

# 15. MERCHANT FINANCE (`/merchant-finance`)

### 15.1 Get All Merchants Finance Summary
`GET /merchant-finance/admin/all`

| Param       | Type    | Notes                                    |
|-------------|---------|------------------------------------------|
| page        | number  | default: 1                               |
| limit       | number  | default: 20                              |
| search      | string  |                                          |
| has_balance | boolean |                                          |
| has_pending | boolean |                                          |
| sort_by     | string  | current_balance, total_earned, created_at |
| sort_order  | string  | ASC or DESC                              |

### 15.2 Get Merchant Finance Overview
`GET /merchant-finance/admin/:merchantId`

### 15.3 Get Merchant Transactions
`GET /merchant-finance/admin/:merchantId/transactions`

| Param            | Type   | Notes                                             |
|------------------|--------|---------------------------------------------------|
| page             | number | default: 1                                        |
| limit            | number | default: 20                                       |
| transaction_type | enum   | CREDIT, DEBIT, ADVANCE_PAYMENT                    |
| reference_type   | enum   | PARCEL_DELIVERED, DELIVERY_CHARGE, WITHDRAWAL, etc.|
| from_date        | string | ISO date                                          |
| to_date          | string | ISO date                                          |
| search           | string |                                                   |
| sort_by          | string | created_at or amount                              |
| sort_order       | string | ASC or DESC                                       |

### 15.4 Adjust Merchant Balance
`POST /merchant-finance/admin/:merchantId/adjust`

| Field  | Type   | Required | Validation                   |
|--------|--------|----------|------------------------------|
| type   | enum   | ✅       | CREDIT, DEBIT, ADVANCE_PAYMENT|
| amount | number | ✅       | Min(0.01)                    |
| reason | string | ✅       | IsNotEmpty                   |
| notes  | string | ❌       |                              |

```json
{ "type": "CREDIT", "amount": 5000, "reason": "Manual adjustment for dispute resolution" }
```

#### Response
```json
{
  "success": true,
  "data": { "transaction_id": "uuid", "type": "CREDIT", "amount": 5000, "balance_after": 25000 },
  "message": "Balance credited successfully"
}
```

### 15.5 Hold Merchant Balance
`POST /merchant-finance/admin/:merchantId/hold`

| Field  | Type   | Required |
|--------|--------|----------|
| amount | number | ✅       |
| reason | string | ✅       |
| notes  | string | ❌       |

### 15.6 Release Held Balance
`POST /merchant-finance/admin/:merchantId/release-hold`

| Field  | Type   | Required |
|--------|--------|----------|
| amount | number | ✅       |
| notes  | string | ❌       |

### 15.7 Sync Merchant Finance
`POST /merchant-finance/admin/:merchantId/sync`

### 15.8 Sync All Merchants Finance
`POST /merchant-finance/admin/sync-all`

```json
{
  "success": true,
  "data": { "synced": 45, "errors": 0 },
  "message": "Synced 45 merchants, 0 errors"
}
```

---

# 📎 ENUM QUICK REFERENCE

| Enum                  | Values                                                                      |
|-----------------------|-----------------------------------------------------------------------------|
| UserRole              | ADMIN, HUB_MANAGER, RIDER, STAFF, MERCHANT                                 |
| MerchantStatus        | PENDING, APPROVED, REJECTED                                                 |
| RiderApprovalStatus   | PENDING, APPROVED, REJECTED                                                 |
| PricingZone           | INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA                                     |
| BikeType              | BICYCLE, MOTORCYCLE, SCOOTER, VAN                                          |
| StaffPosition         | RIDER, COURIER, DISPATCHER, WAREHOUSE_ASSISTANT, CUSTOMER_SERVICE, ADMIN_STAFF, OTHER |
| AccountProviderType   | BANK, BKASH, NAGAD, CASH                                                   |
| AccountTransactionType| CREDIT, DEBIT                                                               |
| TransferRecordStatus  | PENDING, IN_REVIEW, APPROVED, REJECTED, DECLINED                           |
| ReturnStatus          | PARTIAL_DELIVERY, EXCHANGE, RETURNED, PAID_RETURN                           |
| AdvancePaymentStatus  | PENDING_MERCHANT_APPROVAL, MERCHANT_REVIEW_REQUESTED, APPROVED_BY_MERCHANT, PAID, CANCELLED |
| FinanceTransactionType| CREDIT, DEBIT, ADVANCE_PAYMENT                                             |
| DeliveryType          | 0=NORMAL, 1=EXPRESS, 2=SAME_DAY                                            |
| ParcelType            | 0=PARCEL, 1=BOOK, 2=DOCUMENT                                               |
