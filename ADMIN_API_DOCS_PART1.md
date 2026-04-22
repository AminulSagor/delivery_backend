# 🔐 Admin Panel API Documentation — Part 1

> **Base URL:** `{{baseUrl}}`
> **Authentication:** JWT Bearer Token
> **Required Role:** `ADMIN`
> **Header:**
> ```
> Authorization: Bearer <access_token>
> ```

---

## 📊 Common Error Responses

All endpoints share these error formats:

```json
// 400 - Validation Error
{
  "statusCode": 400,
  "message": ["field must be a string", "field should not be empty"],
  "error": "Bad Request"
}

// 401 - Unauthorized (missing/invalid token)
{
  "statusCode": 401,
  "message": "Unauthorized"
}

// 403 - Forbidden (non-admin role)
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}

// 404 - Not Found
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

---

## 📊 Common Pagination Format

```json
{
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

---

# 1. ADMIN MANAGEMENT (`/admin`)

All endpoints under `/admin` are Admin-only (controller-level `@Roles(UserRole.ADMIN)`).

---

### 1.1 Create Admin

**Method:** `POST`
**URL:** `{{baseUrl}}/admin`
**Access:** ⚠️ PUBLIC (no auth required — remove in production)

#### Request DTO (`CreateAdminDto`)

| Field    | Type   | Required | Validation         |
|----------|--------|----------|--------------------|
| fullName | string | ✅       | IsNotEmpty         |
| phone    | string | ✅       | IsNotEmpty         |
| email    | string | ❌       | IsEmail            |
| password | string | ✅       | IsNotEmpty, MinLength(8) |

```json
{
  "fullName": "Admin User",
  "phone": "01712345678",
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

#### Response
```json
{
  "id": "a1b2c3d4-...",
  "fullName": "Admin User",
  "phone": "01712345678",
  "email": "admin@example.com",
  "role": "ADMIN",
  "is_active": true,
  "created_at": "2026-04-22T05:00:00.000Z",
  "updated_at": "2026-04-22T05:00:00.000Z",
  "message": "Admin user created successfully"
}
```

---

### 1.2 Get All Admins

**Method:** `GET`
**URL:** `{{baseUrl}}/admin`
**Access:** Admin Only

#### Response
```json
[
  {
    "id": "a1b2c3d4-...",
    "fullName": "Admin User",
    "phone": "01712345678",
    "email": "admin@example.com",
    "role": "ADMIN",
    "is_active": true,
    "created_at": "2026-04-22T05:00:00.000Z",
    "updated_at": "2026-04-22T05:00:00.000Z"
  }
]
```

---

### 1.3 Get Admin by ID

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/:id`
**Access:** Admin Only

---

### 1.4 Update Admin

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/:id`
**Access:** Admin Only

#### Request DTO (`UpdateAdminDto`)

| Field    | Type   | Required | Validation         |
|----------|--------|----------|--------------------|
| fullName | string | ❌       | IsString           |
| phone    | string | ❌       | IsString           |
| email    | string | ❌       | IsEmail            |
| password | string | ❌       | IsString, MinLength(8) |

---

### 1.5 Delete Admin

**Method:** `DELETE`
**URL:** `{{baseUrl}}/admin/:id`
**Access:** Admin Only

#### Response
```json
{ "deleted": true, "message": "Admin user deleted successfully" }
```

---

### 1.6 Deactivate Admin

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/:id/deactivate`
**Access:** Admin Only

---

### 1.7 Activate Admin

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/:id/activate`
**Access:** Admin Only

---

### 1.8 Get Hub Transfer Records (Admin Review)

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/hub-transfer-records`
**Access:** Admin Only

#### Query Params (`TransferRecordQueryDto`)

| Param       | Type   | Required | Validation                                                  |
|-------------|--------|----------|-------------------------------------------------------------|
| status      | string | ❌       | Enum: `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `DECLINED` |
| hubId       | string | ❌       | UUID                                                        |
| hubManagerId| string | ❌       | UUID                                                        |
| fromDate    | string | ❌       | ISO date string                                             |
| toDate      | string | ❌       | ISO date string                                             |
| page        | number | ❌       | Min(1), default: 1                                          |
| limit       | number | ❌       | Min(1), Max(100), default: 10                               |

**Example:** `?page=1&limit=10&status=PENDING`

#### Response
```json
{
  "success": true,
  "data": {
    "records": [ /* transfer record objects */ ],
    "pagination": { "total": 25, "page": 1, "limit": 10, "totalPages": 3 }
  },
  "message": "Hub transfer records retrieved successfully"
}
```

---

### 1.9 Approve Transfer Record

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/hub-transfer-records/:id/approve`
**Access:** Admin Only
**Param:** `id` — UUID

#### Request DTO (`ApproveTransferRecordDto`)

| Field       | Type   | Required | Validation |
|-------------|--------|----------|------------|
| admin_notes | string | ❌       | IsString   |

```json
{ "admin_notes": "Verified and approved" }
```

#### Response
```json
{
  "success": true,
  "data": { "transfer_record": { /* record object */ } },
  "message": "Transfer record approved successfully"
}
```

---

### 1.10 Reject Transfer Record

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/hub-transfer-records/:id/reject`
**Access:** Admin Only

#### Request DTO (`RejectTransferRecordDto`)

| Field            | Type   | Required | Validation          |
|------------------|--------|----------|---------------------|
| rejection_reason | string | ✅       | IsNotEmpty, IsString|
| admin_notes      | string | ❌       | IsString            |

```json
{ "rejection_reason": "Amount mismatch", "admin_notes": "Re-check receipt" }
```

---

### 1.11 Get Merchant Clearance List

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/merchants/clearance-list`
**Access:** Admin Only

#### Query Params

| Param       | Type   | Required |
|-------------|--------|----------|
| page        | string | ❌       |
| limit       | string | ❌       |
| merchant_id | string | ❌       |
| search      | string | ❌       |

#### Response
```json
{
  "success": true,
  "data": {
    "merchants": [ /* merchant clearance objects */ ],
    "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 },
    "summary": { /* aggregated summary */ }
  },
  "message": "Merchant clearance list retrieved successfully"
}
```

---

# 2. ADMIN ACCOUNTS (`/admin/accounts`)

All endpoints under `/admin/accounts` are Admin-only.

---

### 2.1 Create Admin Account

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/accounts`
**Access:** Admin Only

#### Request DTO (`CreateAdminAccountDto`)

| Field               | Type   | Required | Validation                                          |
|---------------------|--------|----------|-----------------------------------------------------|
| account_name        | string | ✅       | IsNotEmpty, IsString                                |
| account_number      | string | ✅       | IsNotEmpty, IsString                                |
| account_holder_name | string | ✅       | IsNotEmpty, IsString                                |
| district            | string | ❌       | IsString                                            |
| branch_name         | string | ❌       | IsString                                            |
| routing             | string | ❌       | IsString                                            |
| provider_type       | enum   | ✅       | Enum: `BANK`, `BKASH`, `NAGAD`, `CASH`             |
| opening_balance     | number | ❌       | Min(0)                                              |
| notes               | string | ❌       | IsString                                            |

```json
{
  "account_name": "DBBL Corporate",
  "account_number": "1234567890",
  "account_holder_name": "Company Ltd",
  "district": "Dhaka",
  "branch_name": "Gulshan",
  "routing": "090261234",
  "provider_type": "BANK",
  "opening_balance": 50000,
  "notes": "Main corporate account"
}
```

#### Response — Returns the saved `AdminAccount` entity:
```json
{
  "id": "uuid-...",
  "account_name": "DBBL Corporate",
  "account_number": "1234567890",
  "account_holder_name": "Company Ltd",
  "district": "Dhaka",
  "branch_name": "Gulshan",
  "routing": "090261234",
  "provider_type": "BANK",
  "current_balance": 50000,
  "is_active": true,
  "notes": "Main corporate account",
  "created_at": "2026-04-22T05:00:00.000Z",
  "updated_at": "2026-04-22T05:00:00.000Z"
}
```

---

### 2.2 Get All Admin Accounts

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts`
**Access:** Admin Only

---

### 2.3 Get Admin Account by ID

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/:id`
**Access:** Admin Only

---

### 2.4 Get Active Accounts

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/list/active`
**Access:** Admin + Hub Manager

#### Query Params (`PaginationDto`)

| Param  | Type   | Required | Default |
|--------|--------|----------|---------|
| page   | number | ❌       | 1       |
| limit  | number | ❌       | 20      |
| search | string | ❌       | —       |
| sortBy | string | ❌       | created_at |
| order  | string | ❌       | DESC    |

---

### 2.5 Get Single Active Account

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/list/active/:id`
**Access:** Admin + Hub Manager

---

### 2.6 Update Admin Account

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/accounts/:id`
**Access:** Admin Only

#### Request DTO (`UpdateAdminAccountDto`) — All fields optional (extends PartialType)

Same fields as Create + `is_active` (boolean, optional).

---

### 2.7 Delete Admin Account

**Method:** `DELETE`
**URL:** `{{baseUrl}}/admin/accounts/:id`
**Access:** Admin Only

> ⚠️ Cannot delete account with existing transactions. Deactivate instead.

---

### 2.8 Create Manual Transaction

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/accounts/transaction`
**Access:** Admin Only

#### Request DTO (`ManualTransactionDto`)

| Field        | Type   | Required | Validation                    |
|--------------|--------|----------|-------------------------------|
| account_id   | string | ✅       | IsUUID                        |
| type         | enum   | ✅       | Enum: `CREDIT`, `DEBIT`       |
| amount       | number | ✅       | Min(1)                        |
| description  | string | ✅       | IsNotEmpty, IsString          |
| reference_id | string | ❌       | IsString                      |

```json
{
  "account_id": "uuid-...",
  "type": "CREDIT",
  "amount": 10000,
  "description": "Cash deposit from hub collection",
  "reference_id": "COL-2026-001"
}
```

---

### 2.9 Get Finance Overview

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/finance/overview`
**Access:** Admin Only

#### Response
```json
{
  "available_balance": 150000,
  "transferred_this_month": 50000,
  "expenses_this_month": 8000,
  "pending_transfer": 0,
  "lifetime_expenses": 120000,
  "lifetime_transferred": 500000
}
```

---

### 2.10 Transfer Funds Between Accounts

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/accounts/transfer`
**Access:** Admin Only

#### Request DTO (`TransferFundsDto`)

| Field           | Type   | Required | Validation   |
|-----------------|--------|----------|--------------|
| from_account_id | string | ✅       | IsUUID       |
| to_account_id   | string | ✅       | IsUUID       |
| amount          | number | ✅       | Min(1)       |
| description     | string | ❌       | IsString     |
| reference_id    | string | ❌       | IsString     |

```json
{
  "from_account_id": "uuid-1",
  "to_account_id": "uuid-2",
  "amount": 25000,
  "description": "Monthly salary transfer"
}
```

#### Response
```json
{ "transaction_id": "TXN-...", "message": "Transfer successful" }
```

---

### 2.11 Get Account Statements

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/:id/statements`
**Access:** Admin Only
**Query:** `PaginationDto` (page, limit, search, sortBy, order)

---

### 2.12 Get All Statements (Global)

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/statements/list`
**Access:** Admin Only

| Param      | Type   | Required |
|------------|--------|----------|
| page       | number | ❌       |
| limit      | number | ❌       |
| account_id | string | ❌       |
| type       | enum   | ❌       |
| start_date | string | ❌       |
| end_date   | string | ❌       |

---

### 2.13 Get All Transfers

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/transfers/list`
**Access:** Admin Only
**Query:** `page` (number)

---

### 2.14 Get Transfer by ID

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/transfers/:id`
**Access:** Admin Only

---

### 2.15 Get Statement by ID

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/accounts/statements/:id`
**Access:** Admin Only

---

### 2.16 Edit Statement

**Method:** `PATCH`
**URL:** `{{baseUrl}}/admin/accounts/statements/:id`
**Access:** Admin Only

#### Request DTO (`UpdateStatementDto`)

| Field       | Type   | Required | Validation |
|-------------|--------|----------|------------|
| description | string | ❌       | IsString   |
| amount      | number | ❌       | Min(1)     |

> ⚠️ Changing amount auto-adjusts the account balance.

---

### 2.17 Delete Statement

**Method:** `DELETE`
**URL:** `{{baseUrl}}/admin/accounts/statements/:id`
**Access:** Admin Only

> Reverses the transaction and adjusts account balance.

---

# 3. ADMIN EMAIL & SMS TESTING

### 3.1 Verify Email Connection

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/email/verify`
**Access:** Admin Only

#### Response
```json
{ "success": true, "message": "Email server connection verified successfully" }
```

---

### 3.2 Send Test Email

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/email/test`
**Access:** Admin Only

#### Request
```json
{ "email": "test@example.com" }
```

---

### 3.3 Get SMS Status

**Method:** `GET`
**URL:** `{{baseUrl}}/admin/sms/status`
**Access:** Admin Only

---

### 3.4 Toggle SMS Service

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/sms/toggle`
**Access:** Admin Only

#### Request
```json
{ "active": true }
```

---

### 3.5 Check SMS Balance

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/sms/balance`
**Access:** Admin Only

---

### 3.6 Send Test SMS

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/sms/test`
**Access:** Admin Only

#### Request
```json
{ "phone": "01712345678" }
```

---

### 3.7 Get SMS Report

**Method:** `POST`
**URL:** `{{baseUrl}}/admin/sms/report`
**Access:** Admin Only

#### Request
```json
{ "requestId": 12345 }
```

---

# 4. HUB MANAGEMENT (`/hubs`)

---

### 4.1 Create Hub

**Method:** `POST`
**URL:** `{{baseUrl}}/hubs`
**Access:** Admin Only

#### Request DTO (`CreateHubDto`)

| Field            | Type   | Required | Validation                                                    |
|------------------|--------|----------|---------------------------------------------------------------|
| hub_code         | string | ❌       | MaxLength(50), Pattern: `^[A-Z0-9_-]+$` (auto-generated if omitted) |
| branch_name      | string | ✅       | IsNotEmpty, MaxLength(255)                                    |
| area             | string | ✅       | IsNotEmpty, MaxLength(255)                                    |
| address          | string | ✅       | IsNotEmpty                                                    |
| manager_name     | string | ✅       | IsNotEmpty, MaxLength(255)                                    |
| manager_phone    | string | ✅       | Pattern: `^01[3-9]\d{8}$`                                    |
| manager_email    | string | ❌       | IsEmail, MaxLength(255)                                       |
| manager_password | string | ✅       | MinLength(8), MaxLength(100), Pattern: upper+lower+digit      |
| manager_user_id  | string | ❌       | IsUUID                                                        |

```json
{
  "branch_name": "Gulshan Hub",
  "area": "Gulshan-2",
  "address": "123 Gulshan Avenue, Dhaka 1212",
  "manager_name": "Karim Ahmed",
  "manager_phone": "01712345678",
  "manager_email": "karim@hub.com",
  "manager_password": "Manager@123"
}
```

#### Response
```json
{ "id": "uuid-...", "hub_code": "GULSHAN-HUB", "message": "Hub created successfully" }
```

---

### 4.2 Get All Hubs

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs`
**Access:** Admin Only

#### Response
```json
{
  "hubs": [
    {
      "id": "uuid-...", "hub_code": "GULSHAN-HUB", "branch_name": "Gulshan Hub",
      "area": "Gulshan-2", "address": "123 Gulshan Ave", "is_active": true,
      "status": "ACTIVE", "manager_name": "Karim Ahmed"
    }
  ],
  "total": 5,
  "message": "Hubs retrieved successfully"
}
```

---

### 4.3 Get Hub by ID

**Method:** `GET` | **URL:** `{{baseUrl}}/hubs/:id` | **Access:** Admin Only

---

### 4.4 Update Hub

**Method:** `PATCH`
**URL:** `{{baseUrl}}/hubs/:id`
**Access:** Admin Only

#### Request DTO (`UpdateHubDto`) — All optional

| Field           | Type   | Validation               |
|-----------------|--------|--------------------------|
| branch_name     | string | IsNotEmpty, MaxLength(255)|
| area            | string | IsNotEmpty, MaxLength(255)|
| address         | string | IsNotEmpty               |
| manager_name    | string | IsNotEmpty, MaxLength(255)|
| manager_phone   | string | IsNotEmpty, MaxLength(50) |
| manager_user_id | string | IsUUID v4                |

---

### 4.5 Delete Hub

**Method:** `DELETE` | **URL:** `{{baseUrl}}/hubs/:id` | **Access:** Admin Only

---

### 4.6 Deactivate Hub

**Method:** `PATCH` | **URL:** `{{baseUrl}}/hubs/:id/deactivate` | **Access:** Admin Only

#### Response
```json
{ "id": "uuid", "hub_code": "HUB-01", "status": "INACTIVE", "is_active": false, "message": "Hub deactivated successfully" }
```

---

### 4.7 Activate Hub

**Method:** `PATCH` | **URL:** `{{baseUrl}}/hubs/:id/activate` | **Access:** Admin Only

---

### 4.8 Decline Hub

**Method:** `PATCH` | **URL:** `{{baseUrl}}/hubs/:id/decline` | **Access:** Admin Only

---

### 4.9 Get Hubs List (Shared)

**Method:** `GET` | **URL:** `{{baseUrl}}/hubs/list` | **Access:** Admin + Hub Manager

---

### 4.10 Get All Hub Finance Transfers (Admin)

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs/admin/finance/transfers`
**Access:** Admin Only
**Query:** `PaginationDto` (page, limit, search, sortBy, order)

---

### 4.11 Get Hub Finance Transfer by ID (Admin)

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs/admin/finance/transfers/:id`
**Access:** Admin Only

---

### 4.12 Get All Hub Finance Expenses (Admin)

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs/admin/finance/expenses`
**Access:** Admin Only
**Query:** `PaginationDto`

---

### 4.13 Get Hub Finance Expense by ID (Admin)

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs/admin/finance/expenses/:id`
**Access:** Admin Only

---

### 4.14 Review Hub Transfer (Admin)

**Method:** `PATCH`
**URL:** `{{baseUrl}}/hubs/finance/transfer/:id/review`
**Access:** Admin Only

#### Request DTO (`ReviewFinanceRequestDto`)

| Field            | Type   | Required | Validation                              |
|------------------|--------|----------|-----------------------------------------|
| status           | enum   | ✅       | Enum: `APPROVED`, `DECLINED`            |
| rejection_reason | string | ❌       | IsString (mandatory if DECLINED, enforced in service) |

```json
{ "status": "APPROVED" }
```

---

### 4.15 Review Hub Expense (Admin)

**Method:** `PATCH`
**URL:** `{{baseUrl}}/hubs/finance/expense/:id/review`
**Access:** Admin Only

Same DTO as 4.14 (`ReviewFinanceRequestDto`).

---

### 4.16 Get Parcel Reports (Shared)

**Method:** `GET`
**URL:** `{{baseUrl}}/hubs/parcels/reports`
**Access:** Admin + Hub Manager

#### Query Params (`ParcelReportQueryDto`)

| Param      | Type   | Required |
|------------|--------|----------|
| hub_id     | string | ❌ (Admin can filter) |
| search     | string | ❌       |
| issue_type | enum   | ❌       |
| page       | string | ❌       |
| limit      | string | ❌       |

---

### 4.17 Get Single Parcel Report

**Method:** `GET` | **URL:** `{{baseUrl}}/hubs/parcels/reports/:id` | **Access:** Admin + Hub Manager

---

### 4.18 Resolve Parcel Report

**Method:** `PATCH`
**URL:** `{{baseUrl}}/hubs/parcels/reports/:id/resolve`
**Access:** Admin + Hub Manager

#### Request DTO (`ResolveReportDto`)

| Field         | Type   | Required | Validation        |
|---------------|--------|----------|-------------------|
| action_status | enum   | ✅       | ParcelStatus enum |
| admin_notes   | string | ❌       | IsString          |

---

### 4.19 Bulk Resolve Parcel Reports

**Method:** `POST`
**URL:** `{{baseUrl}}/hubs/parcels/reports/bulk-resolve`
**Access:** Admin + Hub Manager

#### Request DTO (`BulkResolveReportDto`)

| Field         | Type     | Required |
|---------------|----------|----------|
| action_status | enum     | ✅       |
| admin_notes   | string   | ❌       |
| parcel_ids    | string[] | ✅       |

