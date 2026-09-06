# Forgot Password Frontend API Guide

## Overview

The forgot-password flow supports both a registered phone number and a
registered email address.

```text
Enter phone/email → Request OTP → Enter OTP and new password → Login
```

These endpoints are public. Do not send an access token.

## Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/forgot-password` | Generate and send a password-reset OTP |
| `POST` | `/auth/reset-password` | Verify the OTP and set the new password |

There is no separate “verify OTP” endpoint. OTP verification happens when the
password is reset.

## 1. Request Password-Reset OTP

```http
POST /auth/forgot-password
Content-Type: application/json
```

### Request using phone

```json
{
  "identifier": "01712345678"
}
```

### Request using email

```json
{
  "identifier": "user@example.com"
}
```

`identifier` must exactly match the phone number or email stored on the user
account.

If the account has both a phone number and an email address, the same OTP is
sent to both registered channels, regardless of which identifier was entered.
Email is delivered through SMTP/Nodemailer, and SMS is delivered through
SMS.net.bd.

The OTP:

- Contains 6 digits in normal operation
- Expires after 5 minutes
- Is replaced if the user requests another OTP

### Success response — `201 Created`

```json
{
  "success": true,
  "data": {},
  "message": "OTP sent successfully",
  "timestamp": "2026-09-05T12:00:00.000Z"
}
```

After success, show the OTP and new-password screen. Do not expect the OTP in
the API response.

### User not found — `404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "User not found",
  "timestamp": "2026-09-05T12:00:00.000Z",
  "path": "/auth/forgot-password"
}
```

### Invalid request — `400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["identifier should not be empty"],
  "timestamp": "2026-09-05T12:00:00.000Z",
  "path": "/auth/forgot-password"
}
```

## 2. Reset Password

```http
POST /auth/reset-password
Content-Type: application/json
```

### Request

```json
{
  "identifier": "user@example.com",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

Phone is also accepted:

```json
{
  "identifier": "01712345678",
  "otp": "123456",
  "newPassword": "NewPassword123"
}
```

### Request-field rules

| Field | Type | Rules |
| --- | --- | --- |
| `identifier` | String | Registered phone number or email address |
| `otp` | String | Exactly 6 characters; send it as a string |
| `newPassword` | String | At least 8 characters |

Use the same `identifier` the user entered on the first screen. The backend
does not require a `confirmPassword` field. If the UI has password confirmation,
validate it on the frontend before calling the API.

### Success response — `201 Created`

```json
{
  "success": true,
  "data": {},
  "message": "Password has been reset successfully. Please login.",
  "timestamp": "2026-09-05T12:03:00.000Z"
}
```

After success:

1. Clear the identifier, OTP, and password from frontend state.
2. Redirect the user to the login page.
3. Do not automatically log the user in; this endpoint does not return tokens.

### Invalid OTP — `400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid OTP",
  "timestamp": "2026-09-05T12:03:00.000Z",
  "path": "/auth/reset-password"
}
```

### Expired OTP — `400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "OTP has expired",
  "timestamp": "2026-09-05T12:06:00.000Z",
  "path": "/auth/reset-password"
}
```

### Invalid password or OTP format — `400 Bad Request`

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "otp must be longer than or equal to 6 characters",
    "Password must be at least 8 characters long"
  ],
  "timestamp": "2026-09-05T12:03:00.000Z",
  "path": "/auth/reset-password"
}
```

The validation message array may contain one or multiple messages. The
frontend should support both a string and a string array in `message`.

## Suggested Frontend Flow

### Screen 1: Forgot Password

1. User enters a phone number or email address.
2. Call `POST /auth/forgot-password`.
3. On success, keep the identifier in state and display the reset screen.
4. Disable the resend button temporarily to prevent accidental repeated calls.

### Screen 2: Reset Password

1. User enters the 6-digit OTP.
2. User enters and confirms a new password.
3. Verify locally that both password inputs match.
4. Call `POST /auth/reset-password` with the saved identifier.
5. On success, redirect to login.

Requesting another OTP invalidates the earlier OTP because only the latest OTP
is stored for the account.

## TypeScript API Client

```ts
type ApiErrorBody = {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
};

async function parseResponse(response: Response) {
  const body = await response.json();
  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message;
    throw new Error(message || 'Request failed');
  }
  return body;
}

export async function requestPasswordResetOtp(identifier: string) {
  const response = await fetch('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.trim() }),
  });

  return parseResponse(response);
}

export async function resetPassword(input: {
  identifier: string;
  otp: string;
  newPassword: string;
}) {
  const response = await fetch('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: input.identifier.trim(),
      otp: input.otp.trim(),
      newPassword: input.newPassword,
    }),
  });

  return parseResponse(response);
}
```

## Important Backend Configuration

Real delivery requires configured SMTP and SMS credentials. When credentials
are missing, the services operate in stub mode and the user will not receive a
real OTP.

If the backend enables a default development OTP, `OTP_DEFAULT_VALUE` must be
configured as exactly 6 characters, for example:

```env
OTP_DEFAULT_ENABLED=true
OTP_DEFAULT_VALUE=123456
```

The current fallback default is `1234`, which does not satisfy the reset API's
6-character validation. Production should use generated OTPs by keeping
`OTP_DEFAULT_ENABLED=false`.
