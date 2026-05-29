**Staff Payroll Implementation (Changes)**

- **Added Entity:** `staff_payout_transactions` table implemented by [src/staff/entities/staff-payout-transaction.entity.ts](src/staff/entities/staff-payout-transaction.entity.ts)
  - Records staff payout transactions (amount, status, timestamps, initiator, notes).

- **Service changes:** [src/staff/staff.service.ts](src/staff/staff.service.ts)
  - Injected `StaffPayoutTransaction` repository.
  - `getFormattedStaffList()` now returns `last_paid` (most recent completed payout).
  - Added `payStaff(staffId, amount, initiatedBy)` to create a PENDING payout transaction.

- **Controller changes:** [src/staff/staff.controller.ts](src/staff/staff.controller.ts)
  - New endpoint: `POST /staff/:id/pay` (Admin only). Accepts `{ amount: number }` and creates a PENDING payout record.

- **Build:** Project builds successfully (`npm run build`).

- **DB note:** You must add a migration to create the `staff_payout_transactions` table (or enable schema sync in dev). Example SQL (for reference):

```
CREATE TABLE staff_payout_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  reference_number varchar(100) UNIQUE,
  status varchar(32) NOT NULL,
  admin_notes text,
  failure_reason text,
  initiated_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp NULL,
  completed_at timestamp NULL,
  initiated_by uuid NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
```

- **Operational behavior & recommendations:**
  - Payouts are created with `status = PENDING`. Payment provider integration and a background worker are required to process PENDING transactions, update `status`, and set `processed_at`/`completed_at` or `failure_reason`.
  - Keep staff payouts separate from merchant payouts for safer rollout. If you prefer a unified payouts model, I can refactor into a single table.

- **API example:**

```
POST /staff/:id/pay
Headers: Authorization: Bearer <admin-token>
Body: { "amount": 1500 }
```

- **Next actions (pick one):**
  - Add DB migration for `staff_payout_transactions`.
  - Implement background worker to process payouts (mock provider or real integration).
  - Merge staff payouts into unified `payout_transactions` table.

---
Files changed:
- [src/staff/entities/staff-payout-transaction.entity.ts](src/staff/entities/staff-payout-transaction.entity.ts)
- [src/staff/staff.service.ts](src/staff/staff.service.ts)
- [src/staff/staff.controller.ts](src/staff/staff.controller.ts)

