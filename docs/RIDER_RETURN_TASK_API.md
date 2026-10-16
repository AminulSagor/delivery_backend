# Rider Return Task API

## API Name

Get Rider Return List

## Method + Endpoint

GET /riders/return-tasks?tab=pending

## Authentication

Authorization: Bearer \<rider-token>

Role:

RIDER

## Query Parameter

`tab`: `pending` or `completed`, optional, default `pending`

## Request Body

None.

## Success Response

```json
{
  "success": true,
  "data": [
    {
      "id": "merchant-uuid",
      "merchant_id": "merchant-uuid",
      "name": "Booklet Design BD",
      "address": "Southeast Bank, Bashundhara Branch, Plot 142, Safwan Road, Dhaka",
      "phone": "+8801712345678",
      "image": "https://cdn.example.com/merchant.png",
      "number_of_parcels": 12,
      "parcels": [
        {
          "id": "return-parcel-uuid",
          "return_parcel_id": "MR161026A1B2",
          "original_parcel_uuid": "original-parcel-uuid",
          "parcel_id": "MF151026C3D4",
          "customer_name": "Farzana Rahman",
          "customer_phone": "+880123456789",
          "status": "ASSIGNED_TO_RIDER"
        }
      ]
    }
  ],
  "count": 1,
  "tab": "pending",
  "message": "Return tasks retrieved successfully"
}
```

## Error Response

401 Unauthorized

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

## Business Rules

- The response contains only return parcels assigned to the authenticated rider.
- Return parcels are grouped by merchant, so the frontend displays one card per merchant.
- The card includes the merchant name, default-store address, phone number, image, and parcel count.
- Pending contains today's assigned return parcels with `ASSIGNED_TO_RIDER` status.
- Completed contains today's parcels completed as `RETURN_TO_MERCHANT`.
- If no default store exists, the parcel-linked store is used.

---

## API Name

Get Rider Return Details

## Method + Endpoint

GET /riders/return-tasks/:merchantId?tab=pending

## Authentication

Authorization: Bearer \<rider-token>

Role:

RIDER

## Path Parameter

`merchantId`: UUID, required

## Query Parameter

`tab`: `pending`, `completed`, or `all`, optional, default `pending`

## Request Body

None.

## Success Response

```json
{
  "success": true,
  "data": {
    "id": "merchant-uuid",
    "merchant_id": "merchant-uuid",
    "name": "Booklet Design BD",
    "address": "Southeast Bank, Bashundhara Branch, Plot 142, Safwan Road, Dhaka",
    "phone": "+8801712345678",
    "image": "https://cdn.example.com/merchant.png",
    "number_of_parcels": 12,
    "parcels": [
      {
        "id": "return-parcel-uuid-1",
        "return_parcel_id": "MR161026A1B2",
        "original_parcel_uuid": "original-parcel-uuid-1",
        "parcel_id": "MF151026C3D4",
        "customer_name": "Farzana Rahman",
        "customer_phone": "+880123456789",
        "status": "ASSIGNED_TO_RIDER"
      },
      {
        "id": "return-parcel-uuid-2",
        "return_parcel_id": "MR161026E5F6",
        "original_parcel_uuid": "original-parcel-uuid-2",
        "parcel_id": "MF151026G7H8",
        "customer_name": "Urmi Akhter",
        "customer_phone": "+880123456788",
        "status": "ASSIGNED_TO_RIDER"
      }
    ]
  },
  "message": "Return task details retrieved successfully"
}
```

## Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Return task not found or not assigned to you"
}
```

## Business Rules

- A rider can access only a return task containing parcels assigned to that rider.
- Merchant ID, name, phone, address, image, and total parcel count are returned.
- Each item contains the original parcel ID and original customer name and phone.
- The route uses the merchant UUID returned as `merchant_id` by the return-list API.
- Frontend can filter the returned `parcels` array for its Parcel ID search box.

---

## API Name

Complete Rider Return To Merchant

## Method + Endpoint

PATCH /riders/return-tasks/:merchantId/complete

## Authentication

Authorization: Bearer \<rider-token>

Role:

RIDER

## Path Parameter

`merchantId`: UUID, required

## Request Body

None.

## Success Response

```json
{
  "success": true,
  "data": {
    "merchant_id": "merchant-uuid",
    "completed_at": "2026-10-16T18:00:00.000Z",
    "parcel_count": 12,
    "parcels": [
      {
        "id": "return-parcel-uuid-1",
        "parcel_id": "MR161026A1B2",
        "status": "RETURN_TO_MERCHANT"
      }
    ]
  },
  "message": "Parcels returned to merchant successfully"
}
```

## Error Response

404 Not Found

```json
{
  "success": false,
  "message": "No pending return parcels found for this merchant"
}
```

## Business Rules

- The operation completes every pending return parcel for the selected merchant assigned to the authenticated rider.
- All selected parcels are updated in one database transaction.
- If any database update fails, the entire operation is rolled back.
- Parcel status and rider action status become `RETURN_TO_MERCHANT`.
- `completed_at`, `delivered_at`, and rider-action timestamps are recorded.
- Retrying after successful completion returns `404` because no pending parcels remain.
- This API does not change COD or return-charge values.
