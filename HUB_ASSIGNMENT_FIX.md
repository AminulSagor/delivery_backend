# Hub Assignment Issue - Root Cause & Fix

## Problem Description
When assigning a hub to a store via the admin endpoint, the store response was showing `hub: null` even after successful assignment.

### Example Response (Before Fix)
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "e900df55-29f3-4f1e-89d3-913918b534b5",
      "store_code": "IAM001",
      "business_name": "I am a test store",
      "hub": null,  // ❌ Should contain hub object after assignment
      "status": "APPROVED"
    }
  }
}
```

---

## Root Cause Analysis

### Issue #1: Missing `hub` Relation in Store Queries
The following methods were **NOT loading the `hub` relation** when fetching stores:

1. **`findOne()` method** - Used when merchant retrieves a store
   - Missing: `relations: ['hub']`
   
2. **`findDefaultStore()` method** - Used when merchant retrieves default store
   - Missing: `relations: ['hub']`
   
3. **`findAllByMerchant()` method** - Used when merchant lists all stores
   - Missing: `relations: ['hub']`

#### Example of the Bug (Before)
```typescript
const store = await this.storesRepository.findOne({
  where: { id, merchant_id: merchant.id },
  // ❌ MISSING: relations: ['hub']
});
```

When relations are not loaded, TypeORM returns `hub: null` even if the database has `hub_id` set.

### Issue #2: Stale Hub Object After Assignment
The `assignHubToStore()` method was updating only the `hub_id` but not updating the in-memory `hub` object:

```typescript
store.hub_id = hubId;  // ✅ Updated ID
// ❌ Missing: store.hub = hub; (in-memory object not updated)
await this.storesRepository.save(store);
```

This caused the returned store object to have a null or outdated hub relation.

---

## Solution Implemented

### Fix #1: Load `hub` Relation in Store Queries
Updated all store retrieval methods to explicitly load the `hub` relation:

```typescript
// ✅ FIXED: findDefaultStore()
const defaultStore = await this.storesRepository.findOne({
  where: { merchant_id: merchant.id, is_default: true },
  relations: ['hub'],  // ✅ Added
});

// ✅ FIXED: findOne()
const store = await this.storesRepository.findOne({
  where: { id, merchant_id: merchant.id },
  relations: ['hub'],  // ✅ Added
});

// ✅ FIXED: findAllByMerchant()
const stores = await this.storesRepository.find({
  where: { merchant_id: merchant.id },
  relations: ['hub'],  // ✅ Added
  order: { ... },
});
```

### Fix #2: Update In-Memory Hub Object
Updated `assignHubToStore()` to synchronize the in-memory hub object:

```typescript
async assignHubToStore(storeId: string, hubId: string): Promise<Store> {
  const store = await this.storesRepository.findOne({
    where: { id: storeId },
    relations: ['merchant', 'hub'],
  });

  const hub = await this.hubRepository.findOne({
    where: { id: hubId },
  });

  store.hub_id = hubId;
  store.hub = hub;  // ✅ FIXED: Update in-memory object
  await this.storesRepository.save(store);

  return store;
}
```

---

## Expected Behavior After Fix

### Admin Hub Assignment
```bash
PATCH /stores/admin/:storeId/assign-hub/:hubId
```

#### Response (After Fix)
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "e900df55-29f3-4f1e-89d3-913918b534b5",
      "store_code": "IAM001",
      "business_name": "I am a test store",
      "hub": {
        "id": "hub-uuid-123",
        "branch_name": "Main Hub"
      },
      "status": "APPROVED"
    }
  }
}
```

### Merchant Store Retrieval
```bash
GET /stores/:id
```

#### Response (After Fix)
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "e900df55-29f3-4f1e-89d3-913918b534b5",
      "store_code": "IAM001",
      "business_name": "I am a test store",
      "hub": {
        "id": "hub-uuid-123",
        "branch_name": "Main Hub"
      },
      "status": "APPROVED"
    }
  }
}
```

### Hub Manager Store List
```bash
GET /stores/hub-manager/my-stores
```

#### Response (After Fix)
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "id": "store-uuid-123",
        "store_code": "ABC001",
        "business_name": "ABC Store",
        "hub": {
          "id": "hub-uuid-456",
          "branch_name": "Hub Name"
        },
        "status": "APPROVED"
      }
    ]
  }
}
```

---

## Files Modified
- **`src/stores/stores.service.ts`**
  - `findDefaultStore()` - Added `relations: ['hub']`
  - `findOne()` - Added `relations: ['hub']`
  - `findAllByMerchant()` - Added `relations: ['hub']`
  - `assignHubToStore()` - Added `store.hub = hub;` to sync in-memory object

---

## Testing Checklist

- [ ] Admin assigns hub to store → Hub appears in response
- [ ] Merchant retrieves store → Hub relation loaded
- [ ] Merchant retrieves default store → Hub relation loaded
- [ ] Merchant lists all stores → Hub relations loaded for all
- [ ] Hub manager views assigned stores → Hub relation present

---

## Related Endpoints

| Endpoint | Method | Role | Status |
|----------|--------|------|--------|
| `/stores/admin/:storeId/assign-hub/:hubId` | PATCH | ADMIN | ✅ Fixed |
| `/stores/:id` | GET | MERCHANT | ✅ Fixed |
| `/stores/default` | GET | MERCHANT | ✅ Fixed |
| `/stores` | GET | MERCHANT | ✅ Fixed |
| `/stores/hub-manager/my-stores` | GET | HUB_MANAGER | ✅ Already Working |
| `/stores/admin/all` | GET | ADMIN | ✅ Already Working |

---

## Summary

The issue was caused by **missing `relations` configuration** in TypeORM queries. When retrieving stores, the `hub` relation was not being eager-loaded, resulting in `hub: null` in API responses. 

**Solution:** Added `relations: ['hub']` to all store retrieval queries to ensure the hub relationship is always loaded from the database when needed.
