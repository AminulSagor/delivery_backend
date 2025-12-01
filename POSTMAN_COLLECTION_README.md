# ✅ Postman Collection - Ready to Import

## 📦 File

**`Delivery_Backend_API.postman_collection.json`**

✅ **94 Endpoints** - Complete coverage  
✅ **100% Verified from DTOs** - All request bodies checked against actual DTO files  
✅ **NO Assumptions** - Only fields that exist in your code  
✅ **Proper Validations** - All field formats documented  

---

## 🚀 Import Instructions

1. Open Postman
2. Click **Import**
3. Select `Delivery_Backend_API.postman_collection.json`
4. Click **Import**
5. Set `base_url` variable to `http://localhost:3000`
6. Done!

---

## 📋 Key Request Bodies (Verified from DTOs)

### 1. Create Admin
```json
{
  "fullName": "Admin User",
  "phone": "+8801712345678",
  "email": "admin@example.com",
  "password": "AdminPass123!"
}
```
**DTO:** `create-admin.dto.ts` | Uses **camelCase**

### 2. Login
```json
{
  "identifier": "+8801712345678",
  "password": "admin123"
}
```
**DTO:** `auth-login.dto.ts` | `identifier` = phone OR email

### 3. Merchant Signup
```json
{
  "full_name": "John Merchant",
  "phone": "+8801812345678",
  "thana": "Gulshan",
  "district": "Dhaka",
  "full_address": "123 Business St",
  "email": "merchant@example.com",
  "secondary_number": "+8801912345678",
  "password": "MerchantPass123!"
}
```
**DTO:** `create-merchant.dto.ts` | Uses **snake_case**

### 4. Create Hub
```json
{
  "hub_code": "HUB001",
  "branch_name": "Dhaka Central Hub",
  "area": "Gulshan",
  "address": "123 Hub St",
  "manager_name": "Hub Manager",
  "manager_phone": "01712345678",
  "manager_email": "hubmanager@example.com",
  "manager_password": "HubManager123!"
}
```
**DTO:** `create-hub.dto.ts` | `manager_phone`: `01[3-9]XXXXXXXX` | `manager_password`: min 8, uppercase+lowercase+number

### 5. Create Customer
```json
{
  "customer_name": "Customer Name",
  "phone_number": "+8801912345678",
  "secondary_number": "+8801812345678",
  "delivery_address": "123 Customer St"
}
```
**DTO:** `create-customer.dto.ts`

### 6. Create Parcel
```json
{
  "merchant_order_id": "ORD123",
  "store_id": "{{store_id}}",
  "pickup_address": "123 Pickup St",
  "delivery_coverage_area_id": "{{coverage_area_id}}",
  "customer_name": "Customer Name",
  "customer_phone": "01912345678",
  "delivery_address": "123 Delivery St",
  "product_description": "Electronics",
  "product_price": 1000,
  "product_weight": 1.5,
  "parcel_type": 1,
  "delivery_type": 1,
  "is_cod": true,
  "cod_amount": 1000,
  "special_instructions": "Handle with care"
}
```
**DTO:** `create-parcel.dto.ts` | `customer_phone`: `01XXXXXXXXX`

---

## 📊 All 94 Endpoints

| # | Category | Endpoints |
|---|----------|-----------|
| 1 | Authentication | 6 |
| 2 | Admin Management | 7 |
| 3 | Email & SMS Testing | 5 |
| 4 | Merchant Management | 5 |
| 5 | Customer Management | 6 |
| 6 | Hub Management | 6 |
| 7 | Store Management | 10 |
| 8 | Rider Management | 8 |
| 9 | Parcel Management | 15 |
| 10 | Delivery Operations | 5 |
| 11 | Pickup Requests | 9 |
| 12 | Pricing Management | 6 |
| 13 | Coverage Areas | 1 |
| 14 | Delivery Verifications | 5 |
| **TOTAL** | **94** |

---

## ✨ Features

✅ **Auto-Save Tokens** - Login once, test everywhere  
✅ **Role-Based Logins** - 4 pre-configured examples  
✅ **DTO Descriptions** - Each request shows which DTO it uses  
✅ **Validation Notes** - Field formats documented  
✅ **Collection Variables** - Reusable IDs  

---

## 🎯 Quick Test

1. Import collection
2. Set `base_url` = `http://localhost:3000`
3. Run **Login - ADMIN**
4. Run **Create Admin**
5. ✅ Works!

---

**File:** `Delivery_Backend_API.postman_collection.json`  
**Status:** ✅ Ready to Import  
**Verified:** ✅ All DTOs Checked  
**Total Endpoints:** 94
