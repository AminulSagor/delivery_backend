# Delivery Verification Hub Approval API

## Overview

This flow allows a rider to complete delivery without OTP only when a hub manager approves the rider request.

### Standard Flow

1. Rider initiates delivery and OTP is sent.
2. Rider tries OTP verify or resend OTP.
3. If OTP is not received, rider can request hub approval.
4. Hub manager reviews and approves or rejects.
5. If approved, delivery is completed without OTP.

## Endpoints

### 1) Rider: Request Hub Approval

- Method: POST
- Path: /delivery-verifications/:id/request-hub-approval
- Role: RIDER

Request body:

```json
{
  "request_reason": "Merchant did not receive OTP after resend attempts"
}
```

Success response (example):

```json
{
  "success": true,
  "request_submitted": true,
  "verification_id": "uuid",
  "otp_bypass_status": "PENDING",
  "requested_at": "2026-04-04T10:00:00.000Z",
  "message": "Request sent to hub manager. You can complete delivery without OTP after approval."
}
```

Validation rules:

- Request is allowed only for the same rider who owns the verification.
- Verification must still require OTP.
- Verification must not already be completed.
- OTP must already be in OTP_SENT state.

### 2) Hub Manager: List Pending Requests

- Method: GET
- Path: /delivery-verifications/hub-approval/pending
- Role: HUB_MANAGER

Success response (example):

```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "verification_id": "uuid",
      "parcel_id": "uuid",
      "tracking_number": "TRK-1001",
      "rider_id": "uuid",
      "rider_name": "Rider Name",
      "rider_phone": "01710000000",
      "selected_status": "DELIVERED",
      "expected_amount": 1500,
      "collected_amount": 1200,
      "difference": -300,
      "request_reason": "Merchant did not receive OTP",
      "requested_at": "2026-04-04T10:00:00.000Z",
      "otp_sent_to": "MERCHANT",
      "otp_phone": "01710****00",
      "otp_expires_at": "2026-04-04T10:05:00.000Z"
    }
  ]
}
```

Notes:

- Hub manager sees only requests from their own hub.

### 3) Hub Manager: Approve Request

- Method: PATCH
- Path: /delivery-verifications/:id/hub-approval/approve
- Role: HUB_MANAGER

Request body:

- No body required.

Success response (example):

```json
{
  "success": true,
  "approved": true,
  "verification_id": "uuid",
  "message": "Hub manager approved the request. Delivery completed without OTP."
}
```

Effects on approval:

- Marks bypass request as APPROVED.
- Clears OTP fields.
- Marks verification as OTP_VERIFIED.
- Completes delivery and updates parcel status/financial fields.

### 4) Hub Manager: Reject Request

- Method: PATCH
- Path: /delivery-verifications/:id/hub-approval/reject
- Role: HUB_MANAGER

Request body:

```json
{
  "rejection_reason": "Please retry OTP with merchant and confirm phone number"
}
```

Success response (example):

```json
{
  "success": true,
  "approved": false,
  "verification_id": "uuid",
  "message": "Hub manager rejected the OTP bypass request."
}
```

Effects on rejection:

- Marks bypass request as REJECTED.
- Keeps delivery pending for normal OTP flow.

## Request Status Values

- NONE: No bypass request made.
- PENDING: Rider has requested hub manager approval.
- APPROVED: Hub manager approved, delivery completed without OTP.
- REJECTED: Hub manager rejected the request.

## Security and Scope

- Rider endpoint is restricted to the rider who owns that verification.
- Hub manager actions are restricted by hub scope using JWT hubId.
- Cross-hub approval/rejection is blocked.
