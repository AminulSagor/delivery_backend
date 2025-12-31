# Hub Transfer Record API Documentation

## 📋 Overview

This system allows Hub Managers to create transaction records when they transfer money to Admin's bank account. Admin can then approve or reject these transfer records.

---

## 🎯 Business Flow

```
1. Hub Manager collects cash from riders (via rider_settlements)
2. Hub Manager transfers money to Admin's bank account
3. Hub Manager creates a transaction record with proof (jpg/png/pdf)
4. Admin reviews the transaction in admin panel
5. Admin approves or rejects the transaction
6. Record is tracked for audit purposes
```

---

## 🗄️ Database Schema

### Table: `hub_transfer_records`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `hub_manager_id` | UUID | Hub manager who created the record |
| `hub_id` | UUID | Hub associated with the transfer |
| `transferred_amount` | DECIMAL(10,2) | Amount transferred to admin |
| `admin_bank_name` | VARCHAR(255) | Admin's bank name |
| `admin_bank_account_number` | VARCHAR(100) | Admin's account number |
| `admin_account_holder_name` | VARCHAR(255) | Admin's account holder name |
| `transaction_reference_id` | VARCHAR(255) | Optional transaction reference |
| `proof_file_url` | VARCHAR(500) | Path to uploaded proof file |
| `proof_file_type` | VARCHAR(10) | File type (jpg, png, pdf) |
| `proof_file_size` | INTEGER | File size in bytes |
| `status` | ENUM | PENDING, APPROVED, REJECTED |
| `reviewed_by` | UUID | Admin who reviewed (nullable) |
| `reviewed_at` | TIMESTAMP | When reviewed (nullable) |
| `admin_notes` | TEXT | Admin's notes (nullable) |
| `rejection_reason` | TEXT | Reason if rejected (nullable) |
| `notes` | TEXT | Hub manager's notes (nullable) |
| `transfer_date` | TIMESTAMP | When transfer was made |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## 🔐 API Endpoints

### Hub Manager Endpoints

#### 1. Create Transfer Record

**POST** `/hubs/transfer-records`

**Authorization:** Hub Manager only

**Content-Type:** `multipart/form-data`

**Request Body:**
```
transferred_amount: 50000.00 (required, number)
admin_bank_name: "Dutch Bangla Bank" (required, string)
admin_bank_account_number: "1234567890" (required, string)
admin_account_holder_name: "Admin Name" (required, string)
transaction_reference_id: "TRX123456" (optional, string)
notes: "Weekly settlement transfer" (optional, string)
proof: file (required, jpg/png/pdf, max 2MB)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "hub_manager_id": "uuid",
      "hub_id": "uuid",
      "transferred_amount": 50000.00,
      "admin_bank_name": "Dutch Bangla Bank",
      "admin_bank_account_number": "1234567890",
      "admin_account_holder_name": "Admin Name",
      "transaction_reference_id": "TRX123456",
      "proof_file_url": "/uploads/transfer-proofs/transfer-1234567890.pdf",
      "proof_file_type": "pdf",
      "proof_file_size": 1024000,
      "status": "PENDING",
      "notes": "Weekly settlement transfer",
      "transfer_date": "2024-12-24T10:00:00.000Z",
      "created_at": "2024-12-24T10:00:00.000Z"
    }
  },
  "message": "Transfer record created successfully"
}
```

---

#### 2. Get My Transfer Records

**GET** `/hubs/transfer-records`

**Authorization:** Hub Manager only

**Query Parameters:**
- `status`: PENDING | APPROVED | REJECTED (optional)
- `fromDate`: ISO date string (optional)
- `toDate`: ISO date string (optional)
- `page`: number (default: 1)
- `limit`: number (default: 10, max: 100)

**Example:**
```
GET /hubs/transfer-records?status=PENDING&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "transferred_amount": 50000.00,
        "admin_bank_name": "Dutch Bangla Bank",
        "admin_bank_account_number": "1234567890",
        "admin_account_holder_name": "Admin Name",
        "transaction_reference_id": "TRX123456",
        "status": "PENDING",
        "proof_file_url": "/uploads/transfer-proofs/transfer-1234567890.pdf",
        "proof_file_type": "pdf",
        "notes": "Weekly settlement transfer",
        "transfer_date": "2024-12-24T10:00:00.000Z",
        "reviewed_at": null,
        "admin_notes": null,
        "hub": {
          "id": "uuid",
          "hub_code": "HUB001",
          "branch_name": "Dhaka Main Hub"
        }
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  },
  "message": "Transfer records retrieved successfully"
}
```

---

#### 3. Get Single Transfer Record

**GET** `/hubs/transfer-records/:id`

**Authorization:** Hub Manager only (own records only)

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "transferred_amount": 50000.00,
      "admin_bank_name": "Dutch Bangla Bank",
      "admin_bank_account_number": "1234567890",
      "admin_account_holder_name": "Admin Name",
      "transaction_reference_id": "TRX123456",
      "status": "PENDING",
      "proof_file_url": "/uploads/transfer-proofs/transfer-1234567890.pdf",
      "notes": "Weekly settlement transfer",
      "transfer_date": "2024-12-24T10:00:00.000Z",
      "hubManager": {
        "id": "uuid",
        "user": {
          "full_name": "Hub Manager Name"
        }
      },
      "hub": {
        "id": "uuid",
        "hub_code": "HUB001",
        "branch_name": "Dhaka Main Hub"
      }
    }
  },
  "message": "Transfer record retrieved successfully"
}
```

---

#### 4. Update Transfer Record (Only PENDING)

**PATCH** `/hubs/transfer-records/:id`

**Authorization:** Hub Manager only (own records only)

**Content-Type:** `multipart/form-data`

**Request Body:** (all optional)
```
transferred_amount: 55000.00
admin_bank_name: "BRAC Bank"
admin_bank_account_number: "9876543210"
transaction_reference_id: "TRX123457"
notes: "Updated notes"
proof: file (replaces existing file)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "transferred_amount": 55000.00,
      "status": "PENDING",
      "updated_at": "2024-12-24T11:00:00.000Z"
    }
  },
  "message": "Transfer record updated successfully"
}
```

**Note:** Only PENDING records can be updated.

---

#### 5. Delete Transfer Record (Only PENDING)

**DELETE** `/hubs/transfer-records/:id`

**Authorization:** Hub Manager only (own records only)

**Response:**
```json
{
  "success": true,
  "message": "Transfer record deleted successfully"
}
```

**Note:** Only PENDING records can be deleted.

---

### Admin Endpoints

#### 6. Get All Hub Transfer Records (Admin Panel)

**GET** `/admin/hub-transfer-records`

**Authorization:** Admin only

**Query Parameters:**
- `status`: PENDING | APPROVED | REJECTED (optional)
- `hubId`: UUID (optional, filter by specific hub)
- `hubManagerId`: UUID (optional, filter by hub manager)
- `fromDate`: ISO date string (optional)
- `toDate`: ISO date string (optional)
- `page`: number (default: 1)
- `limit`: number (default: 10, max: 100)

**Example:**
```
GET /admin/hub-transfer-records?status=PENDING&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid",
        "transferred_amount": 50000.00,
        "admin_bank_name": "Dutch Bangla Bank",
        "admin_bank_account_number": "1234567890",
        "admin_account_holder_name": "Admin Name",
        "transaction_reference_id": "TRX123456",
        "status": "PENDING",
        "proof_file_url": "/uploads/transfer-proofs/transfer-1234567890.pdf",
        "proof_file_type": "pdf",
        "notes": "Weekly settlement transfer",
        "transfer_date": "2024-12-24T10:00:00.000Z",
        "reviewed_at": null,
        "admin_notes": null,
        "hubManager": {
          "id": "uuid",
          "user": {
            "id": "uuid",
            "full_name": "Hub Manager Name",
            "phone": "01712345678"
          }
        },
        "hub": {
          "id": "uuid",
          "hub_code": "HUB001",
          "branch_name": "Dhaka Main Hub",
          "area": "Dhaka"
        }
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  },
  "message": "Hub transfer records retrieved successfully"
}
```

**Admin Panel Display Fields:**
- **Date:** `transfer_date`
- **Hub:** `hub.branch_name` (hub.hub_code)
- **Manager:** `hubManager.user.full_name`
- **Account Name:** `admin_account_holder_name`
- **Amount:** `transferred_amount`
- **Proof:** `proof_file_url` (download link)
- **Status:** `status` (badge: pending/approved/rejected)
- **Actions:** Approve/Reject buttons (if PENDING)

---

#### 7. Approve Transfer Record

**PATCH** `/admin/hub-transfer-records/:id/approve`

**Authorization:** Admin only

**Request Body:**
```json
{
  "admin_notes": "Verified and approved"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "status": "APPROVED",
      "reviewed_by": "admin-user-id",
      "reviewed_at": "2024-12-24T11:00:00.000Z",
      "admin_notes": "Verified and approved"
    }
  },
  "message": "Transfer record approved successfully"
}
```

**Note:** Only PENDING records can be approved.

---

#### 8. Reject Transfer Record

**PATCH** `/admin/hub-transfer-records/:id/reject`

**Authorization:** Admin only

**Request Body:**
```json
{
  "rejection_reason": "Invalid transaction reference",
  "admin_notes": "Please resubmit with correct reference"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "status": "REJECTED",
      "reviewed_by": "admin-user-id",
      "reviewed_at": "2024-12-24T11:00:00.000Z",
      "rejection_reason": "Invalid transaction reference",
      "admin_notes": "Please resubmit with correct reference"
    }
  },
  "message": "Transfer record rejected successfully"
}
```

**Note:** Only PENDING records can be rejected.

---

## 🚫 Error Responses

### 400 - Bad Request

**Missing proof file:**
```json
{
  "statusCode": 400,
  "message": "Proof file is required",
  "error": "Bad Request"
}
```

**Invalid file type:**
```json
{
  "statusCode": 400,
  "message": "Only JPG, PNG, and PDF files are allowed",
  "error": "Bad Request"
}
```

**Cannot update non-pending record:**
```json
{
  "statusCode": 400,
  "message": "Only pending transfer records can be updated",
  "error": "Bad Request"
}
```

**Cannot approve/reject non-pending record:**
```json
{
  "statusCode": 400,
  "message": "Only pending records can be approved",
  "error": "Bad Request"
}
```

---

### 404 - Not Found

```json
{
  "statusCode": 404,
  "message": "Transfer record not found",
  "error": "Not Found"
}
```

---

### 401 - Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## 📝 Enums Reference

### TransferRecordStatus
- `PENDING` - Awaiting admin review
- `APPROVED` - Approved by admin
- `REJECTED` - Rejected by admin

---

## 🔍 File Upload Specifications

### Allowed File Types
- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `application/pdf` (.pdf)

### File Size Limit
- Maximum: 2MB (2,097,152 bytes)

### Storage Location
- Files are stored in: `uploads/transfer-proofs/`
- Filename format: `transfer-{timestamp}-{random}.{ext}`
- Example: `transfer-1735027200000-123456789.pdf`

---

## 🎯 Testing Guide

### 1. Hub Manager Flow

```bash
# Login as Hub Manager
POST /auth/login
{
  "phone": "01712345678",
  "password": "hubmanager123"
}

# Create transfer record
POST /hubs/transfer-records
Content-Type: multipart/form-data
Authorization: Bearer {hub_manager_token}

transferred_amount: 50000
admin_bank_name: Dutch Bangla Bank
admin_bank_account_number: 1234567890
admin_account_holder_name: Admin Name
transaction_reference_id: TRX123456
notes: Weekly settlement
proof: [upload file]

# Get my transfer records
GET /hubs/transfer-records?status=PENDING
Authorization: Bearer {hub_manager_token}

# Update transfer record (if PENDING)
PATCH /hubs/transfer-records/{id}
Authorization: Bearer {hub_manager_token}
[update fields]

# Delete transfer record (if PENDING)
DELETE /hubs/transfer-records/{id}
Authorization: Bearer {hub_manager_token}
```

---

### 2. Admin Flow

```bash
# Login as Admin
POST /auth/login
{
  "phone": "01600000000",
  "password": "admin123"
}

# Get all transfer records
GET /admin/hub-transfer-records?status=PENDING&page=1&limit=20
Authorization: Bearer {admin_token}

# Approve transfer record
PATCH /admin/hub-transfer-records/{id}/approve
Authorization: Bearer {admin_token}
{
  "admin_notes": "Verified and approved"
}

# Reject transfer record
PATCH /admin/hub-transfer-records/{id}/reject
Authorization: Bearer {admin_token}
{
  "rejection_reason": "Invalid reference",
  "admin_notes": "Please resubmit"
}
```

---

## 💡 Business Rules

1. **Hub Manager Can:**
   - Create transfer records with proof
   - View only their own transfer records
   - Update/delete only PENDING records
   - Cannot approve/reject their own records

2. **Admin Can:**
   - View all transfer records from all hubs
   - Filter by hub, manager, status, date range
   - Approve/reject PENDING records
   - Cannot modify APPROVED/REJECTED records

3. **Status Flow:**
   - PENDING → APPROVED (one-way, irreversible)
   - PENDING → REJECTED (one-way, irreversible)
   - Once reviewed, record becomes immutable

4. **File Requirements:**
   - Proof file is mandatory
   - Must be jpg/png/pdf
   - Maximum 2MB size
   - Stored securely on server

---

## 🔗 Related Features

This feature connects with:
- **Rider Settlements:** Hub managers collect cash from riders, then transfer to admin
- **Hub Management:** Each transfer is associated with a specific hub
- **User Management:** Hub managers and admins are users with specific roles

---

## 📊 Admin Panel UI Specification

### Table Columns
1. **Date** - transfer_date (formatted)
2. **Hub** - hub.branch_name (hub.hub_code)
3. **Manager** - hubManager.user.full_name
4. **Account Name** - admin_account_holder_name
5. **Amount** - transferred_amount (formatted with currency)
6. **Proof** - Download link to proof_file_url
7. **Status** - Badge (green: APPROVED, yellow: PENDING, red: REJECTED)
8. **Actions** - Approve/Reject buttons (only for PENDING)

### Filters
- Status dropdown (All, Pending, Approved, Rejected)
- Hub dropdown (All hubs)
- Date range picker (From - To)
- Search by manager name

### Pagination
- 10, 20, 50, 100 records per page
- Page navigation (Previous, 1, 2, 3, Next)
- Total records count

---

## ✅ Implementation Complete

All files created and migration executed successfully! 🚀

**Created Files:**
- ✅ Enum: `transfer-record-status.enum.ts`
- ✅ Entity: `hub-transfer-record.entity.ts`
- ✅ DTOs: `create-transfer-record.dto.ts`, `update-transfer-record.dto.ts`, `transfer-record-query.dto.ts`, `review-transfer-record.dto.ts`
- ✅ Migration: `1735000000000-CreateHubTransferRecordsTable.ts`
- ✅ Service methods in `hubs.service.ts` and `admin.service.ts`
- ✅ Controller endpoints in `hubs.controller.ts` and `admin.controller.ts`
- ✅ Module updates in `hubs.module.ts` and `admin.module.ts`
- ✅ Upload directory: `uploads/transfer-proofs/`

**Database:**
- ✅ Table `hub_transfer_records` created
- ✅ Indexes created for performance
- ✅ Foreign keys configured

**Ready to use!** 🎉

