# Riders & Parcels API — Endpoints, Filters, Examples

Date: 2026-05-04

Auth: All endpoints require a JWT bearer token. Roles used below: `ADMIN`, `HUB_MANAGER`, `RIDER`.

Notes on enums:
- Parcel statuses commonly used in filters: `IN_HUB`, `ASSIGNED_TO_RIDER`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED_DELIVERY`, `RETURNED_TO_HUB`, `DELIVERY_RESCHEDULED`, `IN_TRANSIT`, `PARTIAL_DELIVERY`, `EXCHANGE`, `PAID_RETURN`.

**Get Riders List**
- Method: `GET`
- Path: `/riders`
- Roles: `ADMIN`, `HUB_MANAGER`
- Query params:
  - `hubId` (admin-only) — UUID
  - `isActive` — `true` | `false` | `all` (default: only active riders)
  - `approval_status` — rider approval status (enum)
  - `search` — free-text search on name/phone
  - `page`, `limit` — pagination

Example request:
GET /riders?page=1&limit=10&search=rahim
Authorization: Bearer <HUB_MANAGER_TOKEN>

Example response (200):
{
  "success": true,
  "data": {
    "riders": [
      {
        "id": "b1f2...",
        "rider_code": "RDR001",
        "user_id": "u1a2...",
        "hub_id": "h1a2...",
        "photo": "https://.../photo.jpg",
        "full_name": "Rahim Uddin",
        "phone": "01712345678",
        "is_active": true,
        "rider_status": "On duty",
        "assigned_parcels_count": 5,
        "license_no": "DL-12345",
        "hub": { "id": "h1a2...", "branch_name": "Dhaka North" },
        "created_at": "2026-03-01T08:00:00.000Z"
      },
      {
        "id": "c3d4...",
        "full_name": "Karim Ahmed",
        "phone": "01798765432",
        "is_active": true,
        "rider_status": "Break",
        "assigned_parcels_count": 0,
        "license_no": null
      }
    ],
    "pagination": { "total": 2, "page": 1, "limit": 10, "totalPages": 1 }
  },
  "message": "Riders retrieved successfully"
}

**Get Rider Detail**
- Method: `GET`
- Path: `/riders/:id`
- Roles: `ADMIN`, `HUB_MANAGER`

Example request:
GET /riders/b1f2...
Authorization: Bearer <ADMIN_TOKEN>

Example response (200):
{
  "success": true,
  "data": {
    "id": "b1f2...",
    "rider_code": "RDR001",
    "user_id": "u1a2...",
    "hub_id": "h1a2...",
    "photo": "https://.../photo.jpg",
    "full_name": "Rahim Uddin",
    "phone": "01712345678",
    "is_active": true,
    "rider_status": "On duty",
    "assigned_parcels_count": 5,
    "license_no": "DL-12345",
    "present_address": "Dhaka, Bangladesh",
    "commission_per_delivery": 20,
    "created_at": "2026-03-01T08:00:00.000Z"
  },
  "message": "Rider retrieved successfully"
}

**List Rider's Assigned Parcels**
- Method: `GET`
- Path: `/riders/:id/parcels`
- Roles: `ADMIN`, `HUB_MANAGER`
- Query params:
  - `status` — single parcel status string (see statuses above)
  - `filter` — one of `pickup_pending`, `delivery_pending`, `delivery_completed`, `return_pending`, `return_completed`, `all`

Notes: Hub managers can access only riders in their hub; admins can access any rider.

Example request:
GET /riders/b1f2.../parcels?filter=delivery_pending
Authorization: Bearer <HUB_MANAGER_TOKEN>

Example response (200):
{
  "success": true,
  "data": [
    {
      "id": "p-111...",
      "parcel_tx_id": "#139679",
      "tracking_number": "TRK123456789",
      "customer": { "id": "cust-1", "customer_name": "Nazma Begum", "phone_number": "01911223344", "customer_address": "House 12, Road 5, Dhanmondi, Dhaka" },
      "special_instructions": "Leave at gate if not home",
      "merchant": { "id": "m-1", "full_name": "ABC Store", "phone": "01811223344", "email": "owner@abc.com" },
      "store": { "id": "s-1", "business_name": "ABC Store Branch" },
      "amount": {
        "delivery_charge": 60,
        "cod_charge": 0,
        "weight_charge": 15,
        "discount": 5,
        "total": 70
      },
      "is_cod": false,
      "status": "ASSIGNED_TO_RIDER",
      "assigned_rider": { "id": "b1f2...", "full_name": "Rahim Uddin", "phone": "01712345678" },
      "picked_up_at": null,
      "out_for_delivery_at": null,
      "created_at": "2026-05-01T09:00:00.000Z",
      "updated_at": "2026-05-02T07:00:00.000Z",
      "parcel_age": "2 days"
    },
    {
      "id": "p-112...",
      "parcel_tx_id": "#139680",
      "tracking_number": "TRK123456790",
      "customer": { "customer_name": "Ayesha Khan", "phone_number": "01755443322", "customer_address": "House 7, Gulshan, Dhaka" },
      "special_instructions": null,
      "merchant": { "full_name": "XYZ Shop", "phone": "01999887766" },
      "amount": { "delivery_charge": 50, "cod_charge": 30, "weight_charge": 0, "discount": 0, "total": 80 },
      "is_cod": true,
      "status": "OUT_FOR_DELIVERY",
      "assigned_rider": { "id": "b1f2...", "full_name": "Rahim Uddin" },
      "out_for_delivery_at": "2026-05-03T09:30:00.000Z",
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-03T09:30:00.000Z",
      "parcel_age": "2 days"
    }
  ],
  "count": 2,
  "message": "Assigned parcels retrieved successfully"
}

**Parcel Detail (with Tracking Timeline)**
- Method: `GET`
- Path: `/parcels/:id`
- Roles: `MERCHANT`, `ADMIN`, `RIDER`, `HUB_MANAGER` (access rules apply)

Example request:
GET /parcels/p-111...
Authorization: Bearer <ADMIN_TOKEN>

Example response (200):
{
  "parcel": {
    "id": "p-111...",
    "parcel_tx_id": "#139679",
    "tracking_number": "TRK123456789",
    "customer_name": "Nazma Begum",
    "customer_phone": "01911223344",
    "customer_address": "House 12, Road 5, Dhanmondi, Dhaka",
    "delivery_charge": 60,
    "weight_charge": 15,
    "cod_charge": 0,
    "discount": 5,
    "total_charge": 70,
    "status": "ASSIGNED_TO_RIDER",
    "assigned_rider": { "id": "b1f2...", "full_name": "Rahim Uddin", "phone": "01712345678" },
    "created_at": "2026-05-01T09:00:00.000Z",
    "updated_at": "2026-05-02T07:00:00.000Z",
    "tracking": {
      "parcel_id": "#139679",
      "current_status": "ASSIGNED_TO_RIDER",
      "delivery_milestones": [
        { "key": "picked", "label": "Picked", "is_completed": false },
        { "key": "sorted", "label": "Sorted", "is_completed": true },
        { "key": "in_transit", "label": "In Transit", "is_completed": false },
        { "key": "received_at_lmh", "label": "Received At LMH", "is_completed": true },
        { "key": "assigned_for_delivery", "label": "Assigned For Delivery", "is_completed": true },
        { "key": "delivered", "label": "Delivered", "is_completed": false }
      ],
      "activities": [
        { "id": 1, "message": "Order has been created", "timestamp": "2026-05-01T09:00:00.000Z", "location": null },
        { "id": 2, "message": "Order is being processed and sorted at Dhaka North", "timestamp": "2026-05-02T07:00:00.000Z", "location": "Dhaka North" },
        { "id": 3, "message": "parcel is assigned for delivery to Rahim Uddin (01712345678)", "timestamp": "2026-05-02T07:05:00.000Z", "location": null }
      ]
    }
  },
  "message": "Parcel retrieved successfully"
}

**Assign Parcel(s) to Rider (Single or Bulk)**
- Method: `POST`
- Path: `/hubs/parcels/assign-rider`
- Roles: `HUB_MANAGER`, `ADMIN`
- Body (single): { "rider_id": "<RIDER_UUID>", "parcel_id": "<PARCEL_UUID>" }
- Body (bulk): { "rider_id": "<RIDER_UUID>", "parcel_ids": ["<PARCEL_UUID1>", "<PARCEL_UUID2>"] }

Example request (bulk):
POST /hubs/parcels/assign-rider
Authorization: Bearer <HUB_MANAGER_TOKEN>
Content-Type: application/json

{
  "rider_id": "b1f2...",
  "parcel_ids": ["p-111...","p-112..."]
}

Example response (200):
{
  "success": true,
  "data": {
    "summary": { "total": 2, "success": 2, "failed": 0 },
    "results": [
      { "parcel_id": "p-111...", "parcel_tx_id": "#139679", "tracking_number": "TRK123456789", "success": true },
      { "parcel_id": "p-112...", "parcel_tx_id": "#139680", "tracking_number": "TRK123456790", "success": true }
    ]
  },
  "message": "2 parcels assigned to rider successfully"
}

**Bulk Transfer: Transfer All Parcels From One/More Riders to Target Rider**
- Method: `POST`
- Path: `/hubs/parcels/transfer-from-riders`
- Roles: `HUB_MANAGER`, `ADMIN`
- Body:
  - `target_rider_id` (UUID)
  - `source_rider_ids` (UUID[])
  - `statuses` (optional) — array of parcel status strings to include
  - `notes` (optional)

Example request:
POST /hubs/parcels/transfer-from-riders
Authorization: Bearer <HUB_MANAGER_TOKEN>
Content-Type: application/json

{
  "target_rider_id": "d9e8...",
  "source_rider_ids": ["b1f2...","c3d4..."],
  "statuses": ["ASSIGNED_TO_RIDER","OUT_FOR_DELIVERY"]
}

Example response (200):
{
  "success": true,
  "data": {
    "summary": { "total": 6, "transferred": 5, "failed": 1 },
    "results": [
      { "parcel_id": "p-111...", "parcel_tx_id": "#139679", "tracking_number": "TRK123456789", "success": true },
      { "parcel_id": "p-113...", "parcel_tx_id": "#139681", "tracking_number": "TRK123456791", "success": false, "error": "Parcel is not in your hub" }
    ]
  },
  "message": "5 parcels transferred, 1 failed"
}

**Common Errors**
- `400 Bad Request` — missing required params, invalid UUID, or invalid status.
- `403 Forbidden` — Hub manager accessing riders/parcels outside their hub.
- `404 Not Found` — rider or parcel not found.

---

File: [docs/RIDERS_PARCELS_API.md](docs/RIDERS_PARCELS_API.md)
