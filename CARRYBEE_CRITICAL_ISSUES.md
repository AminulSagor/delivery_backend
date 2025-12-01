# 🚨 Carrybee Integration - Critical Issues & Solutions

## ✅ YOU ARE CORRECT!

### **The Core Problem:**

**Current Store Entity:**
- Only has: `business_address` (free text string)
- Missing: `district`, `thana`, `area` (structured location)

**Carrybee Requirement:**
- Needs: `city_id`, `zone_id`, `area_id` (integers)
- For store creation (pickup location)

**The Conflict:**
- Store location = Where merchant's store is (for pickup)
- Delivery coverage = Where merchant delivers to (different!)

---

## 🔧 Solution: Add Location Fields to Store

### **Updated Store Entity:**
```typescript
@Entity('stores')
export class Store {
  // ... existing fields ...
  
  business_address: string;  // Full address (free text)
  
  // NEW: Structured location
  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;
  
  @Column({ type: 'varchar', length: 100, nullable: true })
  thana: string | null;
  
  @Column({ type: 'varchar', length: 100, nullable: true })
  area: string | null;
  
  @Column({ type: 'varchar', length: 20, nullable: true })
  postal_code: string | null;
  
  // NEW: Contact person
  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_person_name: string | null;
  
  @Column({ type: 'varchar', length: 20, nullable: true })
  contact_person_secondary_number: string | null;
  
  // Carrybee fields
  @Column({ type: 'int', nullable: true })
  carrybee_city_id: number | null;
  
  @Column({ type: 'int', nullable: true })
  carrybee_zone_id: number | null;
  
  @Column({ type: 'int', nullable: true })
  carrybee_area_id: number | null;
}
```

### **Updated CreateStoreDto:**
```typescript
export class CreateStoreDto {
  business_name: string;
  business_address: string;
  
  // NEW: Required
  district: string;
  thana: string;
  area?: string;
  postal_code?: string;
  
  // NEW: Optional
  contact_person_name?: string;
  phone_number: string;
  contact_person_secondary_number?: string;
  
  email?: string;
  facebook_page?: string;
  is_default?: boolean;
}
```

---

## 🔍 Top 10 Critical Edge Cases

### **1. Store Location vs Delivery Coverage**
- Store location = Pickup address (1 location)
- Delivery coverage = Delivery areas (many locations)
- Need both!

### **2. Location Mapping**
- Your: "Dhaka/Gulshan/Gulshan-2" (strings)
- Carrybee: city_id=14, zone_id=151, area_id=5100 (integers)
- Solution: Search & map during sync

### **3. Store Not Synced**
- Validate `is_carrybee_synced` before assignment
- Show error with sync link

### **4. Phone Format**
- Your: `+8801712345678`
- Carrybee: `01712345678`
- Convert by removing `+88`

### **5. Weight Conversion**
- Your: kg (decimal)
- Carrybee: grams (integer 1-25000)
- Convert: `kg * 1000`

### **6. Missing Fields**
- Add `customer_secondary_phone` to Parcel
- Add `item_quantity` to Parcel (default 1)

### **7. Webhook Duplicates**
- Store event IDs to prevent duplicate processing

### **8. Parcel Already Assigned**
- Check if assigned to rider before Carrybee assignment

### **9. Carrybee API Failure**
- Try-catch with user-friendly error
- Store error in parcel notes

### **10. Existing Stores**
- Migration: Add nullable fields
- Require update before sync

---

## 📋 Revised Implementation Steps

### **Phase 1: Database (Day 1-2)**
1. Add location fields to Store entity
2. Add missing fields to Parcel entity
3. Create new entities (ThirdPartyProvider, CarrybeeLocation)
4. Run migration

### **Phase 2: Update Store Module (Day 3)**
1. Update CreateStoreDto with location fields
2. Update UpdateStoreDto
3. Update store service to handle new fields

### **Phase 3: Carrybee API (Day 4-5)**
1. Create CarrybeeApiService
2. Implement location endpoints
3. Implement store/order creation
4. Add validation helpers

### **Phase 4: Store Sync (Day 6-7)**
1. Location search endpoint
2. Store sync endpoint with location mapping
3. Validation logic

### **Phase 5: Parcel Assignment (Day 8-9)**
1. Get parcels for assignment endpoint
2. Assign to Carrybee endpoint
3. All validations
4. Location mapping

### **Phase 6: Webhooks (Day 10-11)**
1. Webhook receiver
2. Signature verification
3. Event handling
4. Status updates

### **Phase 7: Testing (Day 12-13)**
1. Test all flows
2. Handle edge cases
3. Update Postman collection

---

## ✅ What We Need to Do Now

1. **Confirm this approach** - Does it make sense?
2. **Start Phase 1** - Database changes
3. **Update existing stores** - Migration strategy

**Ready to proceed?** 🚀
