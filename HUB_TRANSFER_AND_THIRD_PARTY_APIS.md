# Hub Transfer APIs & Third Party Assignment APIs

## 📦 Hub Transfer APIs

### 1. Parcel Transfer Between Hubs

These APIs handle transferring parcels from one hub to another.

#### **Get All Hubs for Transfer**
- **Method:** `GET`
- **Endpoint:** `/hubs/list`
- **Authorization:** `HUB_MANAGER`, `ADMIN`
- **Description:** Get list of all hubs (excluding current hub) for transfer destination selection
- **Response:** List of hubs with hub_code, name, etc.

#### **Transfer Parcel to Another Hub**
- **Method:** `PATCH`
- **Endpoint:** `/hubs/parcels/:id/transfer`
- **Authorization:** `HUB_MANAGER`
- **Description:** Transfer a parcel from current hub to another hub
- **Request Body:**
  ```json
  {
    "destination_hub_id": "uuid"
  }
  ```
- **Response:** Updated parcel with new destination_hub_id and status IN_TRANSIT

#### **Get Incoming Parcels**
- **Method:** `GET`
- **Endpoint:** `/hubs/parcels/incoming`
- **Authorization:** `HUB_MANAGER`
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 20)
- **Description:** Get parcels that are IN_TRANSIT to this hub (transferred from other hubs)
- **Response:** Paginated list of incoming parcels

#### **Accept Incoming Parcel**
- **Method:** `PATCH`
- **Endpoint:** `/hubs/parcels/:id/accept`
- **Authorization:** `HUB_MANAGER`
- **Description:** Accept an incoming parcel transfer (changes status from IN_TRANSIT to IN_HUB)
- **Response:** Updated parcel with status IN_HUB

#### **Get Outgoing Parcels**
- **Method:** `GET`
- **Endpoint:** `/hubs/parcels/outgoing`
- **Authorization:** `HUB_MANAGER`
- **Query Parameters:**
  - `page` (default: 1)
  - `limit` (default: 20)
- **Description:** Get parcels that were transferred from this hub to other hubs
- **Response:** Paginated list of outgoing parcels

---

### 2. Hub Transfer Records (Financial Transfer Records)

These APIs handle financial transfer records when hub managers transfer money to admin accounts.

#### **Hub Manager Endpoints**

##### **Create Transfer Record**
- **Method:** `POST`
- **Endpoint:** `/hubs/transfer-records`
- **Authorization:** `HUB_MANAGER`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  ```
  transferred_amount: 50000.00 (required, number)
  admin_bank_name: "Dutch Bangla Bank" (required, string)
  admin_bank_account_number: "1234567890" (required, string)
  admin_account_holder_name: "Admin Name" (required, string)
  transaction_reference_id: "TRX123456" (optional, string)
  notes: "Weekly settlement transfer" (optional, string)
  proof: file (required, jpg/png/pdf, max 2MB)
  ```
- **Response:** Created transfer record with status PENDING

##### **Get My Transfer Records**
- **Method:** `GET`
- **Endpoint:** `/hubs/transfer-records`
- **Authorization:** `HUB_MANAGER`
- **Query Parameters:**
  - `status`: PENDING | APPROVED | REJECTED (optional)
  - `fromDate`: ISO date string (optional)
  - `toDate`: ISO date string (optional)
  - `page`: number (default: 1)
  - `limit`: number (default: 10, max: 100)
- **Description:** Get all transfer records created by the current hub manager
- **Response:** Paginated list of transfer records

##### **Get Single Transfer Record**
- **Method:** `GET`
- **Endpoint:** `/hubs/transfer-records/:id`
- **Authorization:** `HUB_MANAGER`
- **Description:** Get details of a specific transfer record (only own records)
- **Response:** Transfer record details with hub and hub manager info

##### **Update Transfer Record**
- **Method:** `PATCH`
- **Endpoint:** `/hubs/transfer-records/:id`
- **Authorization:** `HUB_MANAGER`
- **Content-Type:** `multipart/form-data`
- **Request Body:** (all optional)
  ```
  transferred_amount: 55000.00
  admin_bank_name: "BRAC Bank"
  admin_bank_account_number: "9876543210"
  transaction_reference_id: "TRX123457"
  notes: "Updated notes"
  proof: file (replaces existing file)
  ```
- **Description:** Update a PENDING transfer record (only PENDING records can be updated)
- **Response:** Updated transfer record

##### **Delete Transfer Record**
- **Method:** `DELETE`
- **Endpoint:** `/hubs/transfer-records/:id`
- **Authorization:** `HUB_MANAGER`
- **Description:** Delete a PENDING transfer record (only PENDING records can be deleted)
- **Response:** Success message

#### **Admin Endpoints**

##### **Get All Hub Transfer Records**
- **Method:** `GET`
- **Endpoint:** `/admin/hub-transfer-records`
- **Authorization:** `ADMIN`
- **Query Parameters:**
  - `status`: PENDING | APPROVED | REJECTED (optional)
  - `hubId`: UUID (optional, filter by specific hub)
  - `hubManagerId`: UUID (optional, filter by hub manager)
  - `fromDate`: ISO date string (optional)
  - `toDate`: ISO date string (optional)
  - `page`: number (default: 1)
  - `limit`: number (default: 10, max: 100)
- **Description:** Get all transfer records from all hub managers
- **Response:** Paginated list of all transfer records

##### **Approve Transfer Record**
- **Method:** `PATCH`
- **Endpoint:** `/admin/hub-transfer-records/:id/approve`
- **Authorization:** `ADMIN`
- **Request Body:**
  ```json
  {
    "admin_notes": "Verified and approved" (optional, string)
  }
  ```
- **Description:** Approve a PENDING transfer record (changes status to APPROVED)
- **Response:** Updated transfer record with reviewed_by and reviewed_at

##### **Reject Transfer Record**
- **Method:** `PATCH`
- **Endpoint:** `/admin/hub-transfer-records/:id/reject`
- **Authorization:** `ADMIN`
- **Request Body:**
  ```json
  {
    "rejection_reason": "Insufficient proof" (required, string),
    "admin_notes": "Please provide better proof" (optional, string)
  }
  ```
- **Description:** Reject a PENDING transfer record (changes status to REJECTED)
- **Response:** Updated transfer record with reviewed_by and reviewed_at

---

## 🚚 Third Party Assignment APIs

### 1. Third Party Providers

#### **Get Active Third Party Providers**
- **Method:** `GET`
- **Endpoint:** `/third-party-providers/active`
- **Authorization:** `HUB_MANAGER`, `ADMIN`
- **Description:** Get list of all active third party providers (e.g., Carrybee)
- **Response:** List of active providers with id, name, code, etc.

#### **Get All Third Party Providers**
- **Method:** `GET`
- **Endpoint:** `/third-party-providers`
- **Authorization:** `ADMIN`
- **Description:** Get all third party providers (including inactive)
- **Response:** List of all providers

---

### 2. Carrybee (Third Party) Parcel Assignment

#### **Get Parcels For Third Party Assignment**
- **Method:** `GET`
- **Endpoint:** `/carrybee/parcels/for-assignment`
- **Authorization:** `HUB_MANAGER`
- **Description:** Get parcels that are eligible for third party assignment (status: IN_HUB, not already assigned)
- **Response:** List of parcels ready for third party assignment

#### **Assign Parcel to Carrybee**
- **Method:** `POST`
- **Endpoint:** `/carrybee/parcels/:parcelId/assign`
- **Authorization:** `HUB_MANAGER`
- **Request Body:**
  ```json
  {
    "third_party_provider_id": "uuid" (required),
    "delivery_fee": 50.00 (optional, number),
    "cod_fee": 10.00 (optional, number)
  }
  ```
- **Description:** Assign a parcel to Carrybee (or other third party provider)
- **Response:**
  ```json
  {
    "parcel_id": "uuid",
    "carrybee_consignment_id": "string",
    "delivery_fee": 50.00,
    "cod_fee": 10.00,
    "message": "Parcel assigned to Carrybee successfully"
  }
  ```
- **Note:** This changes parcel status to `ASSIGNED_TO_THIRD_PARTY`

---

### 3. Carrybee Webhook (Status Updates)

#### **Handle Carrybee Webhook**
- **Method:** `POST`
- **Endpoint:** `/webhooks/carrybee`
- **Authorization:** None (public endpoint, uses signature verification)
- **Headers:**
  - `x-carrybee-webhook-signature`: Webhook signature for verification
- **Request Body:** Carrybee webhook payload
- **Description:** Receives status updates from Carrybee (delivered, failed, etc.)
- **Response:** Webhook processing result

---

## 📊 Summary

### Hub Transfer APIs (Total: 11 endpoints)
- **Parcel Transfer:** 5 endpoints
  - Get hubs list
  - Transfer parcel
  - Get incoming parcels
  - Accept incoming parcel
  - Get outgoing parcels

- **Transfer Records:** 6 endpoints
  - Hub Manager: 5 endpoints (Create, List, Get, Update, Delete)
  - Admin: 3 endpoints (List All, Approve, Reject)

### Third Party Assignment APIs (Total: 5 endpoints)
- **Providers:** 2 endpoints (Get Active, Get All)
- **Assignment:** 2 endpoints (Get Parcels, Assign Parcel)
- **Webhook:** 1 endpoint (Handle Webhook)

---

## 🔐 Authorization Summary

| Role | Hub Transfer (Parcels) | Hub Transfer Records | Third Party Assignment |
|------|----------------------|---------------------|----------------------|
| **HUB_MANAGER** | ✅ Full access (own hub) | ✅ Create/View/Update/Delete own records | ✅ Full access |
| **ADMIN** | ✅ View all hubs | ✅ View/Approve/Reject all records | ✅ View providers only |

---

## 📝 Notes

1. **Parcel Transfer:**
   - Parcels must be in `IN_HUB` or `RETURNED_TO_HUB` status to transfer
   - Cannot transfer to the same hub
   - Transferred parcels get status `IN_TRANSIT` until accepted

2. **Transfer Records:**
   - Only `PENDING` records can be updated or deleted
   - `APPROVED` and `REJECTED` records are immutable
   - Proof file is required (JPG, PNG, or PDF, max 2MB)

3. **Third Party Assignment:**
   - Parcels must be in `IN_HUB` status
   - Assignment changes status to `ASSIGNED_TO_THIRD_PARTY`
   - Webhook updates parcel status based on third party delivery status

