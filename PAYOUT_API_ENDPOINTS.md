# Merchant Payout Method API Endpoints

## Base URL
```
http://localhost:3000
```

---

## 🔐 Authentication

### Login as Merchant
```http
POST /auth/login
Content-Type: application/json

{
  "phone": "01712345678",
  "password": "merchant123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "full_name": "John Doe",
    "phone": "01712345678",
    "role": "MERCHANT"
  }
}
```

### Login as Admin
```http
POST /auth/login
Content-Type: application/json

{
  "phone": "01600000000",
  "password": "admin123"
}
```

---

## 📦 Merchant Endpoints

### 1. Get Available Payout Methods

Get list of payment methods that can still be added.

```http
GET /merchants/my/payout-methods/available
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
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

### 2. Get My Current Payout Methods

Get all payout methods added by the merchant.

```http
GET /merchants/my/payout-methods
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_methods": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
        "method_type": "CASH",
        "status": "VERIFIED",
        "is_default": true,
        "bank_name": null,
        "branch_name": null,
        "account_holder_name": null,
        "account_number": null,
        "routing_number": null,
        "bkash_number": null,
        "bkash_account_holder_name": null,
        "bkash_account_type": null,
        "nagad_number": null,
        "nagad_account_holder_name": null,
        "nagad_account_type": null,
        "verified_at": "2024-12-22T10:30:00.000Z",
        "verified_by": null,
        "verifier": null,
        "created_at": "2024-12-22T10:30:00.000Z",
        "updated_at": "2024-12-22T10:30:00.000Z"
      },
      {
        "id": "456e7890-e12b-34d5-a678-426614174111",
        "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
        "method_type": "BANK_ACCOUNT",
        "status": "PENDING",
        "is_default": false,
        "bank_name": "Dutch Bangla Bank",
        "branch_name": "Dhaka Main Branch",
        "account_holder_name": "John Doe",
        "account_number": "1234567890",
        "routing_number": "090123456",
        "bkash_number": null,
        "bkash_account_holder_name": null,
        "bkash_account_type": null,
        "nagad_number": null,
        "nagad_account_holder_name": null,
        "nagad_account_type": null,
        "verified_at": null,
        "verified_by": null,
        "verifier": null,
        "created_at": "2024-12-22T10:35:00.000Z",
        "updated_at": "2024-12-22T10:35:00.000Z"
      }
    ]
  },
  "message": "Payout methods retrieved successfully"
}
```

---

### 3. Add Bank Account

```http
POST /merchants/my/payout-methods
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "456e7890-e12b-34d5-a678-426614174111",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "BANK_ACCOUNT",
      "status": "PENDING",
      "is_default": false,
      "bank_name": "Dutch Bangla Bank",
      "branch_name": "Dhaka Main Branch",
      "account_holder_name": "John Doe",
      "account_number": "1234567890",
      "routing_number": "090123456",
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": null,
      "verified_by": null,
      "created_at": "2024-12-22T10:35:00.000Z",
      "updated_at": "2024-12-22T10:35:00.000Z"
    }
  },
  "message": "Payout method added successfully"
}
```

---

### 4. Add bKash Account

```http
POST /merchants/my/payout-methods
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "method_type": "BKASH",
  "bkash_number": "01712345678",
  "bkash_account_holder_name": "John Doe",
  "bkash_account_type": "PERSONAL"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "789e0123-e45b-67d8-a901-426614174222",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "BKASH",
      "status": "PENDING",
      "is_default": false,
      "bank_name": null,
      "branch_name": null,
      "account_holder_name": null,
      "account_number": null,
      "routing_number": null,
      "bkash_number": "01712345678",
      "bkash_account_holder_name": "John Doe",
      "bkash_account_type": "PERSONAL",
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": null,
      "verified_by": null,
      "created_at": "2024-12-22T10:40:00.000Z",
      "updated_at": "2024-12-22T10:40:00.000Z"
    }
  },
  "message": "Payout method added successfully"
}
```

**Note:** `bkash_account_type` can be: `PERSONAL`, `MERCHANT`, or `AGENT`

---

### 5. Add Nagad Account

```http
POST /merchants/my/payout-methods
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "method_type": "NAGAD",
  "nagad_number": "01812345678",
  "nagad_account_holder_name": "John Doe",
  "nagad_account_type": "PERSONAL"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "012e3456-e78b-90d1-a234-426614174333",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "NAGAD",
      "status": "PENDING",
      "is_default": false,
      "bank_name": null,
      "branch_name": null,
      "account_holder_name": null,
      "account_number": null,
      "routing_number": null,
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": "01812345678",
      "nagad_account_holder_name": "John Doe",
      "nagad_account_type": "PERSONAL",
      "verified_at": null,
      "verified_by": null,
      "created_at": "2024-12-22T10:45:00.000Z",
      "updated_at": "2024-12-22T10:45:00.000Z"
    }
  },
  "message": "Payout method added successfully"
}
```

**Note:** `nagad_account_type` can be: `PERSONAL` or `MERCHANT`

---

### 6. Add Cash Method

```http
POST /merchants/my/payout-methods
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "method_type": "CASH"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "CASH",
      "status": "VERIFIED",
      "is_default": true,
      "bank_name": null,
      "branch_name": null,
      "account_holder_name": null,
      "account_number": null,
      "routing_number": null,
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": "2024-12-22T10:50:00.000Z",
      "verified_by": null,
      "created_at": "2024-12-22T10:50:00.000Z",
      "updated_at": "2024-12-22T10:50:00.000Z"
    }
  },
  "message": "Payout method added successfully"
}
```

**Note:** Cash is auto-verified and set as default if no other default exists.

---

### 7. Update Payout Method

```http
PATCH /merchants/my/payout-methods/456e7890-e12b-34d5-a678-426614174111
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "bank_name": "BRAC Bank",
  "branch_name": "Gulshan Branch",
  "account_number": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "456e7890-e12b-34d5-a678-426614174111",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "BANK_ACCOUNT",
      "status": "PENDING",
      "is_default": false,
      "bank_name": "BRAC Bank",
      "branch_name": "Gulshan Branch",
      "account_holder_name": "John Doe",
      "account_number": "9876543210",
      "routing_number": "090123456",
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": null,
      "verified_by": null,
      "created_at": "2024-12-22T10:35:00.000Z",
      "updated_at": "2024-12-22T11:00:00.000Z"
    }
  },
  "message": "Payout method updated successfully"
}
```

---

### 8. Set Default Payout Method

**Note:** Only VERIFIED methods can be set as default.

```http
PATCH /merchants/my/payout-methods/123e4567-e89b-12d3-a456-426614174000/set-default
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "CASH",
      "status": "VERIFIED",
      "is_default": true,
      "bank_name": null,
      "branch_name": null,
      "account_holder_name": null,
      "account_number": null,
      "routing_number": null,
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": "2024-12-22T10:50:00.000Z",
      "verified_by": null,
      "created_at": "2024-12-22T10:50:00.000Z",
      "updated_at": "2024-12-22T11:05:00.000Z"
    }
  },
  "message": "Default payout method set successfully"
}
```

---

### 9. Delete Payout Method

```http
DELETE /merchants/my/payout-methods/012e3456-e78b-90d1-a234-426614174333
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "message": "Payout method deleted successfully"
}
```

---

### 10. Get Payout Transactions

```http
GET /merchants/my/payout-transactions?page=1&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "abc12345-e67f-89g0-h123-456789012345",
        "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
        "payout_method_id": "123e4567-e89b-12d3-a456-426614174000",
        "amount": "5000.00",
        "reference_number": "PAY20241222001",
        "status": "COMPLETED",
        "admin_notes": "Payment processed successfully",
        "failure_reason": null,
        "initiated_at": "2024-12-22T09:00:00.000Z",
        "processed_at": "2024-12-22T09:05:00.000Z",
        "completed_at": "2024-12-22T09:10:00.000Z",
        "initiated_by": "admin-user-id",
        "created_at": "2024-12-22T09:00:00.000Z",
        "updated_at": "2024-12-22T09:10:00.000Z",
        "payout_method": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "method_type": "CASH",
          "status": "VERIFIED"
        },
        "initiator": {
          "id": "admin-user-id",
          "full_name": "Admin User",
          "phone": "01600000000"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Payout transactions retrieved successfully"
}
```

**Note:** This will be empty initially until payout processing is implemented.

---

## 👨‍💼 Admin Endpoints

### 11. Verify Payout Method

Admin verifies a merchant's payout method.

```http
PATCH /merchants/payout-methods/456e7890-e12b-34d5-a678-426614174111/verify
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "method": {
      "id": "456e7890-e12b-34d5-a678-426614174111",
      "merchant_id": "987e6543-e21b-45d3-a456-426614174999",
      "method_type": "BANK_ACCOUNT",
      "status": "VERIFIED",
      "is_default": true,
      "bank_name": "Dutch Bangla Bank",
      "branch_name": "Dhaka Main Branch",
      "account_holder_name": "John Doe",
      "account_number": "1234567890",
      "routing_number": "090123456",
      "bkash_number": null,
      "bkash_account_holder_name": null,
      "bkash_account_type": null,
      "nagad_number": null,
      "nagad_account_holder_name": null,
      "nagad_account_type": null,
      "verified_at": "2024-12-22T11:15:00.000Z",
      "verified_by": "admin-user-id-123",
      "created_at": "2024-12-22T10:35:00.000Z",
      "updated_at": "2024-12-22T11:15:00.000Z"
    }
  },
  "message": "Payout method verified successfully"
}
```

**Note:** If no default exists for this merchant, the verified method becomes default automatically.

---

## 🚫 Error Responses

### 409 - Duplicate Method
```json
{
  "statusCode": 409,
  "message": "BANK_ACCOUNT payout method already exists",
  "error": "Conflict"
}
```

### 404 - Not Found
```json
{
  "statusCode": 404,
  "message": "Payout method not found",
  "error": "Not Found"
}
```

### 400 - Cannot Set Pending as Default
```json
{
  "statusCode": 400,
  "message": "Only verified methods can be set as default",
  "error": "Bad Request"
}
```

### 400 - Validation Error
```json
{
  "statusCode": 400,
  "message": [
    "Bank name is required for bank account",
    "Account number is required for bank account"
  ],
  "error": "Bad Request"
}
```

### 400 - Invalid Phone Number
```json
{
  "statusCode": 400,
  "message": [
    "Invalid bKash number format"
  ],
  "error": "Bad Request"
}
```

### 401 - Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## 📝 Enums Reference

### PayoutMethodType
- `BANK_ACCOUNT`
- `BKASH`
- `NAGAD`
- `CASH`

### PayoutMethodStatus
- `PENDING` - Awaiting admin verification
- `VERIFIED` - Approved by admin

### BkashAccountType
- `PERSONAL`
- `MERCHANT`
- `AGENT`

### NagadAccountType
- `PERSONAL`
- `MERCHANT`

### PayoutTransactionStatus
- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

---

## 🔍 Quick Test Flow

1. **Login as Merchant** → Get access token
2. **Get Available Methods** → See what can be added
3. **Add Cash Method** → Auto-verified, becomes default
4. **Add Bank Account** → Status: PENDING
5. **Add bKash** → Status: PENDING
6. **Get My Methods** → See all 3 methods
7. **Login as Admin** → Get admin token
8. **Verify Bank Account** → Admin approves
9. **Login as Merchant** → Back to merchant
10. **Set Bank as Default** → Change default method
11. **Get Payout Transactions** → Check transaction history
12. **Delete a Method** → Remove unused method

---

## 💡 Tips

- **Phone numbers** must match Bangladeshi format: `01[3-9]XXXXXXXX`
- **Only ONE** method of each type per merchant
- **Only ONE** default method per merchant
- **Cash** is always auto-verified
- **Admin verification** required for Bank/bKash/Nagad
- **Cannot set pending** methods as default
- Use **query parameters** for pagination: `?page=1&limit=10`


