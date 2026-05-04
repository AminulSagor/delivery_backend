# Session Documentation — Rider & Parcel Features

Date: 2026-05-03

Summary
- Implemented rider/parcel features requested by the product team: rider listing, rider-assigned parcel listing, parcel tracking timeline, and a bulk-transfer-from-riders endpoint. Relaxed merchant DTO validations and added 11-digit phone validation where applicable.

Goals (requests)
- Hub managers see riders for their hub; admins see system riders.
- Rider list should return: id, name, photo, phone, status (On duty / Break / Leave), license_no, total assigned parcels.
- GET endpoint to list a rider's assigned parcels with detailed fields (parcel id, tx id, customer info, merchant info, amounts, parcel age, timestamps).
- Allow hub/admin to bulk-transfer parcels: select multiple parcels OR select multiple source riders and transfer their parcels to another rider.
- Validate phone numbers are 11 digits where inserted.
- Relax strict merchant registration validations (carrybee ids optional, business fields relaxed).
- Add parcel tracking timeline to parcel details responses.

What I changed
- Added endpoint to transfer all parcels from multiple source riders to a target rider.
- Added DTO for the bulk transfer request.
- Extended parcel service with `bulkTransferFromRiders` that performs DB transactional updates and returns per-parcel results.
- Enhanced central response mapper to include a parcel `tracking` timeline in parcel details responses.
- Relaxed merchant DTO validation and made carrybee ids optional; adjusted merchant service assignments to accept `null` for carrybee ids.

Files changed
- [src/hubs/dto/bulk-transfer-from-riders.dto.ts](src/hubs/dto/bulk-transfer-from-riders.dto.ts)
- [src/hubs/hubs.controller.ts](src/hubs/hubs.controller.ts)
- [src/parcels/parcels.service.ts](src/parcels/parcels.service.ts)
- [src/riders/riders.controller.ts](src/riders/riders.controller.ts)
- [src/common/interfaces/responses.interface.ts](src/common/interfaces/responses.interface.ts)
- [src/merchant/dto/create-merchant.dto.ts](src/merchant/dto/create-merchant.dto.ts)
- [src/admin/dto/admin-create-merchant.dto.ts](src/admin/dto/admin-create-merchant.dto.ts)
- [src/merchant/merchant.service.ts](src/merchant/merchant.service.ts)

New / Updated Endpoints
- POST /hubs/parcels/transfer-from-riders
  - Roles: `HUB_MANAGER`, `ADMIN`
  - Body: { target_rider_id: string, source_rider_ids: string[], statuses?: string[], notes?: string }
  - Behavior: Transfers parcels assigned to any rider in `source_rider_ids` to `target_rider_id`. Hub managers are restricted to their hub; admins may operate across hubs.
  - Example request:

```bash
curl -X POST 'http://localhost:3000/hubs/parcels/transfer-from-riders' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "target_rider_id": "<TARGET_RIDER_UUID>",
    "source_rider_ids": ["<SOURCE_RIDER_UUID1>", "<SOURCE_RIDER_UUID2>"],
    "statuses": ["ASSIGNED_TO_RIDER"]
  }'
```

  - Example response (summary):

```json
{
  "success": true,
  "data": {
    "summary": { "total": 10, "transferred": 9, "failed": 1 },
    "results": [ { "parcel_id": "...", "success": true }, ... ]
  },
  "message": "9 parcels transferred, 1 failed"
}
```

- GET /riders/:id/parcels
  - Roles: `HUB_MANAGER`, `ADMIN`
  - Query params: `status` or `filter` (delivery_pending, delivery_completed, return_pending, return_completed, all)
  - Returns: list of parcel items (mapper `toParcelListItem` / `toParcelDetail`) including the new `tracking` timeline.
  - Example request:

```bash
curl -H 'Authorization: Bearer <TOKEN>' 'http://localhost:3000/riders/<RIDER_ID>/parcels?filter=delivery_pending'
```

Response mapping updates
- `toParcelDetail` now includes a `tracking` object with `current_status`, `delivery_milestones` and `activities` assembled from parcel timestamps and hub/rider metadata.
- `toFullRiderSummary` includes `assigned_parcels_count`, `full_name`, and `phone` convenience fields.

Validation / DTO changes
- Merchant DTOs: `phone` fields enforce local 11-digit pattern. `carrybee` id fields are now optional; `business_name` / `business_address` validations relaxed.
- Where carrybee fields were assigned in `merchant.service`, `undefined` is now coerced to `null` to satisfy entity typing.

Build & Run (how to test locally)
- Build:

```bash
npm run build
```

- Run in dev:

```bash
npm run start:dev
```

- Test the transfer endpoint with a Hub Manager token (ensure the hub manager's `hubId` matches source riders' hub).

Notes & implementation details
- `bulkTransferFromRiders` uses a DB transaction via a query runner and updates `assigned_rider_id` + `assigned_at`. It sends assignment SMS notifications via existing `sendAssignForRiderSms` helper.
- Hub managers are restricted to operate within their hub; admins bypass hub checks.
- The transfer method respects optional `statuses` filter; if omitted, active parcel statuses are used.

Next steps (recommended)
- Add integration tests for `bulkTransferFromRiders` and `GET /riders/:id/parcels`.
- Add API docs (OpenAPI) updates and example payloads in the project's docs folder.
- Commit and push the changes; optionally raise a PR for review.

---

If you'd like, I can commit these changes and open a PR, or add automated tests next. Let me know which you'd prefer.
