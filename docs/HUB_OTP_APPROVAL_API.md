# Hub OTP Approval APIs

## API Name

Get Pending OTP Approval Requests

### Method + Endpoint

```http
GET /delivery-verifications/hub-approval/pending
```

### Authentication

```http
Authorization: Bearer <hub-manager-or-admin-token>
```

Roles:

- `HUB_MANAGER`
- `ADMIN`

### Query Parameters

None.

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "verification_id": "verification-uuid",
      "parcel_id": "parcel-uuid",
      "tracking_number": "MF120526DHV4",
      "rider_id": "rider-uuid",
      "rider_name": "Forhad Uddin",
      "rider_phone": "01700000000",
      "selected_status": "DELIVERED",
      "expected_amount": 1200,
      "collected_amount": 1000,
      "difference": -200,
      "request_reason": "Customer paid a lower amount",
      "requested_at": "2026-09-22T10:00:00.000Z",
      "otp_sent_to": "CUSTOMER",
      "otp_phone": "017****0000",
      "otp_expires_at": "2026-09-22T10:05:00.000Z"
    }
  ]
}
```

Possible `selected_status` values include:

- `DELIVERED`
- `PARTIAL_DELIVERY`
- `EXCHANGE`
- `DELIVERY_RESCHEDULED`
- `PAID_RETURN`
- `RETURNED`

Possible `otp_sent_to` values:

- `MERCHANT`
- `CUSTOMER`

### Error Response

Hub manager has no assigned hub (`403 Forbidden`):

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Hub Manager is not assigned to any hub. Please contact admin.",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/hub-approval/pending"
}
```

### Business Rules

- Only requests whose OTP-bypass status is `PENDING` are returned.
- A hub manager receives requests associated with their hub through either the
  parcel's current hub or the rider's assigned hub.
- An administrator receives pending requests across all hubs.
- Results are ordered by request time, newest first.
- `rider_name`, `rider_phone`, `request_reason`, `otp_phone`, and
  `otp_expires_at` can be `null`.
- `otp_phone` is masked when returned.

---

## API Name

Approve OTP Bypass Request

### Method + Endpoint

```http
PATCH /delivery-verifications/:verificationId/hub-approval/approve
```

### Authentication

```http
Authorization: Bearer <hub-manager-or-admin-token>
```

Roles:

- `HUB_MANAGER`
- `ADMIN`

### Path Parameter

`verificationId`: UUID, required.

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "approved": true,
  "verification_id": "verification-uuid",
  "approval_status": "APPROVED",
  "action_completed": true,
  "message": "Hub manager approved the request. Delivery completed without OTP."
}
```

### Error Responses

Verification not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Verification not found",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/approve"
}
```

Unauthorized for the verification's hub (`403 Forbidden`):

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You are not authorized to review this verification",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/approve"
}
```

Invalid verification state (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "No pending hub approval request found",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/approve"
}
```

Other possible `400` messages:

- `This delivery does not require OTP verification`
- `Delivery already verified`

### Business Rules

- The verification must have a pending OTP-bypass request.
- A hub manager can approve only a verification associated with their hub.
- An administrator can approve a request from any hub.
- Approval marks the OTP-bypass request as `APPROVED`.
- Approval records the reviewer and review time.
- Approval clears the outstanding OTP information.
- Approval completes the delivery without requiring the OTP.
- An already finalized delivery cannot be approved again.

---

## API Name

Reject OTP Bypass Request

### Method + Endpoint

```http
PATCH /delivery-verifications/:verificationId/hub-approval/reject
```

### Authentication

```http
Authorization: Bearer <hub-manager-or-admin-token>
Content-Type: application/json
```

Roles:

- `HUB_MANAGER`
- `ADMIN`

### Path Parameter

`verificationId`: UUID, required.

### Request Body

```json
{
  "rejection_reason": "OTP verification is still required"
}
```

### Success Response

```json
{
  "success": true,
  "approved": false,
  "verification_id": "verification-uuid",
  "approval_status": "REJECTED",
  "action_completed": false,
  "message": "Hub manager rejected the OTP bypass request."
}
```

### Error Responses

Invalid request body (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "Rejection reason must be at least 5 characters"
  ],
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/reject"
}
```

Verification not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Verification not found",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/reject"
}
```

Unauthorized for the verification's hub (`403 Forbidden`):

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You are not authorized to review this verification",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/reject"
}
```

Invalid verification state (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "No pending hub approval request found",
  "timestamp": "2026-09-22T10:00:00.000Z",
  "path": "/delivery-verifications/verification-uuid/hub-approval/reject"
}
```

### Business Rules

- `rejection_reason` is required.
- The rejection reason must contain between 5 and 500 characters.
- The verification must have a pending OTP-bypass request.
- A hub manager can reject only a verification associated with their hub.
- An administrator can reject a request from any hub.
- Rejection records the reviewer, review time, and rejection reason.
- Rejection does not complete the delivery.
- An already finalized delivery cannot be rejected.
