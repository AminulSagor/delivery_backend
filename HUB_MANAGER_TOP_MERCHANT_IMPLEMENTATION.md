# Hub Manager - Top Merchant Statistics Implementation

## 📋 Overview

This feature allows hub managers to view:
1. **Top Merchant Name** - The #1 merchant with the most successful parcels in their hub
2. **Successful Parcel Count** - Total successful parcels for the entire hub
3. **Top Merchant's Transactions** - Complete transaction details for the top merchant

---

## 🔧 Implementation Details

### Files Modified

1. **`src/hubs/hubs.module.ts`**
   - Added `Store` and `Parcel` entities to TypeORM imports

2. **`src/hubs/hubs.service.ts`**
   - Added `Store` and `Parcel` repository injections
   - Added `In` to TypeORM imports
   - Added new method: `getTopMerchantStatistics(hubId: string)`

3. **`src/hubs/hubs.controller.ts`**
   - Added new endpoint: `GET /hubs/top-merchant`
   - Placed BEFORE dynamic `:id` routes to avoid routing conflicts

---

## 📡 API Endpoint

### Get Top Merchant Statistics

**Endpoint**: `GET /hubs/top-merchant`

**Authorization**: Hub Manager role required

**Headers**:
```
Authorization: Bearer <hub_manager_jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "top_merchant": {
      "merchant_id": "uuid-merchant-1",
      "merchant_name": "Fatima Electronics",
      "merchant_phone": "+8801712345678",
      "successful_parcels": 85,
      "total_parcels": 90,
      "total_transaction_amount": 45000.00,
      "total_cod_collected": 45000.00,
      "total_delivery_charges": 4500.00,
      "net_amount": 40500.00
    },
    "hub_successful_parcels_total": 380
  },
  "message": "Top merchant statistics retrieved successfully"
}
```

**If No Stores in Hub**:
```json
{
  "success": true,
  "data": {
    "top_merchant": null,
    "hub_successful_parcels_total": 0
  },
  "message": "Top merchant statistics retrieved successfully"
}
```

---

## 🎯 What the Endpoint Returns

### `top_merchant` Object

| Field | Type | Description |
|-------|------|-------------|
| `merchant_id` | UUID | Unique merchant identifier |
| `merchant_name` | String | Merchant's full name |
| `merchant_phone` | String | Merchant's phone number |
| `successful_parcels` | Number | Count of successfully delivered parcels |
| `total_parcels` | Number | Total parcels (all statuses) |
| `total_transaction_amount` | Decimal | Total COD amount collected |
| `total_cod_collected` | Decimal | Total COD collected amount |
| `total_delivery_charges` | Decimal | Total delivery fees charged |
| `net_amount` | Decimal | Net amount (COD - delivery charges) |

### `hub_successful_parcels_total`

Total count of all successful parcels in the hub (across all merchants).

---

## 💡 Business Logic

### Successful Parcel Statuses

The following statuses are considered "successful deliveries":
- `DELIVERED` - Fully delivered to customer
- `PARTIAL_DELIVERY` - Partially delivered
- `EXCHANGE` - Item exchanged

### How Top Merchant is Determined

1. System fetches all stores assigned to the hub manager's hub
2. Gets all parcels for those stores
3. Groups parcels by merchant
4. Counts successful deliveries for each merchant
5. Returns the merchant with the **highest successful parcel count**

### Financial Calculations

- **Total Transaction Amount** = Sum of all COD collected from successful deliveries
- **Total COD Collected** = Actual amount collected from customers
- **Total Delivery Charges** = Sum of delivery fees for successful deliveries
- **Net Amount** = Total COD Collected - Total Delivery Charges

---

## 🧪 Testing the Endpoint

### Using cURL

```bash
curl -X GET http://localhost:3000/hubs/top-merchant \
  -H "Authorization: Bearer YOUR_HUB_MANAGER_TOKEN"
```

### Using Postman

1. Method: `GET`
2. URL: `http://localhost:3000/hubs/top-merchant`
3. Headers:
   - Key: `Authorization`
   - Value: `Bearer YOUR_HUB_MANAGER_TOKEN`

### Expected Test Scenarios

#### Scenario 1: Hub with Multiple Merchants
- **Expected**: Returns the merchant with most successful parcels
- **Result**: `top_merchant` object with full details

#### Scenario 2: Hub with No Stores
- **Expected**: Returns null for top merchant
- **Result**: `top_merchant: null` and `hub_successful_parcels_total: 0`

#### Scenario 3: Hub with Stores but No Parcels
- **Expected**: Returns null for top merchant
- **Result**: `top_merchant: null` and `hub_successful_parcels_total: 0`

---

## 🔒 Security & Authorization

- Only users with `HUB_MANAGER` role can access this endpoint
- Hub managers can only see data for their assigned hub
- User's `hubId` is automatically extracted from JWT token via `@CurrentUser()` decorator

---

## 🐛 Troubleshooting

### Error: "Validation failed (uuid is expected)"
**Cause**: Route placed after dynamic `:id` route  
**Solution**: ✅ Fixed - Route now placed BEFORE dynamic routes

### Error: "hubId missing in auth token"
**Cause**: JWT token doesn't contain hubId  
**Solution**: Ensure hub manager is properly authenticated with correct JWT

### No Data Returned
**Possible Causes**:
1. No stores assigned to the hub
2. No parcels created for hub's merchants
3. No successful deliveries yet

---

## 📊 Use Cases

### For Hub Managers

1. **Performance Tracking**
   - Identify top-performing merchant in their hub
   - Monitor total successful deliveries

2. **Merchant Relations**
   - Recognize high-volume merchants
   - Provide better service to top merchants

3. **Operational Insights**
   - Understand transaction volumes
   - Track financial metrics per merchant

---

## 🔄 Future Enhancements (Optional)

Potential improvements that could be added:
- Date range filters (e.g., top merchant for last 30 days)
- Top N merchants instead of just #1
- Additional metrics (return rate, average delivery time)
- Export functionality

---

## ✅ Implementation Complete

The feature is now live and ready to use. Hub managers can access their top merchant statistics through the `/hubs/top-merchant` endpoint.

