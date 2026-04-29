------------------------------------------------------------
# 0) Hub Panel Read Order (Flow-First)

Use this section as the frontend implementation order. Full request/response contracts are kept in detailed sections below.

## 0.1 Dashboard Related Endpoints (Implement First)

1. GET /hubs/my-hub
- Purpose: Load hub identity and manager-facing branch context.
- Full contract: Section 1.1

2. GET /hubs/riders
- Purpose: Load rider dropdowns and dashboard staffing context.
- Full contract: Section 4.1

3. GET /hubs/merchants
- Purpose: Load merchant/store mappings for dashboard filters.
- Full contract: Section 2.2

4. GET /hubs/top-merchant
- Purpose: Dashboard top performer widget.
- Full contract: Section 5.1

5. GET /hubs/finance/dashboard
- Purpose: Finance cards for available balance and current month movement.
- Full contract: Section 7.1

6. GET /hubs/finance/overview
- Purpose: Aggregated finance overview totals.
- Full contract: Section 7.8

7. GET /hubs/finance/history
- Purpose: Unified dashboard history feed for settlements, expenses, and transfers.
- Full contract: Section 7.11

8. GET /hubs/dashboard/parcels/:id
- Purpose: Parcel drilldown page opened from dashboard lists.
- Full contract: Section 2.10

## 0.2 Parcel Endpoints (Proper Operational Flow)

1. GET /hubs/parcels/received
- Flow step: Arrival queue for pickup-confirmed parcels.
- Full contract: Section 2.3
- Pre-receive edit action: PATCH /parcels/:id/hub-charges (Section 2.4)

2. POST /hubs/parcels/receive
- Flow step: Mark arrived parcels as received in hub inventory.
- Full contract: Section 2.5
- Post-receive edit action: PATCH /parcels/:id (Section 2.6)

3. GET /hubs/parcels/for-assignment
- Flow step: Dispatch-ready inventory.
- Full contract: Section 2.7

4. POST /hubs/parcels/assign-rider
- Flow step: Assign one or many parcels to rider.
- Full contract: Section 2.8

5. GET /hubs/parcels
- Flow step: Unified operational list with filters/sorting.
- Full contract: Section 2.9

6. Delivery outcome review
- GET /hubs/parcels/delivery-outcomes (Section 2.26)
- GET /hubs/parcels/cleared-deliveries (Section 2.27)
- GET /hubs/parcels/carrybee-cleared-deliveries (Section 2.28)

7. Redelivery branch
- PATCH /hubs/parcels/:id/reschedule-delivery (Section 2.11)
- POST /hubs/parcels/bulk-reschedule-delivery (Section 2.12)
- GET /hubs/parcels/rescheduled (Section 2.13)
- PATCH /hubs/parcels/:id/prepare-redelivery (Section 2.14)

8. Return-to-merchant branch
- PATCH /hubs/parcels/:id/return-to-merchant (Section 2.15)
- POST /hubs/parcels/bulk-return-to-merchant (Section 2.16)
- GET /hubs/parcels/return-to-merchant (Section 2.17)

9. Inter-hub transfer branch
- GET /hubs/list (Section 2.18)
- GET /parcels/hub/in-hub (Section 2.19)
- PATCH /hubs/parcels/:id/transfer (Section 2.21)
- PATCH /hubs/parcels/bulk-transfer (Section 2.20)
- GET /hubs/parcels/incoming (Section 2.22)
- PATCH /hubs/parcels/:id/accept (Section 2.24)
- PATCH /hubs/parcels/bulk-accept (Section 2.23)
- GET /hubs/parcels/outgoing (Section 2.25)

10. Optional manual hub entry flow
- POST /hubs/parcels/create-and-receive
- Full contract: Section 2.1

------------------------------------------------------------

# 2) Hub Parcel Operations
## 2.1 Create And Receive Parcel
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


## 2.2 Get Hub Merchants
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


## 2.3 Parcels Awaiting Receipt
GET /hubs/parcels/received

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- paymentStatus: enum (optional) -> UNPAID | PAID | COD_COLLECTED
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, tracking_number, parcel_tx_id, customer_name, customer_phone, merchant_name, area, cod_amount, product_price, total_charge, status
  - Friendly aliases: price, merchant_price, charge, customer, merchant, tracking
  - Alias meaning:
    - price = COALESCE(cod_amount, product_price, 0) (COD first, fallback product price)
    - merchant_price = COALESCE(cod_amount, product_price, 0)
    - charge = total_charge
    - customer = customer_name
    - merchant = merchant_name
    - tracking = tracking_number
  - Recommended for frontend clarity: use explicit fields cod_amount or product_price instead of price
- order: enum (optional, default DESC) -> ASC | DESC
- status: ParcelStatus enum (optional) or ACTIVE alias

Full endpoint examples:
- GET /hubs/parcels/received?page=1&limit=20&search=TRK-20260413&sortBy=created_at&order=DESC&status=PENDING
- GET /hubs/parcels/received?page=2&limit=20&search=017&sortBy=updated_at&order=ASC&status=PICKED_UP
- GET /hubs/parcels/received?page=1&limit=20&search=sifat&sortBy=price&order=ASC&status=PENDING
- GET /hubs/parcels/received?page=1&limit=20&sortBy=charge&order=DESC&status=PICKED_UP
- Full query example:
  - GET /hubs/parcels/received?page=1&limit=20&status=ACTIVE&search=TRK&merchantId=2f2f540f-8240-4ca5-bb53-7f6f33f754d0&storeId=4fe99f8f-23b8-4cc2-a346-2c6186ec2230&customerName=Sadia&customerPhone=0170&merchantName=Beauty&area=Banani&minAmount=100&maxAmount=2500&deliveryType=NORMAL&paymentStatus=UNPAID&sortBy=merchant&order=ASC

Query variants summary:
- Search variant: `search`
- Scope filters: `status`, `merchantId`, `storeId`
- Person filters: `customerName`, `customerPhone`, `merchantName`
- Value/location filters: `area`, `minAmount`, `maxAmount`, `paymentStatus`, `deliveryType`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

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


## 2.4 Update Hub Charges (Weight/Delivery Override)
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
- Hub Manager editable statuses (before parcel is received):
  - PENDING
  - PICKED_UP
  - OUT_FOR_PICKUP
  - IN_TRANSIT
- Admin editable statuses (before rider starts delivery):
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


## 2.5 Bulk Receive Parcels
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


## 2.6 Update Received Parcel Contact and Amount
PATCH /parcels/:id

Access:
- HUB_MANAGER
- ADMIN
- MERCHANT

Hub Manager usage in Hub Panel:
- Use this endpoint after parcel is received (status IN_HUB).
- Hub manager can update only:
  - customer_phone
  - customer_address
  - product_price (amount)

Body (hub manager allowed fields):
```json
{
  "customer_phone": "01719998888",
  "customer_address": "House 12, Road 5, Dhanmondi, Dhaka",
  "product_price": 1350
}
```

Business behavior:
- If product_price is updated, backend auto-sets:
  - cod_amount = product_price
  - is_cod = product_price > 0
  - receivable_amount = cod_amount - total_charge

Success response:
```json
{
  "parcel": {
    "id": "6416d76d-4f94-4ccf-af0f-c03658fe28ca",
    "tracking_number": "TRK-20260413-00063",
    "status": "IN_HUB",
    "customer_name": "Nusrat Jahan",
    "customer_phone": "01719998888",
    "customer_address": "House 12, Road 5, Dhanmondi, Dhaka",
    "product_price": 1350,
    "cod_amount": 1350,
    "total_charge": 160,
    "receivable_amount": 1190
  },
  "message": "Parcel updated successfully"
}
```

------------------------------------------------------------

## 2.7 Parcels For Assignment
GET /hubs/parcels/for-assignment

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default created_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/for-assignment?page=1&limit=20
- Full query example:
  - GET /hubs/parcels/for-assignment?page=1&limit=20&search=TRK&merchantName=Rafi&customerPhone=017&area=Banani&minAmount=100&maxAmount=5000&sortBy=merchant_price&order=DESC

Query variants summary:
- Search variant: `search`
- Scope/person filters: `merchantId`, `storeId`, `customerName`, `customerPhone`, `merchantName`
- Location/value filters: `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

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


## 2.8 Assign Parcels To Rider
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


## 2.9 Hub Parcels List
GET /hubs/parcels

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 20, min 1, max 100)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional) -> matches coverage area/city/zone or parcel delivery_area text
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- paymentStatus: enum (optional) -> UNPAID | PAID | COD_COLLECTED
- sortBy: string (optional, default created_at)
  - Allowed values: created_at, updated_at, tracking_number, parcel_tx_id, customer_name, customer_phone, merchant_name, area, cod_amount, product_price, total_charge, status
  - Friendly aliases: price, merchant_price, charge, customer, merchant, tracking
  - Alias meaning:
    - price = COALESCE(cod_amount, product_price, 0) (COD first, fallback product price)
    - merchant_price = COALESCE(cod_amount, product_price, 0)
    - charge = total_charge
    - customer = customer_name
    - merchant = merchant_name
    - tracking = tracking_number
  - Recommended for frontend clarity: use explicit fields cod_amount or product_price instead of price
- order: enum (optional, default DESC) -> ASC | DESC
- status: ParcelStatus enum (optional) or ACTIVE alias

Full endpoint examples:
- All query params together:
  - GET /hubs/parcels?page=1&limit=20&search=TRK-20260413&sortBy=created_at&order=DESC&status=IN_HUB
- Second page, ascending sort:
  - GET /hubs/parcels?page=2&limit=50&search=0173&sortBy=updated_at&order=ASC&status=ASSIGNED_TO_RIDER
- Price-wise low to high:
  - GET /hubs/parcels?page=1&limit=20&sortBy=price&order=ASC&status=IN_HUB
- Charge-wise high to low:
  - GET /hubs/parcels?page=1&limit=20&sortBy=charge&order=DESC&status=IN_HUB
- Full query example:
  - GET /hubs/parcels?page=1&limit=20&status=ACTIVE&search=TRK-2026&merchantId=2f2f540f-8240-4ca5-bb53-7f6f33f754d0&storeId=4fe99f8f-23b8-4cc2-a346-2c6186ec2230&customerName=Sadia&customerPhone=0170&merchantName=Beauty&area=Banani&minAmount=100&maxAmount=3000&deliveryType=EXPRESS&paymentStatus=UNPAID&sortBy=merchant_price&order=DESC

Query variants summary:
- Search-first variant: `search`
- Entity filters: `status`, `merchantId`, `storeId`, `customerName`, `customerPhone`, `merchantName`
- Financial/coverage filters: `area`, `minAmount`, `maxAmount`, `paymentStatus`, `deliveryType`
- Sort variants: explicit fields plus aliases (`price`, `merchant_price`, `charge`, `customer`, `merchant`, `tracking`)
- Pagination variants: `page`, `limit`

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


## 2.10 Hub Dashboard Parcel Detail
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


## 2.11 Mark Delivery Rescheduled
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


## 2.12 Bulk Reschedule Delivery
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


## 2.13 Rescheduled Deliveries List
GET /hubs/parcels/rescheduled

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 10)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default updated_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/rescheduled?page=1&limit=10
- Full query example:
  - GET /hubs/parcels/rescheduled?search=TRK&merchantName=Trendy&area=Dhanmondi&minAmount=50&maxAmount=3000&sortBy=updated_at&order=DESC&page=1&limit=10

Query variants summary:
- Fast search: `search`
- Entity filters: `merchantId`, `storeId`, `customerName`, `customerPhone`, `merchantName`
- Operational filters: `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

Success response example (full):
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


## 2.14 Prepare For Redelivery
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


## 2.15 Mark Parcel Return To Merchant
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


## 2.16 Bulk Return To Merchant
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


## 2.17 Return To Merchant List
GET /hubs/parcels/return-to-merchant

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 10)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default updated_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/return-to-merchant?page=1&limit=10
- Full query example:
  - GET /hubs/parcels/return-to-merchant?search=RTN&merchantName=Home%20Living&customerPhone=0187&sortBy=updated_at&order=DESC&page=1&limit=10

Query variants summary:
- Search variants: `search`, `customerName`, `customerPhone`, `merchantName`
- Scope filters: `merchantId`, `storeId`, `area`, `deliveryType`
- Amount filters: `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

Success response example (full):
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


## 2.18 Hub List For Transfers
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


## 2.19 In-Hub and Returned-To-Hub Parcels (Related Endpoint)
GET /parcels/hub/in-hub

Access:
- HUB_MANAGER

Why this matters for Hub Panel:
- Use this list for parcels currently inside hub inventory (IN_HUB and RETURNED_TO_HUB).

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default created_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /parcels/hub/in-hub?page=1&limit=20&sortBy=created_at&order=DESC
- Full query example:
  - GET /parcels/hub/in-hub?page=1&limit=20&search=TRK&merchantName=Main&area=Banani&minAmount=100&maxAmount=5000&sortBy=price&order=DESC

Query variants summary:
- Search variant: `search`
- Scope filters: `merchantId`, `storeId`, `customerName`, `customerPhone`, `merchantName`
- Operational filters: `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

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


## 2.20 Bulk Transfer Parcels
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


## 2.21 Transfer Single Parcel
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


## 2.22 Incoming Parcels
GET /hubs/parcels/incoming

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default transferred_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/incoming?page=1&limit=20
- Full query example:
  - GET /hubs/parcels/incoming?page=1&limit=20&search=TRK&merchantName=Tech&area=Agrabad&sortBy=transferred_at&order=DESC

Query variants summary:
- Search/person filters: `search`, `customerName`, `customerPhone`, `merchantName`
- Scope/value filters: `merchantId`, `storeId`, `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

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


## 2.23 Bulk Accept Incoming
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


## 2.24 Accept Single Incoming Parcel
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


## 2.25 Outgoing Parcels
GET /hubs/parcels/outgoing

Access:
- HUB_MANAGER

Query:
- page: integer (optional, default 1)
- limit: integer (optional, default 20)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- sortBy: string (optional, default transferred_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/outgoing?page=1&limit=20
- Full query example:
  - GET /hubs/parcels/outgoing?page=1&limit=20&search=TRK&merchantName=Tech&area=Dhaka&sortBy=transferred_at&order=DESC

Query variants summary:
- Search/person filters: `search`, `customerName`, `customerPhone`, `merchantName`
- Scope/value filters: `merchantId`, `storeId`, `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

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


## 2.26 Delivery Outcomes List
GET /hubs/parcels/delivery-outcomes

Access:
- HUB_MANAGER

Query:
- status: enum (optional) -> PARTIAL_DELIVERY | EXCHANGE | PAID_RETURN | RETURNED
- zone: string (optional)
- merchantId: UUID v4 (optional)
- search: string (optional) -> parcel id/tracking/parcel_tx_id/customer/phone/merchant/store/area text
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- minAmount: number (optional, >= 0) -> amount range lower bound
- maxAmount: number (optional, >= 0) -> amount range upper bound
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)
- sortBy: string (optional, default updated_at)
  - Common values: updated_at, created_at, tracking_number, parcel_tx_id, customer_name, customer_phone, merchant_name, area, cod_amount, product_price, total_charge, status
  - Friendly aliases: tracking, customer, merchant, charge, price, merchant_price
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/delivery-outcomes?status=RETURNED&zone=Rampura&merchantId=2f2f540f-8240-4ca5-bb53-7f6f33f754d0&page=1&limit=10
- Full query example:
  - GET /hubs/parcels/delivery-outcomes?status=RETURNED&zone=Rampura&merchantId=2f2f540f-8240-4ca5-bb53-7f6f33f754d0&search=TRK-2026&customerName=Aminul&customerPhone=0173&merchantName=Daily%20Needs&minAmount=100&maxAmount=2000&deliveryType=NORMAL&sortBy=price&order=DESC&page=1&limit=10

Query variants summary:
- Quick search only: `search`
- Structured filters: `status`, `zone`, `merchantId`, `customerName`, `customerPhone`, `merchantName`, `minAmount`, `maxAmount`, `deliveryType`
- Sorting variants: `sortBy` + `order`
- Pagination variants: `page` + `limit`

Success response example (full):
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


## 2.27 Rider Cleared Deliveries
GET /hubs/parcels/cleared-deliveries

Access:
- HUB_MANAGER

Query:
- rider_id: UUID v4 (required)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)
- sortBy: string (optional, default delivered_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/cleared-deliveries?rider_id=84af0396-d76e-4a86-9678-318e1c078ad3&page=1&limit=10
- Full query example:
  - GET /hubs/parcels/cleared-deliveries?rider_id=84af0396-d76e-4a86-9678-318e1c078ad3&search=TRK&merchantName=Urban&area=Dhaka&minAmount=100&maxAmount=3000&sortBy=price&order=DESC&page=1&limit=10

Query variants summary:
- Required identity filter: `rider_id`
- Search/identity mix: `search`, `customerName`, `customerPhone`, `merchantName`
- Business filters: `merchantId`, `storeId`, `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

Success response example (full):
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


## 2.28 Carrybee Cleared Deliveries
GET /hubs/parcels/carrybee-cleared-deliveries

Access:
- HUB_MANAGER

Query:
- provider_id: UUID v4 (required)
- search: string (optional)
- merchantId: UUID v4 (optional)
- storeId: UUID v4 (optional)
- customerName: string (optional)
- customerPhone: string (optional)
- merchantName: string (optional)
- area: string (optional)
- minAmount: number (optional, >= 0)
- maxAmount: number (optional, >= 0)
- deliveryType: enum (optional) -> NORMAL | EXPRESS | SAME_DAY
- page: integer (optional, default 1, min 1)
- limit: integer (optional, default 10, min 1, max 100)
- sortBy: string (optional, default delivered_at)
- order: enum (optional, default DESC) -> ASC | DESC

Full endpoint example:
- GET /hubs/parcels/carrybee-cleared-deliveries?provider_id=4aef2e16-38cb-4e1f-b489-a946f239ab0d&page=1&limit=10
- Full query example:
  - GET /hubs/parcels/carrybee-cleared-deliveries?provider_id=4aef2e16-38cb-4e1f-b489-a946f239ab0d&search=MF13&customerPhone=0179&area=Dhaka&minAmount=100&maxAmount=5000&sortBy=merchant_price&order=ASC&page=1&limit=10

Query variants summary:
- Required identity filter: `provider_id`
- Search variants: `search`, `customerName`, `customerPhone`, `merchantName`
- Business filters: `merchantId`, `storeId`, `area`, `deliveryType`, `minAmount`, `maxAmount`
- Sort/pagination: `sortBy`, `order`, `page`, `limit`

Success response example (full):
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


# 3) Parcel Issue Reports

## 3.1 List Parcel Reports
GET /hubs/parcels/reports

Access:
- HUB_MANAGER, ADMIN

Query:
- hub_id: UUID v4 (optional, admin can filter)
- search: string (optional; parcel id or customer name)
- issue_type: enum (optional) -> INCORRECT_PHONE | WRONG_ADDRESS | INCORRECT_ADDRESS | NOT_AVAILABLE | PARCEL_DAMAGED | FRAUD | COD_AMOUNT_MISMATCH | CUSTOMER_REFUSED_TO_PAY | OTHER
- page: integer query-string (optional, default 1)
- limit: integer query-string (optional, default 10)

Full endpoint example:
- GET /hubs/parcels/reports?hub_id=8f8c6c8a-e8b4-4c37-88d0-249b09c69758&search=TRK-20260413-00031&issue_type=WRONG_ADDRESS&page=1&limit=10

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

## 4.1.1 Get System Riders (Detailed Status)
GET /riders/system

Access:
- HUB_MANAGER

Query:
- isActive: boolean (optional: true|false|all)

Description:
Returns riders with `rider_status` field (Leave, On duty, Break). Used for staffing overview.

Success response:
```json
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": "uuid",
        "full_name": "Rider Name",
        "rider_status": "On duty",
        "is_active": true
      }
    ]
  },
  "message": "System riders retrieved successfully"
}
```

## 4.2 Rider Settlement Details
GET /hubs/riders/:riderId/settlement

Access:
- HUB_MANAGER

Success response example (full):
```json
{
  "success": true,
  "data": {
    "rider_id": "99f46e35-5fc0-4ef4-8af6-8739ea11b74a",
    "rider_name": "Rider Name",
    "rider_phone": "01711111111",
    "total_collected_amount": 12000,
    "completed_deliveries": 7,
    "previous_due_amount": 500,
    "current_due_amount": 500,
    "period_start": "2026-04-01T00:00:00.000Z",
    "period_end": "2026-04-13T10:00:00.000Z",
    "breakdown": {
      "delivered": 5,
      "partial_delivery": 1,
      "exchange": 0,
      "paid_return": 1,
      "returned": 0
    },
    "parcels": [
      {
        "parcel_id": "f8602ff8-1f07-4f16-b300-2f9eff4d8c62",
        "parcel_tx_id": "MF130426A9X2",
        "tracking_number": "TRK-20260413-00031",
        "status": "DELIVERED",
        "collected_amount": 1450,
        "expected_cod_amount": 1450,
        "amount_difference": 0,
        "delivery_completed_at": "2026-04-13T08:30:00.000Z"
      }
    ]
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
    "rider_id": "99f46e35-5fc0-4ef4-8af6-8739ea11b74a",
    "rider_name": "Rider Name",
    "settlement_period": {
      "from": "2026-04-01T00:00:00.000Z",
      "to": "2026-04-13T10:00:00.000Z"
    },
    "calculation": {
      "total_collected_amount": 12000,
      "previous_due_amount": 500,
      "total_due_to_hub": 12500,
      "cash_received": 11000,
      "discrepancy_amount": -1500,
      "new_due_amount": 1500
    },
    "breakdown": {
      "delivered": 5,
      "partial_delivery": 1,
      "exchange": 0,
      "paid_return": 1,
      "returned": 0
    }
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

Success response example (full):
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
      "id": "cc2a1464-4d3c-4e4d-94b1-c067fc31be4d",
      "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "transferred_amount": 50000,
      "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
      "admin_account_name": "Admin Main Account",
      "admin_account_number": "1234567890",
      "admin_account_holder_name": "Company Admin",
      "transaction_reference_id": "TXN-100001",
      "proof_file_url": "https://cdn.example.com/proof.pdf",
      "status": "PENDING",
      "reviewed_by": null,
      "reviewed_at": null,
      "admin_notes": null,
      "rejection_reason": null,
      "notes": "optional",
      "transfer_date": "2026-04-13T09:00:00.000Z",
      "created_at": "2026-04-13T09:00:00.000Z",
      "updated_at": "2026-04-13T09:00:00.000Z"
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
        "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
        "admin_account_name": "Main Settlement Account",
        "admin_account_number": "2345123456789",
        "admin_account_holder_name": "Company Admin",
        "transaction_reference_id": "TXN-100001",
        "proof_file_url": "https://cdn.example.com/proof.pdf",
        "status": "PENDING",
        "reviewed_by": null,
        "reviewed_at": null,
        "admin_notes": null,
        "rejection_reason": null,
        "notes": "optional",
        "transfer_date": "2026-04-13T09:00:00.000Z",
        "created_at": "2026-04-13T09:00:00.000Z",
        "updated_at": "2026-04-13T09:00:00.000Z",
        "reviewer": null,
        "hub": {
          "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
          "hub_code": "DHK_MAIN",
          "branch_name": "Dhaka Main Hub"
        }
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
      "id": "cc2a1464-4d3c-4e4d-94b1-c067fc31be4d",
      "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "transferred_amount": 50000,
      "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
      "admin_account_name": "Admin Main Account",
      "admin_account_number": "1234567890",
      "admin_account_holder_name": "Company Admin",
      "transaction_reference_id": "TXN-100001",
      "proof_file_url": "https://cdn.example.com/proof.pdf",
      "status": "PENDING",
      "reviewed_by": null,
      "reviewed_at": null,
      "admin_notes": null,
      "rejection_reason": null,
      "notes": "optional",
      "transfer_date": "2026-04-13T09:00:00.000Z",
      "created_at": "2026-04-13T09:00:00.000Z",
      "updated_at": "2026-04-13T09:00:00.000Z",
      "hubManager": {
        "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "user": {
          "id": "495a7669-11ee-4c6d-a7b1-2e4cf731dd37",
          "full_name": "Dhaka Hub Manager"
        }
      },
      "hub": {
        "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "branch_name": "Dhaka Main Hub"
      },
      "reviewer": null
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
      "id": "cc2a1464-4d3c-4e4d-94b1-c067fc31be4d",
      "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "transferred_amount": 52000,
      "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
      "admin_account_name": "Admin Main Account",
      "admin_account_number": "1234567890",
      "admin_account_holder_name": "Company Admin",
      "transaction_reference_id": "TXN-100002",
      "proof_file_url": "https://cdn.example.com/new-proof.pdf",
      "status": "PENDING",
      "reviewed_by": null,
      "reviewed_at": null,
      "admin_notes": null,
      "rejection_reason": null,
      "notes": "updated notes",
      "transfer_date": "2026-04-13T09:00:00.000Z",
      "created_at": "2026-04-13T09:00:00.000Z",
      "updated_at": "2026-04-13T10:15:00.000Z"
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "available_balance": 150000,
    "transferred_this_month": 32000,
    "expenses_this_month": 1200,
    "pending_transfer": 20000,
    "lifetime_expenses": 5000,
    "lifetime_transferred": 92000
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
    "rider_id": "84af0396-d76e-4a86-9678-318e1c078ad3",
    "parcel_count": 5,
    "counted_amount": 13000,
    "cod_cleared_at": "2026-04-13T10:30:00.000Z",
    "current_balance": 150000,
    "message": "COD collection processed successfully"
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
  "message": "COD collected from Carrybee successfully",
  "data": {
    "provider_id": "4aef2e16-38cb-4e1f-b489-a946f239ab0d",
    "provider_name": "Carrybee",
    "parcel_count": 9,
    "total_expected_amount": 22000,
    "counted_amount": 22000,
    "discrepancy": 0,
    "cod_cleared_at": "2026-04-13T10:30:00.000Z",
    "current_balance": 172000,
    "message": "COD collected from Carrybee successfully"
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
    "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "reason": "Printer paper",
    "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
    "status": "IN_REVIEW",
    "reviewed_by": null,
    "reviewed_at": null,
    "rejection_reason": null,
    "created_at": "2026-04-13T08:10:00.000Z",
    "updated_at": "2026-04-13T08:10:00.000Z"
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
    "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "transferred_amount": 50000,
    "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
    "admin_account_name": "Admin Main Account",
    "admin_account_number": "1234567890",
    "admin_account_holder_name": "Company Admin",
    "transaction_reference_id": "TXN-200001",
    "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
    "status": "IN_REVIEW",
    "reviewed_by": null,
    "reviewed_at": null,
    "rejection_reason": null,
    "notes": "weekly transfer",
    "transfer_date": "2026-04-13T09:00:00.000Z",
    "created_at": "2026-04-13T09:00:00.000Z",
    "updated_at": "2026-04-13T09:00:00.000Z"
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "transferred_amount": 50000,
        "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
        "admin_account_name": "Admin Main Account",
        "admin_account_number": "1234567890",
        "admin_account_holder_name": "Company Admin",
        "transaction_reference_id": "TXN-200001",
        "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
        "status": "IN_REVIEW",
        "reviewed_by": null,
        "reviewed_at": null,
        "admin_notes": null,
        "rejection_reason": null,
        "notes": "weekly transfer",
        "transfer_date": "2026-04-13T09:00:00.000Z",
        "created_at": "2026-04-13T09:00:00.000Z",
        "updated_at": "2026-04-13T09:00:00.000Z"
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "transferred_amount": 50000,
    "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
    "admin_account_name": "Admin Main Account",
    "admin_account_number": "1234567890",
    "admin_account_holder_name": "Company Admin",
    "transaction_reference_id": "TXN-200001",
    "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
    "status": "IN_REVIEW",
    "reviewed_by": null,
    "reviewed_at": null,
    "admin_notes": null,
    "rejection_reason": null,
    "notes": "weekly transfer",
    "transfer_date": "2026-04-13T09:00:00.000Z",
    "created_at": "2026-04-13T09:00:00.000Z",
    "updated_at": "2026-04-13T09:00:00.000Z",
    "reviewer": null
  }
}
```

## 7.8 Finance Overview
GET /hubs/finance/overview

Access:
- HUB_MANAGER

Success response example (full):
```json
{
  "success": true,
  "data": {
    "available_balance": 55000,
    "transferred_this_month": 130000,
    "expenses_this_month": 15000,
    "pending_transfer": 20000,
    "lifetime_expenses": 42000,
    "lifetime_transferred": 130000
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "amount": 1500,
        "category": "OFFICE_SUPPLY",
        "reason": "Printer paper",
        "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
        "status": "IN_REVIEW",
        "reviewed_by": null,
        "reviewed_at": null,
        "rejection_reason": null,
        "created_at": "2026-04-13T08:10:00.000Z",
        "updated_at": "2026-04-13T08:10:00.000Z"
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "reason": "Printer paper",
    "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
    "status": "IN_REVIEW",
    "reviewed_by": null,
    "reviewed_at": null,
    "rejection_reason": null,
    "created_at": "2026-04-13T08:10:00.000Z",
    "updated_at": "2026-04-13T08:10:00.000Z",
    "reviewer": null
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

Success response example (full):
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "id": "38f9e1c4-6f67-42dd-b59e-9cf4d26a4282",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "amount": 1500,
        "category": "OFFICE_SUPPLY",
        "reason": "Printer paper",
        "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
        "status": "IN_REVIEW",
        "reviewed_by": null,
        "reviewed_at": null,
        "rejection_reason": null,
        "created_at": "2026-04-13T08:10:00.000Z",
        "updated_at": "2026-04-13T08:10:00.000Z"
      }
    ],
    "transfers": [
      {
        "id": "2efb9a0f-cffd-4afe-89f8-0f1e492f8cca",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "transferred_amount": 50000,
        "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
        "admin_account_name": "Admin Main Account",
        "admin_account_number": "1234567890",
        "admin_account_holder_name": "Company Admin",
        "transaction_reference_id": "TXN-200001",
        "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
        "status": "IN_REVIEW",
        "reviewed_by": null,
        "reviewed_at": null,
        "rejection_reason": null,
        "notes": "weekly transfer",
        "transfer_date": "2026-04-13T09:00:00.000Z",
        "created_at": "2026-04-13T09:00:00.000Z",
        "updated_at": "2026-04-13T09:00:00.000Z"
      }
    ],
    "settlements": [
      {
        "id": "99f46e35-5fc0-4ef4-8af6-8739ea11b74a",
        "rider_id": "84af0396-d76e-4a86-9678-318e1c078ad3",
        "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "total_collected_amount": 6400,
        "cash_received": 6000,
        "discrepancy_amount": -400,
        "previous_due_amount": 0,
        "new_due_amount": 400,
        "completed_deliveries": 7,
        "delivered_count": 6,
        "partial_delivery_count": 1,
        "exchange_count": 0,
        "paid_return_count": 0,
        "returned_count": 0,
        "settlement_status": "PARTIAL",
        "period_start": "2026-04-01T00:00:00.000Z",
        "period_end": "2026-04-13T10:30:00.000Z",
        "settled_at": "2026-04-13T10:42:00.000Z",
        "created_at": "2026-04-13T10:42:00.000Z",
        "updated_at": "2026-04-13T10:42:00.000Z"
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

Success response example (full):
```json
{
  "success": true,
  "data": [
    {
      "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
      "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "transferred_amount": 50000,
      "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
      "admin_account_name": "Admin Main Account",
      "admin_account_number": "1234567890",
      "admin_account_holder_name": "Company Admin",
      "status": "IN_REVIEW",
      "transaction_reference_id": "TXN-200001",
      "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
      "reviewed_by": null,
      "reviewed_at": null,
      "rejection_reason": null,
      "notes": "weekly transfer",
      "transfer_date": "2026-04-13T09:00:00.000Z",
      "created_at": "2026-04-13T09:00:00.000Z",
      "updated_at": "2026-04-13T09:00:00.000Z",
      "hub": {
        "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "branch_name": "Dhaka Main Hub"
      },
      "hubManager": {
        "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "user": {
          "id": "495a7669-11ee-4c6d-a7b1-2e4cf731dd37",
          "full_name": "Dhaka Hub Manager",
          "phone": "01711111111"
        }
      },
      "reviewer": null
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
    "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "transferred_amount": 50000,
    "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
    "admin_account_name": "Admin Main Account",
    "admin_account_number": "1234567890",
    "admin_account_holder_name": "Company Admin",
    "transaction_reference_id": "TXN-200001",
    "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
    "status": "IN_REVIEW",
    "reviewed_by": null,
    "reviewed_at": null,
    "admin_notes": null,
    "rejection_reason": null,
    "notes": "weekly transfer",
    "transfer_date": "2026-04-13T09:00:00.000Z",
    "created_at": "2026-04-13T09:00:00.000Z",
    "updated_at": "2026-04-13T09:00:00.000Z",
    "hub": {
      "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "branch_name": "Dhaka Main Hub"
    },
    "hubManager": {
      "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "user": {
        "id": "495a7669-11ee-4c6d-a7b1-2e4cf731dd37",
        "full_name": "Dhaka Hub Manager",
        "phone": "01711111111"
      }
    },
    "reviewer": null
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

Success response example (full):
```json
{
  "success": true,
  "data": [
    {
      "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
      "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "amount": 1500,
      "category": "OFFICE_SUPPLY",
      "reason": "Printer paper",
      "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
      "status": "IN_REVIEW",
      "reviewed_by": null,
      "reviewed_at": null,
      "rejection_reason": null,
      "created_at": "2026-04-13T08:10:00.000Z",
      "updated_at": "2026-04-13T08:10:00.000Z",
      "hub": {
        "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
        "branch_name": "Dhaka Main Hub"
      },
      "hubManager": {
        "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
        "user": {
          "id": "495a7669-11ee-4c6d-a7b1-2e4cf731dd37",
          "full_name": "Dhaka Hub Manager",
          "phone": "01711111111"
        }
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
    "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "reason": "Printer paper",
    "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
    "status": "IN_REVIEW",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "reviewed_by": null,
    "reviewed_at": null,
    "rejection_reason": null,
    "created_at": "2026-04-13T08:10:00.000Z",
    "updated_at": "2026-04-13T08:10:00.000Z",
    "hub": {
      "id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
      "branch_name": "Dhaka Main Hub"
    },
    "hubManager": {
      "id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
      "user": {
        "id": "495a7669-11ee-4c6d-a7b1-2e4cf731dd37",
        "full_name": "Dhaka Hub Manager",
        "phone": "01711111111"
      }
    },
    "reviewer": null
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
    "id": "fceeb52c-fd78-4fcf-a5a8-a2143001908a",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "transferred_amount": 50000,
    "admin_account_id": "8f9c9639-6cd0-4318-9edf-73b05742e40a",
    "admin_account_name": "Admin Main Account",
    "admin_account_number": "1234567890",
    "admin_account_holder_name": "Company Admin",
    "transaction_reference_id": "TXN-200001",
    "proof_file_url": "https://cdn.example.com/transfer-proof.jpg",
    "status": "APPROVED",
    "reviewed_by": "9e41beba-c5b3-4539-9f0e-76cb96154c2b",
    "reviewed_at": "2026-04-13T10:30:00.000Z",
    "admin_notes": null,
    "rejection_reason": null,
    "notes": "weekly transfer",
    "transfer_date": "2026-04-13T09:00:00.000Z",
    "created_at": "2026-04-13T09:00:00.000Z",
    "updated_at": "2026-04-13T10:30:00.000Z"
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
    "id": "91131ec1-1f8e-42db-a11d-16ebd9afe426",
    "hub_id": "8f8c6c8a-e8b4-4c37-88d0-249b09c69758",
    "hub_manager_id": "34f0679c-079f-4e8e-a9a8-4b94ca2517a5",
    "amount": 1500,
    "category": "OFFICE_SUPPLY",
    "reason": "Printer paper",
    "proof_file_url": "https://cdn.example.com/expense-proof.jpg",
    "status": "DECLINED",
    "reviewed_by": "9e41beba-c5b3-4539-9f0e-76cb96154c2b",
    "reviewed_at": "2026-04-13T10:30:00.000Z",
    "rejection_reason": "Bill not valid",
    "created_at": "2026-04-13T08:10:00.000Z",
    "updated_at": "2026-04-13T10:30:00.000Z"
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
7. In hub parcel list endpoints, prefer explicit sortBy values cod_amount, product_price, and total_charge; avoid alias price when exact pricing metric matters.

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
- Hub manager allowed statuses:
  - PENDING, PICKED_UP, OUT_FOR_PICKUP, IN_TRANSIT
- Admin allowed statuses:
  - PENDING, PICKED_UP, OUT_FOR_PICKUP, IN_TRANSIT, IN_HUB, ASSIGNED_TO_RIDER, ASSIGNED_TO_THIRD_PARTY
- Blocked statuses (examples):
  - OUT_FOR_DELIVERY, DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED, RETURN_TO_MERCHANT, DELIVERY_RESCHEDULED, CANCELLED
- Server recalculates:
  - total_charge = delivery_charge + weight_charge + cod_charge
  - receivable_amount = cod_amount - total_charge
- Recommended UI rule: show edit button only for allowed statuses above and hide for all delivery outcome/final statuses.

## 10.7 Received Parcel Edit (Phone/Address/Amount) Conditions

- Endpoint: PATCH /parcels/:id
- Hub manager allowed status: IN_HUB
- Hub manager editable fields only:
  - customer_phone
  - customer_address
  - product_price
- If hub manager sends other fields, API returns 400 with invalid fields message.
- If parcel is not received yet (PENDING/PICKED_UP/OUT_FOR_PICKUP/IN_TRANSIT), API returns 400 and requires post-receive edit timing.

## 10.8 Common Error Payload Patterns

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
  - Optional pre-receive correction (weight/delivery): PATCH /parcels/:id/hub-charges
2. Mark parcel as received in hub:
  - POST /hubs/parcels/receive
  - Optional post-receive correction (phone/address/amount): PATCH /parcels/:id
3. Load parcels ready for dispatch:
  - GET /hubs/parcels/for-assignment
4. Assign parcel(s) to rider:
  - POST /hubs/parcels/assign-rider
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
| PENDING / PICKED_UP / OUT_FOR_PICKUP / IN_TRANSIT | GET /hubs/parcels/received | PATCH /parcels/:id/hub-charges | Status unchanged (weight/charge updated) |
| IN_HUB | GET /hubs/parcels/for-assignment, GET /hubs/parcels | POST /hubs/parcels/assign-rider | ASSIGNED_TO_RIDER |
| IN_HUB | GET /hubs/parcels/for-assignment, GET /hubs/parcels | PATCH /parcels/:id | IN_HUB (phone/address/amount updated) |
| IN_HUB | GET /parcels/hub/in-hub | PATCH /hubs/parcels/:id/transfer | IN_TRANSIT |
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
- Show Edit Weight/Delivery only for pre-receive rows (PENDING/PICKED_UP/OUT_FOR_PICKUP/IN_TRANSIT).
- Show Edit Phone/Address/Amount only for IN_HUB rows.
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
- PATCH /parcels/:id

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
