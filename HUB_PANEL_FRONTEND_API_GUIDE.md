# Hub Panel Frontend API Guide

Scope:
- Complete API documentation for all endpoints exposed by HubsController
- Includes Hub Manager and Admin hub-related routes under /hubs
- Includes request body contracts, query params, and response contracts

Source of truth:
- src/hubs/hubs.controller.ts
- src/hubs/dto/*.ts
- src/parcels/dto/create-parcel.dto.ts
- src/parcels/dto/transfer-parcel.dto.ts
- src/riders/dto/assign-parcel.dto.ts
- src/riders/dto/bulk-assign-parcel.dto.ts

## Base URL and Auth
- Base URL: /hubs
- Auth: Authorization: Bearer <jwt>
- Guards: JwtAuthGuard + RolesGuard

## Role Access Summary
- HUB_MANAGER: Hub panel operational routes
- ADMIN: Hub master management and finance review routes
- HUB_MANAGER + ADMIN: Some shared reporting/list routes

## Standard Error Shapes

401 Unauthorized example:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

400 Validation/Bad request example:
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "2026-04-13T10:30:00.000Z",
  "path": "/hubs/parcels/assign-rider"
}
```

403 Forbidden example:
```json
{
  "statusCode": 403,
  "message": "Forbidden resource"
}
```

404 Not Found example:
```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Parcel not found",
  "timestamp": "2026-04-13T10:30:00.000Z",
  "path": "/hubs/parcels/00000000-0000-0000-0000-000000000000/accept"
}
```

------------------------------------------------------------

# 1) Hub Profile and Hub Master Management

## 1.1 Get My Hub
GET /hubs/my-hub

Access:
- HUB_MANAGER

Query:
- None

Body:
- None

Success response example:
```json
{
  "hub": {
    "id": "d6d01f20-5a41-4f01-80c2-c2da93e074f0",
    "hub_code": "DHK_MAIN",
    "branch_name": "Dhaka Main Hub",
    "area": "Banani",
    "address": "Road 11, Banani, Dhaka",
    "manager_name": "Hub Manager",
    "manager_phone": "01711111111",
    "manager_email": "manager@hub.local",
    "created_at": "2026-01-01T05:10:00.000Z",
    "updated_at": "2026-04-11T08:00:00.000Z"
  },
  "message": "Hub information retrieved successfully"
}
```

## 1.2 Create Hub
POST /hubs

Access:
- ADMIN

Body:
```json
{
  "hub_code": "DHK_MAIN",
  "branch_name": "Dhaka Main Hub",
  "area": "Banani",
  "address": "Road 11, Banani, Dhaka",
  "manager_name": "Hub Manager",
  "manager_phone": "01712345678",
  "manager_email": "hub.manager@company.com",
  "manager_password": "StrongPass1",
  "manager_user_id": "optional-uuid"
}
```

Body rules:
- hub_code optional (auto generated if not sent)
- manager_phone must match BD format: 01[3-9]XXXXXXXX
- manager_password min 8 chars with uppercase + lowercase + number

Success response example (201):
```json
{
  "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
  "hub_code": "DHK_MAIN",
  "message": "Hub created successfully"
}
```

## 1.3 Get All Hubs
GET /hubs

Access:
- ADMIN

Success response example:
```json
{
  "hubs": [
    {
      "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
      "hub_code": "DHK_MAIN",
      "branch_name": "Dhaka Main Hub",
      "area": "Banani",
      "address": "Road 11, Banani",
      "manager_name": "Hub Manager",
      "manager_phone": "01712345678"
    }
  ],
  "total": 1,
  "message": "Hubs retrieved successfully"
}
```

## 1.4 Get Single Hub
GET /hubs/:id

Access:
- ADMIN

Success response example:
```json
{
  "hub": {
    "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
    "hub_code": "DHK_MAIN",
    "branch_name": "Dhaka Main Hub",
    "area": "Banani",
    "address": "Road 11",
    "manager_name": "Hub Manager",
    "manager_phone": "01712345678",
    "manager_email": "hub.manager@company.com",
    "created_at": "2026-01-01T05:10:00.000Z",
    "updated_at": "2026-04-11T08:00:00.000Z"
  },
  "message": "Hub retrieved successfully"
}
```

## 1.5 Update Hub
PATCH /hubs/:id

Access:
- ADMIN

Body (all optional):
```json
{
  "branch_name": "Dhaka North Hub",
  "area": "Uttara",
  "address": "Sector 10",
  "manager_name": "New Manager",
  "manager_phone": "01711112222",
  "manager_user_id": "uuid"
}
```

Success response example:
```json
{
  "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
  "hub_code": "DHK_MAIN",
  "message": "Hub updated successfully"
}
```

## 1.6 Delete Hub
DELETE /hubs/:id

Access:
- ADMIN

Success response:
```json
{
  "message": "Hub deleted successfully"
}
```

## 1.7 Deactivate Hub
PATCH /hubs/:id/deactivate

Access:
- ADMIN

Success response:
```json
{
  "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
  "hub_code": "DHK_MAIN",
  "status": "INACTIVE",
  "is_active": false,
  "message": "Hub deactivated successfully"
}
```

## 1.8 Activate Hub
PATCH /hubs/:id/activate

Access:
- ADMIN

Success response:
```json
{
  "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
  "hub_code": "DHK_MAIN",
  "status": "ACTIVE",
  "is_active": true,
  "message": "Hub activated successfully"
}
```

## 1.9 Decline Hub
PATCH /hubs/:id/decline

Access:
- ADMIN

Success response:
```json
{
  "id": "2f2f540f-8240-4ca5-bb53-7f6f33f754d0",
  "hub_code": "DHK_MAIN",
  "status": "DECLINED",
  "is_active": false,
  "message": "Hub declined permanently"
}
```

------------------------------------------------------------

# 2) Hub Parcel Operations

## 2.1 Delivery Outcomes List
GET /hubs/parcels/delivery-outcomes

Access:
- HUB_MANAGER

Query:
- status: enum (optional) -> PARTIAL_DELIVERY | EXCHANGE | PAID_RETURN | RETURNED
- zone: string (optional)
- merchantId: UUID v4 (optional)
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)

Full endpoint example:
- GET /hubs/parcels/delivery-outcomes?status=RETURNED&zone=Rampura&merchantId=2f2f540f-8240-4ca5-bb53-7f6f33f754d0&page=1&limit=10

Success response shape:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "5e33dfbb-3b07-4ca6-8444-3f71b0dccce0",
        "parcel_id": "5e33dfbb-3b07-4ca6-8444-3f71b0dccce0",
        "parcel_tx_id": "MF130426N1K8",
        "tracking_number": "TRK-20260413-00018",
        "status": "RETURNED",
        "reason": "Customer unavailable for 3 attempts",
        "customer_name": "Aminul Islam",
        "customer_phone": "01730000000",
        "zone": "Rampura, Dhaka South",
        "store": {
          "name": "Daily Needs Mart",
          "phone": "01855555555"
        },
        "cod_breakdown": {
          "cod_amount": 980,
          "cod_collected_amount": 0,
          "delivery_charge": 70,
          "cod_charge": 12,
          "weight_charge": 0,
          "return_charge": 30,
          "total_charge": 112
        },
        "age": {
          "total_age": "2 days 1h",
          "created_at": "2026-04-11T11:10:00.000Z",
          "updated_at": "2026-04-13T09:42:00.000Z"
        }
      }
    ],
    "pagination": {
      "total": 7,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    },
    "summary": {
      "total_collectable_amount": 3840
    }
  },
  "message": "Delivery outcomes retrieved successfully"
}
```

## 2.2 Rider Cleared Deliveries
GET /hubs/parcels/cleared-deliveries

Access:
- HUB_MANAGER

Query:
- rider_id: UUID v4 (required)
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)

Full endpoint example:
- GET /hubs/parcels/cleared-deliveries?rider_id=84af0396-d76e-4a86-9678-318e1c078ad3&page=1&limit=10

Success response shape:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "84af0396-d76e-4a86-9678-318e1c078ad3",
        "parcel_id": "84af0396-d76e-4a86-9678-318e1c078ad3",
        "parcel_tx_id": "MF130426R6V2",
        "tracking_number": "TRK-20260413-00022",
        "status": "DELIVERED",
        "customer_name": "Sharmin Akter",
        "customer_phone": "01740000000",
        "store": {
          "name": "Urban Style",
          "phone": "01922222222"
        },
        "cod_breakdown": {
          "cod_amount": 1600,
          "cod_collected_amount": 1600,
          "delivery_charge": 85,
          "cod_charge": 18,
          "weight_charge": 0,
          "return_charge": 0,
          "total_charge": 103
        }
      }
    ],
    "summary": {
      "total_collectable_amount": 6220,
      "total_cleared_parcels": 5
    },
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Cleared deliveries retrieved successfully"
}
```

Known 400 error:
- rider_id query parameter is required
- Invalid rider_id format. Must be a valid UUID

## 2.3 Carrybee Cleared Deliveries
GET /hubs/parcels/carrybee-cleared-deliveries

Access:
- HUB_MANAGER

Query:
- provider_id: UUID v4 (required)
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)

Full endpoint example:
- GET /hubs/parcels/carrybee-cleared-deliveries?provider_id=4aef2e16-38cb-4e1f-b489-a946f239ab0d&page=1&limit=10

Success response shape:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "4aef2e16-38cb-4e1f-b489-a946f239ab0d",
        "parcel_id": "4aef2e16-38cb-4e1f-b489-a946f239ab0d",
        "parcel_tx_id": "MF130426KX21",
        "tracking_number": "TRK-20260413-00027",
        "status": "PARTIAL_DELIVERY",
        "customer_name": "Tanjim Rahman",
        "customer_phone": "01790000000",
        "store": {
          "name": "Tech Gadget BD",
          "phone": "01744444444"
        },
        "cod_breakdown": {
          "cod_amount": 2300,
          "cod_collected_amount": 1800,
          "delivery_charge": 95,
          "cod_charge": 20,
          "weight_charge": 15,
          "return_charge": 0,
          "total_charge": 130
        }
      }
    ],
    "summary": {
      "total_collectable_amount": 9400,
      "total_cleared_parcels": 9,
      "provider_name": "Carrybee"
    },
    "pagination": {
      "total": 9,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Carrybee cleared deliveries retrieved successfully"
}
```

## 2.4 Rescheduled Deliveries List
GET /hubs/parcels/rescheduled

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 10)

Full endpoint example:
- GET /hubs/parcels/rescheduled?page=1&limit=10

Success response shape:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "f8602ff8-1f07-4f16-b300-2f9eff4d8c62",
        "parcel_id": "f8602ff8-1f07-4f16-b300-2f9eff4d8c62",
        "parcel_tx_id": "MF130426A9X2",
        "tracking_number": "TRK-20260413-00031",
        "status": "DELIVERY_RESCHEDULED",
        "reschedule_count": 2,
        "delivery_date": "2026-04-14T00:00:00.000Z",
        "note": "Customer requested evening delivery"
      }
    ],
    "pagination": {
      "total": 9,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Rescheduled deliveries retrieved successfully"
}
```

Demo response with data:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "f8602ff8-1f07-4f16-b300-2f9eff4d8c62",
        "parcel_id": "f8602ff8-1f07-4f16-b300-2f9eff4d8c62",
        "parcel_tx_id": "MF130426A9X2",
        "tracking_number": "TRK-20260413-00031",
        "status": "DELIVERY_RESCHEDULED",
        "reschedule_count": 2,
        "reason": "Customer asked for evening redelivery",
        "customer_name": "Nusrat Jahan",
        "customer_phone": "01700000000",
        "destination": "House 12, Road 5, Dhanmondi, Dhaka",
        "zone": "Dhanmondi, Dhaka North",
        "store": {
          "name": "Trendy Fashion BD",
          "phone": "01811111111"
        },
        "cod_breakdown": {
          "cod_amount": 1450,
          "cod_collected_amount": 0,
          "delivery_charge": 80,
          "cod_charge": 15,
          "weight_charge": 10,
          "return_charge": 0,
          "total_charge": 105
        },
        "age": {
          "total_age": "1 day 3h",
          "created_at": "2026-04-12T07:25:00.000Z",
          "updated_at": "2026-04-13T10:20:00.000Z"
        }
      },
      {
        "id": "af4a2e7d-266c-4dcc-a115-83b5376d049c",
        "parcel_id": "af4a2e7d-266c-4dcc-a115-83b5376d049c",
        "parcel_tx_id": "MF130426BZ11",
        "tracking_number": "TRK-20260413-00029",
        "status": "DELIVERY_RESCHEDULED",
        "reschedule_count": 1,
        "reason": "Phone unreachable on first attempt",
        "customer_name": "Shakib Hasan",
        "customer_phone": "01900000000",
        "destination": "Flat 4B, Mirpur DOHS, Dhaka",
        "zone": "Mirpur DOHS, Dhaka North",
        "store": {
          "name": "Book Nest",
          "phone": "01722222222"
        },
        "cod_breakdown": {
          "cod_amount": 720,
          "cod_collected_amount": 0,
          "delivery_charge": 60,
          "cod_charge": 8,
          "weight_charge": 0,
          "return_charge": 0,
          "total_charge": 68
        },
        "age": {
          "total_age": "19h",
          "created_at": "2026-04-12T14:05:00.000Z",
          "updated_at": "2026-04-13T09:40:00.000Z"
        }
      }
    ],
    "pagination": {
      "total": 13,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  },
  "message": "Rescheduled deliveries retrieved successfully"
}
```

## 2.5 Return To Merchant List
GET /hubs/parcels/return-to-merchant

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 10)

Full endpoint example:
- GET /hubs/parcels/return-to-merchant?page=1&limit=10

Success response shape:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "2edf8ea1-7374-4550-a20d-e317f53b9d9c",
        "parcel_id": "2edf8ea1-7374-4550-a20d-e317f53b9d9c",
        "parcel_tx_id": "MF1204269LAA",
        "tracking_number": "TRK-20260412-00011",
        "status": "RETURN_TO_MERCHANT",
        "reason": "Customer refused after opening",
        "customer_name": "Mizanur Rahman",
        "customer_phone": "01877777777",
        "store": {
          "name": "Home Living",
          "phone": "01611111111"
        },
        "return_parcel": {
          "id": "b5a7f8f8-2482-45b8-aec4-43ca4d4baf94",
          "parcel_tx_id": "MR130426Q2P1",
          "tracking_number": "RTN-TRK-20260412-00011",
          "status": "IN_HUB"
        }
      }
    ],
    "pagination": {
      "total": 4,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Return to merchant parcels retrieved successfully"
}
```

## 2.6 Mark Parcel Return To Merchant
PATCH /hubs/parcels/:id/return-to-merchant

Access:
- HUB_MANAGER

Body:
```json
{
  "notes": "Optional notes"
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "original_parcel": { "id": "uuid", "status": "RETURN_TO_MERCHANT" },
    "return_parcel": { "id": "uuid", "status": "IN_HUB", "is_return_parcel": true }
  },
  "message": "Return parcel created. Assign to rider for delivery back to merchant."
}
```

## 2.7 Bulk Return To Merchant
POST /hubs/parcels/bulk-return-to-merchant

Access:
- HUB_MANAGER

Body:
```json
{
  "parcel_ids": ["uuid-1", "uuid-2"]
}
```

Success response:
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
      { "parcel_id": "uuid-1", "success": true },
      { "parcel_id": "uuid-2", "success": true }
    ]
  },
  "message": "2 parcels marked for return to merchant"
}
```

## 2.8 Mark Delivery Rescheduled
PATCH /hubs/parcels/:id/reschedule-delivery

Access:
- HUB_MANAGER

Body:
- None

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "DELIVERY_RESCHEDULED",
    "tracking_number": "TRK123"
  },
  "message": "Parcel marked for redelivery. It will appear in rescheduled list."
}
```

## 2.9 Bulk Reschedule Delivery
POST /hubs/parcels/bulk-reschedule-delivery

Access:
- HUB_MANAGER

Body:
```json
{
  "parcel_ids": ["uuid-1", "uuid-2"]
}
```

Success response:
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
      { "parcel_id": "uuid-1", "success": true },
      { "parcel_id": "uuid-2", "success": true }
    ]
  },
  "message": "2 parcels marked for rescheduled delivery"
}
```

## 2.10 Prepare For Redelivery
PATCH /hubs/parcels/:id/prepare-redelivery

Access:
- HUB_MANAGER

Body:
- None

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_HUB",
    "tracking_number": "TRK123"
  },
  "message": "Parcel ready for redelivery. You can now assign it to a rider."
}
```

## 2.11 Hub Parcels List
GET /hubs/parcels

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, tracking_number, parcel_tx_id, customer_name, customer_phone, cod_amount, total_charge, status
- order: enum (optional, default DESC) -> ASC | DESC
- status: ParcelStatus enum (optional)

Full endpoint examples:
- All query params together:
  - GET /hubs/parcels?page=1&limit=20&search=TRK-20260413&sortBy=created_at&order=DESC&status=IN_HUB
- Second page, ascending sort:
  - GET /hubs/parcels?page=2&limit=50&search=0173&sortBy=updated_at&order=ASC&status=ASSIGNED_TO_RIDER

Query validation notes:
- status must be a valid ParcelStatus enum value

Success response example:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "uuid",
        "tracking_number": "TRK123",
        "customer_name": "Customer",
        "customer_phone": "01700000000",
        "status": "IN_HUB",
        "total_charge": 70,
        "cod_amount": 500,
        "store": { "id": "uuid", "business_name": "Main Store" }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Parcels retrieved successfully"
}
```

## 2.12 Hub Dashboard Parcel Detail
GET /hubs/dashboard/parcels/:id

Access:
- HUB_MANAGER

Success response example:
```json
{
  "success": true,
  "data": {
    "parcel_id": "uuid",
    "tracking_number": "TRK123",
    "merchant_info": {
      "merchant_id": "uuid",
      "merchant_name": "Merchant Name",
      "store_name": "Store Name",
      "phone": "01700000000",
      "address": "Dhaka"
    },
    "assigned_rider": {
      "rider_id": "uuid",
      "rider_name": "Rider",
      "phone": "01711111111"
    },
    "customer_info": {
      "customer_id": "uuid",
      "customer_name": "Customer",
      "phone_number": "01722222222",
      "customer_address": "Address"
    },
    "live_status_controls": {
      "current_status": "IN_HUB"
    },
    "package_information": {
      "product_description": "Product",
      "special_instructions": "Call before delivery",
      "admin_notes": null
    },
    "financial_summary": {
      "cod_amount": 500,
      "delivery_charge": 60,
      "weight_charge": 0,
      "cod_charge": 10,
      "discount": 0,
      "total_charge": 70,
      "total_payable": 430
    },
    "parcel_details": {
      "parcel_weight": 1,
      "parcel_type": 1,
      "parcel_type_key": "PARCEL",
      "parcel_type_label": "Parcel",
      "delivery_type": 1,
      "delivery_type_key": "NORMAL",
      "delivery_type_label": "Normal Delivery",
      "is_cod": true,
      "is_exchange": false
    },
    "enum_mappings": {
      "parcel_type": [
        { "value": 1, "key": "PARCEL", "label": "Parcel" },
        { "value": 2, "key": "BOOK", "label": "Book" },
        { "value": 3, "key": "DOCUMENT", "label": "Document" }
      ],
      "delivery_type": [
        { "value": 1, "key": "NORMAL", "label": "Normal Delivery" },
        { "value": 2, "key": "EXPRESS", "label": "Express Delivery" },
        { "value": 3, "key": "SAME_DAY", "label": "Same Day" }
      ]
    }
  },
  "message": "Hub dashboard parcel detail retrieved successfully"
}
```

Known 400 error:
- Your account is not assigned to any hub. Please contact admin.

## 2.13 Get Hub Merchants
GET /hubs/merchants

Access:
- HUB_MANAGER

Success response:
```json
{
  "success": true,
  "data": [
    {
      "merchant_id": "uuid",
      "merchant_name": "Merchant One",
      "store_id": "uuid",
      "store_name": "Store A"
    }
  ],
  "message": "Hub merchants retrieved successfully"
}
```

## 2.14 Create And Receive Parcel
POST /hubs/parcels/create-and-receive

Access:
- HUB_MANAGER

Body (CreateParcelDto):
```json
{
  "merchant_order_id": "ORDER-1001",
  "merchant_id": "optional-uuid",
  "store_id": "optional-uuid",
  "delivery_area": "Banani",
  "delivery_coverage_area_id": "optional-uuid",
  "customer_name": "Customer",
  "customer_phone": "01700000000",
  "customer_secondary_phone": "01700000001",
  "customer_address": "Customer full address",
  "recipient_carrybee_city_id": 1,
  "recipient_carrybee_zone_id": 10,
  "recipient_carrybee_area_id": 100,
  "product_description": "T-shirt",
  "product_price": 500,
  "product_weight": 0.5,
  "parcel_type": 1,
  "delivery_type": 1,
  "is_exchange": false,
  "special_instructions": "Call before delivery"
}
```

Success response (201):
```json
{
  "success": true,
  "data": {
    "parcel": {
      "id": "uuid",
      "tracking_number": "TRK123",
      "merchant_order_id": "ORDER-1001",
      "status": "IN_HUB"
    }
  },
  "message": "Parcel created and received successfully"
}
```

## 2.15 Parcels Awaiting Receipt
GET /hubs/parcels/received

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, tracking_number, parcel_tx_id, customer_name, customer_phone, cod_amount, total_charge, status
- order: enum (optional, default DESC) -> ASC | DESC
- status: ParcelStatus enum (optional)

Full endpoint examples:
- GET /hubs/parcels/received?page=1&limit=20&search=TRK-20260413&sortBy=created_at&order=DESC&status=PENDING
- GET /hubs/parcels/received?page=2&limit=20&search=017&sortBy=updated_at&order=ASC&status=PICKED_UP

Success response:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "43f17894-71a8-4279-8c35-bf7fbabdd5a2",
        "parcel_tx_id": "MF130426AA92",
        "tracking_number": "TRK-20260413-00041",
        "status": "PENDING",
        "customer_name": "Sadia Noor",
        "store": {
          "id": "4fe99f8f-23b8-4cc2-a346-2c6186ec2230",
          "business_name": "Beauty Corner"
        }
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Parcels awaiting receipt retrieved successfully"
}
```

## 2.16 Bulk Receive Parcels
POST /hubs/parcels/receive

Access:
- HUB_MANAGER

Body:
```json
{
  "parcel_ids": ["uuid-1", "uuid-2"]
}
```

Success response:
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
      { "parcel_id": "uuid-1", "success": true },
      { "parcel_id": "uuid-2", "success": true }
    ]
  },
  "message": "2 parcels marked as received successfully"
}
```

## 2.17 Parcels For Assignment
GET /hubs/parcels/for-assignment

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)

Full endpoint example:
- GET /hubs/parcels/for-assignment?page=1&limit=20

Success response:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "fef5a539-1d2b-4fdd-9233-b6fc4f691f87",
        "parcel_tx_id": "MF130426Y8Q1",
        "tracking_number": "TRK-20260413-00052",
        "status": "IN_HUB",
        "customer_name": "Rafi Ahmed"
      }
    ],
    "pagination": {
      "total": 31,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  },
  "message": "Parcels for assignment retrieved successfully"
}
```

## 2.18 Assign Parcel To Rider (Legacy)
PATCH /hubs/parcels/:id/assign-rider

Access:
- HUB_MANAGER

Body:
```json
{
  "rider_id": "uuid",
  "notes": "optional"
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tracking_number": "TRK123",
    "status": "ASSIGNED_TO_RIDER",
    "assigned_rider_id": "uuid"
  },
  "message": "Parcel assigned to rider successfully"
}
```

## 2.19 Assign Parcels To Rider (Unified)
POST /hubs/parcels/assign-rider

Access:
- HUB_MANAGER

Body variants:

Single:
```json
{
  "rider_id": "uuid",
  "parcel_id": "uuid",
  "notes": "optional"
}
```

Bulk:
```json
{
  "rider_id": "uuid",
  "parcel_ids": ["uuid-1", "uuid-2"],
  "notes": "optional"
}
```

Success response:
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
      { "parcel_id": "uuid-1", "success": true },
      { "parcel_id": "uuid-2", "success": true }
    ]
  },
  "message": "2 parcels assigned to rider successfully"
}
```

## 2.20 Hub List For Transfers
GET /hubs/list

Access:
- HUB_MANAGER, ADMIN

Success response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hub_code": "CTG_MAIN",
      "branch_name": "Chattogram Hub",
      "area": "Agrabad",
      "address": "Agrabad",
      "manager_name": "Manager",
      "manager_phone": "01711111111"
    }
  ],
  "message": "Hubs retrieved successfully"
}
```

## 2.21 Bulk Transfer Parcels
PATCH /hubs/parcels/bulk-transfer

Access:
- HUB_MANAGER

Body:
```json
{
  "parcel_ids": ["uuid-1", "uuid-2"],
  "destination_hub_id": "uuid",
  "transfer_notes": "optional"
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "transferred_count": 2,
    "failed_count": 1,
    "errors": [
      {
        "id": "cf067d3f-3f86-4a58-a3f2-77186f4fd8fe",
        "tracking_number": "TRK-20260413-00047",
        "error": "Invalid status: OUT_FOR_DELIVERY. Must be IN_HUB or RETURNED_TO_HUB"
      }
    ]
  },
  "message": "Successfully transferred 2 parcels."
}
```

400 partial-failure example:
```json
{
  "statusCode": 400,
  "message": {
    "message": "Failed to transfer any parcels",
    "errors": ["Parcel uuid-1 is not in transferable status"]
  },
  "error": "Bad Request"
}
```

## 2.22 Transfer Single Parcel
PATCH /hubs/parcels/:id/transfer

Access:
- HUB_MANAGER

Body:
```json
{
  "destination_hub_id": "uuid",
  "transfer_notes": "optional"
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_TRANSIT",
    "destination_hub_id": "uuid"
  },
  "message": "Parcel transferred successfully"
}
```

## 2.23 Incoming Parcels
GET /hubs/parcels/incoming

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)

Full endpoint example:
- GET /hubs/parcels/incoming?page=1&limit=20

Success response:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "5c1624dc-ce89-4e70-8396-2ea3cf2ac6dd",
        "parcel_tx_id": "MF120426T7X9",
        "tracking_number": "TRK-20260412-00008",
        "status": "IN_TRANSIT",
        "origin_hub_id": "85f090f8-495e-4994-acfd-90d4f02f5312",
        "destination_hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758"
      }
    ],
    "total": 6,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "message": "Incoming parcels retrieved successfully"
}
```

## 2.24 Bulk Accept Incoming
PATCH /hubs/parcels/bulk-accept

Access:
- HUB_MANAGER

Body:
```json
{
  "parcel_ids": ["uuid-1", "uuid-2"]
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "accepted_count": 2,
    "failed_count": 1,
    "errors": [
      {
        "id": "b7712a34-e2d5-4dc8-9f12-8f97547ebf0f",
        "tracking_number": "TRK-20260413-00066",
        "error": "Parcel has already been received"
      }
    ]
  },
  "message": "Successfully accepted 2 parcels."
}
```

## 2.25 Accept Single Incoming Parcel
PATCH /hubs/parcels/:id/accept

Access:
- HUB_MANAGER

Body:
- None

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_HUB",
    "tracking_number": "TRK123"
  },
  "message": "Parcel accepted successfully"
}
```

## 2.26 Outgoing Parcels
GET /hubs/parcels/outgoing

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)

Full endpoint example:
- GET /hubs/parcels/outgoing?page=1&limit=20

Success response:
```json
{
  "success": true,
  "data": {
    "parcels": [
      {
        "id": "7a4b3ad4-5da3-4102-88e1-6ed0212eaf33",
        "parcel_tx_id": "MF100426H9P0",
        "tracking_number": "TRK-20260410-00003",
        "status": "IN_TRANSIT",
        "origin_hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758"
      }
    ],
    "total": 14,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "message": "Outgoing parcels retrieved successfully"
}
```

## 2.27 In-Hub and Returned-To-Hub Parcels (Related Endpoint)
GET /parcels/hub/in-hub

Access:
- HUB_MANAGER

Why this matters for Hub Panel:
- Use this list for parcels currently inside hub inventory (IN_HUB and RETURNED_TO_HUB).

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)
- sortBy: string (optional, default created_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /parcels/hub/in-hub?page=1&limit=20&sortBy=created_at&order=DESC

Success response:
```json
{
  "success": true,
  "data": [
    {
      "id": "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
      "parcel_tx_id": "MF1304268JQ2",
      "tracking_number": "TRK-20260413-00063",
      "status": "IN_HUB",
      "product_weight": 1.2,
      "delivery_charge": 90,
      "weight_charge": 25,
      "cod_charge": 15,
      "total_charge": 130
    }
  ],
  "pagination": {
    "total": 57,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "Hub parcels in IN_HUB/RETURNED_TO_HUB retrieved successfully"
}
```

## 2.28 Update Hub Charges (Weight/Delivery Override)
PATCH /parcels/:id/hub-charges

Access:
- HUB_MANAGER
- ADMIN

Body (all optional; send only what you want to override):
```json
{
  "product_weight": 1.5,
  "delivery_charge": 110,
  "weight_charge": 35
}
```

Business behavior:
- Hub Manager can edit when parcel is hub-scoped:
  - parcel.current_hub_id matches manager hub, or
  - parcel.store.hub_id matches manager hub
- Editable statuses (before delivery outcome finalization):
  - PENDING
  - PICKED_UP
  - OUT_FOR_PICKUP
  - IN_TRANSIT
  - IN_HUB
  - ASSIGNED_TO_RIDER
  - ASSIGNED_TO_THIRD_PARTY
- Backend recalculates:
  - total_charge = delivery_charge + weight_charge + cod_charge
  - receivable_amount = cod_amount - total_charge
- Returns full updated parcel in response.

Success response:
```json
{
  "parcel": {
    "id": "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
    "tracking_number": "TRK-20260413-00063",
    "status": "IN_HUB",
    "product_weight": 1.5,
    "delivery_charge": 110,
    "weight_charge": 35,
    "cod_charge": 15,
    "total_charge": 160,
    "cod_amount": 1200,
    "receivable_amount": 1040
  },
  "message": "Parcel charges updated successfully"
}
```

------------------------------------------------------------

# 3) Parcel Issue Reports

## 3.1 List Parcel Reports
GET /hubs/parcels/reports

Access:
- HUB_MANAGER, ADMIN

Query:
- hub_id: UUID v4 (optional, admin can filter)
- search: string (optional; parcel id or customer name)
- issue_type: enum (optional) -> INCORRECT_ADDRESS | INCORRECT_PHONE | COD_AMOUNT_MISMATCH | PARCEL_DAMAGED | CUSTOMER_REFUSED_TO_PAY | OTHER
- page: integer query-string (optional, default 1)
- limit: integer query-string (optional, default 10)

Full endpoint example:
- GET /hubs/parcels/reports?hub_id=8f8c6c8a-e8b4-4c37-88d0-249b09c69758&search=TRK-20260413-00031&issue_type=INCORRECT_PHONE&page=1&limit=10

Success response:
```json
{
  "success": true,
  "data": [
    {
      "id": "5d9f4db8-2a1c-442f-a2f2-901bb1af8eb0",
      "tracking_number": "TRK-20260413-00031",
      "customer": {
        "name": "Nusrat Jahan",
        "phone": "01700000000",
        "address": "House 12, Road 5, Dhanmondi"
      },
      "merchant": {
        "name": "Tanvir Hasan",
        "company": "Trendy Fashion BD",
        "phone": "01811111111"
      },
      "zone": "Dhanmondi",
      "reported_by": {
        "name": "Rider Kamal",
        "photo": "https://cdn.example.com/riders/kamal.jpg"
      },
      "report": {
        "type": "INCORRECT_PHONE",
        "reason": "Customer number unreachable",
        "reported_at": "2026-04-13T08:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 9,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "message": "Parcel reports retrieved successfully"
}
```

## 3.2 Get Parcel Report By ID
GET /hubs/parcels/reports/:id

Access:
- HUB_MANAGER, ADMIN

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "parcel_id": "uuid",
    "issue_type": "COD_AMOUNT_MISMATCH",
    "issue_description": "Collected amount mismatch",
    "is_issue_resolved": false
  },
  "message": "Parcel report details retrieved successfully"
}
```

## 3.3 Resolve Single Parcel Report
PATCH /hubs/parcels/reports/:id/resolve

Access:
- HUB_MANAGER, ADMIN

Body:
```json
{
  "action_status": "RETURN_TO_MERCHANT",
  "admin_notes": "optional"
}
```

Success response:
```json
{
  "success": true,
  "message": "Parcel report resolved successfully"
}
```

## 3.4 Bulk Resolve Parcel Reports
POST /hubs/parcels/reports/bulk-resolve

Access:
- HUB_MANAGER, ADMIN

Body:
```json
{
  "action_status": "IN_HUB",
  "admin_notes": "optional",
  "parcel_ids": ["uuid-1", "uuid-2"]
}
```

Success response:
```json
{
  "success": true,
  "message": "2 parcel reports resolved successfully"
}
```

------------------------------------------------------------

# 4) Riders and Settlements

## 4.1 Get Hub Riders
GET /hubs/riders

Access:
- HUB_MANAGER

Success response:
```json
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": "uuid",
        "full_name": "Rider Name",
        "phone": "01711111111"
      }
    ]
  },
  "message": "Riders retrieved successfully"
}
```

## 4.2 Rider Settlement Details
GET /hubs/riders/:riderId/settlement

Access:
- HUB_MANAGER

Success response (shape):
```json
{
  "success": true,
  "data": {
    "rider": {
      "id": "uuid",
      "name": "Rider Name"
    },
    "totals": {
      "total_collected": 12000,
      "previous_due": 500
    },
    "period": {
      "start": "2026-04-01T00:00:00.000Z",
      "end": "2026-04-13T10:00:00.000Z"
    }
  },
  "message": "Settlement details retrieved successfully"
}
```

## 4.3 Settlement Calculation Preview
POST /hubs/riders/:riderId/settlement/calculate

Access:
- HUB_MANAGER

Body:
```json
{
  "cash_received": 11000
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "total_collected_amount": 12000,
    "cash_received": 11000,
    "discrepancy_amount": -1000,
    "new_due_amount": 1000,
    "settlement_status": "PARTIAL"
  },
  "message": "Settlement calculation completed"
}
```

## 4.4 Record Settlement
POST /hubs/riders/:riderId/settlement/record

Access:
- HUB_MANAGER

Body:
```json
{
  "cash_received": 12000
}
```

Success response (201):
```json
{
  "success": true,
  "data": {
    "settlement_id": "uuid",
    "rider_id": "uuid",
    "total_collected_amount": 12000,
    "cash_received": 12000,
    "discrepancy_amount": 0,
    "previous_due_amount": 0,
    "new_due_amount": 0,
    "settlement_status": "COMPLETED",
    "settled_at": "2026-04-13T10:30:00.000Z"
  },
  "message": "Settlement recorded successfully"
}
```

## 4.5 Settlement History
GET /hubs/riders/:riderId/settlement/history

Access:
- HUB_MANAGER

Query:
- start_date: ISO date string (optional)
- end_date: ISO date string (optional)
- status: enum (optional) -> PENDING | COMPLETED | PARTIAL
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1)

Full endpoint example:
- GET /hubs/riders/99f46e35-5fc0-4ef4-8af6-8739ea11b74a/settlement/history?start_date=2026-04-01&end_date=2026-04-13&status=PARTIAL&page=1&limit=20

Success response shape:
```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "settlement_id": "99f46e35-5fc0-4ef4-8af6-8739ea11b74a",
        "total_collected_amount": 6400,
        "cash_received": 6000,
        "discrepancy_amount": -400,
        "previous_due_amount": 0,
        "new_due_amount": 400,
        "completed_deliveries": 7,
        "settlement_status": "PARTIAL",
        "settled_at": "2026-04-13T10:42:00.000Z",
        "settled_by": "Hub Manager Dhaka"
      }
    ],
    "pagination": {
      "total": 18,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Settlement history retrieved successfully"
}
```

------------------------------------------------------------

# 5) Hub Statistics

## 5.1 Top Merchant Stats
GET /hubs/top-merchant

Access:
- HUB_MANAGER

Success response:
```json
{
  "success": true,
  "data": {
    "top_merchant": {
      "merchant_id": "uuid",
      "merchant_name": "Merchant Name",
      "successful_parcels": 350
    },
    "hub_successful_parcels": 1200
  },
  "message": "Top merchant statistics retrieved successfully"
}
```

------------------------------------------------------------

# 6) Hub Transfer Records

## 6.1 Create Transfer Record
POST /hubs/transfer-records

Access:
- HUB_MANAGER

Body (JSON):
```json
{
  "transferred_amount": 50000,
  "admin_account_id": "uuid",
  "admin_account_name": "Admin Main Account",
  "admin_account_number": "1234567890",
  "admin_account_holder_name": "Company Admin",
  "transaction_reference_id": "TXN-100001",
  "proof_file_url": "https://cdn.example.com/proof.pdf",
  "notes": "optional"
}
```

Important:
- Controller is configured with multipart interceptor for proof file field name proof
- Current DTO/service contract still requires proof_file_url in body

Success response (201):
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "status": "PENDING",
      "transferred_amount": 50000
    }
  },
  "message": "Transfer record created successfully"
}
```

## 6.2 List My Transfer Records
GET /hubs/transfer-records

Access:
- HUB_MANAGER

Query:
- status: enum (optional) -> PENDING | IN_REVIEW | APPROVED | REJECTED | DECLINED
- hubId: UUID v4 (optional)
- hubManagerId: UUID v4 (optional)
- fromDate: ISO date string (optional)
- toDate: ISO date string (optional)
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)

Full endpoint example:
- GET /hubs/transfer-records?status=PENDING&hubId=8f8c6c8a-e8b4-4c37-88d0-249b09c69758&hubManagerId=34f0679c-079f-4e8e-a9a8-4b94ca2517a5&fromDate=2026-04-01&toDate=2026-04-13&page=1&limit=10

Success response:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "cc2a1464-4d3c-4e4d-94b1-c067fc31be4d",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "transferred_amount": 50000,
        "admin_account_name": "Main Settlement Account",
        "admin_account_number": "2345123456789",
        "transaction_reference_id": "TXN-100001",
        "status": "PENDING",
        "transfer_date": "2026-04-13T09:00:00.000Z",
        "created_at": "2026-04-13T09:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 6,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "message": "Transfer records retrieved successfully"
}
```

## 6.3 Transfer Record By ID
GET /hubs/transfer-records/:id

Access:
- HUB_MANAGER

Success response:
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "status": "PENDING",
      "transferred_amount": 50000
    }
  },
  "message": "Transfer record retrieved successfully"
}
```

## 6.4 Update Transfer Record
PATCH /hubs/transfer-records/:id

Access:
- HUB_MANAGER

Body (all optional):
```json
{
  "transferred_amount": 52000,
  "admin_account_id": "uuid",
  "admin_bank_name": "Bank Name",
  "admin_bank_account_number": "1234567890",
  "admin_account_holder_name": "Admin Holder",
  "transaction_reference_id": "TXN-100002",
  "proof_file_url": "https://cdn.example.com/new-proof.pdf",
  "notes": "updated notes"
}
```

Success response:
```json
{
  "success": true,
  "data": {
    "transfer_record": {
      "id": "uuid",
      "status": "PENDING",
      "transferred_amount": 52000
    }
  },
  "message": "Transfer record updated successfully"
}
```

## 6.5 Delete Transfer Record
DELETE /hubs/transfer-records/:id

Access:
- HUB_MANAGER

Success response:
```json
{
  "success": true,
  "message": "Transfer record deleted successfully"
}
```

------------------------------------------------------------

# 7) Hub Finance (Hub Manager)

## 7.1 Finance Dashboard
GET /hubs/finance/dashboard

Access:
- HUB_MANAGER

Success response shape:
```json
{
  "success": true,
  "data": {
    "cash_in_hand": 150000,
    "pending_transfer": 20000,
    "pending_expense": 5000,
    "today": {
      "collected": 32000,
      "expense": 1200,
      "transferred": 10000
    }
  }
}
```

## 7.2 Collect COD From Rider
POST /hubs/finance/collect-cod/:rider_id

Access:
- HUB_MANAGER

Body:
```json
{
  "counted_amount": 13000
}
```

Success response:
```json
{
  "success": true,
  "message": "Cash collected successfully",
  "data": {
    "rider_id": "uuid",
    "counted_amount": 13000,
    "recorded_at": "2026-04-13T10:30:00.000Z"
  }
}
```

## 7.3 Collect COD From Carrybee
POST /hubs/finance/collect-cod-carrybee/:provider_id

Access:
- HUB_MANAGER

Body:
```json
{
  "counted_amount": 22000
}
```

Success response:
```json
{
  "success": true,
  "message": "Carrybee cash collected successfully",
  "data": {
    "provider_id": "uuid",
    "counted_amount": 22000,
    "recorded_at": "2026-04-13T10:30:00.000Z"
  }
}
```

## 7.4 Create Expense
POST /hubs/finance/expense

Access:
- HUB_MANAGER

Body:
```json
{
  "amount": 1500,
  "category": "OFFICE_SUPPLY",
  "reason": "Printer paper",
  "proof_file_url": "https://cdn.example.com/expense-proof.jpg"
}
```

Category enum:
- OFFICE_RENT
- OFFICE_SUPPLY
- UTILITIES
- STATIONARY
- MAINTENANCE
- SALARY
- OTHER

Success response:
```json
{
  "success": true,
  "message": "Expense recorded successfully",
  "data": {
    "id": "uuid",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "status": "IN_REVIEW"
  }
}
```

## 7.5 Submit Transfer To Admin
POST /hubs/finance/transfer

Access:
- HUB_MANAGER

Body:
```json
{
  "transferred_amount": 50000,
  "admin_account_id": "uuid",
  "admin_account_name": "Admin Main Account",
  "admin_account_number": "1234567890",
  "admin_account_holder_name": "Company Admin",
  "transaction_reference_id": "TXN-200001",
  "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
  "notes": "weekly transfer"
}
```

Success response:
```json
{
  "success": true,
  "message": "Transfer submitted successfully",
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "transferred_amount": 50000
  }
}
```

## 7.6 Finance Transfers List
GET /hubs/finance/transfers

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, transfer_date, transferred_amount, status, transaction_reference_id
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/finance/transfers?page=1&limit=20&search=TXN-200001&sortBy=created_at&order=DESC

Success response shape:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
        "transferred_amount": 50000,
        "status": "IN_REVIEW",
        "transfer_date": "2026-04-13T09:00:00.000Z"
      }
    ],
    "meta": {
      "total": 12,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

## 7.7 Finance Transfer By ID
GET /hubs/finance/transfers/:id

Access:
- HUB_MANAGER

Success response shape:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transferred_amount": 50000,
    "status": "PENDING"
  }
}
```

## 7.8 Finance Overview
GET /hubs/finance/overview

Access:
- HUB_MANAGER

Success response shape:
```json
{
  "success": true,
  "data": {
    "total_collected": 200000,
    "total_expense": 15000,
    "total_transferred": 130000,
    "balance": 55000
  }
}
```

## 7.9 Finance Expenses List
GET /hubs/finance/expenses

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, amount, category, status
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/finance/expenses?page=1&limit=20&search=OFFICE_SUPPLY&sortBy=created_at&order=DESC

Success response shape:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
        "amount": 1500,
        "category": "OFFICE_SUPPLY",
        "status": "IN_REVIEW",
        "created_at": "2026-04-13T08:10:00.000Z"
      }
    ],
    "meta": {
      "total": 21,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

## 7.10 Finance Expense By ID
GET /hubs/finance/expenses/:id

Access:
- HUB_MANAGER

Success response shape:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "status": "IN_REVIEW"
  }
}
```

## 7.11 Finance History
GET /hubs/finance/history

Access:
- HUB_MANAGER

Query:
- period: enum (optional, default MONTHLY) -> WEEKLY | MONTHLY | ALL_TIME
- type: string (optional; expected values: SETTLEMENT | EXPENSE | TRANSFER)
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - For EXPENSE view: created_at, updated_at, amount, category, status
  - For TRANSFER view: created_at, transfer_date, transferred_amount, status, transaction_reference_id
  - For SETTLEMENT view: created_at, updated_at, settled_at, total_collected_amount, cash_received, discrepancy_amount, settlement_status
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/finance/history?period=MONTHLY&type=TRANSFER&page=1&limit=20&search=TXN-200001&sortBy=created_at&order=DESC

Success response shape:
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
        "amount": 1500,
        "category": "OFFICE_SUPPLY",
        "status": "IN_REVIEW"
      }
    ],
    "transfers": [
      {
        "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
        "transferred_amount": 50000,
        "status": "IN_REVIEW"
      }
    ],
    "settlements": [
      {
        "id": "99f46e35-5fc0-4ef4-8af6-8739ea11b74a",
        "total_collected_amount": 6400,
        "cash_received": 6000,
        "settlement_status": "PARTIAL"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "counts": {
        "expenses": 21,
        "transfers": 12,
        "settlements": 18
      }
    }
  }
}
```

------------------------------------------------------------

# 8) Admin Finance Review APIs

## 8.1 Admin List Transfer Requests
GET /hubs/admin/finance/transfers

Access:
- ADMIN

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, transfer_date, transferred_amount, status, transaction_reference_id
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/admin/finance/transfers?page=1&limit=20&search=TXN-200001&sortBy=created_at&order=DESC

Success response shape:
```json
{
  "success": true,
  "data": [
    {
      "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
      "transferred_amount": 50000,
      "status": "IN_REVIEW",
      "transaction_reference_id": "TXN-200001",
      "hub": {
        "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "branch_name": "Dhaka Main Hub"
      },
      "hubManager": {
        "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5"
      }
    }
  ],
  "meta": {
    "total": 27,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

## 8.2 Admin Transfer Request Detail
GET /hubs/admin/finance/transfers/:id

Access:
- ADMIN

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "transferred_amount": 50000,
    "hub": {
      "id": "uuid",
      "branch_name": "Dhaka Main Hub"
    }
  }
}
```

## 8.3 Admin List Expense Requests
GET /hubs/admin/finance/expenses

Access:
- ADMIN

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, amount, category, status
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/admin/finance/expenses?page=1&limit=20&search=OFFICE_SUPPLY&sortBy=created_at&order=DESC

Success response shape:
```json
{
  "success": true,
  "data": [
    {
      "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
      "amount": 1500,
      "category": "OFFICE_SUPPLY",
      "status": "IN_REVIEW",
      "hub": {
        "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "branch_name": "Dhaka Main Hub"
      }
    }
  ],
  "meta": {
    "total": 14,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

## 8.4 Admin Expense Request Detail
GET /hubs/admin/finance/expenses/:id

Access:
- ADMIN

Success response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "IN_REVIEW",
    "amount": 1500,
    "category": "OFFICE_SUPPLY"
  }
}
```

## 8.5 Review Transfer Request
PATCH /hubs/finance/transfer/:id/review

Access:
- ADMIN

Body:
```json
{
  "status": "APPROVED",
  "rejection_reason": "Required only when declined"
}
```

Allowed status:
- APPROVED
- DECLINED

Success response:
```json
{
  "success": true,
  "message": "Transfer request approved",
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "reviewed_at": "2026-04-13T10:30:00.000Z"
  }
}
```

## 8.6 Review Expense Request
PATCH /hubs/finance/expense/:id/review

Access:
- ADMIN

Body:
```json
{
  "status": "DECLINED",
  "rejection_reason": "Bill not valid"
}
```

Success response:
```json
{
  "success": true,
  "message": "Expense request declined",
  "data": {
    "id": "uuid",
    "status": "DECLINED",
    "rejection_reason": "Bill not valid"
  }
}
```

------------------------------------------------------------

# 9) Implementation Notes for Frontend Team

1. Always read hub_id and role from auth token-derived backend context; hub manager endpoints scope data to current hub.
2. For list endpoints, always send page and limit explicitly to keep deterministic pagination.
3. Keep status filters case-sensitive and use enum values exactly as documented.
4. Bulk endpoints return mixed results in data.results; build UI to show partial success.
5. For dashboard parcel detail, use enum_mappings from API for dropdown labels instead of hardcoding.
6. finance/transfer and transfer-records create share similar body contract; both currently require proof_file_url in request body.
7. Legacy endpoint PATCH /hubs/parcels/:id/assign-rider exists, but use POST /hubs/parcels/assign-rider for new implementation.

------------------------------------------------------------

# 10) Edge Cases and Condition Matrix

## 10.1 Hub Access Scope Rules

- HUB_MANAGER requests are auto-scoped to their own hub in service layer even if another hub_id is sent.
- If manager account has no assigned hub, response is 404 with hub assignment error.
- ADMIN can query with hub_id filters and view cross-hub data.

## 10.2 Status Transition Restrictions (Parcel Lifecycle)

- Receive parcel (/hubs/parcels/receive): only works for parcels in PICKED_UP; other states fail validation with per-item errors.
- Assign rider (/hubs/parcels/assign-rider): only valid for IN_HUB parcels; already assigned/invalid states are returned in skipped/error buckets.
- Transfer parcel (/hubs/parcels/:id/transfer or bulk-transfer): parcel must be IN_HUB and target hub must differ from source.
- Accept incoming (/hubs/parcels/:id/accept or bulk-accept): only valid for IN_TRANSIT parcels where to_hub_id matches current hub.
- Reschedule delivery (/hubs/parcels/:id/reschedule-delivery): allowed only for eligible delivery-failed outcomes, increments reschedule_count.
- Prepare redelivery (/hubs/parcels/:id/prepare-redelivery): works when parcel is DELIVERY_RESCHEDULED and next attempt is being scheduled.
- Return to merchant (/hubs/parcels/:id/return-to-merchant): rejected if parcel already delivered/settled/returned.

## 10.3 Bulk Operation Partial-Success Behavior

- Bulk APIs return mixed outcomes by design.
- Handle these fields in UI as first-class states:
  - results: successful row-wise actions.
  - errors: explicit failed rows with reason.
  - skipped_count or unchanged_count: rows ignored due to status/ownership mismatch.
- Never assume all items succeeded when HTTP status is 200.

## 10.4 Finance Review Constraints

- Expense/transfer review endpoints only accept APPROVED or DECLINED.
- rejection_reason is required when status is DECLINED.
- Already reviewed requests cannot be re-reviewed (expect 400 conflict-style response message).
- Hub finance lists typically include PENDING and IN_REVIEW records; approved/declined history appears in overview/history endpoints.

## 10.5 Settlement and COD Collection Conditions

- Settlement calculation may return discrepancy_amount:
  - 0: exact match
  - negative: short collection (new due increases)
  - positive: over collection
- Record settlement persists due progression via previous_due_amount and new_due_amount.
- collect-cod endpoints fail if counted_amount is invalid (<= 0) or rider/provider context is not eligible for collection.

## 10.6 Hub Charge Editing Conditions

- Endpoint: PATCH /parcels/:id/hub-charges
- Allowed roles: HUB_MANAGER, ADMIN
- Editable fields: product_weight, delivery_charge, weight_charge
- Hub manager ownership scope check:
  - Allowed if parcel.current_hub_id = current hub OR parcel.store.hub_id = current hub
  - Otherwise returns 403 (This parcel does not belong to your hub)
- Allowed statuses:
  - PENDING, PICKED_UP, OUT_FOR_PICKUP, IN_TRANSIT, IN_HUB, ASSIGNED_TO_RIDER, ASSIGNED_TO_THIRD_PARTY
- Blocked statuses (examples):
  - OUT_FOR_DELIVERY, DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED, RETURN_TO_MERCHANT, DELIVERY_RESCHEDULED, CANCELLED
- Server recalculates:
  - total_charge = delivery_charge + weight_charge + cod_charge
  - receivable_amount = cod_amount - total_charge
- Recommended UI rule: show edit button only for allowed statuses above and hide for all delivery outcome/final statuses.

## 10.7 Common Error Payload Patterns

- Validation error (400): malformed UUID, invalid enum, missing required fields.
- Not found (404): parcel/report/transfer/expense not found in scoped hub context.
- Forbidden (403): role mismatch for endpoint.
- Conflict/Business rule (400): invalid status transition, duplicate review attempt, hub mismatch.

------------------------------------------------------------

# 11) Full Hub Parcel API Flow (Recommended Order)

## 11.1 First Load (Hub Panel Bootstrap)

1. GET /hubs/my-hub
2. GET /hubs/riders
3. GET /hubs/merchants
4. GET /hubs/parcels/received?page=1&limit=20&status=PENDING&sortBy=created_at&order=DESC

## 11.2 Standard Hub Delivery Flow (Your Requested Order)

1. Parcel arrives to hub pickup queue:
  - GET /hubs/parcels/received
2. Mark parcel as received in hub:
  - POST /hubs/parcels/receive
3. Load parcels ready for dispatch:
  - GET /hubs/parcels/for-assignment
4. Assign parcel(s) to rider:
  - POST /hubs/parcels/assign-rider (preferred)
  - PATCH /hubs/parcels/:id/assign-rider (legacy)
5. Track assigned parcel details:
  - GET /hubs/parcels?status=ASSIGNED_TO_RIDER
  - GET /hubs/dashboard/parcels/:id
6. Process delivery outcomes after rider attempts:
  - GET /hubs/parcels/delivery-outcomes
  - GET /hubs/parcels/cleared-deliveries?rider_id=:riderId
  - GET /hubs/parcels/carrybee-cleared-deliveries?provider_id=:providerId

## 11.3 If Delivery Fails (Branch Flow)

1. Reschedule path:
  - PATCH /hubs/parcels/:id/reschedule-delivery
  - POST /hubs/parcels/bulk-reschedule-delivery
  - GET /hubs/parcels/rescheduled
  - PATCH /hubs/parcels/:id/prepare-redelivery
  - POST /hubs/parcels/assign-rider (re-assign)
2. Return-to-merchant path:
  - PATCH /hubs/parcels/:id/return-to-merchant
  - POST /hubs/parcels/bulk-return-to-merchant
  - GET /hubs/parcels/return-to-merchant

## 11.4 Inter-Hub Transfer Flow (When Needed)

1. List transferable in-hub inventory:
  - GET /parcels/hub/in-hub
2. Transfer from source hub:
  - PATCH /hubs/parcels/:id/transfer
  - PATCH /hubs/parcels/bulk-transfer
3. Destination hub receives incoming:
  - GET /hubs/parcels/incoming
  - PATCH /hubs/parcels/:id/accept
  - PATCH /hubs/parcels/bulk-accept
4. Verify accepted inventory for assignment:
  - GET /hubs/parcels/for-assignment

## 11.5 Settlement and Finance Flow (After Delivery)

1. Rider settlement:
  - GET /hubs/riders/:riderId/settlement
  - POST /hubs/riders/:riderId/settlement/calculate
  - POST /hubs/riders/:riderId/settlement/record
  - GET /hubs/riders/:riderId/settlement/history
2. Hub finance operations:
  - GET /hubs/finance/dashboard
  - POST /hubs/finance/collect-cod/:rider_id
  - POST /hubs/finance/collect-cod-carrybee/:provider_id
  - POST /hubs/finance/expense
  - POST /hubs/finance/transfer
  - GET /hubs/finance/transfers
  - GET /hubs/finance/expenses
  - GET /hubs/finance/history
3. Admin review stage:
  - GET /hubs/admin/finance/transfers
  - GET /hubs/admin/finance/expenses
  - PATCH /hubs/finance/transfer/:id/review
  - PATCH /hubs/finance/expense/:id/review

## 11.6 Parcel Issue Report Resolution Flow

1. GET /hubs/parcels/reports
2. GET /hubs/parcels/reports/:id
3. PATCH /hubs/parcels/reports/:id/resolve
4. POST /hubs/parcels/reports/bulk-resolve

## 11.7 Frontend State-Machine (Status -> Next Action API)

Use this table to decide which action buttons to show for each parcel status in Hub Panel.

| Current status | Typical source list | Allowed next action API | Expected next status |
|---|---|---|---|
| PENDING / PICKED_UP | GET /hubs/parcels/received | POST /hubs/parcels/receive | IN_HUB |
| IN_HUB | GET /hubs/parcels/for-assignment, GET /hubs/parcels | POST /hubs/parcels/assign-rider | ASSIGNED_TO_RIDER |
| IN_HUB | GET /parcels/hub/in-hub | PATCH /hubs/parcels/:id/transfer | IN_TRANSIT |
| IN_HUB | GET /hubs/parcels, GET /hubs/dashboard/parcels/:id | PATCH /parcels/:id/hub-charges | IN_HUB (charges updated only) |
| ASSIGNED_TO_RIDER | GET /hubs/parcels?status=ASSIGNED_TO_RIDER | Rider app completes delivery attempt (outside hub API) | DELIVERED / PARTIAL_DELIVERY / EXCHANGE / DELIVERY_RESCHEDULED / PAID_RETURN / RETURNED |
| DELIVERY_RESCHEDULED | GET /hubs/parcels/rescheduled | PATCH /hubs/parcels/:id/prepare-redelivery | IN_HUB |
| IN_HUB (after prepare-redelivery) | GET /hubs/parcels/for-assignment | POST /hubs/parcels/assign-rider | ASSIGNED_TO_RIDER |
| RETURNED / PAID_RETURN / EXCHANGE / PARTIAL_DELIVERY | GET /hubs/parcels/delivery-outcomes | PATCH /hubs/parcels/:id/return-to-merchant | RETURN_TO_MERCHANT |
| RETURN_TO_MERCHANT | GET /hubs/parcels/return-to-merchant | Assign return parcel to rider via POST /hubs/parcels/assign-rider | ASSIGNED_TO_RIDER |
| IN_TRANSIT (to this hub) | GET /hubs/parcels/incoming | PATCH /hubs/parcels/:id/accept | IN_HUB |
| IN_TRANSIT (from this hub) | GET /hubs/parcels/outgoing | No direct hub manager action until destination accepts | IN_TRANSIT |
| DELIVERED | GET /hubs/parcels/cleared-deliveries | POST /hubs/riders/:riderId/settlement/record, POST /hubs/finance/collect-cod/:rider_id | Settled finance state (parcel remains DELIVERED) |

UI enable/disable rules:
- Show Receive only for PENDING/PICKED_UP rows.
- Show Assign Rider only for IN_HUB rows.
- Show Prepare Redelivery only for DELIVERY_RESCHEDULED rows.
- Show Accept Incoming only for IN_TRANSIT rows in incoming list.
- Show Transfer only for IN_HUB rows and when destination_hub_id != current hub.
- Show Return To Merchant only for eligible delivery outcome rows (not already returned/settled).

------------------------------------------------------------

# 12) Quick Endpoint Matrix

Hub Profile and Admin:
- GET /hubs/my-hub
- POST /hubs
- GET /hubs
- GET /hubs/:id
- PATCH /hubs/:id
- DELETE /hubs/:id
- PATCH /hubs/:id/deactivate
- PATCH /hubs/:id/activate
- PATCH /hubs/:id/decline

Parcel Ops:
- GET /hubs/parcels/delivery-outcomes
- GET /hubs/parcels/cleared-deliveries
- GET /hubs/parcels/carrybee-cleared-deliveries
- GET /hubs/parcels/rescheduled
- GET /hubs/parcels/return-to-merchant
- PATCH /hubs/parcels/:id/return-to-merchant
- POST /hubs/parcels/bulk-return-to-merchant
- PATCH /hubs/parcels/:id/reschedule-delivery
- POST /hubs/parcels/bulk-reschedule-delivery
- PATCH /hubs/parcels/:id/prepare-redelivery
- GET /hubs/parcels
- GET /hubs/dashboard/parcels/:id
- GET /hubs/merchants
- POST /hubs/parcels/create-and-receive
- GET /hubs/parcels/received
- POST /hubs/parcels/receive
- GET /hubs/parcels/for-assignment
- PATCH /hubs/parcels/:id/assign-rider
- POST /hubs/parcels/assign-rider
- GET /hubs/list
- PATCH /hubs/parcels/bulk-transfer
- PATCH /hubs/parcels/:id/transfer
- GET /hubs/parcels/incoming
- PATCH /hubs/parcels/bulk-accept
- PATCH /hubs/parcels/:id/accept
- GET /hubs/parcels/outgoing
- GET /parcels/hub/in-hub
- PATCH /parcels/:id/hub-charges

Reports and Settlements:
- GET /hubs/parcels/reports
- GET /hubs/parcels/reports/:id
- PATCH /hubs/parcels/reports/:id/resolve
- POST /hubs/parcels/reports/bulk-resolve
- GET /hubs/riders
- GET /hubs/riders/:riderId/settlement
- POST /hubs/riders/:riderId/settlement/calculate
- POST /hubs/riders/:riderId/settlement/record
- GET /hubs/riders/:riderId/settlement/history
- GET /hubs/top-merchant

Transfer Records and Finance:
- POST /hubs/transfer-records
- GET /hubs/transfer-records
- GET /hubs/transfer-records/:id
- PATCH /hubs/transfer-records/:id
- DELETE /hubs/transfer-records/:id
- GET /hubs/finance/dashboard
- POST /hubs/finance/collect-cod/:rider_id
- POST /hubs/finance/collect-cod-carrybee/:provider_id
- POST /hubs/finance/expense
- POST /hubs/finance/transfer
- GET /hubs/finance/transfers
- GET /hubs/finance/transfers/:id
- GET /hubs/finance/overview
- GET /hubs/finance/expenses
- GET /hubs/finance/expenses/:id
- GET /hubs/finance/history
- GET /hubs/admin/finance/transfers
- GET /hubs/admin/finance/transfers/:id
- GET /hubs/admin/finance/expenses
- GET /hubs/admin/finance/expenses/:id
- PATCH /hubs/finance/transfer/:id/review
- PATCH /hubs/finance/expense/:id/review
