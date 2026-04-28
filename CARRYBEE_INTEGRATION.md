# Carrybee Integration — Frontend Guide & Test Plan

Purpose: document the end-to-end flows (store creation, hub receive, parcel assignment), frontend integration points, and local testing instructions for the Carrybee integration.

Status
- Unit tests for core assign flow pass locally (`src/carrybee/carrybee.unit.spec.ts`).
- Integration tests were updated to support Postgres; they require a reachable Postgres instance (Docker or external).

Important environment variables
- `CARRYBEE_API_KEY` / `CARRYBEE_SECRET` (set in env as used by `CarrybeeApiService`)
- `CARRYBEE_WEBHOOK_SIGNATURE` — secret used to verify webhooks (header `x-carrybee-webhook-signature`).
- For integration tests using Postgres: `USE_POSTGRES_TEST=true`, `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DB`.

Endpoints (frontend-oriented)

- Store creation (Merchant)
  - POST /stores
  - Role: Merchant (JWT)
  - Body (example):

```json
{
  "business_name": "My Test Store",
  "business_address": "Some address",
  "phone_number": "01700000002",
  "carrybee_city_id": 1,
  "carrybee_zone_id": 1,
  "carrybee_area_id": 1,
  "is_default": true
}
```

  - Behavior: store is saved in DB; service attempts to auto-create the store in Carrybee. If successful, the store record will have `is_carrybee_synced=true` and `carrybee_store_id` set.

- Manual store sync (Merchant/Admin)
  - POST /carrybee/stores/:storeId/sync
  - Body: `carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id`
  - Role: Merchant / Admin

- List Carrybee stores (Admin debug)
  - GET /carrybee/stores
  - Role: Admin

- Carrybee locations (for store/customer address pickers)
  - GET /carrybee/cities
  - GET /carrybee/cities/:cityId/zones
  - GET /carrybee/cities/:cityId/zones/:zoneId/areas
  - Role: Merchant / Admin

- Hub receive (Hub Manager)
  - PATCH /hubs/parcels/:id/accept
  - Role: Hub Manager
  - Behavior: marks parcel as accepted in hub. The codebase can enqueue or auto-assign to Carrybee after receive depending on configuration.

- Assign a single parcel to Carrybee (Hub Manager)
  - POST /carrybee/parcels/:parcelId/assign
  - Body example (AssignToCarrybeeDto):

```json
{ "provider_id": "<provider-uuid>", "notes": "Hand over to Carrybee" }
```

  - Response contains `carrybee_consignment_id`, `delivery_fee`, `cod_fee`.

- Bulk assign (Hub Manager)
  - POST /carrybee/parcels/assign/carrybee
  - Body (AssignParcelToCarrybeeDto):

```json
{ "parcel_ids": ["<uuid1>", "<uuid2>"], "provider_id": "<provider-uuid>", "notes": "Bulk assign" }
```

- Webhook (Carrybee -> Backend)
  - POST /webhooks/carrybee
  - No auth header required, but `x-carrybee-webhook-signature` must equal configured `CARRYBEE_WEBHOOK_SIGNATURE`.
  - Payload shape: refer to `src/carrybee/dto/carrybee-webhook.dto.ts` (fields: `event`, `store_id`, `consignment_id`, `timestamptz`, optional `delivery_fee`, `collected_amount`, `cod_fee`, `reason`, ...).

Full flows (high level)

- Merchant creates store
  1. Merchant calls `POST /stores` with Carrybee location ids.
  2. Backend creates store and attempts to `createStore` in Carrybee via `CarrybeeApiService`.
  3. Backend updates `store.carrybee_store_id` and `is_carrybee_synced=true` when Carrybee returns the ID.

- Hub Manager receives a parcel and assigns to Carrybee
  1. Hub Manager accepts parcel via `PATCH /hubs/parcels/:id/accept` (or bulk accept).
  2. System either auto-enqueues a DB job (CarrybeeJob) or direct-calls `CarrybeeService.assignParcelToCarrybee` depending on `USE_CARRYBEE_QUEUE` and `START_CARRYBEE_WORKER` flags.
  3. Worker / service ensures store is synced (auto-sync on assign) and then calls Carrybee `createOrder`.
  4. On success: parcel updated with `delivery_provider='CARRYBEE'`, `carrybee_consignment_id`, and status `ASSIGNED_TO_THIRD_PARTY`.
  5. When Carrybee sends webhooks (delivery, returned, etc.) the webhook endpoint maps events into parcel status changes.

Verification: how frontend can confirm things worked

- Verify store was created and synced
  - After `POST /stores`, call `GET /stores/:id` and check `is_carrybee_synced: true` and `carrybee_store_id` is present.
  - Admin: `GET /carrybee/stores` should list the store.
  - Direct DB: SELECT carrybee_store_id FROM stores WHERE id = '<store_id>';

- Verify parcel assigned to Carrybee
  - After assign endpoint returns, the response includes `carrybee_consignment_id`. The parcel should have `delivery_provider='CARRYBEE'` and `status='ASSIGNED_TO_THIRD_PARTY'`.
  - API: use hub parcel detail `GET /hubs/dashboard/parcels/:id` or parcel endpoints to see updated fields.
  - DB query: SELECT delivery_provider, carrybee_consignment_id, status FROM parcels WHERE id = '<parcel_id>';

Testing locally

1) Unit tests (fast, already run locally):

```bash
npx jest src/carrybee/carrybee.unit.spec.ts -i --runInBand
```

2) Integration tests (store creation + parcel assignment)

These tests now support running against Postgres. Two options:

- Option A — Docker (recommended for local parity):

```bash
# Start Postgres test container (exposes to localhost:5433)
docker run --name carrybee-test-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=courier_test -p 5433:5432 -d postgres:15
# Wait until Postgres is ready
# (You can poll with `docker exec carrybee-test-postgres pg_isready -U postgres`)

# Run the integration test (this repo's test reads PG_* env vars)
# In PowerShell:
# $env:USE_POSTGRES_TEST='true'
# $env:PG_HOST='localhost'
# $env:PG_PORT='5433'
# $env:PG_USER='postgres'
# $env:PG_PASSWORD='postgres'
# $env:PG_DB='courier_test'
# npx jest src/carrybee/carrybee.integration.spec.ts -i --runInBand

# Cleanup when done
# docker rm -f carrybee-test-postgres
```

- Option B — External Postgres / CI-provided database

Set `USE_POSTGRES_TEST=true` and the `PG_*` env vars to point to the database, then run the same jest command above.

Notes about running integration tests
- The integration test module switches to Postgres when `USE_POSTGRES_TEST=true` (or `CARRYBEE_TEST_DB=postgres`). If you cannot run Docker locally, use a remote Postgres instance and set the `PG_*` env vars.
- If you prefer SQLite in-memory, the test will still run, but some entity enums/metadata may behave differently — Postgres is the recommended environment for fidelity.

Simulating webhooks (manual test)

1. Prepare a webhook JSON matching `CarrybeeWebhookDto` (example):

```json
{
  "event": "order.delivered",
  "store_id": "cb_store_1",
  "consignment_id": "cons-1",
  "timestamptz": "2026-04-28T12:00:00Z",
  "collected_amount": "500"
}
```

2. Send to the webhook endpoint with the configured signature:

```bash
curl -X POST http://localhost:3000/webhooks/carrybee \
  -H "Content-Type: application/json" \
  -H "x-carrybee-webhook-signature: ${CARRYBEE_WEBHOOK_SIGNATURE}" \
  -d '@webhook.json'
```

Production-grade approach (recommendations)

- Queue & workers
  - DB-backed queue (current): reliable and transactional (use SELECT FOR UPDATE SKIP LOCKED). Good for smaller throughput and simpler ops.
  - Redis-based queue (BullMQ/Redis): recommended if you need very high throughput, faster job claim times, and advanced rate limiting. Not strictly required.

- Reliability
  - Use idempotent operations for webhook handling (already implemented — webhook handler checks current status).
  - Use a Dead-Letter Queue (DLQ) for jobs that fail after retries (admin endpoints exist to view and requeue).

- Observability
  - Add metrics (Prometheus) for job queue lengths, worker throughput, retry counts.
  - Log structured events and surface critical failures to Sentry.

- Security
  - Protect the webhook with a secret header (`CARRYBEE_WEBHOOK_SIGNATURE`) and rotate keys if needed.
  - Rate-limit external endpoints.

- Deployment
  - Run workers as separate processes (Docker / Kubernetes). Use health checks and a restart policy.
  - Keep `synchronize` disabled in production unless you control schema changes via migrations.

Why not Redis? When is DB queue OK?

- DB-backed queue pros:
  - Simpler to operate (no extra infra), transactional safety with DB-native queries.
  - Durable by default (data persisted in Postgres).

- DB-backed queue cons:
  - Slower claim/availability semantics compared to Redis.
  - Can add load to primary DB — watch connection pool and query performance.

- Recommendation: start with the DB-backed queue (current implementation). If throughput or latency becomes a bottleneck, migrate to a Redis-backed worker (BullMQ) and preserve job semantics and DLQ behavior.

Next steps (recommended)

- Run the integration test locally using Docker (or a test Postgres) and verify store creation + parcel assignment flow.
- Add webhook simulation tests to the test suite (send signed payloads and assert DB updates).
- Add CI job that spins up Postgres and runs the integration tests (GitHub Actions matrix: unit + integration).

If you want, I can:
- Add a small script to start Postgres + wait for readiness and run the integration test (PowerShell / bash). 
- Add webhook simulation tests and CI workflow to run them.

---
File references
- Server integration code: `src/carrybee/*`, `src/stores/*`, `src/hubs/*`, `src/parcels/*` (see relevant controllers and services).

