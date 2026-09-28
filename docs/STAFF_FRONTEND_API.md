# Staff Management Frontend API Guide

Base URL: `https://deliverybackend-production-f9bf.up.railway.app`

All protected APIs use `Authorization: Bearer <token>`. JSON requests use `Content-Type: application/json`.

Enums:

```text
StaffPosition: RIDER | COURIER | MANAGER | ADMIN | DISPATCHER |
WAREHOUSE_ASSISTANT | CUSTOMER_SERVICE | ADMIN_STAFF | OTHER

BikeType: MOTORCYCLE | BICYCLE | SCOOTER | CAR | VAN
```

`position` is a job title. It does not grant an authentication role.

## Staff Files

### API Name

Create Staff File Upload URL

### Method + Endpoint

POST /upload/signed-url

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

```json
{
  "fileName": "nid-front.jpg",
  "fileType": "image/jpeg",
  "module": "staff/nid"
}
```

Allowed staff modules: `staff/profile`, `staff/nid`, `staff/license`, `staff/parent-nid`.

### Success Response

```json
{
  "success": true,
  "message": "Signed URL generated successfully",
  "signedUrl": "https://s3-presigned-put-url",
  "fileKey": "staff/nid/uuid-timestamp.jpg",
  "readUrl": "https://s3-presigned-read-url"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["module must be one of the following values: ..."]
}
```

### Business Rules

- Request one signed URL per file, then `PUT` the file to `signedUrl` using the same content type.
- Send `readUrl` in the staff create/update field. Keep `fileKey` so a read URL can be refreshed later.
- Upload URL expires in 5 minutes; read URL expires in 7 days.

---

### API Name

Refresh Staff File Read URL

### Method + Endpoint

GET /upload/read-url?fileKey=staff/nid/uuid-timestamp.jpg

### Authentication

Public endpoint.

### Query Parameters

`fileKey`: string, required

### Success Response

```json
{
  "success": true,
  "message": "Read URL generated successfully",
  "readUrl": "https://new-read-url",
  "fileKey": "staff/nid/uuid-timestamp.jpg"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "message": "fileKey query parameter is required"
}
```

### Business Rules

- Use the original `fileKey`, not an expired `readUrl`.

## Staff Profiles

### API Name

Create Staff

### Method + Endpoint

POST /staff

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

```json
{
  "full_name": "Ahmed Wasi",
  "phone": "01700000000",
  "email": "ahmed@example.com",
  "password": "StrongPass123",
  "position": "MANAGER",
  "hub_id": "hub-uuid",
  "photo": "https://profile-read-url",
  "secondary_phone": "01800000000",
  "guardian_mobile_no": "01900000000",
  "bike_type": "MOTORCYCLE",
  "nid_number": "1234567890",
  "license_no": "DL-12345",
  "present_address": "Dhaka",
  "permanent_address": "Sylhet",
  "fixed_salary": 25000,
  "bank_name": "Dutch-Bangla Bank",
  "bank_account_number": "123456789012",
  "bank_branch": "Mohammadpur",
  "district": "Dhaka",
  "account_holder_name": "Ahmed Wasi",
  "routing_number": "090263456",
  "nid_front_photo": "https://nid-front-read-url",
  "nid_back_photo": "https://nid-back-read-url",
  "license_front_photo": "https://license-front-read-url",
  "license_back_photo": "https://license-back-read-url",
  "parent_nid_front_photo": "https://parent-front-read-url",
  "parent_nid_back_photo": "https://parent-back-read-url"
}
```

Required: `full_name`, `phone`, `position`, `hub_id`, `guardian_mobile_no`, `bike_type`, `nid_number`, both addresses, `fixed_salary`, all six bank fields, both staff NID photos, and both parent NID photos.

Optional: `email`, `password`, `photo`, `secondary_phone`, `license_no`, and both license photos.

### Success Response

201 Created

```json
{
  "success": true,
  "data": {
    "id": "staff-uuid",
    "staff_code": "EMP12345",
    "full_name": "Ahmed Wasi",
    "phone": "01700000000",
    "email": "ahmed@example.com",
    "position": "MANAGER",
    "hub_id": "hub-uuid",
    "hub_name": "Mohammadpur Hub",
    "hub_code": "DHK-MDP",
    "fixed_salary": "25000.00",
    "bank_name": "Dutch-Bangla Bank",
    "district": "Dhaka",
    "account_holder_name": "Ahmed Wasi",
    "routing_number": "090263456",
    "is_active": true,
    "created_at": "2026-09-28T10:00:00.000Z",
    "updated_at": "2026-09-28T10:00:00.000Z"
  },
  "message": "Staff created successfully"
}
```

### Error Response

409 Conflict

```json
{
  "success": false,
  "statusCode": 409,
  "message": "Phone number already registered"
}
```

### Business Rules

- Phone fields use Bangladesh format `01XXXXXXXXX`; password minimum is 8 characters.
- Phone, email, and NID must be unique. Hub must exist.
- If password is omitted, the backend creates a secure random password.
- User, Staff, verified default bank payout method, and StaffFinance are created atomically.
- The current frontend ZIP must add `district`, `account_holder_name`, and `routing_number` and must upload its selected files before sending this request.

---

### API Name

Get Staff List

### Method + Endpoint

GET /staff

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Query Parameters

```text
page: integer, default 1
limit: integer, default 10, maximum 100
search: name, phone, or staff code
position: StaffPosition
hub_id: UUID (ADMIN only)
is_active: true | false
```

Legacy aliases `hubId` and `isActive` are also accepted.

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "staff-uuid",
      "staff_code": "EMP12345",
      "full_name": "Ahmed Wasi",
      "phone": "01700000000",
      "email": "ahmed@example.com",
      "position": "MANAGER",
      "hub_id": "hub-uuid",
      "hub_name": "Mohammadpur Hub",
      "hub_code": "DHK-MDP",
      "bike_type": "MOTORCYCLE",
      "fixed_salary": "25000.00",
      "is_active": true
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "summary": {
    "totalStaff": 1,
    "active": 1,
    "inactive": 0,
    "riders": 0,
    "couriers": 0,
    "totalSalary": 25000
  },
  "message": "Staff retrieved successfully"
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "message": "Your account is not assigned to any hub. Please contact admin."
}
```

### Business Rules

- HUB_MANAGER is always restricted to the hub stored in the token.
- Use server filters; do not status-filter only the current page in the browser.

---

### API Name

Get Staff Details

### Method + Endpoint

GET /staff/details/:staffId

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`staffId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "staff-uuid",
    "staff_code": "EMP12345",
    "full_name": "Ahmed Wasi",
    "phone": "01700000000",
    "email": "ahmed@example.com",
    "position": "MANAGER",
    "hub_id": "hub-uuid",
    "hub_name": "Mohammadpur Hub",
    "hub_code": "DHK-MDP",
    "secondary_phone": "01800000000",
    "guardian_mobile_no": "01900000000",
    "bike_type": "MOTORCYCLE",
    "nid_number": "1234567890",
    "license_no": "DL-12345",
    "present_address": "Dhaka",
    "permanent_address": "Sylhet",
    "fixed_salary": "25000.00",
    "bank_name": "Dutch-Bangla Bank",
    "bank_account_number": "123456789012",
    "bank_branch": "Mohammadpur",
    "district": "Dhaka",
    "account_holder_name": "Ahmed Wasi",
    "routing_number": "090263456",
    "nid_front_photo": "https://nid-front-read-url",
    "nid_back_photo": "https://nid-back-read-url",
    "license_front_photo": "https://license-front-read-url",
    "license_back_photo": "https://license-back-read-url",
    "parent_nid_front_photo": "https://parent-front-read-url",
    "parent_nid_back_photo": "https://parent-back-read-url",
    "is_active": true
  },
  "message": "Staff details retrieved successfully"
}
```

### Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Staff not found in your hub"
}
```

### Business Rules

- HUB_MANAGER can read only staff in their own hub.
- `GET /staff/:staffId` is an equivalent compatibility route and now returns the same complete shape.

---

### API Name

Update Staff

### Method + Endpoint

PATCH /staff/:staffId

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`staffId`: UUID, required

### Request Body

```json
{
  "full_name": "Ahmed Wasi Updated",
  "fixed_salary": 27000,
  "bank_name": "BRAC Bank",
  "bank_account_number": "9988776655",
  "bank_branch": "Banani",
  "district": "Dhaka",
  "account_holder_name": "Ahmed Wasi Updated",
  "routing_number": "060263456"
}
```

This is a partial update, so frontend can send only changed fields.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "staff-uuid",
    "full_name": "Ahmed Wasi Updated",
    "fixed_salary": "27000.00",
    "bank_name": "BRAC Bank",
    "is_active": true
  },
  "message": "Staff updated successfully"
}
```

### Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Staff with ID \"staff-uuid\" not found"
}
```

### Business Rules

- Send only changed fields. Do not send `is_active`; status has separate endpoints.
- Bank changes synchronize the default payout method in the same transaction.
- Salary changes adjust the remaining finance balance by the salary difference.
- HUB_MANAGER cannot move staff to another hub.
- The current frontend ZIP must call this route in edit mode; it currently calls create again.

---

### API Name

Deactivate Staff

### Method + Endpoint

PATCH /staff/:staffId/deactivate

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`staffId`: UUID, required

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "staff-uuid",
    "full_name": "Ahmed Wasi",
    "is_active": false
  },
  "message": "Staff deactivated successfully"
}
```

### Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Staff not found in your hub"
}
```

### Business Rules

- Deactivation also disables the linked user login.
- HUB_MANAGER can deactivate only staff in their hub.
- `DELETE /staff/:staffId` is a backward-compatible soft-deactivate route.

---

### API Name

Activate Staff

### Method + Endpoint

PATCH /staff/:staffId/activate

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "staff-uuid",
    "full_name": "Ahmed Wasi",
    "is_active": true
  },
  "message": "Staff activated successfully"
}
```

### Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Staff with ID \"staff-uuid\" not found"
}
```

### Business Rules

- Only ADMIN can reactivate staff.
- Activation also enables the linked user login.

---

### API Name

Get Active Staff Options

### Method + Endpoint

GET /staff/admin/list

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "data": {
    "staff": [
      {
        "id": "EMP12345",
        "profile": {
          "name": "Ahmed Wasi",
          "phone": "01700000000",
          "photo": null
        },
        "position": "MANAGER",
        "assigned_hub": {
          "id": "hub-uuid",
          "name": "Mohammadpur Hub",
          "code": "DHK-MDP"
        },
        "salary": 25000,
        "last_paid": null
      }
    ],
    "total": 1
  },
  "message": "Staff list retrieved successfully"
}
```

### Error Response

403 Forbidden

```json
{
  "success": false,
  "message": "Forbidden resource"
}
```

### Business Rules

- Returns active staff only.
- This legacy option list uses staff code in `id`; use `GET /staff` for management UUIDs.

---

### API Name

Get Active Staff Count by Hub

### Method + Endpoint

GET /staff/hub/:hubId/count

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`hubId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": { "count": 12 },
  "message": "Staff count retrieved successfully"
}
```

### Error Response

403 Forbidden

```json
{
  "success": false,
  "message": "You do not have permission to access another hub"
}
```

### Business Rules

- Counts active staff only. HUB_MANAGER can request only their own hub.

---

### API Name

Get Staff by ID (Compatibility Route)

### Method + Endpoint

GET /staff/:staffId

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`staffId`: UUID, required

### Success Response

Returns the same complete `data` object as `GET /staff/details/:staffId` with message `Staff retrieved successfully`.

### Error Response

404 Not Found

```json
{ "success": false, "message": "Staff not found in your hub" }
```

### Business Rules

- Prefer `/staff/details/:staffId` for new frontend code.
- HUB_MANAGER remains limited to their own hub.

---

### API Name

Soft Delete Staff (Compatibility Route)

### Method + Endpoint

DELETE /staff/:staffId

### Authentication

Authorization: Bearer \<admin-or-hub-manager-token>

Roles: ADMIN, HUB_MANAGER

### Path Parameter

`staffId`: UUID, required

### Request Body

No request body.

### Success Response

```json
{
  "success": true,
  "message": "Staff deactivated successfully"
}
```

### Error Response

404 Not Found

```json
{ "success": false, "message": "Staff not found in your hub" }
```

### Business Rules

- This does not delete database rows; it deactivates Staff and the linked User.
- Prefer `PATCH /staff/:staffId/deactivate` for new frontend code.

---

### API Name

Initiate Staff Payout (Legacy Route)

### Method + Endpoint

POST /staff/:staffId/pay

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Request Body

```json
{ "amount": 25000 }
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "staff_id": "staff-uuid",
    "amount": "25000.00",
    "status": "PENDING"
  },
  "message": "Staff payout initiated"
}
```

### Error Response

400 Bad Request

```json
{ "success": false, "message": "Invalid amount" }
```

### Business Rules

- This route does not validate the selected payout account or exact pending salary.
- Do not use it in the new salary UI. Use `/api/salary/process-payment` instead.

## Salary and Payout

Salary service JSON is wrapped as `success -> data -> status/data`. Read the business payload from `response.data.data` after the normal API envelope.

### API Name

Get Salary Creation List

### Method + Endpoint

GET /api/salary/create-list?page=1&limit=10

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Query Parameters

`page`: integer, default 1; `limit`: integer, default 10, maximum 100.

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "staff": [
        {
          "id": "staff-uuid",
          "profile": {
            "name": "Ahmed Wasi",
            "phone": "01700000000",
            "avatar_url": null
          },
          "position": "MANAGER",
          "assigned_hub": "Mohammadpur Hub",
          "salary_amount": 25000,
          "last_paid": null,
          "status": "pending_creation"
        }
      ],
      "pagination": {
        "total_items": 1,
        "current_page": 1,
        "items_per_page": 10,
        "total_pages": 1
      }
    }
  }
}
```

### Error Response

403 Forbidden

```json
{ "success": false, "message": "Forbidden resource" }
```

### Business Rules

- Returns active staff eligible for salary calculation.

---

### API Name

Get Staff Salary Creation Details

### Method + Endpoint

GET /api/salary/staff/:staffId/create-details

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "staff_information": {
        "id": "staff-uuid",
        "name": "Ahmed Wasi",
        "base_salary": 25000
      },
      "salary_summary": { "basic_salary": 25000, "per_day": 833.33 },
      "salary_increment_modifiers": {},
      "monthly_salary_modifiers": {},
      "calculated_payment_amount": 25000
    }
  }
}
```

### Error Response

404 Not Found

```json
{ "success": false, "message": "Staff with ID \"staff-uuid\" not found" }
```

### Business Rules

- Load this before displaying salary generation and use its calculated defaults.

---

### API Name

Generate Staff Salary Calculation

### Method + Endpoint

POST /api/salary/generate

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

```json
{
  "staff_id": "staff-uuid",
  "salary_increment_modifiers": {
    "increment": 1000,
    "commitment_increment": 500,
    "pickup_increment": 300,
    "eid_bonus_per": 0
  },
  "monthly_salary_modifiers": {
    "attendance": 0,
    "delivery": 0,
    "cancel": 0,
    "pickup": 0,
    "overtime": 500,
    "advance_acceptance": 0,
    "loan": 0,
    "previous_month": 0
  },
  "final_payment_amount": 27300
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": { "staff_id": "staff-uuid", "final_payment_amount": 27300 }
  }
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "message": "final_payment_amount must equal calculated_payment_amount (27300)"
}
```

### Business Rules

- Modifiers default to zero. If sent, final amount must equal the backend calculation.
- This validates a calculation; it does not complete a payout.

---

### API Name

Get Salary Pay List

### Method + Endpoint

GET /api/salary/pay-list?page=1&limit=10

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Query Parameters

`page`: integer, default 1; `limit`: integer, default 10, maximum 100.

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "staff": [
        {
          "id": "staff-uuid",
          "total_earnings": 25000,
          "salary_pending": 25000,
          "payment_method": "bank_transfer",
          "last_paid": null,
          "month": "September 26",
          "is_payable": true
        }
      ],
      "pagination": {
        "total_items": 1,
        "current_page": 1,
        "items_per_page": 10,
        "total_pages": 1
      }
    }
  }
}
```

### Error Response

403 Forbidden

```json
{ "success": false, "message": "Forbidden resource" }
```

### Business Rules

- `salary_pending` subtracts completed payouts in the current month.
- Disable Pay when `is_payable` is false.

---

### API Name

Get Staff Payment Details

### Method + Endpoint

GET /api/salary/staff/:staffId/payment-details

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "payment_summary": {
        "total_earnings": 25000,
        "last_paid": null,
        "salary_pending": 25000
      },
      "available_bank_accounts": [
        {
          "account_id": "payout-method-uuid",
          "bank_name": "Dutch-Bangla Bank",
          "masked_number": "********9012",
          "is_default": true
        }
      ],
      "selected_account_details": {
        "bank_name": "Dutch-Bangla Bank",
        "account_no": "123456789012",
        "account_holder_name": "Ahmed Wasi"
      }
    }
  }
}
```

### Error Response

404 Not Found

```json
{ "success": false, "message": "Staff with ID \"staff-uuid\" not found" }
```

### Business Rules

- Send the selected returned `account_id` to the payment endpoint.

---

### API Name

Process Staff Salary Payment

### Method + Endpoint

POST /api/salary/process-payment

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

```json
{
  "staff_id": "staff-uuid",
  "account_id": "payout-method-uuid",
  "payment_amount": 25000,
  "payment_method": "bank_transfer"
}
```

Payment methods: `bank_transfer`, `bkash`, `nagad`, `manual`.

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "transaction_id": "transaction-uuid",
      "staff_id": "staff-uuid",
      "payment_amount": "25000.00",
      "payment_method": "bank_transfer",
      "reference_number": "SAL-EMP12345-1790590000000",
      "status": "PENDING"
    }
  }
}
```

### Error Response

400 Bad Request

```json
{
  "success": false,
  "message": "payment_amount must equal salary_pending (25000)"
}
```

### Business Rules

- Amount must equal current pending salary. Account must be active and belong to the staff.
- Success creates a PENDING transaction; it is not completed until finalized.

---

### API Name

Bulk Process Staff Salary Payments

### Method + Endpoint

POST /api/salary/bulk-process-payment

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Request Body

```json
{
  "payments": [
    {
      "staff_id": "staff-uuid-1",
      "account_id": "payout-method-uuid-1",
      "payment_amount": 25000,
      "payment_method": "bank_transfer"
    }
  ]
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "total": 2,
      "succeeded": 1,
      "failed": 1,
      "results": [
        {
          "index": 0,
          "staff_id": "staff-uuid-1",
          "success": true,
          "data": { "transaction_id": "transaction-uuid" }
        },
        {
          "index": 1,
          "staff_id": "staff-uuid-2",
          "success": false,
          "message": "Invalid account_id"
        }
      ]
    }
  }
}
```

### Error Response

400 Bad Request

```json
{ "success": false, "message": ["payments must contain at least 1 elements"] }
```

### Business Rules

- Accepts 1-100 items. Valid items succeed even if other items fail.
- Each result has its own success/error. Duplicate staff IDs fail after the first occurrence.

---

### API Name

Finalize Staff Payout

### Method + Endpoint

POST /api/salary/payouts/:transactionId/finalize

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`transactionId`: UUID, required

### Request Body

```json
{
  "status": "COMPLETED",
  "processed_at": "2026-09-28T10:05:00.000Z"
}
```

For failure, send status `FAILED` and `failure_reason`.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "transaction-uuid",
    "staff_id": "staff-uuid",
    "amount": "25000.00",
    "status": "COMPLETED"
  }
}
```

### Error Response

404 Not Found

```json
{ "success": false, "message": "Payout transaction not found" }
```

### Business Rules

- Normally called by a payout worker/provider callback.
- COMPLETED updates StaffFinance totals and remaining balance.

---

### API Name

Get Staff Payout Transactions

### Method + Endpoint

GET /api/salary/staff/:staffId/payouts?page=1&limit=20

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": {
    "status": "success",
    "data": {
      "transactions": [],
      "total": 0,
      "staff": { "id": "staff-uuid", "name": "Ahmed Wasi" }
    }
  }
}
```

### Error Response

404 Not Found

```json
{ "success": false, "message": "Staff with ID \"staff-uuid\" not found" }
```

### Business Rules

- Includes PENDING, COMPLETED, and FAILED staff payout transactions.

---

### API Name

Export Salary Report

### Method + Endpoint

GET /api/salary/export?from_date=2026-09-01&to_date=2026-09-30&format=csv

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Query Parameters

`from_date`: YYYY-MM-DD, required

`to_date`: YYYY-MM-DD, required

`format`: `csv`, `excel`, or `pdf`, required

### Success Response

200 binary download. Content type is `text/csv`, XLSX, or `application/pdf`, and filename is in `Content-Disposition`.

### Error Response

400 Bad Request

```json
{ "success": false, "message": "format must be csv, excel, or pdf" }
```

### Business Rules

- Exports completed staff payouts in the inclusive date range.
- Frontend must read this response as a Blob.

## Payout History

### API Name

Get Staff Payout History

### Method + Endpoint

GET /api/v1/payout-history

Alternative: `GET /admin/payout-history`

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Query Parameters

`search`, `page`, `limit`, `start_date`, and `end_date` are optional.

### Success Response

```json
{
  "success": true,
  "meta": {
    "title": "Payout History",
    "pagination": {
      "total_records": 1,
      "current_page": 1,
      "limit": 10,
      "showing": "1 - 1 of 1"
    }
  },
  "data": [
    {
      "id": "staff-uuid",
      "payout_id": "payout-uuid",
      "profile": { "name": "Ahmed Wasi", "number": "01700000000" },
      "position": "MANAGER",
      "assigned_hub": "Mohammadpur Hub",
      "salary_amount": 25000,
      "currency": "BDT",
      "paid_using": "Dutch-Bangla Bank"
    }
  ]
}
```

### Error Response

400 Bad Request

```json
{ "success": false, "message": "start_date must be earlier than end_date" }
```

### Business Rules

- Returns completed payouts only, grouped by staff with their latest payout.

---

### API Name

Get Staff Payout History Details

### Method + Endpoint

GET /api/v1/payout-history-details/:staffId

Alternative: `GET /admin/payout-history-details/:staffId`

### Authentication

Authorization: Bearer \<admin-token>

Role: ADMIN

### Path Parameter

`staffId`: UUID, required

### Success Response

```json
{
  "success": true,
  "data": {
    "staff_information": {
      "id": "staff-uuid",
      "name": "Ahmed Wasi",
      "status": "Verified",
      "position": "MANAGER",
      "hub": "Mohammadpur Hub",
      "salary": 25000
    },
    "total_earning": 25000,
    "salary_paid": { "month": "September 2026", "amount": 25000 },
    "currency": "BDT",
    "paid_using": {}
  }
}
```

### Error Response

404 Not Found

```json
{
  "success": false,
  "message": "No completed salary payout found for staff \"staff-uuid\""
}
```

### Business Rules

- Requires at least one completed payout for the selected staff.

## Required Frontend Corrections Found in the ZIP

1. Add `updateStaff`, `activateStaff`, and `deactivateStaff` mutations.
2. In edit mode call `PATCH /staff/:staffId`; the current form calls POST create again.
3. Send `is_active` to `GET /staff` instead of filtering only the current page.
4. Add `district`, `account_holder_name`, and `routing_number` to the form and request type.
5. Upload each selected document and send the resulting URL. The current form collects files but does not submit them.
6. Add document and bank payout fields to `StaffDetails`.
7. Add `manual` to salary `PaymentMethod`; remove `rocket` until Rocket is implemented.
8. Handle salary export as Blob instead of normal JSON.
