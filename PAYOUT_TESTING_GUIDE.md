# Merchant Payout Method System - Testing Guide

## Prerequisites

1. Ensure the server is running: `npm run start:dev`
2. Have a test merchant account (approved)
3. Have admin credentials
4. Use Postman or similar API testing tool

## Authentication Setup

### Get Merchant Token
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "phone": "01712345678",  // Your merchant phone
  "password": "yourpassword"
}
```

Save the `access_token` from the response.

### Get Admin Token
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "phone": "01600000000",  // Your admin phone
  "password": "admin123"
}
```

Save the admin `access_token` from the response.

---

## Test Scenarios

### 1. Get Available Payout Methods (Merchant)

**Endpoint:** `GET /merchants/my/payout-methods/available`

```http
GET http://localhost:3000/merchants/my/payout-methods/available
Authorization: Bearer <merchant_token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "available_methods": [
      "BANK_ACCOUNT",
      "BKASH",
      "NAGAD",
      "CASH"
    ]
  },
  "message": "Available payout methods retrieved successfully"
}
```

---

### 2. Add Bank Account (Merchant)

**Endpoint:** `POST /merchants/my/payout-methods`

```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "BANK_ACCOUNT",
  "bank_name": "Dutch Bangla Bank",
  "branch_name": "Dhaka Main Branch",
  "account_holder_name": "John Doe",
  "account_number": "1234567890",
  "routing_number": "090123456"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "uuid",
      "merchant_id": "uuid",
      "method_type": "BANK_ACCOUNT",
      "status": "PENDING",
      "is_default": false,
      "bank_name": "Dutch Bangla Bank",
      ...
    }
  },
  "message": "Payout method added successfully"
}
```

**Note:** Status should be `PENDING` (not yet verified by admin).

---

### 3. Add bKash Account (Merchant)

```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "BKASH",
  "bkash_number": "01712345678",
  "bkash_account_holder_name": "John Doe",
  "bkash_account_type": "PERSONAL"
}
```

**Expected:** Status should be `PENDING`.

---

### 4. Add Nagad Account (Merchant)

```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "NAGAD",
  "nagad_number": "01812345678",
  "nagad_account_holder_name": "John Doe",
  "nagad_account_type": "PERSONAL"
}
```

**Expected:** Status should be `PENDING`.

---

### 5. Add Cash Method (Merchant)

```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "CASH"
}
```

**Expected:** 
- Status should be `VERIFIED` (auto-verified)
- `is_default` should be `true` (if it's the first verified method)

---

### 6. Try Adding Duplicate Method (Should Fail)

```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "CASH"
}
```

**Expected:** Error 409 - "CASH payout method already exists"

---

### 7. Get Current Payout Methods (Merchant)

```http
GET http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "current_methods": [
      {
        "id": "uuid",
        "method_type": "CASH",
        "status": "VERIFIED",
        "is_default": true,
        ...
      },
      {
        "id": "uuid",
        "method_type": "BANK_ACCOUNT",
        "status": "PENDING",
        "is_default": false,
        ...
      },
      ...
    ]
  },
  "message": "Payout methods retrieved successfully"
}
```

**Note:** Methods should be ordered by `is_default` DESC, then `created_at` ASC.

---

### 8. Update Payout Method (Merchant)

```http
PATCH http://localhost:3000/merchants/my/payout-methods/<method_id>
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "bank_name": "BRAC Bank",
  "account_number": "9876543210"
}
```

**Expected:** Method should be updated with new values.

---

### 9. Admin Verifies Bank Account

**Endpoint:** `PATCH /merchants/payout-methods/:id/verify`

```http
PATCH http://localhost:3000/merchants/payout-methods/<method_id>/verify
Authorization: Bearer <admin_token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "uuid",
      "status": "VERIFIED",
      "verified_at": "2024-12-22T...",
      "verified_by": "admin_user_id",
      ...
    }
  },
  "message": "Payout method verified successfully"
}
```

---

### 10. Set Default Payout Method (Merchant)

**Note:** Can only set verified methods as default.

```http
PATCH http://localhost:3000/merchants/my/payout-methods/<verified_method_id>/set-default
Authorization: Bearer <merchant_token>
```

**Expected:** 
- Method becomes `is_default: true`
- Previous default becomes `is_default: false`

---

### 11. Try Setting Pending Method as Default (Should Fail)

```http
PATCH http://localhost:3000/merchants/my/payout-methods/<pending_method_id>/set-default
Authorization: Bearer <merchant_token>
```

**Expected:** Error 400 - "Only verified methods can be set as default"

---

### 12. Delete Payout Method (Merchant)

```http
DELETE http://localhost:3000/merchants/my/payout-methods/<method_id>
Authorization: Bearer <merchant_token>
```

**Expected:** Method should be deleted. If it was default, `is_default` should be unset first.

---

### 13. Get Payout Transactions (Merchant)

```http
GET http://localhost:3000/merchants/my/payout-transactions?page=1&limit=10
Authorization: Bearer <merchant_token>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [],
    "pagination": {
      "total": 0,
      "page": 1,
      "limit": 10,
      "totalPages": 0
    }
  },
  "message": "Payout transactions retrieved successfully"
}
```

**Note:** Transactions list will be empty initially (actual payout processing not yet implemented).

---

### 14. Validation Tests

#### Invalid bKash Number
```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "BKASH",
  "bkash_number": "12345",  // Invalid format
  "bkash_account_holder_name": "John Doe",
  "bkash_account_type": "PERSONAL"
}
```

**Expected:** Validation error - "Invalid bKash number format"

#### Missing Bank Details
```http
POST http://localhost:3000/merchants/my/payout-methods
Authorization: Bearer <merchant_token>
Content-Type: application/json

{
  "method_type": "BANK_ACCOUNT"
  // Missing required bank fields
}
```

**Expected:** Validation errors for missing required fields.

---

## Database Verification

After running the tests, verify in the database:

```sql
-- Check payout methods
SELECT 
  id,
  merchant_id,
  method_type,
  status,
  is_default,
  verified_at,
  created_at
FROM merchant_payout_methods
ORDER BY created_at DESC;

-- Check unique constraint
SELECT merchant_id, method_type, COUNT(*)
FROM merchant_payout_methods
GROUP BY merchant_id, method_type
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check default flags
SELECT merchant_id, COUNT(*) as default_count
FROM merchant_payout_methods
WHERE is_default = true
GROUP BY merchant_id
HAVING COUNT(*) > 1;
-- Should return 0 rows (only one default per merchant)
```

---

## Success Criteria

- ✅ Merchants can add all 4 types of payout methods
- ✅ Cash method is auto-verified
- ✅ Other methods require admin verification
- ✅ Cannot add duplicate methods
- ✅ Can update payout method details
- ✅ Can delete payout methods
- ✅ Admin can verify pending methods
- ✅ Merchants can set verified methods as default
- ✅ Cannot set pending methods as default
- ✅ Only one method can be default at a time
- ✅ Validation works correctly for phone numbers and required fields
- ✅ Available methods list updates after adding methods
- ✅ Payout transactions endpoint works (even if empty)

---

## Next Steps

After successful testing, the payout method system is ready for:
1. Integration with actual payment processing
2. Automated payout scheduling
3. Payout transaction creation when payments are processed
4. Integration with the rider settlement system (for handling merchant COD settlements)

