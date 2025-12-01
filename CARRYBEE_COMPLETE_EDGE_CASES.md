# 🚨 Carrybee Integration - Complete Edge Cases (57 Total)

## 📋 Categories

1. **Store-Related** (7 cases)
2. **Parcel-Related** (11 cases)
3. **Location-Related** (4 cases)
4. **Pricing-Related** (3 cases)
5. **Webhook-Related** (6 cases)
6. **Permission & Role** (3 cases)
7. **State Management** (3 cases)
8. **API & Integration** (5 cases)
9. **Data Consistency** (3 cases)
10. **Testing** (2 cases)
11. **Database** (3 cases)
12. **Business Logic** (3 cases)
13. **Notification** (2 cases)
14. **Reporting** (2 cases)

---

## 🏪 STORE-RELATED (7)

1. **Store location missing** - Existing stores have no district/thana
2. **Multiple stores** - Each needs separate Carrybee sync
3. **Store location changed** - Need to re-sync
4. **Store deleted with active orders** - Prevent deletion
5. **Contact person missing** - Fallback to merchant name
6. **Store phone vs contact phone** - Separate fields needed
7. **Store not synced** - Validate before assignment

## 📦 PARCEL-RELATED (11)

8. **Already assigned to rider** - Check before Carrybee
9. **Already assigned to Carrybee** - Prevent duplicate
10. **Wrong status** - Must be IN_HUB
11. **Weight = 0 or NULL** - Validation required
12. **Weight too heavy** - Max 25kg
13. **COD too high** - Max 100,000 Taka
14. **Merchant order ID too long** - Max 25 chars
15. **Invalid customer phone** - Format validation
16. **Address too short/long** - 10-200 chars
17. **Customer name invalid** - 2-99 chars
18. **Special instructions too long** - Max 256 chars

## 🗺️ LOCATION-RELATED (4)

19. **Delivery area not mapped** - Coverage area → Carrybee location
20. **Store location not in Carrybee** - Area not covered
21. **Multiple matches** - User must select correct one
22. **Mapping outdated** - Periodic sync needed

## 💰 PRICING-RELATED (3)

23. **Your price vs Carrybee price** - Track both, calculate margin
24. **COD fee difference** - Your 1% vs Carrybee 1.5%
25. **Price changes after assignment** - Store historical fees

## 🔔 WEBHOOK-RELATED (6)

26. **Webhook before assignment complete** - Race condition
27. **Duplicate events** - Idempotency check
28. **Out of order events** - Status validation
29. **Wrong parcel** - Consignment ID not found
30. **Invalid signature** - Security check
31. **Server down, missed webhooks** - Periodic sync

## 🔐 PERMISSION & ROLE (3)

32. **Merchant tries to assign** - Only Hub Manager allowed
33. **Different hub manager** - Check hub ownership
34. **Merchant sees Carrybee fees** - Hide internal costs

## 🔄 STATE MANAGEMENT (3)

35. **Cancelled in your system** - Cancel in Carrybee too
36. **Carrybee cancels** - Handle webhook, notify hub
37. **Partial delivery** - How to handle?

## 🔧 API & INTEGRATION (5)

38. **Rate limit** - Throttle requests
39. **Timeout** - Retry logic
40. **500 error** - Graceful handling
41. **API changes** - Version management
42. **Sandbox vs production** - Environment check

## 📊 DATA CONSISTENCY (3)

43. **Updated after assignment** - Prevent changes
44. **Tracking number conflict** - Store both
45. **Status mismatch** - Trust Carrybee status

## 🧪 TESTING (2)

46. **No real account** - Use sandbox/mocks
47. **Webhook testing** - Test endpoint

## 💾 DATABASE (3)

48. **Migration fails** - Use transactions
49. **NULL values** - Data cleanup
50. **JSON field too large** - Limit events stored

## 🎯 BUSINESS LOGIC (3)

51. **Switch provider mid-delivery** - Not allowed
52. **Wrong assignment** - Allow cancel within 5 min
53. **Bulk partial failure** - Return detailed results

## 🔔 NOTIFICATION (2)

54. **Merchant preferences** - Opt-in/out
55. **Event spam** - Only important events

## 📈 REPORTING (2)

56. **Revenue calculation** - Track profit/loss
57. **Performance metrics** - Success rate, avg time

---

## ✅ Priority Levels

### 🔴 CRITICAL (Must Handle)
- Store not synced (#7)
- Already assigned (#8, #9)
- Wrong status (#10)
- Weight validation (#11, #12)
- COD validation (#13)
- Location not mapped (#19)
- Webhook duplicates (#27)
- Invalid signature (#30)
- Permission checks (#32, #33)
- Cancelled in both systems (#35)

### 🟡 HIGH (Should Handle)
- Store location missing (#1)
- Phone validation (#15)
- Address validation (#16, #17)
- Multiple location matches (#21)
- Pricing tracking (#23, #24)
- Webhook out of order (#28)
- API errors (#39, #40)
- Data consistency (#43, #44)

### 🟢 MEDIUM (Nice to Have)
- Store changed (#3)
- Contact person fallback (#5)
- Mapping outdated (#22)
- Rate limiting (#38)
- Testing tools (#46, #47)
- Notification preferences (#54)
- Reporting (#56, #57)

---

## 🚀 Implementation Checklist

- [ ] Add validation for all critical cases
- [ ] Implement webhook deduplication
- [ ] Add location mapping system
- [ ] Create error handling for API failures
- [ ] Add permission checks
- [ ] Implement cancel in both systems
- [ ] Add data consistency checks
- [ ] Create testing tools
- [ ] Add reporting queries
- [ ] Document all edge cases

---

**Total: 57 Edge Cases Identified**

Ready to start implementation with all these cases in mind! 🎯
