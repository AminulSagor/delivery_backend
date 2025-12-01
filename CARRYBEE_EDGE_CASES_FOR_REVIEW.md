# 🚨 Carrybee Integration - Critical Edge Cases & Decisions Needed

**Date:** November 24, 2025  
**Status:** Awaiting Supervisor Decision

---

## 🎯 CRITICAL DECISION NEEDED

### **Issue #1: Store Location Mapping Mismatch**

**Problem:**
Merchant's store location (district, thana, area) might NOT match Carrybee's location naming/structure.

**Example:**
```
Merchant enters:
- District: "Dhaka"
- Thana: "Gulshan"
- Area: "Gulshan 1"

Carrybee has:
- City: "Dhaka" (id: 1)
- Zone: "Gulshan Area" (id: 5)
- Area: "Gulshan-1" (id: 23)  ← Different format!
```

**Current Implementation:**
- Store has fields: `district`, `thana`, `area` (text)
- Store has fields: `carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id` (numbers)
- Auto-sync uses Carrybee IDs to create store in Carrybee

**Risk:**
If wrong Carrybee IDs are set, parcels will be delivered to WRONG location! 😱

---

### **OPTION A: Merchant Selects Carrybee Location (Recommended)**

**Flow:**
1. Merchant creates store
2. Merchant searches Carrybee locations: `GET /carrybee/area-suggestion?search=Gulshan`
3. Merchant selects matching location from dropdown
4. Store saved with both text location AND Carrybee IDs
5. Auto-sync works perfectly

**Pros:**
- ✅ Merchant knows their location best
- ✅ Accurate from the start
- ✅ No admin intervention needed
- ✅ Prevents location errors

**Cons:**
- ❌ Merchant needs access to Carrybee location APIs
- ❌ Slightly more complex merchant UI
- ❌ Merchant might select wrong location

**Implementation:**
- Add `carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id` to `CreateStoreDto` (optional)
- Keep Merchant role access to `/carrybee/cities`, `/carrybee/area-suggestion`
- Frontend shows location search during store creation

---

### **OPTION B: Admin/Hub Manager Maps Location**

**Flow:**
1. Merchant creates store (only text location)
2. Hub Manager tries to assign parcel to Carrybee
3. System detects missing Carrybee IDs → Returns error
4. Hub Manager/Admin searches Carrybee locations
5. Hub Manager/Admin updates store with Carrybee IDs
6. Assignment works (auto-sync happens)

**Pros:**
- ✅ Merchant doesn't need Carrybee access
- ✅ Admin verifies location accuracy
- ✅ Simpler merchant experience

**Cons:**
- ❌ Extra step before first Carrybee assignment
- ❌ Admin might not know merchant's exact location
- ❌ Delays first Carrybee delivery
- ❌ Admin workload increases

**Implementation:**
- Remove Merchant access to Carrybee location APIs
- Add validation in assignment: "Store location not mapped to Carrybee"
- Admin/Hub updates store before assignment

---

### **OPTION C: Automatic Mapping (AI/Fuzzy Match)**

**Flow:**
1. Merchant creates store with text location
2. System automatically searches Carrybee for best match
3. Suggests match to merchant/admin for confirmation
4. Once confirmed, Carrybee IDs saved

**Pros:**
- ✅ Best UX - mostly automatic
- ✅ Merchant confirms accuracy
- ✅ Reduces errors

**Cons:**
- ❌ Complex to implement
- ❌ Fuzzy matching might fail
- ❌ Requires AI/matching algorithm
- ❌ Out of scope for current sprint

---

## 📋 Other Critical Edge Cases

### **2. Store Already Exists in Carrybee**

**Scenario:**
Merchant creates store → Auto-sync creates it in Carrybee → Merchant deletes store in our system → Merchant creates same store again → Auto-sync tries to create duplicate in Carrybee

**Carrybee Response:**
Might return error: "Store already exists"

**Questions:**
- Should we handle duplicate store names?
- Should we check if store exists before creating?
- Should we allow re-syncing?

**Current Implementation:**
- No duplicate check
- Will fail if store name exists in Carrybee

**Recommendation:**
- Add try-catch for duplicate errors
- If duplicate, search for existing store and use that ID
- Log warning but continue

---

### **3. Carrybee Location IDs Change**

**Scenario:**
Carrybee updates their location structure (city/zone/area IDs change)

**Impact:**
- Existing stores have old IDs
- New parcels fail to assign
- Orders go to wrong location

**Questions:**
- How to handle Carrybee location updates?
- Should we periodically re-validate locations?
- Should we allow re-mapping?

**Current Implementation:**
- No validation of Carrybee IDs
- Assumes IDs are permanent

**Recommendation:**
- Add endpoint to re-sync store location
- Validate Carrybee IDs before creating order
- Handle "Invalid location" errors gracefully

---

### **4. Merchant Updates Store Location**

**Scenario:**
Store created with location A → Synced to Carrybee → Merchant moves to location B → Updates store in our system

**Questions:**
- Should we re-sync to Carrybee?
- Should we create new Carrybee store?
- Should we prevent location changes after sync?

**Current Implementation:**
- Location can be updated
- Carrybee store NOT updated
- Mismatch between our DB and Carrybee

**Recommendation:**
- Option 1: Prevent location change after Carrybee sync
- Option 2: Re-sync to Carrybee (create new store)
- Option 3: Mark as "needs re-sync" and block assignments

---

### **5. Parcel Weight Mismatch**

**Scenario:**
Merchant enters weight in kg → Carrybee expects grams → Conversion errors

**Example:**
- Merchant: 0.5 kg
- Carrybee: 500 grams ✅
- Merchant: 0.001 kg
- Carrybee: 1 gram (minimum) ✅
- Merchant: 30 kg
- Carrybee: 30000 grams ❌ (max 25 kg)

**Questions:**
- Should we validate weight before assignment?
- Should we show weight in grams to merchant?
- What if merchant enters wrong weight?

**Current Implementation:**
- Validates weight: 0.001 kg - 25 kg
- Converts to grams automatically
- Rejects if out of range

**Status:** ✅ Handled

---

### **6. COD Amount Exceeds Limit**

**Scenario:**
Merchant creates parcel with COD 150,000 Taka → Carrybee max is 100,000 Taka

**Questions:**
- Should we prevent parcel creation?
- Should we block Carrybee assignment only?
- Should we allow internal delivery for high COD?

**Current Implementation:**
- Parcel can be created with any COD
- Carrybee assignment blocked if COD > 100,000
- Can still assign to internal rider

**Status:** ✅ Handled (blocks Carrybee, allows internal)

---

### **7. Phone Number Format Issues**

**Scenario:**
Merchant enters phone: +8801712345678 → Carrybee expects: 01712345678 (no +88)

**Questions:**
- Should we store with or without +88?
- Should we validate format strictly?
- What if customer phone is invalid?

**Current Implementation:**
- Stores phone with format validation
- Auto-removes +88 when sending to Carrybee
- Validates BD format (01XXXXXXXXX)

**Status:** ✅ Handled

---

### **8. Carrybee API Down/Timeout**

**Scenario:**
Hub Manager assigns parcel → Carrybee API is down → Assignment fails

**Questions:**
- Should we retry automatically?
- Should we queue for later?
- Should we notify merchant?
- Can we cancel and reassign to internal rider?

**Current Implementation:**
- Returns error immediately
- No retry mechanism
- No queue
- Parcel stays IN_HUB (can retry manually)

**Recommendation:**
- Add retry logic (3 attempts)
- Log failures
- Allow manual retry
- Allow switching to internal rider

---

### **9. Webhook Signature Invalid**

**Scenario:**
Carrybee sends webhook → Signature doesn't match → Status update rejected

**Questions:**
- Should we accept without signature in sandbox?
- Should we log and alert?
- Should we have fallback status check?

**Current Implementation:**
- Rejects if signature invalid
- Logs warning
- No fallback

**Recommendation:**
- Keep strict validation in production
- Add manual status sync endpoint
- Alert admin on repeated failures

---

### **10. Parcel Status Out of Sync**

**Scenario:**
Carrybee updates status → Webhook fails → Our DB shows old status

**Questions:**
- Should we periodically sync status?
- Should we have manual refresh?
- Should we trust Carrybee or our DB?

**Current Implementation:**
- Relies only on webhooks
- No periodic sync
- No manual refresh

**Recommendation:**
- Add endpoint: `GET /carrybee/parcels/:id/sync-status`
- Periodic background job to sync status
- Show "Last synced" timestamp

---

### **11. Multiple Stores Same Name**

**Scenario:**
Merchant has 2 stores: "ABC Shop - Gulshan" and "ABC Shop - Banani" → Both sync to Carrybee → Carrybee might have duplicate names

**Questions:**
- Should we make store names unique in Carrybee?
- Should we append location to name?
- How to identify correct store?

**Current Implementation:**
- Uses exact business_name
- No uniqueness check
- Might create duplicates

**Recommendation:**
- Append area to name: "ABC Shop - Gulshan 1"
- Or use unique identifier in name
- Check for duplicates before creating

---

### **12. Merchant Deletes Store**

**Scenario:**
Store synced to Carrybee → Merchant deletes store → Carrybee store still exists

**Questions:**
- Should we delete from Carrybee too?
- Should we prevent deletion if synced?
- Should we soft-delete only?

**Current Implementation:**
- Store deleted from our DB
- Carrybee store remains
- Orphaned store in Carrybee

**Recommendation:**
- Prevent deletion if has active Carrybee parcels
- Soft-delete (mark as inactive)
- Don't delete from Carrybee (keep history)

---

### **13. Delivery Type Mapping**

**Scenario:**
Our system has: REGULAR, EXPRESS, SAME_DAY → Carrybee has: 48, 24, 12 (hours)

**Questions:**
- Is mapping correct?
- What if Carrybee adds new types?
- Should merchant see Carrybee types?

**Current Implementation:**
```javascript
REGULAR → 48 (hours)
EXPRESS → 24 (hours)  
SAME_DAY → 12 (hours)
```

**Recommendation:**
- Confirm mapping with Carrybee docs
- Add fallback to REGULAR if unknown
- Document mapping clearly

---

### **14. Parcel Already Assigned to Rider**

**Scenario:**
Parcel assigned to internal rider → Hub Manager tries to assign to Carrybee

**Questions:**
- Should we allow switching?
- Should we unassign rider first?
- Should we block completely?

**Current Implementation:**
- Blocks if already assigned to rider
- Returns error
- Must unassign rider first

**Status:** ✅ Handled

---

### **15. Carrybee Returns Different Fees**

**Scenario:**
We calculate delivery fee: 60 Taka → Carrybee returns: 65 Taka

**Questions:**
- Which fee to show merchant?
- Should we update our pricing?
- Should we warn merchant?

**Current Implementation:**
- Saves Carrybee's fee in `carrybee_delivery_fee`
- Saves Carrybee's COD fee in `carrybee_cod_fee`
- Merchant sees both fees

**Recommendation:**
- Show Carrybee fee as "Third-party delivery fee"
- Keep our fee for internal comparison
- Alert if difference is large

---

### **16. Partial Delivery/Return**

**Scenario:**
Carrybee delivers parcel → Customer refuses → Carrybee returns to merchant → Webhook: "returned"

**Questions:**
- Should we charge merchant?
- Should we update payment status?
- Should we allow re-delivery?

**Current Implementation:**
- Updates status to RETURNED
- No payment logic
- No re-delivery option

**Recommendation:**
- Add return reason tracking
- Add re-delivery workflow
- Integrate with payment system

---

### **17. Consignment ID Collision**

**Scenario:**
Carrybee generates consignment_id: "FX123" → We save it → Carrybee reuses ID (unlikely but possible)

**Questions:**
- Should we validate uniqueness?
- Should we handle duplicates?

**Current Implementation:**
- Assumes consignment_id is unique
- No duplicate check

**Recommendation:**
- Add unique constraint on `carrybee_consignment_id`
- Handle duplicate errors gracefully

---

### **18. Timezone Issues**

**Scenario:**
Carrybee sends timestamp: "2024-11-24T10:30:00Z" → Our system in UTC+6

**Questions:**
- Should we convert to local time?
- Should we store in UTC?
- How to display to merchant?

**Current Implementation:**
- Stores as-is from Carrybee
- Database uses timestamps with timezone

**Status:** ✅ Handled (PostgreSQL handles timezones)

---

### **19. Merchant Order ID Too Long**

**Scenario:**
Merchant uses long order IDs → Carrybee max is 25 characters

**Questions:**
- Should we truncate?
- Should we hash?
- Should we validate on parcel creation?

**Current Implementation:**
- Truncates to 25 characters: `merchant_order_id?.substring(0, 25)`
- Might lose uniqueness

**Recommendation:**
- Validate merchant_order_id length on parcel creation
- Or use our parcel ID instead

---

### **20. Special Characters in Address**

**Scenario:**
Address contains: "House #45, Road-12, Flat/3" → Carrybee might reject special characters

**Questions:**
- Should we sanitize addresses?
- Should we validate characters?
- What characters are allowed?

**Current Implementation:**
- Sends address as-is
- No sanitization

**Recommendation:**
- Test with Carrybee
- Add sanitization if needed
- Document allowed characters

---

## 📊 Summary of Decisions Needed

| # | Issue | Decision Required | Priority |
|---|-------|-------------------|----------|
| 1 | **Store Location Mapping** | Option A, B, or C? | 🔴 CRITICAL |
| 2 | Duplicate Store Names | How to handle? | 🟡 HIGH |
| 3 | Location ID Changes | Re-sync strategy? | 🟡 HIGH |
| 4 | Store Location Updates | Allow or block? | 🟡 HIGH |
| 8 | API Failures | Retry strategy? | 🟡 HIGH |
| 10 | Status Sync | Periodic sync? | 🟢 MEDIUM |
| 11 | Multiple Stores Same Name | Naming strategy? | 🟢 MEDIUM |
| 12 | Store Deletion | Soft-delete? | 🟢 MEDIUM |
| 15 | Fee Differences | Which to show? | 🟢 MEDIUM |
| 16 | Returns/Partial Delivery | Workflow? | 🟢 MEDIUM |

---

## 🎯 Recommended Immediate Actions

### **Must Decide Now:**
1. **Store Location Mapping** (Issue #1) - Blocks merchant onboarding
2. **Duplicate Store Handling** (Issue #2) - Prevents sync errors
3. **Location Update Policy** (Issue #4) - Prevents data mismatch

### **Can Decide Later:**
- API retry strategy
- Status sync mechanism
- Return workflow
- Fee display logic

---

## 📞 Questions for Supervisor

1. **Who should map store locations to Carrybee?**
   - [ ] Merchant (during store creation)
   - [ ] Admin/Hub Manager (before first assignment)
   - [ ] Automatic (with confirmation)

2. **What happens if merchant updates store location after Carrybee sync?**
   - [ ] Block the update
   - [ ] Create new Carrybee store
   - [ ] Mark as "needs re-sync"

3. **How to handle Carrybee API failures?**
   - [ ] Retry automatically (how many times?)
   - [ ] Queue for later
   - [ ] Manual retry only

4. **Should we allow multiple stores with same name?**
   - [ ] Yes, append location to Carrybee name
   - [ ] No, enforce uniqueness
   - [ ] Yes, use unique identifier

5. **What to do with stores deleted by merchant?**
   - [ ] Soft-delete only
   - [ ] Hard-delete from both systems
   - [ ] Keep in Carrybee, delete from our DB

---

**Please review and provide decisions on the critical issues (especially #1) so we can proceed with implementation.**

**Status:** ⏸️ AWAITING SUPERVISOR APPROVAL
