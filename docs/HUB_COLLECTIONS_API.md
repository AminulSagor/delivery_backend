# Hub Collections API

## GET `/admin/hub-collections`

Returns the list of hubs for the HUB cash collection screen.

### Request

No request body.

### Query Parameters

- `page` - page number, default `1`
- `limit` - items per page, default `20`
- `search` - search by `branch_name`, `hub_code`, `manager name`, or `manager phone`
- `area` - filter by hub area
- `sortBy` - `branch_name`, `hub_code`, `area`, `created_at`
- `order` - `ASC` or `DESC`

### Response Fields

- `success` - boolean
- `data.items[]`
  - `id`
  - `hub_code`
  - `branch_name`
  - `area`
  - `address`
  - `manager.id`
  - `manager.name`
  - `manager.phone`
  - `lifetime_collection`
  - `hub_expenses`
  - `pending_amount`
  - `last_received_at`
- `data.pagination`
  - `total`
  - `page`
  - `limit`
  - `totalPages`
  - `hasNext`
  - `hasPrev`
- `message`

### Example Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "c8f7f7d1-2e43-4b39-a35d-7d3e8b8a1a11",
        "hub_code": "HUB-DHK-001",
        "branch_name": "Dhanmondi Branch",
        "area": "Dhanmondi",
        "address": "Plot#142, Safwan Road",
        "manager": {
          "id": "a1f2d3c4-5678-4ef1-9f20-111122223333",
          "name": "Fokrul Alam",
          "phone": "+880123456789"
        },
        "lifetime_collection": 50500,
        "hub_expenses": 14000,
        "pending_amount": 0,
        "last_received_at": "2026-05-18T09:00:00.000Z"
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
  "message": "Hub collections retrieved successfully"
}
```

### Notes

- This endpoint is read-only.
- It does not require a request body.
- Use `search` and `area` together when narrowing the hub list for the collection dashboard.
