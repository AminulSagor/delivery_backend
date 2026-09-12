# Rider Protected Action Approval — Frontend Guide

This flow protects rider amount changes and return-related actions with one
existing delivery-verification mechanism. The protected parcel action is not
applied until OTP verification succeeds or a hub manager approves it.

## Protected and direct actions

OTP or hub approval is required for:

- `RETURNED`
- `PAID_RETURN`
- `PARTIAL_DELIVERY`
- `EXCHANGE`
- any `DELIVERED` action where `collected_amount` differs from the parcel COD

These actions remain direct:

- `DELIVERED` when `collected_amount` exactly matches the parcel COD
- `DELIVERY_RESCHEDULED`

For a protected action, OTP is sent to the merchant using the existing rule.
When the parcel's delivery charge is zero, it is sent to the customer instead.

## 1. Rider initiates the action

```http
POST /delivery-verifications/parcels/:parcelId/initiate
Authorization: Bearer <rider-token>
Content-Type: application/json
```

```json
{
  "selected_status": "RETURNED",
  "collected_amount": 0,
  "reason": "Customer refused the parcel at the delivery address"
}
```

Protected response:

```json
{
  "success": true,
  "verification_id": "b2430244-3cae-4f42-86a8-a56646046c1f",
  "selected_status": "RETURNED",
  "expected_amount": 1500,
  "collected_amount": 0,
  "has_difference": true,
  "difference": -1500,
  "otp_required": true,
  "otp_available": true,
  "hub_approval_available": true,
  "otp_sent_to": "MERCHANT",
  "otp_phone": "01710****00",
  "otp_expires_at": "2026-09-12T11:05:00.000Z"
}
```

Do not update the parcel status locally from the submitted action. Wait for a
successful OTP response or approved polling result.

If the selected OTP recipient has no phone number, initiation still succeeds
with `otp_available: false` and `hub_approval_available: true`. Skip the OTP
form and show the Request Hub Approval action immediately.

## 2A. Complete with OTP

```http
POST /delivery-verifications/:verificationId/verify-otp
Authorization: Bearer <rider-token>
Content-Type: application/json
```

```json
{
  "otp_code": "1234"
}
```

On success, refresh the rider task list and parcel details.

## 2B. Ask the hub to approve instead

Use this when the rider cannot obtain the OTP:

```http
POST /delivery-verifications/:verificationId/request-hub-approval
Authorization: Bearer <rider-token>
Content-Type: application/json
```

```json
{
  "request_reason": "Customer cannot receive the OTP and the merchant is unavailable"
}
```

The response provides a reusable polling URL:

```json
{
  "success": true,
  "request_submitted": true,
  "verification_id": "b2430244-3cae-4f42-86a8-a56646046c1f",
  "otp_bypass_status": "PENDING",
  "poll_url": "/delivery-verifications/b2430244-3cae-4f42-86a8-a56646046c1f"
}
```

## 3. Rider polls for the hub decision

```http
GET /delivery-verifications/:verificationId
Authorization: Bearer <rider-token>
```

Poll every **5 seconds** only while the approval screen is visible. Stop when
`polling_recommended` becomes `false`, when the user leaves the screen, or after
two minutes. A manual Refresh/Check Status button should remain available after
the automatic polling timeout.

Pending response fields:

```json
{
  "success": true,
  "data": {
    "verification_status": "OTP_SENT",
    "otp_bypass_status": "PENDING",
    "action_completed": false,
    "approval_pending": true,
    "approval_decision_available": false,
    "polling_recommended": true,
    "next_action": "WAIT_FOR_HUB"
  }
}
```

After approval:

```json
{
  "success": true,
  "data": {
    "verification_status": "COMPLETED",
    "otp_bypass_status": "APPROVED",
    "action_completed": true,
    "approval_pending": false,
    "approval_decision_available": true,
    "polling_recommended": false,
    "next_action": "COMPLETED"
  }
}
```

After rejection, show `otp_bypass_rejection_reason`. The rider can still verify
the OTP or submit another hub-approval request:

```json
{
  "action_completed": false,
  "otp_bypass_status": "REJECTED",
  "approval_decision_available": true,
  "polling_recommended": false,
  "next_action": "VERIFY_OTP_OR_REQUEST_AGAIN"
}
```

## 4. Hub Verify OTP page

Load only pending rider requests:

```http
GET /delivery-verifications/hub-approval/pending
Authorization: Bearer <hub-manager-token>
```

Approve:

```http
PATCH /delivery-verifications/:verificationId/hub-approval/approve
Authorization: Bearer <hub-manager-token>
```

Decline:

```http
PATCH /delivery-verifications/:verificationId/hub-approval/reject
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

```json
{
  "rejection_reason": "The submitted amount does not match the cash received"
}
```

After either action, remove the row from the pending table and reload the
pending endpoint. Hub approval applies the protected action immediately, just
like successful OTP verification.
