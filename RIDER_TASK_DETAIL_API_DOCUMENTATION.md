# Rider Task Detail API Documentation

## Overview
These APIs are used by the Rider app task screens to open a single item and view full details.

Supported drill-down flows:
- Pending/Completed Pickup request detail
- Pending/Completed Delivery parcel detail
- Pending/Completed Return parcel detail

## Auth
- Bearer token required
- Role: RIDER

## Endpoint List
- GET {{baseUrl}}/riders/pickups/:id
- GET {{baseUrl}}/riders/deliveries/:id
- GET {{baseUrl}}/riders/returns/:id

---

## 1) Pickup Request Detail

### Endpoint
GET {{baseUrl}}/riders/pickups/:id

### Path Param
- id: Pickup Request UUID

### Query Param
- tab (optional): pending | completed | all
- default: all

### Tab Rules
- tab=pending: only pickup requests with status CONFIRMED assigned to this rider.
- tab=completed: only pickup requests with status PICKED_UP completed by this rider.
- tab=all: rider can view if either pending-for-rider or completed-by-rider.

### Request Body Variants
This is a GET endpoint, so request body is not used.

#### Variant 1: Pending pickup detail
Request URL:
GET {{baseUrl}}/riders/pickups/6b66dd59-5904-44ad-aa10-9157061abfaa?tab=pending

Body:
None

#### Variant 2: Completed pickup detail
Request URL:
GET {{baseUrl}}/riders/pickups/6b66dd59-5904-44ad-aa10-9157061abfaa?tab=completed

Body:
None

#### Variant 3: Auto mode (all)
Request URL:
GET {{baseUrl}}/riders/pickups/6b66dd59-5904-44ad-aa10-9157061abfaa?tab=all

Body:
None

### Success Response Example (200)
```json
{
  "success": true,
  "data": {
    "id": "6b66dd59-5904-44ad-aa10-9157061abfaa",
    "request_code": "REQ-2088",
    "pickup_count": 7,
    "status": "CONFIRMED",
    "comment": "Collect before 5 PM",
    "created_at": "2026-04-07T09:10:00.000Z",
    "store": {
      "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
      "business_name": "Shafa Mart",
      "phone_number": "01700000000",
      "business_address": "Uttara, Dhaka"
    },
    "assigned_rider": {
      "id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
      "full_name": "Rakib Hasan",
      "phone": "01800000000"
    },
    "merchant_id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b",
    "store_id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
    "hub_id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
    "assigned_rider_id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
    "completed_by_rider_id": null,
    "actual_parcels": 0,
    "picked_up_count": 0,
    "requested_at": "2026-04-07T09:10:00.000Z",
    "confirmed_at": "2026-04-07T09:30:00.000Z",
    "picked_up_at": null,
    "cancelled_at": null,
    "updated_at": "2026-04-07T09:30:00.000Z",
    "merchant": {
      "id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b",
      "user_id": "3a741b8c-f4ff-4a18-9bde-2adf2439ce07",
      "thana": "Uttara",
      "district": "Dhaka",
      "full_address": "House 12, Road 5, Uttara",
      "secondary_number": null,
      "status": "APPROVED",
      "is_advance_payment_disabled": false,
      "approved_at": "2026-03-01T11:00:00.000Z",
      "approved_by": "0df3f4da-5f61-43c1-9b44-cfdcb7351ef2",
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-04-01T08:00:00.000Z",
      "user": {
        "id": "3a741b8c-f4ff-4a18-9bde-2adf2439ce07",
        "full_name": "Shafa Merchant",
        "phone": "01900000000",
        "email": "merchant@example.com",
        "role": "MERCHANT",
        "is_active": true,
        "created_at": "2026-01-10T08:00:00.000Z",
        "updated_at": "2026-04-01T08:00:00.000Z"
      }
    },
    "hub": {
      "id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
      "hub_code": "HUB-UTT-01",
      "branch_name": "Uttara Hub",
      "area": "Uttara",
      "address": "Sector 7, Dhaka",
      "manager_name": "Hub Manager",
      "manager_phone": "01600000000",
      "manager_user_id": "e4ac3fa2-a6a8-4dd6-a43f-7c1d87ca1b9b",
      "status": "ACTIVE",
      "is_active": true,
      "created_at": "2025-12-01T10:00:00.000Z",
      "updated_at": "2026-04-01T09:00:00.000Z"
    },
    "assigned_rider_full": {
      "id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
      "rider_code": "RDR-1102",
      "user_id": "d805f95a-2f11-4308-890e-99f768f5fbce",
      "hub_id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
      "photo": null,
      "guardian_mobile_no": "01711111111",
      "bike_type": "Bike",
      "nid_number": "1234567890",
      "license_no": "DL-2026-1234",
      "present_address": "Mirpur, Dhaka",
      "permanent_address": "Rajshahi",
      "fixed_salary": 0,
      "commission_per_delivery": 20,
      "bank_name": null,
      "bank_account_number": null,
      "bank_branch": null,
      "nid_front_photo": null,
      "nid_back_photo": null,
      "license_front_photo": null,
      "license_back_photo": null,
      "parent_nid_front_photo": null,
      "parent_nid_back_photo": null,
      "approval_status": "APPROVED",
      "approved_at": "2026-03-10T12:00:00.000Z",
      "approved_by": "0df3f4da-5f61-43c1-9b44-cfdcb7351ef2",
      "is_active": true,
      "created_at": "2026-03-01T12:00:00.000Z",
      "updated_at": "2026-04-07T08:00:00.000Z",
      "user": {
        "id": "d805f95a-2f11-4308-890e-99f768f5fbce",
        "full_name": "Rakib Hasan",
        "phone": "01800000000",
        "email": "rakib@example.com",
        "role": "RIDER",
        "is_active": true,
        "created_at": "2026-03-01T12:00:00.000Z",
        "updated_at": "2026-04-07T08:00:00.000Z"
      },
      "hub": {
        "id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
        "hub_code": "HUB-UTT-01",
        "branch_name": "Uttara Hub",
        "area": "Uttara",
        "address": "Sector 7, Dhaka",
        "manager_name": "Hub Manager",
        "manager_phone": "01600000000",
        "manager_user_id": "e4ac3fa2-a6a8-4dd6-a43f-7c1d87ca1b9b",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2025-12-01T10:00:00.000Z",
        "updated_at": "2026-04-01T09:00:00.000Z"
      },
      "approver": {
        "id": "0df3f4da-5f61-43c1-9b44-cfdcb7351ef2",
        "full_name": "Admin User",
        "phone": "01500000000",
        "email": "admin@example.com",
        "role": "ADMIN",
        "is_active": true,
        "created_at": "2025-11-01T09:00:00.000Z",
        "updated_at": "2026-04-01T09:00:00.000Z"
      }
    },
    "completed_by_rider": null,
    "parcels": [
      {
        "id": "b1f27f93-5eb6-4b2c-a0fd-4f713f8e6f09",
        "parcel_tx_id": "#140021",
        "tracking_number": "TRK-20260407-0011",
        "status": "PENDING",
        "total_charge": 120,
        "cod_amount": 1000,
        "is_cod": true,
        "created_at": "2026-04-07T09:12:00.000Z",
        "updated_at": "2026-04-07T09:12:00.000Z"
      }
    ]
  },
  "message": "Pickup request details retrieved successfully"
}
```

### Error Response Examples

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 403 Forbidden (tab=pending but not assigned rider)
```json
{
  "statusCode": 403,
  "message": "This pending pickup is not assigned to you",
  "error": "Forbidden"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Pickup request not found",
  "error": "Not Found"
}
```

---

## 2) Delivery Detail

### Endpoint
GET {{baseUrl}}/riders/deliveries/:id

### Path Param
- id: Parcel UUID

### Query Param
- tab (optional): pending | completed | all
- default: all

### Tab Rules
- tab=pending: only ASSIGNED_TO_RIDER
- tab=completed: only DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN
- tab=all: pending + completed statuses above
- For tab=completed, parcel must not be COD-cleared (`cod_cleared_at` must be null)

### Request Body Variants
This is a GET endpoint, so request body is not used.

#### Variant 1: Pending delivery detail
Request URL:
GET {{baseUrl}}/riders/deliveries/9d9be8b0-a64a-43e8-b7b6-1c0f5bd78a84?tab=pending

Body:
None

#### Variant 2: Completed delivery detail
Request URL:
GET {{baseUrl}}/riders/deliveries/9d9be8b0-a64a-43e8-b7b6-1c0f5bd78a84?tab=completed

Body:
None

#### Variant 3: Auto mode (all)
Request URL:
GET {{baseUrl}}/riders/deliveries/9d9be8b0-a64a-43e8-b7b6-1c0f5bd78a84?tab=all

Body:
None

### Success Response Example (200)
```json
{
  "success": true,
  "data": {
    "id": "9d9be8b0-a64a-43e8-b7b6-1c0f5bd78a84",
    "customer_id": "6f7b93f4-4d13-4069-8bb9-f99fdf2d941c",
    "merchant_id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b",
    "store_id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
    "pickup_request_id": "6b66dd59-5904-44ad-aa10-9157061abfaa",
    "parcel_tx_id": "#140045",
    "tracking_number": "TRK-20260407-0045",
    "merchant_order_id": "ORD-45001",
    "delivery_area_text": "Uttara Sector 11",
    "delivery_coverage_area_id": "ba5d3adf-6cc0-4852-9458-a343d13d6ddf",
    "customer_name": "Md. Tamim",
    "customer_phone": "01722222222",
    "customer_secondary_phone": null,
    "customer_address": "House 23, Road 4, Uttara",
    "product_description": "Shoes",
    "product_price": 1400,
    "product_weight": 0.5,
    "parcel_type": "REGULAR",
    "delivery_charge": 80,
    "weight_charge": 20,
    "cod_charge": 10,
    "discount": 0,
    "total_charge": 110,
    "is_cod": true,
    "cod_amount": 1400,
    "is_exchange": false,
    "receivable_amount": 1290,
    "cod_collected_amount": 0,
    "return_charge": 0,
    "delivery_charge_applicable": true,
    "return_charge_applicable": false,
    "financial_status": "PENDING",
    "invoice_id": null,
    "clearance_required": false,
    "clearance_done": false,
    "clearance_invoice_id": null,
    "paid_amount": 0,
    "status": "ASSIGNED_TO_RIDER",
    "payment_status": "UNPAID",
    "paid_to_merchant": false,
    "paid_to_merchant_at": null,
    "cod_cleared_at": null,
    "delivery_type": 0,
    "assigned_rider_id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
    "assigned_at": "2026-04-07T10:00:00.000Z",
    "rider_accepted_at": null,
    "out_for_delivery_at": null,
    "reschedule_count": 0,
    "special_instructions": "Call before arrival",
    "admin_notes": null,
    "return_reason": null,
    "current_hub_id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
    "origin_hub_id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
    "destination_hub_id": null,
    "is_inter_hub_transfer": false,
    "transferred_at": null,
    "received_at_destination_hub": null,
    "transfer_notes": null,
    "delivery_provider": "IN_HOUSE",
    "third_party_provider_id": null,
    "issue_type": null,
    "issue_description": null,
    "issue_reported_by_id": null,
    "issue_reported_at": null,
    "is_issue_resolved": false,
    "carrybee_consignment_id": null,
    "carrybee_delivery_fee": null,
    "carrybee_cod_fee": null,
    "assigned_to_carrybee_at": null,
    "recipient_carrybee_city_id": null,
    "recipient_carrybee_zone_id": null,
    "recipient_carrybee_area_id": null,
    "original_parcel_id": null,
    "is_return_parcel": false,
    "picked_up_at": "2026-04-07T09:40:00.000Z",
    "delivered_at": null,
    "created_at": "2026-04-07T09:12:00.000Z",
    "updated_at": "2026-04-07T10:00:00.000Z",
    "merchant": {
      "id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b"
    },
    "store": {
      "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
      "business_name": "Shafa Mart"
    },
    "customer": {
      "id": "6f7b93f4-4d13-4069-8bb9-f99fdf2d941c"
    },
    "delivery_area": {
      "id": "ba5d3adf-6cc0-4852-9458-a343d13d6ddf",
      "area": "Sector 11",
      "zone": "Uttara",
      "city": "Dhaka",
      "division": "Dhaka"
    },
    "delivery_coverage_area": {
      "id": "ba5d3adf-6cc0-4852-9458-a343d13d6ddf",
      "area": "Sector 11",
      "zone": "Uttara",
      "city": "Dhaka",
      "division": "Dhaka"
    },
    "assigned_rider": {
      "id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87"
    },
    "current_hub": {
      "id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
      "branch_name": "Uttara Hub"
    },
    "origin_hub": {
      "id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
      "branch_name": "Uttara Hub"
    },
    "destination_hub": null,
    "third_party_provider": null
  },
  "message": "Delivery details retrieved successfully"
}
```

### Error Response Examples

#### 400 Bad Request (status does not belong to selected tab)
```json
{
  "statusCode": 400,
  "message": "Parcel status RETURNED is not available in pending delivery tab",
  "error": "Bad Request"
}
```

#### 400 Bad Request (completed but COD already cleared)
```json
{
  "statusCode": 400,
  "message": "This parcel is already cleared and is not available in completed deliveries",
  "error": "Bad Request"
}
```

#### 404 Not Found / not assigned to rider
```json
{
  "statusCode": 404,
  "message": "Parcel not found or not assigned to you",
  "error": "Not Found"
}
```

---

## 3) Return Detail

### Endpoint
GET {{baseUrl}}/riders/returns/:id

### Path Param
- id: Parcel UUID

### Query Param
- tab (optional): pending | completed | all
- default: all

### Tab Rules
- tab=pending: RETURNED, DELIVERY_RESCHEDULED
- tab=completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
- tab=all: pending + completed statuses above

### Request Body Variants
This is a GET endpoint, so request body is not used.

#### Variant 1: Pending return detail
Request URL:
GET {{baseUrl}}/riders/returns/2dd63ef4-93af-4f14-9e58-8c9e2d069d03?tab=pending

Body:
None

#### Variant 2: Completed return detail
Request URL:
GET {{baseUrl}}/riders/returns/2dd63ef4-93af-4f14-9e58-8c9e2d069d03?tab=completed

Body:
None

#### Variant 3: Auto mode (all)
Request URL:
GET {{baseUrl}}/riders/returns/2dd63ef4-93af-4f14-9e58-8c9e2d069d03?tab=all

Body:
None

### Success Response Example (200)
```json
{
  "success": true,
  "data": {
    "id": "2dd63ef4-93af-4f14-9e58-8c9e2d069d03",
    "parcel_tx_id": "#140102",
    "tracking_number": "TRK-20260407-0102",
    "status": "RETURNED",
    "return_reason": "Customer not available",
    "assigned_rider_id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87",
    "assigned_at": "2026-04-07T12:00:00.000Z",
    "cod_amount": 800,
    "total_charge": 90,
    "cod_collected_amount": 0,
    "current_hub_id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
    "picked_up_at": "2026-04-07T10:20:00.000Z",
    "delivered_at": null,
    "created_at": "2026-04-07T09:00:00.000Z",
    "updated_at": "2026-04-07T13:10:00.000Z",
    "merchant": {
      "id": "0dcb7daf-a0d4-44df-b5a1-4de47c0e741b"
    },
    "store": {
      "id": "5bbf388f-6c34-4e88-bfc2-7a16b9f86171",
      "business_name": "Shafa Mart"
    },
    "customer": {
      "id": "9f13d4ad-c7ae-4df5-a12a-43ddf1f3b552"
    },
    "assigned_rider": {
      "id": "7f4e0fb2-0af1-4b1f-a998-8f9d0f291f87"
    },
    "current_hub": {
      "id": "86ecc27a-6e4a-4558-8603-e8bd9e8ec2bc",
      "branch_name": "Uttara Hub"
    }
  },
  "message": "Return details retrieved successfully"
}
```

### Error Response Examples

#### 400 Bad Request (status does not belong to selected tab)
```json
{
  "statusCode": 400,
  "message": "Parcel status ASSIGNED_TO_RIDER is not available in completed return tab",
  "error": "Bad Request"
}
```

#### 404 Not Found / not assigned to rider
```json
{
  "statusCode": 404,
  "message": "Parcel not found or not assigned to you",
  "error": "Not Found"
}
```

---

## Notes for Frontend Integration
- For rider task list screens:
  - Pickups list item click -> call GET /riders/pickups/:id with matching tab.
  - Deliveries list item click -> call GET /riders/deliveries/:id with matching tab.
  - Returns list item click -> call GET /riders/returns/:id with matching tab.
- For best UX consistency, pass the same tab value from the list screen to detail screen.
- If tab is omitted, backend uses all and still enforces rider ownership.
