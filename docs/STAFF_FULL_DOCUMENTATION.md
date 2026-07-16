**Staff Module — Full Implementation & Auto Bank Payout**

- **Purpose:** Document the full staff creation, payroll, and automatic bank payout flow implemented across the codebase. This doc is for developers and maintainers to understand design, APIs, DB changes, and operational steps.

**Overview**:
- **Auto Bank Payout:** When an admin creates a staff member, the system now requires full bank details and automatically creates a verified bank payout method for the staff. A finance ledger (StaffFinance) is created to track balances and last payouts.
- **Files Changed / Added:**
  - **Entities:** [src/staff/entities/staff-finance.entity.ts](src/staff/entities/staff-finance.entity.ts#L1)
  - **DTO:** [src/staff/dto/create-staff.dto.ts](src/staff/dto/create-staff.dto.ts#L1)
  - **Service:** [src/staff/staff.service.ts](src/staff/staff.service.ts#L1)
  - **Module:** [src/staff/staff.module.ts](src/staff/staff.module.ts#L1)
  - **Salary service updates:** [src/salary/salary.service.ts](src/salary/salary.service.ts#L1)
  - **Salary module update:** [src/salary/salary.module.ts](src/salary/salary.module.ts#L1)
  - **Migration:** [src/migrations/1717225200000-CreateStaffFinance.ts](src/migrations/1717225200000-CreateStaffFinance.ts#L1)
  - **Postman collection:** [postman/Staff.postman_collection.json](postman/Staff.postman_collection.json#L1)

**Design & Rationale**:
- Require full bank details for all staff to ensure payroll always has a verified payout path.
- Create `StaffPayoutMethod` immediately (VERIFIED, is_default=true) so admins can process payments without additional verification steps.
- Introduce `StaffFinance` entity as a single-row ledger per staff to keep cumulative `total_paid_amount`, `remaining_balance`, and `last_payout_*` fields for efficient reads in the admin UI.
- Keep creation transactional to ensure User/Staff/PayoutMethod/StaffFinance are created atomically.

**Schema: StaffFinance**
- Table: `staff_finances`
- Columns:
  - `id` (uuid) — PK
  - `staff_id` (uuid) — unique FK to `staffs` with ON DELETE CASCADE
  - `total_paid_amount` (numeric) — cumulative paid
  - `remaining_balance` (numeric) — amount currently owed
  - `last_payout_at` (timestamp)
  - `last_payout_amount` (numeric)
  - `created_at`, `updated_at`

**Create Staff (Admin)**
- Input: Use `POST {{baseUrl}}/staff` with full CreateStaffDto payload.
- Required bank fields (all required):
  - **bank_name**, **bank_account_number**, **bank_branch**, **district**, **account_holder_name**, **routing_number**
- Side effects (transactional):
  1. Create `User` record
  2. Create `Staff` record
  3. Create `StaffPayoutMethod` with:
     - `method_type`: BANK_ACCOUNT
     - `status`: VERIFIED
     - `is_default`: true
     - `is_active`: true
     - persisted bank fields
  4. Create `StaffFinance` with `remaining_balance` prefilled from `fixed_salary` (or 0)

**APIs (detailed endpoints, request & response examples)**

1) Create Staff (Admin)
  - Endpoint: POST [{{baseUrl}}]/staff
  - Description: Create User + Staff, automatically create `StaffPayoutMethod` (BANK_ACCOUNT, VERIFIED) and `StaffFinance`.
  - Request body (application/json):

```json
{
  "full_name": "John Staff",
  "phone": "01712345678",
  "email": "john.staff@example.com",
  "password": "StrongPass123",
  "position": "ADMIN_STAFF",
  "fixed_salary": 15000,
  "bank_name": "DBBL",
  "bank_account_number": "123456789012",
  "bank_branch": "Gulshan Branch",
  "district": "Dhaka",
  "account_holder_name": "John Staff",
  "routing_number": "DBBLDHA",
  "hub_id": "{{hubId}}"
}
```

  - Success response (201):

```json
{
  "status": "success",
  "data": {
    "staff": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user": { "id": "u-01", "full_name": "John Staff", "phone": "01712345678", "email": "john.staff@example.com" },
      "position": "ADMIN_STAFF",
      "hub_id": "hub-01",
      "payout_method": {
        "id": "pm-01",
        "method_type": "BANK_ACCOUNT",
        "bank_name": "DBBL",
        "account_number_masked": "1234****9012",
        "status": "VERIFIED",
        "is_default": true
      },
      "finance": {
        "id": "sf-01",
        "remaining_balance": 15000,
        "total_paid_amount": 0,
        "last_payout_at": null
      }
    }
  }
}
```

  - Validation errors (400): missing bank fields will return field-specific messages.

Filters/Notes:
  - All bank fields are required for staff creation.

2) Get Staff Payouts (staff)
  - Endpoint: GET [{{baseUrl}}]/api/salary/staff/{staffId}/payouts
  - Query params:
    - `page` (int, default=1)
    - `limit` (int, default=20)
    - `status` (optional, e.g., COMPLETED, PENDING)
    - `start_date`, `end_date` (optional, ISO date strings for range)

  - Example request:
    GET /api/salary/staff/550e8400-e29b-41d4-a716-446655440000/payouts?page=1&limit=10&status=COMPLETED

  - Response (200):

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "ptx-01",
        "amount": 15000,
        "status": "COMPLETED",
        "paid_at": "2026-05-15T10:30:00Z",
        "reference_number": "SAL-ABC-1623456789000",
        "payout_method": { "id": "pm-01", "bank_name": "DBBL", "account_number_masked": "1234****9012" }
      }
    ],
    "pagination": { "total_items": 1, "current_page": 1, "items_per_page": 10 }
  }
}
```

3) Payout History (Admin dashboard aggregated list)
  - Endpoint: GET [{{baseUrl}}]/admin/payout-history
  - Query params / filters:
    - `search` — matches staff name or phone (partial)
    - `page`, `limit` — pagination
    - `start_date`, `end_date` — filter payouts within date range (ISO: YYYY-MM-DD)

  - Example request:
    GET /admin/payout-history?search=John&page=1&limit=10&start_date=2026-01-01&end_date=2026-12-31

  - Response (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "payout_id": "650e8400-e29b-41d4-a716-446655440001",
      "profile": {
        "profile_pic": null,
        "name": "John Staff",
        "number": "01712345678"
      },
      "position": "ADMIN_STAFF",
      "assigned_hub": "Gulshan",
      "last_paid": { "date_time": "2026-05-15T10:30:00.000Z" },
      "salary_amount": 15000,
      "currency": "BDT",
      "paid_using": "DBBL"
    }
  ],
  "meta": {
    "title": "Payout History",
    "subtitle": "Salary Management - Staff List",
    "pagination": {
      "total_records": 1,
      "current_page": 1,
      "limit": 10,
      "showing": "1 - 1 of 1"
    }
  }
}
```

4) Payout Details (Modal)
  - Endpoint: GET [{{baseUrl}}]/admin/payout-history-details/{staffId}
  - Description: Returns staff profile, lifetime paid salary, the amount paid in the latest payout month, the recipient account used for that payout, and the source admin account balance immediately after payment.
  - The admin source account is resolved from a debit statement whose `reference_id` matches the payout transaction ID or reference number. It is `null` when the salary debit was not linked in the admin account ledger.

  - Response (200):

```json
{
  "success": true,
  "data": {
    "staff_information": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Staff",
      "status": "Verified",
      "position": "ADMIN_STAFF",
      "hub": "Gulshan",
      "number": "01712345678",
      "profile_pic": null,
      "salary": 15000,
      "commission": 0
    },
    "total_earning": 45000,
    "last_paid": { "date_time": "2026-05-15T10:30:00.000Z" },
    "salary_paid": {
      "month": "May 2026",
      "amount": 15000
    },
    "currency": "BDT",
    "paid_using": {
      "recipient_account": {
        "method_type": "BANK_ACCOUNT",
        "provider_name": "DBBL",
        "bank_name": "DBBL",
        "district": "Dhaka",
        "branch_name": "Gulshan",
        "account_holder_name": "John Staff",
        "account_number": "123456789012",
        "routing_number": "090261726"
      },
      "admin_source_account": {
        "id": "750e8400-e29b-41d4-a716-446655440002",
        "account_name": "Main Salary Account",
        "provider_type": "BANK",
        "account_number": "987654321000",
        "account_holder_name": "Delivery Admin",
        "district": "Dhaka",
        "branch_name": "Gulshan",
        "routing": "090261726",
        "balance_before_payment": 115000,
        "balance_after_payment": 100000,
        "ledger_statement_id": "850e8400-e29b-41d4-a716-446655440003"
      },
      "account_balance_after_payment": 100000,
      "last_used_at": "2026-05-15T10:30:00.000Z"
    }
  }
}
```

5) Generate Salary Slip
  - Endpoint: POST [{{baseUrl}}]/api/salary/generate
  - Request body:

```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440000",
  "salary_increment_modifiers": { "increment": 0, "commitment_increment": 0, "pickup_increment": 0, "eid_bonus_per": 0 },
  "monthly_salary_modifiers": { "attendance": 0, "delivery": 0, "cancel": 0, "pickup": 0, "overtime": 0, "advance_acceptance": 0, "loan": 0, "previous_month": 0 },
  "final_payment_amount": 15000
}
```

  - Response (200):

```json
{ "status": "success", "data": { "salary_id": "sal-01", "amount": 15000, "status": "CREATED" } }
```

6) Process Salary Payment
  - Endpoint: POST [{{baseUrl}}]/api/salary/process-payment
  - Request body:

```json
{
  "staff_id": "550e8400-e29b-41d4-a716-446655440000",
  "account_id": "pm-01",
  "payment_amount": 15000,
  "payment_method": "bank_transfer"
}
```

  - Response (201):

```json
{
  "status": "success",
  "data": {
    "payout_transaction": {
      "id": "ptx-01",
      "amount": 15000,
      "status": "PENDING",
      "reference_number": "SAL-JS-1623456789000",
      "initiated_at": "2026-06-01T12:00:00Z"
    }
  }
}
```

**Postman**
- Use [postman/Staff.postman_collection.json](postman/Staff.postman_collection.json#L1) — contains production-grade requests with environment variables:
  - `baseUrl`, `adminToken`, `token`, `hubId`, `staffId`, `payoutMethodId`
- Steps to create staff and pay:
  1. Set `baseUrl` and `adminToken` in environment
  2. `Create Staff` → copy returned `staffId`
  3. `Get Create Salary Details` → copy `payoutMethodId` from `available_bank_accounts`
  4. `Process Salary Payment` with `payoutMethodId`

**DB Migration & Deployment Steps**
- Add migration file: [src/migrations/1717225200000-CreateStaffFinance.ts](src/migrations/1717225200000-CreateStaffFinance.ts#L1)
- To apply migrations (example using TypeORM CLI):

```bash
# from project root
npm run typeorm:migrate
# or if using a migration runner configured in package.json
npm run migration:run
```

- Ensure DB has `uuid-ossp` or `pgcrypto` extension available (depending on UUID generation strategy used).
- After migration, run `npm run build` and deploy service.

**Developer Notes & Troubleshooting**
- If staff creation fails with validation errors, ensure all bank fields are present and valid strings.
- If migration fails due to missing extension, run:

```sql
-- For uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

- Rollback: revert the migration using your migration tool (e.g., `npm run typeorm:revert`) and remove records if necessary.

**Testing**
- Unit tests: Add tests for `createByAdmin()` to assert that `StaffPayoutMethod` and `StaffFinance` are created in the same transaction.
- Integration: Use Postman collection to exercise the full flow in a staging environment.

**Next steps / Optional improvements**
- Add automated worker that syncs payout transaction completions to `StaffFinance` (updates `total_paid_amount`, `remaining_balance`, `last_payout_*`).
- Expose staff-facing endpoint to fetch own `remaining_balance` and `last_payout`.
- Add soft/fallback when bank verification fails: create `PENDING` payout method and an admin-facing verification UI.

**Contact / Ownership**
- Implemented by: Backend Team (changes reside in the staff & salary modules).
- File references in repo: see the list at top for quick navigation.

---

If you want I can also:
- Add a small changelog entry to [SESSION_CHANGELOG.md](SESSION_CHANGELOG.md#L1)
- Create a short developer README with exact commands for local testing
- Expand Postman examples with pre-request scripts to auto-populate `staffId` and `payoutMethodId` from responses
