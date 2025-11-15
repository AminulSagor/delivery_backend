# 📊 Database Design Flow Diagram

## 🗄️ **DATABASE SCHEMA OVERVIEW**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          COURIER DATABASE SCHEMA                         │
│                           (courier_db)                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                            CORE TABLES                                   │
│                                                                          │
│  1. users          - All system users (ADMIN, HUB_MANAGER, RIDER,        │
│                      MERCHANT)                                           │
│  2. merchants      - Merchant-specific data (linked to users)            │
│  3. hubs           - Delivery hub locations                              │
│  4. hub_managers   - Hub manager assignments (linked to users + hubs)    │
│  5. riders         - Rider profiles (linked to users + hubs)             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 **TABLE 1: USERS (Central Authentication Table)**

```
┌───────────────────────────────────────────────────────────────┐
│                        USERS TABLE                            │
│  Purpose: Store ALL users regardless of role                  │
│  Used for: Authentication, Login, JWT tokens                  │
├───────────────────────────────────────────────────────────────┤
│  Column          │ Type          │ Description                │
├──────────────────┼───────────────┼────────────────────────────┤
│  id              │ UUID (PK)     │ Unique user ID             │
│  full_name       │ VARCHAR(255)  │ User's full name           │
│  phone           │ VARCHAR(50)   │ Phone (UNIQUE) - for login │
│  email           │ VARCHAR(255)  │ Email (UNIQUE, NULLABLE)   │
│  password_hash   │ VARCHAR(255)  │ Bcrypt hashed password     │
│  role            │ ENUM          │ ADMIN, HUB_MANAGER,        │
│                  │               │ RIDER, MERCHANT            │
│  is_active       │ BOOLEAN       │ Can user login?            │
│  refresh_token   │ TEXT          │ JWT refresh token storage  │
│  created_at      │ TIMESTAMP     │ When user was created      │
│  updated_at      │ TIMESTAMP     │ Last update time           │
└──────────────────┴───────────────┴────────────────────────────┘

INDEXES:
  - PRIMARY KEY: id
  - UNIQUE INDEX: phone
  - UNIQUE INDEX: email
```

**Example Data:**
```sql
id                  | full_name         | phone          | role        | is_active
--------------------|-------------------|----------------|-------------|----------
uuid-admin-001      | Admin User        | +8801700000000 | ADMIN       | true
uuid-merchant-002   | John Doe          | +8801712345678 | MERCHANT    | false ❌
uuid-hubmgr-003     | Manager Ahmed     | +8801798765432 | HUB_MANAGER | true
uuid-rider-004      | Rider Karim       | +8801687654321 | RIDER       | true
```

---

## 📦 **TABLE 2: MERCHANTS (Merchant Profile Data)**

```
┌───────────────────────────────────────────────────────────────┐
│                     MERCHANTS TABLE                           │
│  Purpose: Store merchant-specific business information        │
│  Relationship: One merchant → One user (1:1)                  │
├───────────────────────────────────────────────────────────────┤
│  Column          │ Type          │ Description                │
├──────────────────┼───────────────┼────────────────────────────┤
│  id              │ UUID (PK)     │ Unique merchant ID         │
│  user_id         │ UUID (FK)     │ → users.id                 │
│  thana           │ VARCHAR(255)  │ Thana/Upazila name         │
│  district        │ VARCHAR(255)  │ District name              │
│  full_address    │ TEXT          │ Complete address (optional)│
│  secondary_number│ VARCHAR(50)   │ Alternative phone (opt.)   │
│  status          │ ENUM          │ PENDING, APPROVED,         │
│                  │               │ REJECTED                   │
│  approved_at     │ TIMESTAMP     │ When admin approved        │
│  approved_by     │ UUID (FK)     │ → users.id (admin who      │
│                  │               │   approved)                │
│  created_at      │ TIMESTAMP     │ When merchant signed up    │
│  updated_at      │ TIMESTAMP     │ Last update                │
└──────────────────┴───────────────┴────────────────────────────┘

FOREIGN KEYS:
  - user_id → users.id (CASCADE DELETE)
  - approved_by → users.id (SET NULL ON DELETE)
```

**Example Data:**
```sql
id              | user_id         | thana     | district | status    | approved_by
----------------|-----------------|-----------|----------|-----------|-------------
uuid-merch-001  | uuid-merchant-002| Dhanmondi | Dhaka    | PENDING ⏳| NULL
uuid-merch-002  | uuid-merchant-005| Gulshan   | Dhaka    | APPROVED ✅| uuid-admin-001
```

---

## 🏢 **TABLE 3: HUBS (Delivery Hub Locations)**

```
┌───────────────────────────────────────────────────────────────┐
│                        HUBS TABLE                             │
│  Purpose: Store delivery hub/branch information               │
│  Relationship: One hub → One manager (1:1, optional)          │
├───────────────────────────────────────────────────────────────┤
│  Column          │ Type          │ Description                │
├──────────────────┼───────────────┼────────────────────────────┤
│  id              │ UUID (PK)     │ Unique hub ID              │
│  hub_code        │ VARCHAR(50)   │ Hub identifier (UNIQUE)    │
│                  │               │ e.g., "HUB-DH-001"         │
│  branch_name     │ VARCHAR(255)  │ Branch name                │
│  area            │ VARCHAR(255)  │ Area/locality              │
│  address         │ TEXT          │ Full address               │
│  manager_name    │ VARCHAR(255)  │ Manager name (for display) │
│  manager_phone   │ VARCHAR(50)   │ Manager phone              │
│  manager_user_id │ UUID (FK)     │ → users.id (optional,      │
│                  │ NULLABLE      │   linked hub manager user) │
│  created_at      │ TIMESTAMP     │ When hub was created       │
│  updated_at      │ TIMESTAMP     │ Last update                │
└──────────────────┴───────────────┴────────────────────────────┘

FOREIGN KEYS:
  - manager_user_id → users.id (SET NULL ON DELETE)

INDEXES:
  - UNIQUE INDEX: hub_code
```

**Example Data:**
```sql
id          | hub_code    | branch_name      | area      | manager_user_id
------------|-------------|------------------|-----------|----------------
uuid-hub-01 | HUB-DH-001  | Dhaka Central    | Dhanmondi | uuid-hubmgr-003
uuid-hub-02 | HUB-CH-001  | Chittagong Main  | Agrabad   | NULL
```

---

## 👔 **TABLE 4: HUB_MANAGERS (Hub Manager Assignments)**

```
┌───────────────────────────────────────────────────────────────┐
│                   HUB_MANAGERS TABLE                          │
│  Purpose: Link hub managers to their hubs                     │
│  Relationship: One hub_manager → One user, One hub            │
│               (Bridge/Junction table)                         │
├───────────────────────────────────────────────────────────────┤
│  Column          │ Type          │ Description                │
├──────────────────┼───────────────┼────────────────────────────┤
│  id              │ UUID (PK)     │ Unique assignment ID       │
│  user_id         │ UUID (FK)     │ → users.id (must be        │
│                  │               │   role=HUB_MANAGER)        │
│  hub_id          │ UUID (FK)     │ → hubs.id (UNIQUE -        │
│                  │ UNIQUE        │   one manager per hub)     │
│  created_at      │ TIMESTAMP     │ When assigned              │
│  updated_at      │ TIMESTAMP     │ Last update                │
└──────────────────┴───────────────┴────────────────────────────┘

FOREIGN KEYS:
  - user_id → users.id (CASCADE DELETE)
  - hub_id → hubs.id (CASCADE DELETE)

CONSTRAINTS:
  - UNIQUE(hub_id) - Each hub can have only ONE manager
```

**Example Data:**
```sql
id              | user_id         | hub_id
----------------|-----------------|----------------
uuid-assign-01  | uuid-hubmgr-003 | uuid-hub-01
```

---

## 🏍️ **TABLE 5: RIDERS (Delivery Riders)**

```
┌───────────────────────────────────────────────────────────────┐
│                       RIDERS TABLE                            │
│  Purpose: Store rider profiles and hub assignments            │
│  Relationship: Many riders → One hub (M:1)                    │
│               One rider → One user (1:1)                      │
├───────────────────────────────────────────────────────────────┤
│  Column          │ Type          │ Description                │
├──────────────────┼───────────────┼────────────────────────────┤
│  id              │ UUID (PK)     │ Unique rider ID            │
│  user_id         │ UUID (FK)     │ → users.id (role=RIDER)    │
│  hub_id          │ UUID (FK)     │ → hubs.id (assigned hub)   │
│  license_no      │ VARCHAR(100)  │ Driver's license (optional)│
│  is_active       │ BOOLEAN       │ Is rider currently active? │
│  created_at      │ TIMESTAMP     │ When rider was added       │
│  updated_at      │ TIMESTAMP     │ Last update                │
└──────────────────┴───────────────┴────────────────────────────┘

FOREIGN KEYS:
  - user_id → users.id (CASCADE DELETE)
  - hub_id → hubs.id (RESTRICT DELETE - can't delete hub if riders exist)
```

**Example Data:**
```sql
id            | user_id       | hub_id      | license_no  | is_active
--------------|---------------|-------------|-------------|----------
uuid-rider-01 | uuid-rider-004| uuid-hub-01 | DL-12345678 | true
uuid-rider-02 | uuid-rider-007| uuid-hub-01 | DL-87654321 | true
```

---

## 🔗 **RELATIONSHIP DIAGRAM**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TABLE RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────┘

                            ┌─────────────┐
                            │   USERS     │ ◄─── Central table
                            │  (PK: id)   │      All users here
                            └──────┬──────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         │ (1:1)                   │ (1:1)                   │ (1:1)
         │                         │                         │
    ┌────▼────┐              ┌─────▼─────┐            ┌─────▼──────┐
    │MERCHANTS│              │HUB_MANAGERS│            │  RIDERS    │
    │         │              │           │            │            │
    │user_id  │              │user_id    │            │user_id     │
    │(FK)     │              │(FK)       │            │(FK)        │
    │         │              │           │            │            │
    │approved_│              │hub_id ────┼────┐       │hub_id ─────┼───┐
    │by (FK)  │              │(FK)       │    │       │(FK)        │   │
    └─────────┘              └───────────┘    │       └────────────┘   │
         │                                    │                        │
         │                                    │                        │
         │ Approved by                        │ Manages                │ Works at
         │ (admin)                            │ (1:1)                  │ (M:1)
         │                                    │                        │
         │                                    ▼                        ▼
         │                              ┌──────────┐            ┌──────────┐
         └─────────────────────────────►│  HUBS    │◄───────────┤  HUBS    │
                                        │ (PK: id) │            │          │
                                        │          │            │          │
                                        │manager_  │            └──────────┘
                                        │user_id   │
                                        │(FK, opt.)│
                                        └──────────┘
```

**Key Relationships:**

1. **users ↔ merchants** (1:1)
   - One user can be one merchant
   - Foreign Key: `merchants.user_id → users.id`

2. **users ↔ hub_managers ↔ hubs** (1:1:1)
   - One user can manage one hub
   - Foreign Keys: 
     - `hub_managers.user_id → users.id`
     - `hub_managers.hub_id → hubs.id` (UNIQUE)

3. **users ↔ riders** (1:1)
   - One user can be one rider
   - Foreign Key: `riders.user_id → users.id`

4. **hubs ↔ riders** (1:M)
   - One hub has many riders
   - Foreign Key: `riders.hub_id → hubs.id`

5. **users (admin) ↔ merchants** (1:M for approval)
   - One admin can approve many merchants
   - Foreign Key: `merchants.approved_by → users.id`

---

## 🎯 **DATA FLOW: MERCHANT SIGNUP TO LOGIN**

### **Step 1: Merchant Signup**
```
CLIENT SENDS:
  POST /merchants/signup
  { fullName: "John", phone: "+880...", password: "..." }

BACKEND CREATES:
  1. INSERT INTO users
     ┌─────────────────────────────────────────────┐
     │ id: uuid-merchant-002                       │
     │ full_name: "John Doe"                       │
     │ phone: "+8801712345678"                     │
     │ password_hash: "$2b$10$aBcD..."            │
     │ role: MERCHANT                              │
     │ is_active: FALSE  ◄─── CANNOT LOGIN YET    │
     └─────────────────────────────────────────────┘
  
  2. INSERT INTO merchants
     ┌─────────────────────────────────────────────┐
     │ id: uuid-merch-001                          │
     │ user_id: uuid-merchant-002  ◄─── LINKS HERE │
     │ thana: "Dhanmondi"                          │
     │ district: "Dhaka"                           │
     │ status: PENDING  ◄─── NEEDS APPROVAL        │
     │ approved_by: NULL                           │
     └─────────────────────────────────────────────┘

RESULT: Merchant created but CANNOT login
```

### **Step 2: Merchant Tries to Login (FAILS)**
```
CLIENT SENDS:
  POST /auth/login
  { phoneOrEmail: "+8801712345678", password: "..." }

BACKEND CHECKS:
  1. Find user by phone
     SELECT * FROM users WHERE phone = '+8801712345678'
     ✅ Found: uuid-merchant-002
  
  2. Verify password
     ✅ Password matches
  
  3. Check if role = MERCHANT
     ✅ Yes, role = MERCHANT
  
  4. Find merchant record
     SELECT * FROM merchants WHERE user_id = 'uuid-merchant-002'
     ✅ Found: status = PENDING
  
  5. Check if status = APPROVED
     ❌ FAIL! status = PENDING
  
RESPONSE: 401 Unauthorized
  "Your account is pending approval"
```

### **Step 3: Admin Approves Merchant**
```
CLIENT SENDS:
  PATCH /merchants/uuid-merch-001/approve
  { adminId: "uuid-admin-001" }

BACKEND UPDATES:
  1. UPDATE merchants
     ┌─────────────────────────────────────────────┐
     │ id: uuid-merch-001                          │
     │ status: APPROVED  ◄─── CHANGED!             │
     │ approved_at: 2025-11-12 10:30:00           │
     │ approved_by: uuid-admin-001  ◄─── WHO DID IT│
     └─────────────────────────────────────────────┘
  
  2. UPDATE users
     ┌─────────────────────────────────────────────┐
     │ id: uuid-merchant-002                       │
     │ is_active: TRUE  ◄─── CHANGED!              │
     └─────────────────────────────────────────────┘
  
  3. Send email/SMS (stubs)
     [STUB] Email to john@example.com
     [STUB] SMS to +8801712345678

RESULT: Merchant NOW can login ✅
```

### **Step 4: Merchant Logs In (SUCCESS)**
```
CLIENT SENDS:
  POST /auth/login
  { phoneOrEmail: "+8801712345678", password: "..." }

BACKEND CHECKS:
  1. Find user
     SELECT * FROM users WHERE phone = '+8801712345678'
     ✅ Found: uuid-merchant-002
  
  2. Verify password
     ✅ Matches
  
  3. Check if role = MERCHANT
     ✅ Yes
  
  4. Find merchant
     SELECT * FROM merchants WHERE user_id = 'uuid-merchant-002'
     ✅ Found
  
  5. Check if status = APPROVED
     ✅ YES! status = APPROVED
  
  6. Check if is_active = true
     ✅ YES! is_active = true
  
  7. Generate JWT tokens
     accessToken = jwt.sign({ userId, role, phone }, secret, { expiresIn: '15m' })
     refreshToken = jwt.sign({ userId }, secret, { expiresIn: '7d' })
  
  8. Store refresh token
     UPDATE users SET refresh_token = '...' WHERE id = 'uuid-merchant-002'

RESPONSE: 200 OK
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": { id, full_name, phone, role, is_active }
  }
```

---

## 📊 **DATABASE QUERIES VISUALIZATION**

### **Query 1: Get All Pending Merchants with User Info**
```sql
SELECT 
  m.id,
  m.thana,
  m.district,
  m.status,
  m.created_at,
  u.full_name,
  u.phone,
  u.email
FROM merchants m
LEFT JOIN users u ON m.user_id = u.id
WHERE m.status = 'PENDING'
ORDER BY m.created_at DESC;
```

**Result:**
```
id              | thana     | district | full_name | phone          | status
----------------|-----------|----------|-----------|----------------|--------
uuid-merch-001  | Dhanmondi | Dhaka    | John Doe  | +8801712345678 | PENDING
uuid-merch-003  | Gulshan   | Dhaka    | Jane Smith| +8801798765432 | PENDING
```

### **Query 2: Get Hub with Manager and Riders**
```sql
-- Get hub info
SELECT * FROM hubs WHERE id = 'uuid-hub-01';

-- Get hub manager
SELECT u.full_name, u.phone
FROM hub_managers hm
JOIN users u ON hm.user_id = u.id
WHERE hm.hub_id = 'uuid-hub-01';

-- Get all riders for this hub
SELECT u.full_name, u.phone, r.license_no, r.is_active
FROM riders r
JOIN users u ON r.user_id = u.id
WHERE r.hub_id = 'uuid-hub-01';
```

**Result:**
```
HUB: Dhaka Central (HUB-DH-001)
MANAGER: Manager Ahmed (+8801798765432)
RIDERS:
  - Rider Karim (+8801687654321) DL-12345678 [ACTIVE]
  - Rider Rahim (+8801776543210) DL-87654321 [ACTIVE]
```

---

## 🎨 **ENTITY-RELATIONSHIP DIAGRAM (ERD)**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ENTITY RELATIONSHIP DIAGRAM                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    USERS     │
│──────────────│
│ PK id        │──┐
│    full_name │  │
│    phone     │  │ 1
│    email     │  │
│    password  │  │
│    role      │  │
│    is_active │  │
│ refresh_token│  │
└──────────────┘  │
                  │
      ┌───────────┼───────────┬──────────────┐
      │           │           │              │
      │ 1         │ 1         │ 1            │ 1
      │           │           │              │
┌─────▼──────┐ ┌──▼────────┐ ┌▼──────────┐ ┌▼─────────┐
│ MERCHANTS  │ │HUB_MANAGERS│ │  RIDERS   │ │  HUBS    │
│────────────│ │────────────│ │───────────│ │──────────│
│PK id       │ │PK id       │ │PK id      │ │PK id     │
│FK user_id  │ │FK user_id  │ │FK user_id │ │ hub_code │
│  thana     │ │FK hub_id   │ │FK hub_id  │ │ branch   │
│  district  │ │            │ │ license_no│ │ area     │
│  address   │ │            │ │ is_active │ │ address  │
│  status    │ │            │ │           │ │FK manager│
│  approved_at│ │            │ │           │ │ _user_id │
│FK approved │ │            │ │           │ └──────────┘
│  _by       │ │            │ │           │      ▲
└────────────┘ └────────────┘ └───────────┘      │
      ▲              │ M            │ M           │
      │              │              │             │ 1
      │              └──────────────┼─────────────┘
      │ M (approval)                │
      │                             │
      └─────────────────────────────┘
           (approved_by FK)
```

**Legend:**
- **PK** = Primary Key
- **FK** = Foreign Key
- **1** = One
- **M** = Many
- **─** = Relationship line

---

## 🔍 **WHY THIS DESIGN?**

### **1. Separation of Concerns**
- **users** = Authentication & Login (all users)
- **merchants/riders/hub_managers** = Role-specific data

**Benefits:**
- ✅ Single login system for all user types
- ✅ Easy to add new user roles (e.g., CUSTOMER)
- ✅ Centralized password management

### **2. Foreign Keys Enforce Data Integrity**
```sql
-- Can't delete user if merchant exists
DELETE FROM users WHERE id = 'uuid-merchant-002';
ERROR: Foreign key violation (merchants.user_id references this)

-- Can't delete hub if riders are assigned
DELETE FROM hubs WHERE id = 'uuid-hub-01';
ERROR: Foreign key violation (riders.hub_id references this)
```

### **3. Nullable vs Non-Nullable**
```
NULLABLE (optional):
  - users.email (some users may not have email)
  - merchants.secondary_number
  - hubs.manager_user_id (hub can exist without manager initially)

NOT NULL (required):
  - users.phone (must have phone for login)
  - merchants.user_id (merchant must link to user)
  - riders.hub_id (rider must be assigned to a hub)
```

### **4. ENUM Types for Data Validation**
```sql
-- Database enforces valid values
CREATE TYPE user_role_enum AS ENUM('ADMIN', 'HUB_MANAGER', 'RIDER', 'MERCHANT');
CREATE TYPE merchant_status_enum AS ENUM('PENDING', 'APPROVED', 'REJECTED');

-- Can't insert invalid values
INSERT INTO users (role) VALUES ('INVALID_ROLE');
ERROR: invalid input value for enum user_role_enum
```

---

## 📝 **SUMMARY**

**Key Points:**
1. **One central `users` table** for all authentication
2. **Role-specific tables** (merchants, riders, hub_managers) link via `user_id`
3. **Status-based access control** (merchant.status, user.is_active)
4. **Foreign keys** maintain referential integrity
5. **Migrations** track schema changes over time

**Data Flow:**
```
Signup → Create User + Merchant (status=PENDING, is_active=false)
        ↓
Admin Approves → Update status=APPROVED, is_active=true
        ↓
Login → Check password + status + is_active → Issue JWT
        ↓
Protected Routes → Verify JWT → Access granted
```

This design is **scalable**, **maintainable**, and follows **database normalization** best practices!
