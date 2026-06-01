# Staff Payout Methods & Attendance — Implementation Plan

Purpose
- Add production-quality staff payout-methods and attendance tracking, reusing merchant payout-method patterns.

Scope
- Data model: `staff_payout_methods` entity (bank/bkash/nagad), `staff_attendance` entity (daily records).
- API: admin endpoints to add/update/verify staff payout methods; staff endpoints to list/select payout method; attendance check-in/out + monthly report.
- Integration: wire staff creation (admin) to create a default payout method when bank fields are provided (already implemented).
- Migrations, tests, Postman updates, docs, and rollout steps.

Assumptions
- `banks` master table exists (used by routing lookup), but payout methods store full account details (consistent with merchant implementation).
- `payout_transactions` already supports `staff_id` for writing payouts.

Deliverables
1. `staff_payout_methods` entity (done).
2. Create flow wiring to insert a verified payout-method when staff created with bank fields (done).
3. Controller + service endpoints for staff payout-methods:
   - GET `/staff/my/payout-methods`
   - POST `/staff/my/payout-methods`
   - PATCH `/staff/my/payout-methods/:id`
   - DELETE `/staff/my/payout-methods/:id`
   - PATCH `/admin/staff/:staffId/payout-methods/:id/verify` (admin verify)
   - PATCH `/staff/my/payout-methods/:id/set-default`
4. `staff_attendance` entity and basic APIs:
   - POST `/staff/:id/attendance/check-in`
   - POST `/staff/:id/attendance/check-out`
   - GET `/staff/:id/attendance?month=YYYY-MM`
   - Admin bulk adjust endpoint
5. Salary integration:
   - Inject `StaffAttendance` repository into `SalaryService`
   - In `resolveSalaryBreakdown()` compute `presentDays` for current month when `monthlyModifiers.attendance` not provided; compute `attendance = per_day * presentDays`
   - Update `getCreateList()` and related responses to return `attendance.present = presentDays` (instead of 0)
6. Migrations:
   - Create SQL/TypeORM migration to add `staff_payout_methods` and `staff_attendance` tables (do not rely on `synchronize` in production).
7. Tests & Postman:
   - Unit tests for services and integration tests for controller flows.
   - Update `postman/Staff.postman_collection.json` with new endpoints and examples.
8. Documentation & rollout:
   - Docs: `docs/STAFF_PAYOUT_AND_ATTENDANCE_IMPLEMENTATION_PLAN.md` (this file) and a short `docs/STAFF_API_CHANGES.md` describing new endpoints and request/response shapes.
   - Rollout: run migration, restart backend, smoke test, then enable feature flags if needed.

Implementation Steps (detailed)
1. Data model (2-3 hours)
   - `StaffPayoutMethod` entity (already added at `src/staff/entities/staff-payout-method.entity.ts`).
   - `StaffAttendance` entity (new): columns `{ id(uuid), staff_id(uuid), date(date), check_in(timestamp|null), check_out(timestamp|null), present(boolean), notes(text|null), created_at, updated_at }`.
2. Staff controller & service endpoints (3-5 hours)
   - Copy merchant payout-method controller/service routes and adapt to `staff` context and permissions.
   - Ensure admin verify endpoints exist and mark verified_at/verified_by when admin verifies.
3. Staff creation flow (done)
   - Already creates verified `staff_payout_methods` when bank fields present.
4. Salary integration (1-2 hours)
   - Add `StaffAttendance` repo injection; implement `getPresentDays(staffId, start, end)`; in `resolveSalaryBreakdown()` prefer `monthlyModifiers.attendance` override, otherwise calculate `attendance = per_day * presentDays`.
   - Update UI payload: return `attendance.present` and `attendance.total_days`.
5. Migrations (1-2 hours)
   - Generate TypeORM migration for both tables; include indexes: `IDX_staff_attendance_staff_date` unique(staff_id, date).
6. Tests & Postman (2-4 hours)
   - Add unit tests for new services and controller flows.
   - Update `postman/Staff.postman_collection.json` with examples for add payout method and attendance flows.
7. Docs & release (1-2 hours)
   - Create `docs/STAFF_API_CHANGES.md` listing endpoints, DTOs, and examples.
   - Add migration run instructions to release notes.

Security & Edge Cases
- Validate account numbers and phone patterns consistently using existing DTO validators.
- Protect endpoints with `@Roles(UserRole.ADMIN)` and `@Roles(UserRole.STAFF)` where applicable.
- Rate-limit check-in endpoints if needed.

Backward-compatibility & Migration Strategy
- Add new tables via migration; preserve existing `bank_name` fields on `staff` until clients migrate to payout-method based flows.
- During rollout: create payout-method from existing staff bank fields (backfill script) and mark default where appropriate.

Estimated total effort: 2–3 days for a developer (including tests & migration).

Rollback Plan
- If migration causes issues, revert migration and fallback to saving bank fields on `staff` while debugging.

Contact / Next actions
- If you approve, I will:
  1) add `StaffAttendance` entity + migration, 
  2) add staff payout-method controller/service, 
  3) update salary integration and Postman, 
  4) run build and tests, then open PR.

