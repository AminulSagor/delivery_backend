# Store Response Fix - Issue Resolution

## 🐛 Problem

The API was returning basic store info without the enriched data:

```json
{
  "id": "...",
  "business_name": "My Electronics Store",
  "business_address": "...",
  "phone_number": "...",
  "email": "...",
  "is_default": true,
  "is_carrybee_synced": false,
  "hub": null
}
```

**Missing:**
- ❌ `store_code` (auto-generated unique ID)
- ❌ `hub_code` (hub identifier)
- ❌ `hub_name` (hub branch name)
- ❌ `performance` (metrics like total parcels, delivered, returns)

---

## 🔍 Root Cause

### The Data Flow:

1. **✅ Service Layer** (`stores.service.ts`)
   - `findAllByMerchant()` method was correctly generating enriched data
   - Included `store_code`, `hub_code`, `hub_name`, `performance`

2. **❌ Response Transformation** (`responses.interface.ts`)
   - `toStoreListItem()` function was **filtering out** the enriched data
   - Only returning basic fields defined in old `StoreListItem` interface

3. **Controller Layer** (`stores.controller.ts`)
   - Using `stores.map(toStoreListItem)` which stripped the data

**The enriched data was being generated but then filtered out before sending to client!**

---

## ✅ Solution

### 1. Updated `StoreListItem` Interface

**File:** `src/common/interfaces/responses.interface.ts`

**Before:**
```typescript
export interface StoreListItem {
  id: string;
  business_name: string;
  business_address: string;
  phone_number: string;
  email: string | null;
  is_default: boolean;
  is_carrybee_synced: boolean;
  hub?: {
    id: string;
    branch_name: string;
  } | null;
}
```

**After:**
```typescript
export interface StoreListItem {
  id: string;
  store_code: string | null; // ✅ NEW - Auto-generated
  business_name: string;
  business_address: string;
  phone_number: string;
  email: string | null;
  is_default: boolean;
  is_carrybee_synced: boolean;
  hub_id: string | null; // ✅ NEW
  hub_code: string | null; // ✅ NEW - Hub code
  hub_name: string | null; // ✅ NEW - Hub branch name
  performance: { // ✅ NEW - Performance metrics
    total_parcels: number;
    successfully_delivered: number;
    total_returns: number;
    pending_parcels: number;
  };
}
```

### 2. Updated `toStoreListItem()` Function

**File:** `src/common/interfaces/responses.interface.ts`

**Before:**
```typescript
export function toStoreListItem(store: any): StoreListItem {
  return {
    id: store.id,
    business_name: store.business_name,
    business_address: store.business_address,
    phone_number: store.phone_number,
    email: store.email,
    is_default: store.is_default,
    is_carrybee_synced: store.is_carrybee_synced || false,
    hub: store.hub ? {
      id: store.hub.id,
      branch_name: store.hub.branch_name,
    } : null,
  };
}
```

**After:**
```typescript
export function toStoreListItem(store: any): StoreListItem {
  return {
    id: store.id,
    store_code: store.store_code || null, // ✅ Include store code
    business_name: store.business_name,
    business_address: store.business_address,
    phone_number: store.phone_number,
    email: store.email,
    is_default: store.is_default,
    is_carrybee_synced: store.is_carrybee_synced || false,
    hub_id: store.hub_id || null, // ✅ Include hub_id
    hub_code: store.hub_code || null, // ✅ Include hub_code
    hub_name: store.hub_name || null, // ✅ Include hub_name
    performance: store.performance || { // ✅ Include performance
      total_parcels: 0,
      successfully_delivered: 0,
      total_returns: 0,
      pending_parcels: 0,
    },
  };
}
```

### 3. Updated Service to Include `is_carrybee_synced`

**File:** `src/stores/stores.service.ts`

Added the missing field to the enriched response:

```typescript
return {
  id: store.id,
  store_code: store.store_code,
  business_name: store.business_name,
  business_address: store.business_address,
  phone_number: store.phone_number,
  email: store.email,
  facebook_page: store.facebook_page,
  district: store.district,
  thana: store.thana,
  area: store.area,
  is_default: store.is_default,
  is_carrybee_synced: store.is_carrybee_synced || false, // ✅ ADDED
  hub_id: store.hub_id,
  hub_code: store.hub?.hub_code || null,
  hub_name: store.hub?.branch_name || null,
  performance: {
    total_parcels: performance.total_parcels,
    successfully_delivered: performance.successfully_delivered,
    total_returns: performance.total_returns,
    pending_parcels: performance.pending_parcels,
  },
  created_at: store.created_at,
  updated_at: store.updated_at,
};
```

---

## 📡 Expected Response Now

```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "id": "e0cde5ef-799d-4529-8430-5789417c2818",
        "store_code": "MYE001", // ✅ Auto-generated
        "business_name": "My Electronics Store",
        "business_address": "House 15, Road 5, Gulshan-2, Dhaka",
        "phone_number": "01712345678",
        "email": "store@example.com",
        "is_default": true,
        "is_carrybee_synced": false,
        "hub_id": "...", // ✅ Hub ID
        "hub_code": "HUB-DHK-001", // ✅ Auto-included
        "hub_name": "Dhaka Central Hub", // ✅ Auto-included
        "performance": { // ✅ Auto-calculated
          "total_parcels": 1247,
          "successfully_delivered": 1200,
          "total_returns": 47,
          "pending_parcels": 0
        }
      }
    ]
  },
  "message": "Stores retrieved successfully",
  "timestamp": "2026-01-08T12:36:34.336Z"
}
```

---

## 🎯 Key Changes

| Component | File | Change |
|-----------|------|--------|
| **Interface** | `responses.interface.ts` | Added `store_code`, `hub_id`, `hub_code`, `hub_name`, `performance` |
| **Transformer** | `responses.interface.ts` | Updated `toStoreListItem()` to include new fields |
| **Service** | `stores.service.ts` | Added `is_carrybee_synced` to enriched response |

---

## ✅ Status

- ✅ Interface updated
- ✅ Transformer function updated
- ✅ Service includes all required fields
- ✅ No linter errors
- ✅ Ready to test

**The response transformation layer now properly passes through all enriched data from the service!**

---

## 📝 Testing

Test the endpoint:

```bash
GET /stores
Authorization: Bearer <merchant_token>
```

You should now see:
- ✅ `store_code` (auto-generated)
- ✅ `hub_code` and `hub_name` (if hub assigned)
- ✅ `performance` object with metrics

