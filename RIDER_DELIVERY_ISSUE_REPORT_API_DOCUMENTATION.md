# Rider Delivery Issue Report API Documentation

## Overview
This update allows a rider to submit a delivery issue report for a specific parcel with:
- A required issue reason (fixed enum list)
- A required short note

Submitted reports are stored on the parcel issue fields and appear in the parcel reports queue for hub manager and admin review.

## Reasons Supported
The rider must pick one of these values:
- INCORRECT_ADDRESS
- INCORRECT_PHONE
- COD_AMOUNT_MISMATCH
- PARCEL_DAMAGED
- CUSTOMER_REFUSED_TO_PAY
- OTHER

## 1) Rider Submit Issue Report

### Endpoint
POST /riders/parcels/:id/report

### Auth
- Bearer token required
- Role: RIDER

### Path Param
- id: Parcel UUID

### Request Body
```json
{
  "issue_type": "INCORRECT_ADDRESS",
  "note": "Customer confirmed the address in app is wrong."
}
```

### Validation Rules
- issue_type: required enum
- note: required string, trimmed, max length 300
- empty note is rejected

### Request Body Variants (All Reason Types)

#### Incorrect Address
```json
{
  "issue_type": "INCORRECT_ADDRESS",
  "note": "House number does not exist on this road."
}
```

#### Incorrect Phone
```json
{
  "issue_type": "INCORRECT_PHONE",
  "note": "Given number is switched off and alternate number is invalid."
}
```

#### COD Amount Mismatch
```json
{
  "issue_type": "COD_AMOUNT_MISMATCH",
  "note": "Customer invoice says 850 but parcel app shows 950."
}
```

#### Parcel Damaged
```json
{
  "issue_type": "PARCEL_DAMAGED",
  "note": "Outer packaging torn and liquid leakage observed."
}
```

#### Customer Refused to Pay
```json
{
  "issue_type": "CUSTOMER_REFUSED_TO_PAY",
  "note": "Customer refused to pay after opening and checking product."
}
```

#### Other
```json
{
  "issue_type": "OTHER",
  "note": "Building gate locked, no one available to receive after 3 calls."
}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "c43b8df3-689f-4f88-baf7-6d265087ad3e",
    "tracking_number": "TRK-20260407-00123",
    "status": "ASSIGNED_TO_RIDER",
    "issue_type": "INCORRECT_ADDRESS",
    "issue_description": "Customer confirmed the address in app is wrong.",
    "issue_reported_by_id": "95e1a624-fb1b-4d18-86d8-87cbf2f8e670",
    "issue_reported_at": "2026-04-07T10:05:41.120Z",
    "is_issue_resolved": false
  },
  "message": "Delivery issue submitted to hub manager and admin successfully"
}
```

### Error Response Examples

#### 400 - Invalid status for reporting
```json
{
  "success": false,
  "message": "Cannot report issue for parcel with status: RETURNED_TO_HUB",
  "statusCode": 400
}
```

#### 400 - Empty note
```json
{
  "success": false,
  "message": "note should not be empty",
  "statusCode": 400
}
```

#### 400 - Invalid issue type
```json
{
  "success": false,
  "message": "issue_type must be a valid enum value",
  "statusCode": 400
}
```

#### 403 - Wrong role
```json
{
  "success": false,
  "message": "Forbidden resource",
  "statusCode": 403
}
```

#### 404 - Parcel not found or not assigned
```json
{
  "success": false,
  "message": "Parcel not found or not assigned to you",
  "statusCode": 404
}
```

## 2) Hub Manager/Admin Review Queue Access

This update also enables admin access for existing parcel report review endpoints.

### Get Reports List
GET /hubs/parcels/reports

- Roles: HUB_MANAGER, ADMIN
- Query options:
  - search
  - issue_type
  - page
  - limit
  - hub_id (admin only optional filter)

#### Admin list all hubs
GET /hubs/parcels/reports?page=1&limit=20

#### Admin list specific hub
GET /hubs/parcels/reports?hub_id=<hub-uuid>&page=1&limit=20

### Get Single Report
GET /hubs/parcels/reports/:id

- Roles: HUB_MANAGER, ADMIN

### Resolve Single Report
PATCH /hubs/parcels/reports/:id/resolve

- Roles: HUB_MANAGER, ADMIN
- Existing body contract unchanged

### Bulk Resolve Reports
POST /hubs/parcels/reports/bulk-resolve

- Roles: HUB_MANAGER, ADMIN
- Existing body contract unchanged

## Data Mapping Notes
On rider submission, these parcel fields are updated:
- issue_type
- issue_description
- issue_reported_by_id
- issue_reported_at
- is_issue_resolved = false

This makes the report visible in unresolved report queues for operational review.
