# Hub Panel Dashboard Parcel API Documentation

## Overview
This document covers the Hub Panel dashboard parcel details and related managerial action endpoints.

Target UI flow:
1. Hub Manager opens Dashboard parcel list.
2. Clicks a parcel row/card.
3. Frontend calls detail API to render:
   - Parcel Id
   - Merchant Info
   - Assigned Rider
   - Customer Info
   - Live Status and Controls
   - Package Information
   - Financial Summary
   - Parcel Details
4. Frontend uses action endpoints based on enabled controls.

---

## Authentication and Access Control
- Guard: JWT + Role guard
- Role required: HUB_MANAGER
- Hub scope: Hub manager can only access parcels/staff in own hub scope.

If hub manager account has no hub assigned:
- HTTP 400
- Message: Your account is not assigned to any hub. Please contact admin.

---

## 1) Dashboard Parcel Detail API

### Endpoint
GET /hubs/dashboard/parcels/:id

### Purpose
Return dashboard-ready grouped response for one parcel.

### Path Params
- id (required, UUID): Parcel ID

### Query Params
- None

### Request Body
- None

### Example Request
GET /hubs/dashboard/parcels/8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d
Authorization: Bearer <hub_manager_access_token>

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "parcel_id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "tracking_number": "TRK-20260407-10021",
    "merchant_info": {
      "merchant_id": "4d884b88-9a84-4f50-95a8-8dcbf55ea0d4",
      "merchant_name": "Mir Abdur Chowdhury",
      "store_name": "Chowdhury Electronics",
      "phone": "+88 01712 456 678",
      "address": "Shop 15, Electronic Market, Sector 18, Uttora"
    },
    "assigned_rider": {
      "rider_id": "f4264f43-24b4-49e9-b349-4e992adce2d4",
      "rider_name": "Rakib Hasan",
      "phone": "+88 01811 223 344",
      "bike_type": "BIKE"
    },
    "customer_info": {
      "customer_id": "71dc4eb0-6f52-4d01-af0d-f9365304e8fa",
      "customer_name": "Nazmul Karim",
      "phone": "+88 01966 778 899",
      "secondary_phone": null,
      "address": "Sector 18, Uttora, Dhaka"
    },
    "live_status_controls": {
      "current_status": "IN_TRANSIT",
      "managerial_actions": [
        {
          "key": "UPDATE_STATUS_MANUALLY",
          "enabled": false,
          "endpoint": null,
          "note": "No generic manual status endpoint exists for hub managers"
        },
        {
          "key": "REASSIGN_RIDER",
          "enabled": false,
          "method": "POST",
          "endpoint": "/hubs/parcels/assign-rider"
        },
        {
          "key": "RESCHEDULE_DELIVERY",
          "enabled": true,
          "method": "PATCH",
          "endpoint": "/hubs/parcels/8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d/reschedule-delivery"
        },
        {
          "key": "RETURN_TO_MERCHANT",
          "enabled": false,
          "method": "PATCH",
          "endpoint": "/hubs/parcels/8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d/return-to-merchant"
        },
        {
          "key": "CANCEL_DELIVERY",
          "enabled": false,
          "endpoint": null,
          "note": "No dedicated cancel-delivery endpoint exists for hub managers"
        }
      ]
    },
    "package_information": {
      "product_description": "Mobile accessories",
      "special_instructions": "Call before delivery",
      "admin_notes": null
    },
    "financial_summary": {
      "cod_amount": 1250,
      "delivery_charge": 80,
      "weight_charge": 80,
      "cod_charge": 0,
      "discount": 0,
      "total_charge": 122,
      "total_payable": 1128
    },
    "parcel_details": {
      "parcel_weight": 2.5,
      "parcel_type": "ACCESSORIES",
      "delivery_type": "EXPRESS",
      "is_cod": true,
      "is_exchange": false
    }
  },
  "message": "Hub dashboard parcel detail retrieved successfully"
}
```

### Response Variant: Unassigned Rider
```json
{
  "success": true,
  "data": {
    "assigned_rider": null
  },
  "message": "Hub dashboard parcel detail retrieved successfully"
}
```

### Error Responses

#### 400 - Invalid UUID
```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

#### 400 - Hub manager not linked to hub
```json
{
  "statusCode": 400,
  "message": "Your account is not assigned to any hub. Please contact admin.",
  "error": "Bad Request"
}
```

#### 403 - Out of scope parcel
```json
{
  "statusCode": 403,
  "message": "You do not have permission to view this parcel",
  "error": "Forbidden"
}
```

#### 404 - Parcel not found
```json
{
  "statusCode": 404,
  "message": "Parcel not found",
  "error": "Not Found"
}
```

---

## 2) Dashboard Parcel List Source API

### Endpoint
GET /hubs/parcels

### Purpose
Used to render parcel list/table before opening parcel detail drawer/page.

### Query Params
- status (optional, enum ParcelStatus)
- page (optional, default from pagination config)
- limit (optional)
- sortBy (optional)
- order (optional: ASC or DESC)

### Example Request
GET /hubs/parcels?status=IN_TRANSIT&page=1&limit=20

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
        "tracking_number": "TRK-20260407-10021",
        "status": "IN_TRANSIT",
        "customer_name": "Nazmul Karim",
        "customer_phone": "+88 01966 778 899",
        "customer_address": "Sector 18, Uttora, Dhaka",
        "cod_amount": 1250,
        "delivery_charge": 80,
        "weight_charge": 80,
        "total_charge": 122,
        "assigned_rider_id": "f4264f43-24b4-49e9-b349-4e992adce2d4"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Parcels retrieved successfully"
}
```

---

## 3) Managerial Actions from Dashboard Controls

## 3.1 Reassign Rider

### Endpoint
POST /hubs/parcels/assign-rider

### Purpose
Assign or reassign parcel(s) to rider.

### Request Body Variants

### Variant A: Single parcel assignment
```json
{
  "rider_id": "6c9f1d6e-6a21-49f8-a8d1-f62ea61d476a",
  "parcel_id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
  "notes": "Urgent reassignment"
}
```

### Variant B: Bulk assignment
```json
{
  "rider_id": "6c9f1d6e-6a21-49f8-a8d1-f62ea61d476a",
  "parcel_ids": [
    "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "10d4d4b4-7f85-45e9-a778-2b38a56f9630"
  ],
  "notes": "Bulk reassignment"
}
```

### Variant C: Both provided (parcel_ids takes priority)
```json
{
  "rider_id": "6c9f1d6e-6a21-49f8-a8d1-f62ea61d476a",
  "parcel_id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
  "parcel_ids": [
    "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "10d4d4b4-7f85-45e9-a778-2b38a56f9630"
  ]
}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 2,
      "failed": 0
    },
    "results": [
      {
        "parcel_id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
        "success": true,
        "message": "Assigned successfully"
      },
      {
        "parcel_id": "10d4d4b4-7f85-45e9-a778-2b38a56f9630",
        "success": true,
        "message": "Assigned successfully"
      }
    ]
  },
  "message": "2 parcels assigned to rider successfully"
}
```

### Error Response Example (400)
```json
{
  "statusCode": 400,
  "message": [
    "Each parcel ID must be a valid UUID"
  ],
  "error": "Bad Request"
}
```

---

## 3.2 Reschedule Delivery

### Endpoint
PATCH /hubs/parcels/:id/reschedule-delivery

### Purpose
Mark parcel as DELIVERY_RESCHEDULED.

### Request Body
- None

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "status": "DELIVERY_RESCHEDULED",
    "reschedule_count": 1,
    "updated_at": "2026-04-07T11:20:10.000Z"
  },
  "message": "Parcel marked for redelivery. It will appear in rescheduled list."
}
```

### Error Response Example (400)
```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

---

## 3.3 Return to Merchant

### Endpoint
PATCH /hubs/parcels/:id/return-to-merchant

### Purpose
Create return parcel and mark original flow for merchant return journey.

### Request Body Variants

### Variant A: Without notes
```json
{}
```

### Variant B: With notes
```json
{
  "notes": "Customer repeatedly unreachable. Returning to merchant."
}
```

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "original_parcel": {
      "id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
      "status": "RETURN_TO_MERCHANT"
    },
    "return_parcel": {
      "id": "b22fc93d-fb39-4b72-bd19-5f839dd9818d",
      "status": "IN_HUB",
      "original_parcel_id": "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
      "is_return_parcel": true
    }
  },
  "message": "Return parcel created. Assign to rider for delivery back to merchant."
}
```

---

## 3.4 Bulk Dashboard Actions (optional multi-select UX)

## Bulk return to merchant
POST /hubs/parcels/bulk-return-to-merchant

Body:
```json
{
  "parcel_ids": [
    "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "10d4d4b4-7f85-45e9-a778-2b38a56f9630"
  ]
}
```

Success:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 2,
      "failed": 0
    },
    "results": []
  },
  "message": "2 parcels marked for return to merchant"
}
```

## Bulk reschedule delivery
POST /hubs/parcels/bulk-reschedule-delivery

Body:
```json
{
  "parcel_ids": [
    "8d1b8ea8-2f84-4a35-b6b8-c5b7f3ea8c6d",
    "10d4d4b4-7f85-45e9-a778-2b38a56f9630"
  ]
}
```

Success:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 2,
      "failed": 0
    },
    "results": []
  },
  "message": "2 parcels marked for rescheduled delivery"
}
```

---

## 4) Actions Not Currently Implemented for Hub Manager

The dashboard control metadata intentionally marks these as disabled:
1. UPDATE_STATUS_MANUALLY
2. CANCEL_DELIVERY

Current API state:
- No generic hub manager manual status update endpoint.
- No dedicated hub manager cancel delivery endpoint.

UI recommendation:
- Render disabled button using managerial_actions.enabled.
- Show managerial_actions.note as tooltip/help text.

---

## 5) UI Field Mapping for Your Dashboard

### Parcel Id
- data.parcel_id
- data.tracking_number

### Merchant Info
- data.merchant_info.merchant_name
- data.merchant_info.store_name
- data.merchant_info.phone
- data.merchant_info.address
- Call Merchant button: tel:<merchant_info.phone>

### Assigned Rider
- data.assigned_rider.rider_name
- data.assigned_rider.phone
- data.assigned_rider.bike_type
- If null, show: Not assigned yet

### Customer Info
- data.customer_info.customer_name
- data.customer_info.phone
- data.customer_info.secondary_phone
- data.customer_info.address

### Live Status and Controls
- Current status: data.live_status_controls.current_status
- Action list: data.live_status_controls.managerial_actions

### Package Information
- data.package_information.product_description
- data.package_information.special_instructions
- data.package_information.admin_notes

### Financial Summary
- data.financial_summary.cod_amount
- data.financial_summary.delivery_charge
- data.financial_summary.weight_charge
- data.financial_summary.discount
- data.financial_summary.total_payable

Formula used in API:
- total_payable = cod_amount - total_charge

### Parcel Details
- data.parcel_details.parcel_weight
- data.parcel_details.parcel_type
- data.parcel_details.delivery_type

---

## 6) Quick Postman Collection Entries

1. GET /hubs/parcels
2. GET /hubs/dashboard/parcels/:id
3. POST /hubs/parcels/assign-rider
4. PATCH /hubs/parcels/:id/reschedule-delivery
5. PATCH /hubs/parcels/:id/return-to-merchant
6. POST /hubs/parcels/bulk-reschedule-delivery
7. POST /hubs/parcels/bulk-return-to-merchant

All requests require HUB_MANAGER bearer token.
