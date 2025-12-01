# 📦 Courier Delivery Backend API

> **Day One Tasks - ✅ COMPLETED**
> 
> A production-ready NestJS backend for a courier delivery system with full authentication, merchant approval workflow, and dual notification system (Email + SMS).

---

## 📊 Project Overview

### 🎯 What Has Been Built

This is a complete **courier/logistics backend** built with **NestJS + TypeScript + PostgreSQL** that provides:

- ✅ **Multi-role Authentication System** (Admin, Merchant, Hub Manager, Rider)
- ✅ **JWT-based Authorization** with refresh token rotation
- ✅ **Merchant Approval Workflow** with status tracking
- ✅ **Dual Notification System** (Email via Zoho Mail + SMS via SMS.net.bd)
- ✅ **Role-Based Access Control (RBAC)** with guards and decorators
- ✅ **Admin Management Panel** (CRUD operations for users)
- ✅ **Email/SMS Testing Endpoints** for admins
- ✅ **Comprehensive Database Schema** (5 normalized tables)
- ✅ **TypeORM Migrations** with seeding support

### 🏗️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | 11.0.1 | TypeScript framework with dependency injection |
| **TypeORM** | 0.3.27 | ORM for PostgreSQL with migrations |
| **PostgreSQL** | Latest | Relational database |
| **JWT** | 9.0.2 | Authentication tokens (15m access, 7d refresh) |
| **Bcrypt** | 6.0.0 | Password hashing (10 salt rounds) |
| **Nodemailer** | 7.0.10 | Email via Zoho Mail SMTP |
| **SMS.net.bd API** | - | SMS notifications for Bangladesh |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ installed and running
- Zoho Mail account (for email notifications)
- SMS.net.bd account (for SMS notifications)

### Installation

```powershell
# 1. Clone and navigate
cd delivery_backend

# 2. Install dependencies
npm install

# 3. Create database
createdb postgres

# 4. Copy environment file
Copy-Item .env.example .env

# 5. Edit .env with your credentials
notepad .env
```

### Configuration

Edit `.env` with your settings:

```bash
# Database
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=postgres

# JWT
JWT_SECRET=your_jwt_secret_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Environment
NODE_ENV=development

# Email (Zoho Mail)
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=demomail.com
SMTP_PASSWORD=your-app-specific-password
EMAIL_FROM=demomail@gmail.com
EMAIL_FROM_NAME=Courier Delivery Service


SMS_API_KEY=
SMS_API_URL=
SMS_SENDER_ID=
SMS_CONTENT_ID=
```

### Run Migrations & Seed

```powershell
# Run database migrations
npm run typeorm:migrate

# Seed admin user
npm run seed
```

**Default Admin Credentials:**
- **Email**: `admin@courier.com`
- **Phone**: `+8801700000000`
- **Password**: `admin123`

### Start Server

```powershell
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

Server runs at: **http://localhost:3000**

---

## 📐 Database Schema

### Entity Relationship Diagram

```
┌─────────────┐
│    USERS    │◄─────────┐
│  (Central)  │          │
└──────┬──────┘          │
       │                 │
       │ 1:1             │ 1:1
       │                 │
┌──────▼──────┐    ┌─────┴──────┐
│  MERCHANTS  │    │    HUBS    │
│  (Business) │    │ (Branches) │
└─────────────┘    └─────┬──────┘
                         │
                         │ 1:N
                         │
                   ┌─────▼────────┐
                   │ HUB_MANAGERS │
                   │   & RIDERS   │
                   └──────────────┘
```

### Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| **users** | Central auth for all roles | - |
| **merchants** | Merchant profiles | → users.id |
| **hubs** | Delivery hub locations | → users.id (manager) |
| **hub_managers** | Hub manager assignments | → users.id, → hubs.id |
| **riders** | Rider profiles | → users.id, → hubs.id |

**Detailed Schema**: See [DATABASE_DESIGN_DIAGRAM.md](./DATABASE_DESIGN_DIAGRAM.md)

---

## 🔐 Authentication Flow

### How JWT Works

```
1. Login → Receive access_token (15m) + refresh_token (7d)
2. Use access_token in Authorization header
3. When access_token expires → Use refresh endpoint
4. Get new access_token + refresh_token
5. Logout → Invalidate refresh_token
```

### Token Storage

- **Access Token**: Client stores in memory (short-lived)
- **Refresh Token**: Stored in database `users.refresh_token` (long-lived)

### Role-Based Access

| Role | Access Level | Can Access |
|------|--------------|------------|
| **ADMIN** | Full system access | All endpoints, user management, approvals |
| **MERCHANT** | Business operations | Own profile, order creation (future) |
| **HUB_MANAGER** | Hub management | Hub operations, rider assignments (future) |
| **RIDER** | Delivery operations | Order pickup/delivery (future) |

---

## 📡 API Documentation

Base URL: `http://localhost:3000`

### 🔑 Authentication Endpoints

#### 1. Login (All Roles)

```http
POST /auth/login
```

**Description**: Authenticate user with phone/email and password. Returns JWT tokens.

**Request Body**:
```json
{
  "identifier": "admin@courier.com",
  "password": "admin123"
}
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-admin-001",
      "full_name": "Admin User",
      "phone": "+8801700000000",
      "email": "admin@courier.com",
      "role": "ADMIN",
      "is_active": true
    }
  }
}
```

**Error Response (401 Unauthorized)**:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**Notes**:
- `identifier` can be either phone or email
- Password must match bcrypt hash
- Merchant with status `PENDING` cannot login

---

#### 2. Refresh Token

```http
POST /auth/refresh
```

**Description**: Get new access token using refresh token.

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (401 Unauthorized)**:
```json
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "error": "Unauthorized"
}
```

**Notes**:
- Old refresh token is invalidated
- New refresh token replaces old one in database

---

#### 3. Logout

```http
POST /auth/logout
```

**Description**: Invalidate refresh token and log out user.

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "message": "Logout successful"
}
```

**Notes**:
- Removes refresh token from database
- Client should delete access token

---

### 👥 Merchant Endpoints

#### 4. Merchant Signup (Public)

```http
POST /merchants/signup
```

**Description**: Register new merchant account. Status starts as `PENDING` and requires admin approval.

**Request Body**:
```json
{
  "fullName": "ABC Electronics Store",
  "phone": "+8801711222333",
  "email": "abc@electronics.com",
  "password": "Merchant123!",
  "thana": "Gulshan",
  "district": "Dhaka",
  "fullAddress": "House 15, Road 5, Gulshan-2, Dhaka",
  "secondaryNumber": "+8801811222333"
}
```

**Success Response (201 Created)**:
```json
{
  "id": "uuid-merchant-123",
  "status": "PENDING",
  "message": "Signup successful. Please wait for admin approval."
}
```

**Error Response (400 Bad Request)**:
```json
{
  "statusCode": 400,
  "message": "Phone number already exists",
  "error": "Bad Request"
}
```

**Notes**:
- Phone must be unique
- Email is optional but must be unique if provided
- Password is hashed with bcrypt
- Merchant cannot login until status is `APPROVED`

---

#### 5. Get All Merchants (Admin Only)

```http
GET /merchants?status=PENDING&district=Dhaka&page=1&limit=10
```

**Description**: List all merchants with optional filters.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | enum | No | Filter by status (PENDING, APPROVED, REJECTED) |
| district | string | No | Filter by district name |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 10) |

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "merchants": [
      {
        "id": "uuid-merchant-123",
        "user": {
          "full_name": "ABC Electronics Store",
          "phone": "+8801711222333",
          "email": "abc@electronics.com"
        },
        "thana": "Gulshan",
        "district": "Dhaka",
        "full_address": "House 15, Road 5, Gulshan-2, Dhaka",
        "status": "PENDING",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Notes**:
- Requires ADMIN role
- Returns all merchant details including user info

---

#### 6. Get Merchant By ID (Admin Only)

```http
GET /merchants/:id
```

**Description**: Get detailed information about a specific merchant.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid-merchant-123",
    "user": {
      "id": "uuid-user-456",
      "full_name": "ABC Electronics Store",
      "phone": "+8801711222333",
      "email": "abc@electronics.com",
      "role": "MERCHANT",
      "is_active": false
    },
    "thana": "Gulshan",
    "district": "Dhaka",
    "full_address": "House 15, Road 5, Gulshan-2, Dhaka",
    "secondary_number": "+8801811222333",
    "status": "PENDING",
    "approved_at": null,
    "approved_by": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (404 Not Found)**:
```json
{
  "statusCode": 404,
  "message": "Merchant not found",
  "error": "Not Found"
}
```

---

#### 7. Update Merchant (Admin or Own Merchant)

```http
PATCH /merchants/:id
```

**Description**: Update merchant details.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body** (all fields optional):
```json
{
  "fullName": "ABC Electronics - Updated",
  "thana": "Banani",
  "district": "Dhaka",
  "fullAddress": "New Address",
  "secondaryNumber": "+8801999888777"
}
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "message": "Merchant updated successfully",
  "data": {
    "id": "uuid-merchant-123",
    "user": {
      "full_name": "ABC Electronics - Updated"
    },
    "thana": "Banani",
    "status": "PENDING"
  }
}
```

**Notes**:
- ADMIN can update any merchant
- MERCHANT can only update their own profile

---

#### 8. Approve Merchant (Admin Only) ⭐ **Triggers Email + SMS**

```http
PATCH /merchants/:id/approve
```

**Description**: Approve pending merchant and activate their account. **Automatically sends approval email and SMS notification.**

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{}
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "message": "Merchant approved successfully. Email and SMS sent.",
  "data": {
    "id": "uuid-merchant-123",
    "status": "APPROVED",
    "approved_at": "2024-01-15T11:00:00Z",
    "approved_by": "uuid-admin-001",
    "user": {
      "is_active": true
    },
    "notifications": {
      "email": {
        "sent": true,
        "to": "abc@electronics.com"
      },
      "sms": {
        "sent": true,
        "to": "+8801711222333",
        "requestId": 123456
      }
    }
  }
}
```

**What Happens**:
1. ✅ Merchant status → `APPROVED`
2. ✅ User `is_active` → `true`
3. ✅ Merchant can now login
4. ✅ **Email sent** with professional HTML template
5. ✅ **SMS sent** to merchant's phone
6. ✅ `approved_at` timestamp set
7. ✅ `approved_by` set to admin's user ID

**Email Template Preview**:
```
Subject: 🎉 Your Merchant Account Has Been Approved!

Dear ABC Electronics Store,

Great news! Your merchant account has been approved by our admin team.

✅ Account Status: APPROVED
📧 Login Email: abc@electronics.com
📱 Login Phone: +8801711222333

You can now login and start using our courier services.

Best regards,
Courier Delivery Service
```

**SMS Template**:
```
Congratulations! Your merchant account at Courier Delivery Service has been approved. You can now login and start using our services. Welcome aboard!
```

**Notes**:
- Requires ADMIN role
- Can only approve merchants with status `PENDING`
- Email/SMS failures don't block approval process
- Notifications work in STUB mode when credentials not configured

---

### 🛡️ Admin Management Endpoints

#### 9. Create Admin User (Admin Only)

```http
POST /admin
```

**Description**: Create a new admin user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "fullName": "New Admin",
  "phone": "+8801799999999",
  "email": "newadmin@courier.com",
  "password": "AdminPass123!"
}
```

**Success Response (201 Created)**:
```json
{
  "id": "uuid-admin-new",
  "full_name": "New Admin",
  "phone": "+8801799999999",
  "email": "newadmin@courier.com",
  "role": "ADMIN",
  "is_active": true,
  "created_at": "2024-01-15T12:00:00Z",
  "message": "Admin user created successfully"
}
```

**Notes**:
- Only existing admins can create new admins
- Password is automatically hashed
- Sensitive fields (password_hash, refresh_token) excluded from response

---

#### 10. Get All Users (Admin Only)

```http
GET /admin
```

**Description**: List all users in the system.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "uuid-admin-001",
      "full_name": "Admin User",
      "phone": "+8801700000000",
      "email": "admin@courier.com",
      "role": "ADMIN",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    },
    {
      "id": "uuid-merchant-456",
      "full_name": "ABC Electronics",
      "phone": "+8801711222333",
      "email": "abc@electronics.com",
      "role": "MERCHANT",
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

#### 11. Get User By ID (Admin Only)

```http
GET /admin/:id
```

**Description**: Get detailed information about a specific user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "id": "uuid-admin-001",
    "full_name": "Admin User",
    "phone": "+8801700000000",
    "email": "admin@courier.com",
    "role": "ADMIN",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 12. Update User (Admin Only)

```http
PATCH /admin/:id
```

**Description**: Update user details.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body** (all fields optional):
```json
{
  "fullName": "Updated Name",
  "phone": "+8801788888888",
  "email": "updated@courier.com",
  "password": "NewPassword123!"
}
```

**Success Response (200 OK)**:
```json
{
  "id": "uuid-admin-001",
  "full_name": "Updated Name",
  "phone": "+8801788888888",
  "email": "updated@courier.com",
  "role": "ADMIN",
  "is_active": true
}
```

---

#### 13. Delete User (Admin Only)

```http
DELETE /admin/:id
```

**Description**: Permanently delete a user.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "deleted": true,
  "message": "Admin user deleted successfully"
}
```

**Notes**:
- Deleting a user also deletes associated merchant/hub_manager/rider records (CASCADE)

---

#### 14. Deactivate User (Admin Only)

```http
PATCH /admin/:id/deactivate
```

**Description**: Deactivate user account (sets `is_active` to `false`).

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "id": "uuid-user-123",
  "full_name": "User Name",
  "is_active": false,
  "message": "Admin user deactivated successfully"
}
```

**Notes**:
- Deactivated users cannot login
- Account still exists in database

---

#### 15. Activate User (Admin Only)

```http
PATCH /admin/:id/activate
```

**Description**: Reactivate user account (sets `is_active` to `true`).

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "id": "uuid-user-123",
  "full_name": "User Name",
  "is_active": true,
  "message": "Admin user activated successfully"
}
```

---

### 📧 Email Testing Endpoints (Admin Only)

#### 16. Verify Email Configuration

```http
POST /admin/email/verify
```

**Description**: Test SMTP connection to verify email configuration.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Email server connection verified successfully"
}
```

**STUB Mode Response**:
```json
{
  "success": false,
  "message": "Email service not configured (STUB mode active)"
}
```

**Notes**:
- Checks SMTP connection without sending email
- Useful for validating `.env` email settings

---

#### 17. Send Test Email

```http
POST /admin/email/test
```

**Description**: Send a test email to verify full email flow.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "email": "your-test-email@gmail.com"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Test email sent to your-test-email@gmail.com"
}
```

**STUB Mode Response**:
```json
{
  "success": false,
  "message": "Email service in STUB mode. Email would be sent to: your-test-email@gmail.com"
}
```

---

### 📱 SMS Testing Endpoints (Admin Only)

#### 18. Check SMS Balance

```http
POST /admin/sms/balance
```

**Description**: Check SMS balance from SMS.net.bd account.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "balance": 150.75,
  "message": "SMS balance retrieved successfully"
}
```

**STUB Mode Response**:
```json
{
  "success": false,
  "message": "SMS service in STUB mode. Balance check not available."
}
```

---

#### 19. Send Test SMS

```http
POST /admin/sms/test
```

**Description**: Send a test SMS to verify SMS integration.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "phone": "+8801711222333"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "message": "Test SMS sent to 8801711222333",
  "requestId": 123456,
  "cost": 0.25
}
```

**STUB Mode Response**:
```json
{
  "success": false,
  "message": "SMS service in STUB mode. SMS would be sent to: 8801711222333"
}
```

**Notes**:
- Phone number automatically formatted to 880XXXXXXXXXX
- Supports formats: +880, 880, 01X

---

#### 20. Get SMS Report

```http
POST /admin/sms/report
```

**Description**: Get delivery report for a specific SMS using request ID.

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "requestId": 123456
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "status": "DELIVERED",
  "submittedAt": "2024-01-15T11:00:00Z",
  "deliveredAt": "2024-01-15T11:00:15Z",
  "recipient": "8801711222333",
  "message": "SMS delivered successfully"
}
```

**Notes**:
- Use `requestId` from Send Test SMS response
- Status can be: PENDING, DELIVERED, FAILED

---

## 🧪 Testing with Postman

### Import Collection

1. Open Postman
2. Click **Import** → **Upload Files**
3. Select `Courier-API.postman_collection.json`
4. Collection will appear in sidebar

### Auto-Save Variables

The collection automatically saves:
- ✅ `accessToken` after login
- ✅ `refreshToken` after login
- ✅ `merchantId` after merchant signup

These are used in subsequent requests (e.g., `{{accessToken}}` in headers).

### Complete Testing Flow

**Step 1: Admin Login**
```
POST /auth/login
Body: { "identifier": "admin@courier.com", "password": "admin123" }
→ Tokens auto-saved
```

**Step 2: Create Merchant**
```
POST /merchants/signup
Body: { "fullName": "Test Store", "phone": "+8801711222333", ... }
→ merchantId auto-saved
```

**Step 3: Approve Merchant (Triggers Email + SMS)**
```
PATCH /merchants/{{merchantId}}/approve
→ Email sent, SMS sent
```

**Step 4: Merchant Login**
```
POST /auth/login
Body: { "identifier": "+8801711222333", "password": "..." }
→ Success! Merchant can now login
```

**Detailed Guide**: See [POSTMAN_QUICKSTART.md](./POSTMAN_QUICKSTART.md)

---

## 📧 Email Integration

### Setup (Zoho Mail)

1. **Create App-Specific Password**:
   - Go to Zoho Mail Settings → Security → App Passwords
   - Generate password for "Email Client"

2. **Configure .env**:
```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=app-specific-password-here
EMAIL_FROM=your-email@yourdomain.com
EMAIL_FROM_NAME=Courier Delivery Service
```

3. **Verify Connection**:
```
POST /admin/email/verify
→ Should return: "Email server connection verified successfully"
```

### STUB Mode (Development)

If email credentials are **not configured**, the service runs in **STUB mode**:

- ✅ Server starts normally
- ✅ Email methods execute without errors
- ✅ Logs show: `📧 [STUB] Email would be sent to: user@example.com`
- ❌ No actual emails sent

### Email Templates

**Merchant Approval Email**:
- Professional HTML design
- Green approval badge
- Login credentials included
- Company branding

**Template Features**:
- Responsive design
- Dark/Light mode compatible
- Professional styling
- Clear call-to-action

**Testing**: See [ZOHO_EMAIL_TESTING.md](./ZOHO_EMAIL_TESTING.md)

---

## 📱 SMS Integration

### Setup (SMS.net.bd)

1. **Get API Credentials**:
   - Sign up at [SMS.net.bd](https://sms.net.bd)
   - Get API Key from dashboard

2. **Configure .env**:
```bash
SMS_API_KEY=your-api-key-here
SMS_API_URL=https://api.sms.net.bd/sendsms
SMS_SENDER_ID=8809601010456
SMS_CONTENT_ID=
```

3. **Check Balance**:
```
POST /admin/sms/balance
→ Should return current balance
```

### STUB Mode (Development)

If SMS credentials are **not configured**, the service runs in **STUB mode**:

- ✅ Server starts normally
- ✅ SMS methods execute without errors
- ✅ Logs show: `📱 [STUB] SMS would be sent to: 8801711222333`
- ❌ No actual SMS sent

### Phone Number Formatting

The service automatically formats phone numbers:

| Input | Formatted Output |
|-------|------------------|
| `+8801711222333` | `8801711222333` |
| `8801711222333` | `8801711222333` |
| `01711222333` | `8801711222333` |

### SMS Templates

**Merchant Approval SMS**:
```
Congratulations! Your merchant account at Courier Delivery Service 
has been approved. You can now login and start using our services. 
Welcome aboard!
```

**Testing**: See [SMS_TESTING_GUIDE.md](./SMS_TESTING_GUIDE.md)

---

## 🔒 Security Features

### Password Security
- ✅ Bcrypt hashing (10 salt rounds)
- ✅ Never stored in plaintext
- ✅ Never returned in API responses

### JWT Security
- ✅ Short-lived access tokens (15 minutes)
- ✅ Refresh token rotation
- ✅ Tokens invalidated on logout
- ✅ Secret key stored in environment

### Authorization Guards

**JwtAuthGuard**:
- Verifies JWT signature
- Checks token expiration
- Extracts user data

**RolesGuard**:
- Checks user role against required roles
- Works with `@Roles()` decorator

**Usage Example**:
```typescript
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('sensitive-data')
async getSensitiveData() {
  // Only admins can access
}
```

### Decorators

**@Public()**:
- Bypass JWT authentication
- Used for login, signup, refresh

**@CurrentUser()**:
- Extract current user from request
- Access user ID, role, etc.

**@Roles(...roles)**:
- Specify required roles
- Works with RolesGuard

---

## 🎨 Code Architecture

### Module Structure

```
src/
├── auth/              # Authentication logic
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── dto/
│       ├── auth-login.dto.ts
│       ├── auth-refresh.dto.ts
│       └── auth-logout.dto.ts
│
├── merchant/          # Merchant business logic
│   ├── merchant.controller.ts
│   ├── merchant.service.ts
│   ├── merchant.module.ts
│   ├── entities/
│   │   └── merchant.entity.ts
│   └── dto/
│       ├── create-merchant.dto.ts
│       └── update-merchant.dto.ts
│
├── admin/             # Admin user management
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   ├── admin-email-test.controller.ts
│   ├── admin-sms-test.controller.ts
│   └── ...
│
├── users/             # User CRUD operations
│   ├── users.service.ts
│   ├── users.module.ts
│   └── entities/
│       └── user.entity.ts
│
├── common/            # Shared utilities
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   └── enums/
│       ├── user-role.enum.ts
│       └── merchant-status.enum.ts
│
├── utils/             # External services
│   ├── email.service.ts
│   └── sms.service.ts
│
├── migrations/        # Database migrations
│   └── 1699999999999-InitialSchema.ts
│
└── database/          # Seed scripts
    └── seed.ts
```

### Design Patterns

**Dependency Injection**:
- Services injected via constructor
- Managed by NestJS IoC container

**Repository Pattern**:
- TypeORM repositories for database access
- Abstraction over raw SQL

**DTO Pattern**:
- Data Transfer Objects for request validation
- Clear API contracts

**Guard Pattern**:
- Authorization logic separated from business logic
- Reusable across controllers

---

## 🧩 Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PG_HOST` | ✅ | PostgreSQL host | `localhost` |
| `PG_PORT` | ✅ | PostgreSQL port | `5432` |
| `PG_USER` | ✅ | Database user | `postgres` |
| `PG_PASSWORD` | ✅ | Database password | `postgres` |
| `PG_DB` | ✅ | Database name | `postgres` |
| `JWT_SECRET` | ✅ | JWT signing key | `random_secret_key` |
| `JWT_EXPIRES_IN` | ✅ | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token lifetime | `7d` |
| `BCRYPT_SALT_ROUNDS` | ✅ | Bcrypt salt rounds | `10` |
| `NODE_ENV` | ✅ | Environment | `development` |
| `SMTP_HOST` | ❌ | Email server host | `smtp.zoho.com` |
| `SMTP_PORT` | ❌ | Email server port | `465` |
| `SMTP_SECURE` | ❌ | Use SSL/TLS | `true` |
| `SMTP_USER` | ❌ | Email account | `user@domain.com` |
| `SMTP_PASSWORD` | ❌ | Email password | `app-password` |
| `EMAIL_FROM` | ❌ | Sender email | `noreply@domain.com` |
| `EMAIL_FROM_NAME` | ❌ | Sender name | `Courier Service` |
| `SMS_API_KEY` | ❌ | SMS.net.bd API key | `api-key-here` |
| `SMS_API_URL` | ❌ | SMS API endpoint | `https://api.sms.net.bd/sendsms` |
| `SMS_SENDER_ID` | ❌ | SMS sender ID | `8809601010456` |

**Note**: ❌ = Optional (works in STUB mode without them)

---

## 📜 Available Scripts

```powershell
# Development
npm run start:dev        # Start with hot reload

# Production
npm run build            # Compile TypeScript
npm run start:prod       # Run production build

# Database
npm run typeorm:migrate  # Run migrations
npm run typeorm:revert   # Revert last migration
npm run seed             # Seed admin user

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run test:cov         # Generate coverage report

# Linting
npm run lint             # Run ESLint
npm run format           # Run Prettier
```

---

## 🎯 Day One Completion Summary

### ✅ Fully Implemented Features

#### 1. Authentication System
- ✅ JWT-based login with phone or email
- ✅ Refresh token rotation mechanism
- ✅ Logout with token invalidation
- ✅ Bcrypt password hashing
- ✅ Token storage in database

#### 2. Merchant Module
- ✅ Public signup endpoint
- ✅ Approval workflow (PENDING → APPROVED)
- ✅ Status-based login restriction
- ✅ Admin approval endpoint
- ✅ List merchants with filters (status, district, pagination)
- ✅ CRUD operations

#### 3. Admin Module
- ✅ User management (CRUD)
- ✅ Activate/Deactivate users
- ✅ Email testing endpoints (verify, send test)
- ✅ SMS testing endpoints (balance, send test, report)

#### 4. Email Notifications
- ✅ Zoho Mail SMTP integration
- ✅ Professional HTML email templates
- ✅ Merchant approval email automation
- ✅ STUB mode for development
- ✅ Connection verification
- ✅ Test email endpoint

#### 5. SMS Notifications
- ✅ SMS.net.bd API integration
- ✅ Merchant approval SMS automation
- ✅ Phone number formatting (880/01X support)
- ✅ STUB mode for development
- ✅ Balance checking
- ✅ SMS delivery reports
- ✅ Test SMS endpoint

#### 6. Authorization
- ✅ JwtAuthGuard (token verification)
- ✅ RolesGuard (role-based access)
- ✅ @Public() decorator
- ✅ @Roles() decorator
- ✅ @CurrentUser() decorator

#### 7. Database
- ✅ 5 normalized tables (users, merchants, hubs, hub_managers, riders)
- ✅ TypeORM migrations
- ✅ Foreign key relationships
- ✅ Indexes on phone/email
- ✅ Admin seeder script

#### 8. Documentation
- ✅ Comprehensive README (this file)
- ✅ Database design diagram
- ✅ Postman collection
- ✅ Email testing guide
- ✅ SMS testing guide
- ✅ Implementation status tracker

---

## 🚧 Future Enhancements (Not Day One)

### Hubs Module (40% Complete)
- ⚠️ Entities and DTOs exist
- ❌ Controller implementation needed
- ❌ Service implementation needed

**Planned Endpoints**:
- `POST /hubs` - Create hub
- `GET /hubs` - List hubs
- `GET /hubs/:id` - Get hub details
- `PATCH /hubs/:id` - Update hub
- `POST /hubs/:id/manager` - Assign manager

### Riders Module (40% Complete)
- ⚠️ Entities and DTOs exist
- ❌ Controller implementation needed
- ❌ Service implementation needed

**Planned Endpoints**:
- `POST /riders` - Create rider
- `GET /riders` - List riders
- `GET /riders/:id` - Get rider details
- `PATCH /riders/:id` - Update rider
- `PATCH /riders/:id/assign-hub` - Assign to hub

### Orders Module (Not Started)
- ❌ Order creation
- ❌ Parcel tracking
- ❌ Status updates
- ❌ Delivery assignments

### Payments Module (Not Started)
- ❌ Payment processing
- ❌ Transaction history
- ❌ Merchant payouts

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem**: `ECONNREFUSED` error

**Solution**:
```powershell
# Check if PostgreSQL is running
Get-Service postgresql*

# Start PostgreSQL service
Start-Service postgresql-x64-14
```

### Email Not Sending

**Problem**: Emails not delivered

**Solutions**:
1. Verify SMTP credentials in `.env`
2. Check Zoho Mail app-specific password
3. Run verification endpoint: `POST /admin/email/verify`
4. Check logs for error messages

### SMS Not Sending

**Problem**: SMS not delivered

**Solutions**:
1. Verify `SMS_API_KEY` in `.env`
2. Check SMS balance: `POST /admin/sms/balance`
3. Verify phone number format (880XXXXXXXXXX)
4. Check SMS.net.bd dashboard for delivery status

### JWT Token Expired

**Problem**: `401 Unauthorized` after some time

**Solution**:
```
POST /auth/refresh
Body: { "refreshToken": "your-refresh-token" }
→ Get new access token
```

### Migration Errors

**Problem**: Migration fails

**Solution**:
```powershell
# Revert last migration
npm run typeorm:revert

# Run migrations again
npm run typeorm:migrate
```

