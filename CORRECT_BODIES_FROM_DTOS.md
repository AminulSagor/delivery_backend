# ✅ CORRECT Request Bodies - From Actual DTOs

## ⚠️ IMPORTANT
All bodies below are verified from actual DTO files in the codebase.
**NO fields added or assumed.**

---

## 1. Create Admin (POST /admin)
**File:** `src/admin/dto/create-admin.dto.ts`

```json
{
  "fullName": "Admin User",
  "phone": "+8801712345678",
  "email": "admin@example.com",
  "password": "AdminPass123!"
}
```

**Fields:**
- `fullName` (required) - camelCase
- `phone` (required)
- `email` (optional)
- `password` (required, min 8 chars)

---

## 2. Login (POST /auth/login)
**File:** `src/auth/dto/auth-login.dto.ts`

```json
{
  "identifier": "+8801712345678",
  "password": "admin123"
}
```

**Fields:**
- `identifier` (required) - phone OR email
- `password` (required)

---

## 3. Merchant Signup (POST /merchants/signup)
**File:** `src/merchant/dto/create-merchant.dto.ts`

```json
{
  "full_name": "John Merchant",
  "phone": "+8801812345678",
  "thana": "Gulshan",
  "district": "Dhaka",
  "full_address": "123 Business St, Dhaka",
  "email": "merchant@example.com",
  "secondary_number": "+8801912345678",
  "password": "MerchantPass123!"
}
```

**Fields:**
- `full_name` (required)
- `phone` (required, format: `+8801XXXXXXXXX`)
- `thana` (required)
- `district` (required)
- `full_address` (optional)
- `email` (optional)
- `secondary_number` (optional, format: `+8801XXXXXXXXX`)
- `password` (required, min 4 chars)

---

## 4. Create Customer (POST /customers)
**File:** `src/customer/dto/create-customer.dto.ts`

```json
{
  "customer_name": "Customer Name",
  "phone_number": "+8801912345678",
  "secondary_number": "+8801812345678",
  "delivery_address": "123 Customer St, Dhaka"
}
```

**Fields:**
- `customer_name` (required, max 255)
- `phone_number` (required, max 50)
- `secondary_number` (optional, max 50)
- `delivery_address` (required)

---

## 5. Create Hub (POST /hubs)
**File:** `src/hubs/dto/create-hub.dto.ts`

```json
{
  "hub_code": "HUB001",
  "branch_name": "Dhaka Central Hub",
  "area": "Gulshan",
  "address": "123 Hub St, Gulshan, Dhaka",
  "manager_name": "Hub Manager",
  "manager_phone": "01712345678",
  "manager_email": "hubmanager@example.com",
  "manager_password": "HubManager123!"
}
```

**Fields:**
- `hub_code` (required, uppercase/numbers/-/_ only, max 50)
- `branch_name` (required, max 255)
- `area` (required, max 255)
- `address` (required)
- `manager_name` (required, max 255)
- `manager_phone` (required, format: `01[3-9]XXXXXXXX`)
- `manager_email` (optional, valid email)
- `manager_password` (required, min 8, must have uppercase+lowercase+number)

---

## 6. Create Store (POST /stores)
**File:** `src/stores/dto/create-store.dto.ts`

```json
{
  "business_name": "My Store",
  "business_address": "123 Store St, Dhaka",
  "phone_number": "01712345678",
  "email": "store@example.com",
  "facebook_page": "https://facebook.com/mystore",
  "is_default": true
}
```

**Fields:**
- `business_name` (required, min 2, max 255)
- `business_address` (required)
- `phone_number` (required, format: `01XXXXXXXXX`)
- `email` (optional, valid email)
- `facebook_page` (optional, max 255)
- `is_default` (optional, boolean)

---

## 7. Create Rider (POST /riders)
**File:** `src/riders/dto/create-rider.dto.ts`

```json
{
  "full_name": "John Rider",
  "phone": "01712345678",
  "email": "rider@example.com",
  "password": "RiderPass123!",
  "photo": "url",
  "guardian_mobile_no": "01798765432",
  "bike_type": "MOTORCYCLE",
  "nid_number": "1234567890123",
  "license_no": "DL123456",
  "present_address": "123 Present St",
  "permanent_address": "456 Permanent St",
  "fixed_salary": 15000,
  "commission_percentage": 5,
  "nid_front_photo": "url",
  "nid_back_photo": "url",
  "license_front_photo": "url",
  "license_back_photo": "url",
  "parent_nid_front_photo": "url",
  "parent_nid_back_photo": "url"
}
```

**Fields:** (All required unless marked optional)
- `full_name` (required)
- `phone` (required, format: `01XXXXXXXXX`)
- `email` (optional)
- `password` (required, min 8)
- `photo` (optional)
- `guardian_mobile_no` (required, format: `01XXXXXXXXX`)
- `bike_type` (required, enum: MOTORCYCLE, SCOOTER, etc.)
- `nid_number` (required)
- `license_no` (optional)
- `present_address` (required)
- `permanent_address` (required)
- `fixed_salary` (required, number, min 0)
- `commission_percentage` (required, number, 0-100)
- `nid_front_photo` (required)
- `nid_back_photo` (required)
- `license_front_photo` (optional)
- `license_back_photo` (optional)
- `parent_nid_front_photo` (required)
- `parent_nid_back_photo` (required)

---

## 8. Create Parcel (POST /parcels)
**File:** `src/parcels/dto/create-parcel.dto.ts`

```json
{
  "merchant_order_id": "ORD123",
  "store_id": "uuid-here",
  "pickup_address": "123 Pickup St",
  "delivery_coverage_area_id": "uuid-here",
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

**Fields:**
- `merchant_order_id` (optional, max 100)
- `store_id` (optional, UUID)
- `pickup_address` (required)
- `delivery_coverage_area_id` (optional, UUID)
- `customer_name` (required, max 255)
- `customer_phone` (required, format: `01XXXXXXXXX`)
- `delivery_address` (required)
- `product_description` (optional, max 255)
- `product_price` (optional, number, min 0)
- `product_weight` (optional, number, min 0)
- `parcel_type` (optional, 1=Parcel, 2=Book, 3=Document)
- `delivery_type` (optional, 1=Normal, 2=Express, 3=Same Day)
- `is_cod` (optional, boolean)
- `cod_amount` (optional, number, required if is_cod=true)
- `special_instructions` (optional)

---

## 9. Create Pickup Request (POST /pickup-requests)
**File:** `src/pickup-requests/dto/create-pickup-request.dto.ts`

```json
{
  "store_id": "uuid-here",
  "estimated_parcels": 10,
  "comment": "Morning pickup preferred"
}
```

**Fields:**
- `store_id` (required, UUID)
- `estimated_parcels` (required, integer, min 1)
- `comment` (optional)

---

## 10. Create Pricing (POST /pricing)
**File:** `src/pricing/dto/create-pricing-configuration.dto.ts`

```json
{
  "store_id": "uuid-here",
  "zone": "INSIDE_DHAKA",
  "delivery_charge": 60,
  "weight_charge_per_kg": 15,
  "cod_percentage": 1,
  "discount_percentage": 0,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

**Fields:**
- `store_id` (required, UUID)
- `zone` (required, enum: INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA)
- `delivery_charge` (required, number, min 0)
- `weight_charge_per_kg` (required, number, min 0)
- `cod_percentage` (required, number, 0-100)
- `discount_percentage` (optional, number, 0-100)
- `start_date` (optional, ISO date string)
- `end_date` (optional, ISO date string)

---

**All bodies verified from actual DTO files. No assumptions made.**
