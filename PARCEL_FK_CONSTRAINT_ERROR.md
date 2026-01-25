# Foreign Key Constraint Error - FK_84d3757f0e4a20f86842a05a0a2

## Error Details
```
INSERT or UPDATE on table "parcels" violates foreign key constraint "FK_84d3757f0e4a20f86842a05a0a2"
PostgreSQL Error Code: 23503
```

**Error Code 23503:** Foreign key violation - A referenced record doesn't exist in the parent table.

---

## Root Cause Analysis

The foreign key constraint `FK_84d3757f0e4a20f86842a05a0a2` corresponds to the **`delivery_coverage_area_id`** in the parcels table.

### Why It Fails:
1. **Store ID doesn't exist** in the stores table
2. **Delivery coverage area ID doesn't exist** in the coverage_areas table
3. **Merchant ID doesn't exist** in the users/merchants table  
4. **Customer ID doesn't exist** (if customer is provided) in the customer table

### Parameters That Failed (from error):
```
store_id:                  e900df55-29f3-4f1e-89d3-913918b534b5
delivery_coverage_area_id: b5a26b1f-7d44-4067-b7df-195dd41a14f2
merchant_id:               7bcad4a1-8793-4bcb-ba98-771f46558d00
customer_id:               64ed78ff-fcdd-4c77-af7a-4c0d542cf466
```

---

## Solution: Add Foreign Key Validation

The current code validates `delivery_coverage_area_id` but doesn't validate `store_id` before saving. We need to add proper validation for ALL foreign keys.

### Issue in Current Code

In [src/parcels/parcels.service.ts](src/parcels/parcels.service.ts) around line 1000-1050:

```typescript
// ✅ Store is validated
const store = await this.storeRepository.findOne({
  where: { id: createParcelDto.store_id, merchant_id: merchantId },
});
if (!store)
  throw new NotFoundException(
    'Store not found or does not belong to this merchant. Please check the store ID.',
  );

// ✅ Delivery area is validated
const deliveryArea = createParcelDto.delivery_coverage_area_id
  ? await this.coverageAreaRepository.findOne({
      where: { id: createParcelDto.delivery_coverage_area_id },
    })
  : null;
if (createParcelDto.delivery_coverage_area_id && !deliveryArea)
  throw new NotFoundException(
    `Delivery coverage area not found. Please select a valid delivery area.`,
  );
```

However, there's a gap: **If `store_id` is nullable and skipped, or if validation passes but the store is deleted between validation and save, the FK constraint will fail.**

---

## Troubleshooting Steps

### 1. Check if Store Exists
```sql
SELECT id, business_name, status FROM stores 
WHERE id = 'e900df55-29f3-4f1e-89d3-913918b534b5';
```

**Expected:** Should return 1 row
**If empty:** Store doesn't exist - need to create or use valid store ID

---

### 2. Check if Delivery Coverage Area Exists
```sql
SELECT id, area, zone, city FROM coverage_areas 
WHERE id = 'b5a26b1f-7d44-4067-b7df-195dd41a14f2';
```

**Expected:** Should return 1 row
**If empty:** Coverage area doesn't exist - need to use valid area ID

---

### 3. Check if Merchant Exists
```sql
SELECT id, user_id FROM merchants 
WHERE id = '7bcad4a1-8793-4bcb-ba98-771f46558d00';
```

**Expected:** Should return 1 row
**If empty:** Merchant doesn't exist

---

### 4. Verify Store Belongs to Merchant
```sql
SELECT id, merchant_id, business_name FROM stores 
WHERE id = 'e900df55-29f3-4f1e-89d3-913918b534b5' 
  AND merchant_id = '7bcad4a1-8793-4bcb-ba98-771f46558d00';
```

**Expected:** Should return 1 row
**If empty:** Store doesn't belong to this merchant

---

## Fix: Enhanced Foreign Key Validation

### Add Customer ID Validation
Update the `create` method in [src/parcels/parcels.service.ts](src/parcels/parcels.service.ts) to add explicit validation:

```typescript
// After validating delivery_coverage_area_id, add:

// Validate merchant exists (required FK)
const merchant = await this.merchantRepository.findOne({
  where: { id: merchantId },
});
if (!merchant) {
  throw new BadRequestException(
    `Merchant with ID ${merchantId} not found. Please contact support.`,
  );
}

// If customer_id is provided, validate it exists
if (createParcelDto.customer_id) {
  const existingCustomer = await this.customerRepository.findOne({
    where: { id: createParcelDto.customer_id },
  });
  if (!existingCustomer) {
    throw new BadRequestException(
      `Customer with ID ${createParcelDto.customer_id} not found. Please verify the customer ID.`,
    );
  }
}
```

### Better Error Handling for FK Failures
The code already catches error code `23503`, but we can improve the message:

```typescript
} catch (error) {
  this.logger.error(`[PARCEL SAVE ERROR] ${error.message}`, error.stack);
  if (error.code === '23505') {
    throw new BadRequestException(
      'Duplicate tracking number detected. Please try again.',
    );
  } else if (error.code === '23503') {
    // FK constraint - need more details
    if (error.constraint === 'FK_delivery_coverage_area') {
      throw new BadRequestException(
        'Invalid delivery area. Please select a valid delivery coverage area.',
      );
    } else if (error.constraint === 'FK_store_id') {
      throw new BadRequestException(
        'Invalid store. Please verify the store exists and belongs to your account.',
      );
    }
    throw new BadRequestException(
      'Invalid reference data. Please check all IDs: store_id, delivery_coverage_area_id, and customer_id.',
    );
  }
  throw new InternalServerErrorException(
    'Failed to create parcel. Please try again or contact support.',
  );
}
```

---

## Data Verification Queries

### Get Valid Store IDs for This Merchant
```sql
SELECT id, store_code, business_name FROM stores 
WHERE merchant_id = '7bcad4a1-8793-4bcb-ba98-771f46558d00'
  AND status = 'APPROVED'
ORDER BY created_at DESC;
```

### Get Valid Coverage Area IDs
```sql
SELECT id, area, zone, city FROM coverage_areas 
ORDER BY city, zone, area;
```

### Get All Coverage Areas for Dhaka
```sql
SELECT id, area, zone, city FROM coverage_areas 
WHERE city = 'Dhaka' 
ORDER BY zone, area;
```

---

## API Request Validation Checklist

Before creating a parcel, verify:

- [ ] **store_id** - Belongs to the merchant AND store exists in database
- [ ] **delivery_coverage_area_id** - Exists in coverage_areas table
- [ ] **merchant_id** - Exists and matches the authenticated user
- [ ] **customer_phone** - Format: `01XXXXXXXXX` (11 digits starting with 01)
- [ ] **product_weight** - Non-negative number
- [ ] **product_price** - Non-negative number (COD amount)

---

## Common Causes & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Store not found | Store ID is wrong or store deleted | Use valid store ID from GET /stores |
| Delivery area not found | Coverage area doesn't exist | Use valid area from GET /coverage-areas |
| Store doesn't belong to merchant | Store assigned to different merchant | Verify store with GET /stores |
| Customer not found | Customer ID doesn't exist | Let system create customer or use valid ID |
| FK constraint fails silently | Validation passed but data deleted between check and save | Add transaction or retry logic |

---

## Testing

### Create Parcel - Valid Request
```bash
POST /parcels
{
  "store_id": "e900df55-29f3-4f1e-89d3-913918b534b5",  # ← Verify this exists
  "delivery_coverage_area_id": "b5a26b1f-7d44-4067-b7df-195dd41a14f2",  # ← Verify this exists
  "customer_name": "John Doe",
  "customer_phone": "01538386793",
  "customer_address": "House 15, Road 5, Gulshan-2, Dhaka",
  "product_description": "Electronics Item",
  "product_weight": 1.5,
  "product_price": 100
}
```

### Verify IDs Exist First
```bash
# Check store exists
GET /stores/:storeId

# Check coverage area exists
GET /coverage-areas?search=gulshan
```

---

## Summary

**The parcel creation is failing because one or more of these IDs don't exist in the database:**
- Store ID: `e900df55-29f3-4f1e-89d3-913918b534b5`
- Coverage Area ID: `b5a26b1f-7d44-4067-b7df-195dd41a14f2`
- Merchant ID: `7bcad4a1-8793-4bcb-ba98-771f46558d00`

**Action:**
1. Run the SQL queries above to check which ID is missing
2. Use valid IDs from your database
3. If IDs should exist, check if they were recently deleted or migrated
