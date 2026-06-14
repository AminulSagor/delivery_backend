# Admin Approval Endpoints

This document lists API endpoints used by Admins (and Hub Managers where noted) to approve or reject merchants, documents, stores, riders, transfer records, and delivery verification requests.

All endpoints below are protected and require an admin JWT (Bearer token). The `Roles` guard is used to limit access — see each endpoint for required roles.

---

## Merchants

### Get merchants with pending documents
- Method: GET
- Path: /merchants/pending-documents
- Roles: ADMIN
- Query: none
- Body: none
- Success response (200):

{
  "merchants": [ /* array of merchant summary objects */ ],
  "message": "Merchants with pending documents retrieved successfully"
}

---

### Approve merchant account
- Method: PATCH
- Path: /merchants/:id/approve
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "id": "<merchant-id>",
  "status": "APPROVED",
  "message": "Merchant approved successfully"
}

---

### Decline merchant (permanent)
- Method: PATCH
- Path: /merchants/:id/decline
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "id": "<merchant-id>",
  "status": "DECLINED",
  "is_active": false,
  "message": "Merchant declined permanently"
}

---

### Approve merchant documents (NID / Trade License / TIN / BIN)
- Method: PATCH
- Paths:
  - /merchants/:id/documents/nid/approve
  - /merchants/:id/documents/trade-license/approve
  - /merchants/:id/documents/tin/approve
  - /merchants/:id/documents/bin/approve
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "merchant_id": "<merchant-id>",
  "document_type": "nid|trade_license|tin|bin",
  "verified": true,
  "message": "<DOCUMENT> document approved successfully"
}

Notes: There is currently no dedicated "reject document" admin route. To reject a merchant document, admins may either decline the merchant (`PATCH /merchants/:id/decline`) or request changes via internal workflow.

---

## Stores

### Admin approve store
- Method: PATCH
- Path: /stores/admin/:id/approve
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "store": { /* full store detail object */ },
  "message": "Store approved successfully"
}

### Admin decline store
- Method: PATCH
- Path: /stores/admin/:id/decline
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "store": { /* full store detail object */ },
  "message": "Store declined successfully"
}

### Admin list stores (with status filter)
- Method: GET
- Path: /stores/admin/all
- Roles: ADMIN
- Query params:
  - `merchant_id` (optional)
  - `status` (optional) e.g., `PENDING`, `APPROVED`
  - `page`, `limit`, `search`
- Success response (200):

{
  "stores": [ /* array of store objects */ ],
  "total": 123,
  "pagination": { /* page/limit/totalPages */ },
  "message": "All stores retrieved successfully"
}

---

## Riders

### Approve rider
- Method: PATCH
- Path: /riders/:id/approve
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "success": true,
  "data": { /* rider detail */ },
  "message": "Rider approved successfully"
}

### Reject rider
- Method: PATCH
- Path: /riders/:id/reject
- Roles: ADMIN
- Body: none
- Success response (200):

{
  "success": true,
  "data": { /* rider detail */ },
  "message": "Rider rejected"
}

---

## Hub Transfer Records

### Approve transfer record
- Method: PATCH
- Path: /admin/hub-transfer-records/:id/approve
- Roles: ADMIN
- Body (optional):

{
  "admin_notes": "Optional admin notes"
}

- Success response (200):

{
  "success": true,
  "data": { "transfer_record": { /* record object */ } },
  "message": "Transfer record approved successfully"
}

### Reject transfer record
- Method: PATCH
- Path: /admin/hub-transfer-records/:id/reject
- Roles: ADMIN
- Body (required):

{
  "rejection_reason": "Reason for rejection",
  "admin_notes": "Optional admin notes"
}

- Success response (200):

{
  "success": true,
  "data": { "transfer_record": { /* record object */ } },
  "message": "Transfer record rejected successfully"
}

---

## Delivery Verification (Hub Approval)

These endpoints are used by Hub Managers and Admins to approve or reject OTP bypass / hub approval requests.

### Get pending hub approval requests
- Method: GET
- Path: /delivery-verifications/hub-approval/pending
- Roles: HUB_MANAGER, ADMIN
- Query: optional hub scope
- Success response (200): list of pending requests.

### Approve hub approval request
- Method: PATCH
- Path: /delivery-verifications/:id/hub-approval/approve
- Roles: HUB_MANAGER, ADMIN
- Body: none
- Success response (200): verification updated and delivery completed where applicable.

### Reject hub approval request
- Method: PATCH
- Path: /delivery-verifications/:id/hub-approval/reject
- Roles: HUB_MANAGER, ADMIN
- Body (required):

{
  "rejection_reason": "Reason (min 5 chars)"
}

- Success response (200): verification rejected.

---

## Examples (cURL)

Approve merchant document (NID):

```bash
curl -X PATCH \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  https://api.example.com/merchants/<MERCHANT_ID>/documents/nid/approve
```

Approve hub transfer record with notes:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"admin_notes":"Checked, looks good"}' \
  https://api.example.com/admin/hub-transfer-records/<RECORD_ID>/approve
```

Reject transfer record example:

```bash
curl -X PATCH \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason":"Invalid paperwork", "admin_notes":"Missing signature"}' \
  https://api.example.com/admin/hub-transfer-records/<RECORD_ID>/reject
```

---

If you want, I can:
- Add explicit `reject document` endpoints for merchant documents (server currently lacks those), or
- Generate OpenAPI snippets for these routes.


