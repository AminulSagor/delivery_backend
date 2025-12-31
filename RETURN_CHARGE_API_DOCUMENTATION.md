# Return Charge Configuration API Documentation

## Overview

The **Return Charge Configuration System** allows Admins to configure return charges on a per-store basis for different return statuses. This system provides flexibility to apply different charges based on:

- **Return Status** (PARTIAL_DELIVERY, EXCHANGE, RETURNED, PAID_RETURN)
- **Pricing Zone** (INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA)
- **Store**

---

## 🔑 Key Features

✅ **Status-Based Charges** - Different charges for each return status  
✅ **Zone-Based Pricing** - Separate configurations for each delivery zone  
✅ **Flexible Charge Components** - Delivery charge, weight charge, COD percentage  
✅ **Bulk Creation** - Create all status configurations at once  
✅ **Time-Based Validity** - Optional start and end dates  
✅ **Optional Charges** - Empty/zero values = No charge applied  

---

## 📋 Return Status Types

| Status | Description |
|--------|-------------|
| **PARTIAL_DELIVERY** | When only part of the order was delivered |
| **EXCHANGE** | When the parcel is being exchanged |
| **RETURNED** | When the parcel is returned to merchant |
| **PAID_RETURN** | When a paid parcel is returned |

---

## 🛠️ API Endpoints

### Base URL
```
http://localhost:3000/pricing/return-charges
```

All endpoints require JWT authentication and appropriate role permissions.

---

## 1️⃣ Create Single Return Charge Configuration

**POST** `/pricing/return-charges`

**Authorization**: Admin Only

**Description**: Create a return charge configuration for a specific status and zone.

### Request Body

```json
{
  "store_id": "uuid-of-store",
  "return_status": "RETURNED",
  "zone": "INSIDE_DHAKA",
  "return_delivery_charge": 50.00,
  "return_weight_charge_per_kg": 15.00,
  "return_cod_percentage": 0.00,
  "discount_percentage": 10.00,
  "start_date": "2024-01-01",
  "end_date": null
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_id` | UUID | Yes | Store ID |
| `return_status` | Enum | Yes | PARTIAL_DELIVERY, EXCHANGE, RETURNED, PAID_RETURN |
| `zone` | Enum | Yes | INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA |
| `return_delivery_charge` | Decimal | Yes | Base return delivery charge |
| `return_weight_charge_per_kg` | Decimal | Yes | Charge per kg for return |
| `return_cod_percentage` | Decimal | No | COD percentage (0-100) |
| `discount_percentage` | Decimal | No | Discount percentage (0-100) |
| `start_date` | Date | No | When this config becomes active |
| `end_date` | Date | No | When this config expires |

### Response

```json
{
  "id": "config-uuid-123",
  "store_id": "store-uuid-456",
  "return_status": "RETURNED",
  "zone": "INSIDE_DHAKA",
  "return_delivery_charge": 50.00,
  "return_weight_charge_per_kg": 15.00,
  "return_cod_percentage": 0.00,
  "discount_percentage": 10.00,
  "start_date": "2024-01-01T00:00:00.000Z",
  "end_date": null,
  "created_at": "2024-12-22T10:00:00.000Z",
  "updated_at": "2024-12-22T10:00:00.000Z"
}
```

---

## 2️⃣ Bulk Create Return Charges (Recommended)

**POST** `/pricing/return-charges/bulk`

**Authorization**: Admin Only

**Description**: Create return charge configurations for multiple statuses at once. This is the recommended way to set up return charges for a store.

### Request Body

```json
{
  "store_id": "store-uuid-456",
  "zone": "INSIDE_DHAKA",
  "status_charges": [
    {
      "return_status": "PARTIAL_DELIVERY",
      "return_delivery_charge": 40.00,
      "return_weight_charge_per_kg": 10.00,
      "return_cod_percentage": 0.00,
      "discount_percentage": 5.00
    },
    {
      "return_status": "EXCHANGE",
      "return_delivery_charge": 30.00,
      "return_weight_charge_per_kg": 8.00,
      "return_cod_percentage": 0.00
    },
    {
      "return_status": "RETURNED",
      "return_delivery_charge": 50.00,
      "return_weight_charge_per_kg": 12.00,
      "return_cod_percentage": 0.00
    },
    {
      "return_status": "PAID_RETURN",
      "return_delivery_charge": 45.00,
      "return_weight_charge_per_kg": 11.00,
      "return_cod_percentage": 1.00
    }
  ],
  "start_date": "2024-01-01",
  "end_date": null
}
```

### Important Notes

- **Empty = No Charge**: If all charge fields are 0 or empty for a status, that status will be skipped
- **Multiple Statuses**: You can configure 1 to 4 statuses in a single request
- **Zone-Specific**: Each zone requires a separate bulk create request

### Response

```json
[
  {
    "id": "config-uuid-1",
    "store_id": "store-uuid-456",
    "return_status": "PARTIAL_DELIVERY",
    "zone": "INSIDE_DHAKA",
    "return_delivery_charge": 40.00,
    "return_weight_charge_per_kg": 10.00,
    "return_cod_percentage": 0.00,
    "discount_percentage": 5.00,
    "created_at": "2024-12-22T10:00:00.000Z",
    "updated_at": "2024-12-22T10:00:00.000Z"
  },
  {
    "id": "config-uuid-2",
    "store_id": "store-uuid-456",
    "return_status": "EXCHANGE",
    "zone": "INSIDE_DHAKA",
    "return_delivery_charge": 30.00,
    "return_weight_charge_per_kg": 8.00,
    "return_cod_percentage": 0.00,
    "created_at": "2024-12-22T10:00:00.000Z",
    "updated_at": "2024-12-22T10:00:00.000Z"
  }
  // ... more configs
]
```

---

## 3️⃣ Get All Return Charges (Admin)

**GET** `/pricing/return-charges`

**Authorization**: Admin Only

**Description**: Get all return charge configurations across all stores.

### Response

```json
[
  {
    "id": "config-uuid-1",
    "store_id": "store-uuid-456",
    "return_status": "RETURNED",
    "zone": "INSIDE_DHAKA",
    "return_delivery_charge": 50.00,
    "return_weight_charge_per_kg": 15.00,
    "return_cod_percentage": 0.00,
    "discount_percentage": null,
    "start_date": null,
    "end_date": null,
    "created_at": "2024-12-22T10:00:00.000Z",
    "updated_at": "2024-12-22T10:00:00.000Z",
    "store": {
      "id": "store-uuid-456",
      "business_name": "ABC Store",
      // ... other store fields
    }
  }
  // ... more configs
]
```

---

## 4️⃣ Get Return Charges for a Store

**GET** `/pricing/return-charges/store/:storeId`

**Authorization**: Admin, Merchant

**Description**: Get all return charge configurations for a specific store.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `storeId` | UUID | Store ID |

### Example Request

```
GET /pricing/return-charges/store/store-uuid-456
Authorization: Bearer <token>
```

### Response

```json
[
  {
    "id": "config-uuid-1",
    "store_id": "store-uuid-456",
    "return_status": "PARTIAL_DELIVERY",
    "zone": "INSIDE_DHAKA",
    "return_delivery_charge": 40.00,
    "return_weight_charge_per_kg": 10.00,
    "return_cod_percentage": 0.00,
    "created_at": "2024-12-22T10:00:00.000Z",
    "updated_at": "2024-12-22T10:00:00.000Z"
  },
  {
    "id": "config-uuid-2",
    "store_id": "store-uuid-456",
    "return_status": "RETURNED",
    "zone": "INSIDE_DHAKA",
    "return_delivery_charge": 50.00,
    "return_weight_charge_per_kg": 12.00,
    "return_cod_percentage": 0.00,
    "created_at": "2024-12-22T10:00:00.000Z",
    "updated_at": "2024-12-22T10:00:00.000Z"
  }
  // ... grouped by zone and status
]
```

---

## 5️⃣ Get Single Return Charge Configuration

**GET** `/pricing/return-charges/:id`

**Authorization**: Admin Only

**Description**: Get a specific return charge configuration by ID.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Configuration ID |

### Example Request

```
GET /pricing/return-charges/config-uuid-123
Authorization: Bearer <admin_token>
```

### Response

```json
{
  "id": "config-uuid-123",
  "store_id": "store-uuid-456",
  "return_status": "RETURNED",
  "zone": "INSIDE_DHAKA",
  "return_delivery_charge": 50.00,
  "return_weight_charge_per_kg": 15.00,
  "return_cod_percentage": 0.00,
  "discount_percentage": 10.00,
  "start_date": "2024-01-01T00:00:00.000Z",
  "end_date": null,
  "created_at": "2024-12-22T10:00:00.000Z",
  "updated_at": "2024-12-22T10:00:00.000Z",
  "store": {
    "id": "store-uuid-456",
    "business_name": "ABC Store",
    // ... other store fields
  }
}
```

---

## 6️⃣ Update Return Charge Configuration

**PATCH** `/pricing/return-charges/:id`

**Authorization**: Admin Only

**Description**: Update an existing return charge configuration.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Configuration ID |

### Request Body (Partial)

```json
{
  "return_delivery_charge": 55.00,
  "return_weight_charge_per_kg": 20.00,
  "discount_percentage": 15.00
}
```

### Response

```json
{
  "id": "config-uuid-123",
  "store_id": "store-uuid-456",
  "return_status": "RETURNED",
  "zone": "INSIDE_DHAKA",
  "return_delivery_charge": 55.00,
  "return_weight_charge_per_kg": 20.00,
  "return_cod_percentage": 0.00,
  "discount_percentage": 15.00,
  "start_date": "2024-01-01T00:00:00.000Z",
  "end_date": null,
  "created_at": "2024-12-22T10:00:00.000Z",
  "updated_at": "2024-12-22T12:00:00.000Z"
}
```

---

## 7️⃣ Delete Return Charge Configuration

**DELETE** `/pricing/return-charges/:id`

**Authorization**: Admin Only

**Description**: Delete a return charge configuration.

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Configuration ID |

### Example Request

```
DELETE /pricing/return-charges/config-uuid-123
Authorization: Bearer <admin_token>
```

### Response

```
Status: 200 OK
(No content)
```

---

## 💡 Usage Scenarios

### Scenario 1: Setting Up Return Charges for a New Store

1. Admin creates pricing for INSIDE_DHAKA zone
2. Admin creates pricing for SUB_DHAKA zone
3. Admin creates pricing for OUTSIDE_DHAKA zone

**Example for INSIDE_DHAKA:**

```bash
curl -X POST http://localhost:3000/pricing/return-charges/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "store_id": "store-uuid-456",
    "zone": "INSIDE_DHAKA",
    "status_charges": [
      {
        "return_status": "PARTIAL_DELIVERY",
        "return_delivery_charge": 40.00,
        "return_weight_charge_per_kg": 10.00,
        "return_cod_percentage": 0.00
      },
      {
        "return_status": "EXCHANGE",
        "return_delivery_charge": 30.00,
        "return_weight_charge_per_kg": 8.00,
        "return_cod_percentage": 0.00
      },
      {
        "return_status": "RETURNED",
        "return_delivery_charge": 50.00,
        "return_weight_charge_per_kg": 12.00,
        "return_cod_percentage": 0.00
      },
      {
        "return_status": "PAID_RETURN",
        "return_delivery_charge": 45.00,
        "return_weight_charge_per_kg": 11.00,
        "return_cod_percentage": 1.00
      }
    ]
  }'
```

---

### Scenario 2: Configuring Only Specific Statuses

If a store only wants charges for **RETURNED** status:

```json
{
  "store_id": "store-uuid-456",
  "zone": "INSIDE_DHAKA",
  "status_charges": [
    {
      "return_status": "RETURNED",
      "return_delivery_charge": 50.00,
      "return_weight_charge_per_kg": 12.00,
      "return_cod_percentage": 0.00
    }
  ]
}
```

Other statuses will have **no return charges** applied.

---

### Scenario 3: Updating Charges for a Specific Status

```bash
# First, get the config ID for RETURNED status
GET /pricing/return-charges/store/store-uuid-456

# Then update it
PATCH /pricing/return-charges/<config-id>
{
  "return_delivery_charge": 60.00
}
```

---

## 🔍 How Charges Are Applied

When a return parcel is created, the system:

1. **Identifies** the return status (PARTIAL_DELIVERY, EXCHANGE, etc.)
2. **Determines** the zone (INSIDE_DHAKA, SUB_DHAKA, OUTSIDE_DHAKA)
3. **Looks up** the active return charge configuration
4. **Calculates** the total return charge:

```
Return Charge = return_delivery_charge 
              + (parcel_weight × return_weight_charge_per_kg)
              + (cod_amount × return_cod_percentage / 100)
```

5. **Applies discount** if configured:

```
Final Charge = Return Charge × (1 - discount_percentage / 100)
```

---

## ⚠️ Important Notes

1. **Unique Constraint**: Only ONE configuration per `(store_id, return_status, zone)` combination
2. **Cascade Delete**: Deleting a store will delete all its return charge configs
3. **Zero Values**: If all charge values are 0, no charge is applied
4. **Date Validity**: Configs with future `start_date` or past `end_date` won't be applied
5. **COD Percentage**: Optional, typically used for PAID_RETURN status

---

## 🧪 Testing Guide

### Test 1: Bulk Create for All Statuses

```bash
curl -X POST http://localhost:3000/pricing/return-charges/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d @test-data/bulk-return-charges.json
```

### Test 2: Verify Configurations

```bash
curl -X GET http://localhost:3000/pricing/return-charges/store/<store-id> \
  -H "Authorization: Bearer <merchant_token>"
```

### Test 3: Update a Configuration

```bash
curl -X PATCH http://localhost:3000/pricing/return-charges/<config-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"return_delivery_charge": 60.00}'
```

### Test 4: Delete a Configuration

```bash
curl -X DELETE http://localhost:3000/pricing/return-charges/<config-id> \
  -H "Authorization: Bearer <admin_token>"
```

---

## 📊 Sample Data

### Complete Setup for 3 Zones

```json
// INSIDE_DHAKA
{
  "store_id": "store-uuid-456",
  "zone": "INSIDE_DHAKA",
  "status_charges": [
    {
      "return_status": "PARTIAL_DELIVERY",
      "return_delivery_charge": 40.00,
      "return_weight_charge_per_kg": 10.00
    },
    {
      "return_status": "EXCHANGE",
      "return_delivery_charge": 30.00,
      "return_weight_charge_per_kg": 8.00
    },
    {
      "return_status": "RETURNED",
      "return_delivery_charge": 50.00,
      "return_weight_charge_per_kg": 12.00
    },
    {
      "return_status": "PAID_RETURN",
      "return_delivery_charge": 45.00,
      "return_weight_charge_per_kg": 11.00,
      "return_cod_percentage": 1.00
    }
  ]
}

// SUB_DHAKA
{
  "store_id": "store-uuid-456",
  "zone": "SUB_DHAKA",
  "status_charges": [
    {
      "return_status": "PARTIAL_DELIVERY",
      "return_delivery_charge": 50.00,
      "return_weight_charge_per_kg": 12.00
    },
    {
      "return_status": "EXCHANGE",
      "return_delivery_charge": 40.00,
      "return_weight_charge_per_kg": 10.00
    },
    {
      "return_status": "RETURNED",
      "return_delivery_charge": 60.00,
      "return_weight_charge_per_kg": 15.00
    },
    {
      "return_status": "PAID_RETURN",
      "return_delivery_charge": 55.00,
      "return_weight_charge_per_kg": 13.00,
      "return_cod_percentage": 1.00
    }
  ]
}

// OUTSIDE_DHAKA
{
  "store_id": "store-uuid-456",
  "zone": "OUTSIDE_DHAKA",
  "status_charges": [
    {
      "return_status": "PARTIAL_DELIVERY",
      "return_delivery_charge": 70.00,
      "return_weight_charge_per_kg": 18.00
    },
    {
      "return_status": "EXCHANGE",
      "return_delivery_charge": 60.00,
      "return_weight_charge_per_kg": 15.00
    },
    {
      "return_status": "RETURNED",
      "return_delivery_charge": 80.00,
      "return_weight_charge_per_kg": 20.00
    },
    {
      "return_status": "PAID_RETURN",
      "return_delivery_charge": 75.00,
      "return_weight_charge_per_kg": 18.00,
      "return_cod_percentage": 1.00
    }
  ]
}
```

---

## 🎯 Summary

The Return Charge Configuration system provides:

✅ **Flexible Pricing** - Different charges per status and zone  
✅ **Easy Setup** - Bulk creation for all statuses at once  
✅ **Optional Charges** - Configure only what you need  
✅ **Time-Based** - Schedule pricing changes in advance  
✅ **Comprehensive API** - Full CRUD operations  
✅ **Role-Based Access** - Admin control with merchant visibility  

For questions or issues, please contact the development team.

