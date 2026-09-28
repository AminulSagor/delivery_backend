# Hub Transfer Approval Frontend API

## Workflow

- Only a Hub Manager submits a request.
- A request starts as `IN_REVIEW`; submission does not move balances.
- Only an Admin approves or declines.
- Approval atomically debits the Hub, credits the Admin account, and creates an account statement.
- Decline does not move balances and notifies the requesting Hub Manager.
- Bulk review uses partial success.

---

### API Name

Get Active Admin Accounts

### Method + Endpoint

GET /admin/accounts/list/active?page=1&limit=100&search=

### Authentication

Authorization: Bearer \<hub-manager-token>

Role:

HUB_MANAGER or ADMIN

### Query Parameters

page: Integer, optional, default `1`

limit: Integer, optional, maximum `100`

search: String, optional

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "admin-account-uuid",
      "account_name": "Eastern Bank Ltd",
      "account_number": "12345678",
      "account_holder_name": "Meghswar Hub Account",
      "provider_type": "BANK",
      "current_balance": "250000.00",
      "is_active": true
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 100, "totalPages": 1 }
}
```

### Error Response

401 Unauthorized

```json
{ "success": false, "statusCode": 401, "message": "Unauthorized" }
```

### Business Rules

- Use the selected account `id` as `admin_account_id`.
- Do not send account names or numbers in the transfer request; the backend derives them.

---

### API Name

Upload Transfer Proof

### Method + Endpoint

POST /upload/signed-url

### Authentication

No upload-specific token is required by the current endpoint.

### Request Body

```json
{
  "fileName": "transfer-proof.jpg",
  "fileType": "image/jpeg",
  "module": "hubs/transfer-proofs"
}
```

### Success Response

```json
{
  "success": true,
  "message": "Signed URL generated successfully",
  "signedUrl": "https://s3-presigned-upload-url",
  "fileKey": "hubs/transfer-proofs/generated-file-name.jpg",
  "readUrl": "https://s3-presigned-read-url"
}
```

### Error Response

500 Internal Server Error

```json
{
  "success": false,
  "statusCode": 500,
  "message": "Could not generate upload URL"
}
```

### Business Rules

- Upload the file to `signedUrl` using `PUT` and the same `Content-Type`.
- Store `fileKey`, not the expiring `readUrl`.
- Send `fileKey` as `proof_file_url`.
- To display proof later, call `GET /upload/read-url?fileKey=<encoded-file-key>`.

---

### API Name

Submit Hub Transfer Request

### Method + Endpoint

POST /hubs/finance/transfer

### Authentication

Authorization: Bearer \<hub-manager-token>

Role:

HUB_MANAGER

### Request Body

```json
{
  "transferred_amount": 65670,
  "admin_account_id": "admin-account-uuid",
  "transaction_reference_id": "TRF-001",
  "proof_file_url": "hubs/transfer-proofs/generated-file-name.jpg",
  "notes": "Transfer balance to admin operating account"
}
```

`notes` is optional. All other fields are required.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "transfer-uuid",
    "hub_manager_id": "hub-manager-uuid",
    "hub_id": "hub-uuid",
    "transferred_amount": "65670.00",
    "admin_account_id": "admin-account-uuid",
    "transaction_reference_id": "TRF-001",
    "proof_file_url": "hubs/transfer-proofs/generated-file-name.jpg",
    "notes": "Transfer balance to admin operating account",
    "status": "IN_REVIEW"
  },
  "message": "Transfer submitted successfully"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient balance to transfer"
}
```

### Business Rules

- The backend derives the Hub and Hub Manager from the token.
- New requests always start as `IN_REVIEW`.
- Submission does not deduct the Hub balance.
- The balance is checked again during approval.
- Frontend must not send `status`, `reviewed_by`, or `reviewed_at`.

---

### API Name

Get Hub Manager Transfer History

### Method + Endpoint

GET /hubs/finance/transfers?page=1&limit=20&search=TRF-001&sortBy=created_at&order=DESC

### Authentication

Authorization: Bearer \<hub-manager-token>

Role:

HUB_MANAGER

### Query Parameters

page, limit, search, sortBy, order

Allowed `order`: `ASC`, `DESC`

### Success Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "transfer-uuid",
        "transaction_reference_id": "TRF-001",
        "transferred_amount": "65670.00",
        "admin_account_name": "Eastern Bank Ltd",
        "proof_file_url": "hubs/transfer-proofs/generated-file-name.jpg",
        "notes": "Transfer balance to admin operating account",
        "status": "IN_REVIEW",
        "transfer_date": "2026-09-28T16:00:00.000Z"
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
  }
}
```

### Error Response

403 Forbidden

```json
{ "success": false, "statusCode": 403, "message": "Forbidden resource" }
```

### Business Rules

- Results are restricted to the authenticated Hub Manager.
- Do not send a Hub Manager ID from the frontend.
- Details route: `GET /hubs/finance/transfers/:transferId`.

---

### API Name

Get Admin Transfer Approval List

### Method + Endpoint

GET /hubs/admin/finance/transfers

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Query Parameters

page: Integer, default `1`

limit: Integer, default `20`, maximum `100`

search: Searches transfer ID, reason, Hub, requester, or account

status: `IN_REVIEW`, `APPROVED`, or `DECLINED`

hubId, hubManagerId: UUID, optional

fromDate, toDate: ISO date, optional

sortBy: `created_at`, `transfer_date`, `amount`, `status`, or `transfer_id`

order: `ASC` or `DESC`

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "transfer-uuid",
      "transfer_id": "TRF-001",
      "date": "2026-09-28T16:00:00.000Z",
      "hub": {
        "id": "hub-uuid",
        "name": "Mohammadpur Hub",
        "code": "HUB-DHK-001"
      },
      "from_account": {
        "id": "hub-manager-uuid",
        "name": "Dutch Bangla Bank",
        "account_number": "7458413684559",
        "account_holder_name": "Shahriar Emon",
        "branch": "Mohammadpur"
      },
      "to_account": {
        "id": "admin-account-uuid",
        "name": "Eastern Bank Ltd",
        "account_number": "12345678",
        "account_holder_name": "Meghswar Hub Account"
      },
      "requested_by": { "id": "user-uuid", "name": "Shahriar Emon" },
      "amount": 65670,
      "reason": "Transfer balance to admin operating account",
      "proof_file_url": "hubs/transfer-proofs/generated-file-name.jpg",
      "status": "IN_REVIEW",
      "reviewed_by": null,
      "reviewed_at": null,
      "admin_notes": null,
      "rejection_reason": null
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "message": "Transfer approval list retrieved successfully"
}
```

### Error Response

400 Bad Request

```json
{ "success": false, "statusCode": 400, "message": ["Invalid query value"] }
```

### Business Rules

- Use `data` as table rows and `meta` for pagination.
- Column mapping: `date`, `transfer_id`, `from_account`, `to_account`, `requested_by.name`, `amount`, `reason`, `status`.
- Legacy `PENDING` is returned as `IN_REVIEW`.
- Legacy `REJECTED` is returned as `DECLINED`.
- Details route: `GET /hubs/admin/finance/transfers/:transferId`.

---

### API Name

Approve Transfer Request

### Method + Endpoint

PATCH /hubs/admin/finance/transfers/:transferId/review

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Path Parameter

transferId: UUID, required

### Request Body

```json
{ "status": "APPROVED", "admin_notes": "Reference and proof verified" }
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "transfer-uuid",
    "transfer_id": "TRF-001",
    "status": "APPROVED",
    "amount": 65670,
    "reviewed_by": "admin-user-uuid",
    "reviewed_at": "2026-09-28T17:00:00.000Z",
    "admin_notes": "Reference and proof verified",
    "rejection_reason": null,
    "notification_sent": false
  },
  "message": "Transfer request approved"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Insufficient Hub balance to approve this transfer"
}
```

### Business Rules

- Only `IN_REVIEW` requests can be approved.
- Approval cannot be processed twice.
- Balance changes and the account statement are committed atomically.
- Frontend must never update balances itself.

---

### API Name

Decline Transfer Request

### Method + Endpoint

PATCH /hubs/admin/finance/transfers/:transferId/review

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Path Parameter

transferId: UUID, required

### Request Body

```json
{
  "status": "DECLINED",
  "rejection_reason": "The uploaded proof does not match the reference ID",
  "admin_notes": "Submit a new request with the correct proof"
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "transfer-uuid",
    "transfer_id": "TRF-001",
    "status": "DECLINED",
    "amount": 65670,
    "reviewed_by": "admin-user-uuid",
    "reviewed_at": "2026-09-28T17:00:00.000Z",
    "admin_notes": "Submit a new request with the correct proof",
    "rejection_reason": "The uploaded proof does not match the reference ID",
    "notification_sent": true
  },
  "message": "Transfer request declined"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Rejection reason is required when declining"
}
```

### Business Rules

- `rejection_reason` is required.
- Decline does not change balances.
- Decline sends one `HUB_TRANSFER_DECLINED` notification to the requester.
- A declined request cannot be reviewed again.

---

### API Name

Bulk Review Transfer Requests

### Method + Endpoint

PATCH /hubs/admin/finance/transfers/bulk-review

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Request Body

```json
{
  "transfer_ids": ["first-transfer-uuid", "second-transfer-uuid"],
  "status": "APPROVED",
  "admin_notes": "Bulk proof verification completed"
}
```

For bulk decline, send `status: "DECLINED"` and a required `rejection_reason`.

### Success Response

```json
{
  "success": true,
  "data": {
    "requested": 2,
    "success": 1,
    "failed": 1,
    "results": [
      {
        "transfer_id": "first-transfer-uuid",
        "success": true,
        "status": "APPROVED"
      },
      {
        "transfer_id": "second-transfer-uuid",
        "success": false,
        "error": "Insufficient Hub balance to approve this transfer"
      }
    ]
  },
  "message": "1 transfer request(s) processed; 1 failed"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Rejection reason is required when declining transfers"
}
```

### Business Rules

- Accepts 1–100 transfer UUIDs.
- Duplicate UUIDs are processed once.
- Valid requests succeed even when another request fails.
- Check every item in `data.results`; HTTP `200` does not mean all succeeded.
- Every successful decline sends a notification to its requester.

---

### API Name

Export Transfer Approvals CSV

### Method + Endpoint

GET /hubs/admin/finance/transfers/export

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Query Parameters

Accepts the same filters as the Admin approval list. Pagination is ignored.

### Success Response

200 OK

```text
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="hub-transfer-approvals-YYYY-MM-DD.csv"
```

The body is a CSV file, not JSON.

### Error Response

403 Forbidden

```json
{ "success": false, "statusCode": 403, "message": "Forbidden resource" }
```

### Business Rules

- Request the response with `responseType: 'blob'`.
- All records matching the current filters are exported.
- The CSV contains date, transfer ID, accounts, requester, amount, reason, and status.

---

### API Name

Get Transfer Rejection Notifications

### Method + Endpoint

GET /notifications?page=1&limit=20&category=FINANCE&type=HUB_TRANSFER_DECLINED

### Authentication

Authorization: Bearer \<hub-manager-token>

Role:

HUB_MANAGER

### Query Parameters

page, limit, status (`ALL`, `READ`, `UNREAD`), category (`FINANCE`), type (`HUB_TRANSFER_DECLINED`)

### Success Response

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notification-uuid",
        "type": "HUB_TRANSFER_DECLINED",
        "category": "FINANCE",
        "title": "Transfer request declined",
        "message": "Transfer TRF-001 for BDT 65670.00 was declined. Reason: Proof mismatch",
        "entity_type": "TRANSFER",
        "entity_id": "transfer-uuid",
        "action_url": "/hub/finance/transfers/transfer-uuid",
        "is_read": false,
        "read_at": null
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "unread_count": 1
  },
  "message": "Notifications retrieved"
}
```

### Error Response

401 Unauthorized

```json
{ "success": false, "statusCode": 401, "message": "Unauthorized" }
```

### Business Rules

- This is an in-app notification, not a push notification.
- Refresh on page focus or use the existing polling interval.
- Use `PATCH /notifications/:notificationId/read` to mark it as read.
- Use `GET /notifications/unread-count` for the badge.
- Navigate to `action_url` when selected.

## Compatibility Routes

The older routes remain functional:

```http
PATCH /hubs/finance/transfer/:id/review
PATCH /admin/hub-transfer-records/:id/approve
PATCH /admin/hub-transfer-records/:id/reject
```

New Admin frontend code should use:

```http
PATCH /hubs/admin/finance/transfers/:transferId/review
```
