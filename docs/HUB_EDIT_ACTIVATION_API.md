# Hub Edit and Activation APIs

These endpoints already exist in the backend. They are restricted to
administrators.

## Edit a hub

### API Name

Update Hub

### Method + Endpoint

```http
PATCH /hubs/:hubId
```

### Authentication

```http
Authorization: Bearer <admin-token>
Content-Type: application/json
```

Role: `ADMIN`

### Path Parameter

`hubId`: UUID, required.

### Request Body

```json
{
  "branch_name": "Uttara Branch",
  "area": "Uttara",
  "address": "House 7, Road 10, Uttara, Dhaka",
  "manager_name": "Hridoy",
  "manager_phone": "01760652026",
  "manager_user_id": "manager-user-uuid"
}
```

This is a partial update. The frontend can send only the changed fields.

Allowed fields:

- `branch_name`: string, optional, maximum 255 characters
- `area`: string, optional, maximum 255 characters
- `address`: string, optional
- `manager_name`: string, optional, maximum 255 characters
- `manager_phone`: string, optional, maximum 50 characters
- `manager_user_id`: UUID v4, optional

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "hub-uuid",
    "hub_code": "HUB-DHK-001"
  },
  "message": "Hub updated successfully",
  "timestamp": "2026-09-22T00:00:00.000Z"
}
```

### Error Responses

No fields supplied (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "No fields provided for update",
  "timestamp": "2026-09-22T00:00:00.000Z",
  "path": "/hubs/hub-uuid"
}
```

Hub not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Hub with ID 'hub-uuid' not found",
  "timestamp": "2026-09-22T00:00:00.000Z",
  "path": "/hubs/hub-uuid"
}
```

### Business Rules

- Send only changed fields.
- At least one allowed field is required.
- Do not send `hub_code`, `status`, `is_active`, or
  `third_party_enabled` through this API.
- Activation, deactivation, and third-party availability have separate
  endpoints.
- The current success response returns the hub ID and hub code, not the full
  updated hub object.

---

## Deactivate a hub

### API Name

Deactivate Hub

### Method + Endpoint

```http
PATCH /hubs/:hubId/deactivate
```

### Authentication

```http
Authorization: Bearer <admin-token>
```

Role: `ADMIN`

### Path Parameter

`hubId`: UUID, required.

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "hub-uuid",
    "hub_code": "HUB-DHK-001",
    "status": "ACTIVE",
    "is_active": false
  },
  "message": "Hub deactivated successfully",
  "timestamp": "2026-09-22T00:00:00.000Z"
}
```

### Error Response

Hub not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Hub with ID 'hub-uuid' not found",
  "timestamp": "2026-09-22T00:00:00.000Z",
  "path": "/hubs/hub-uuid/deactivate"
}
```

### Business Rules

- This is temporary deactivation, not deletion.
- It sets `is_active` to `false`.
- It currently does not change the hub `status` enum. Therefore, a successful
  response can contain `status: "ACTIVE"` together with `is_active: false`.
- Permanent rejection uses the separate `PATCH /hubs/:hubId/decline`
  endpoint.

---

## Activate a hub

### API Name

Activate Hub

### Method + Endpoint

```http
PATCH /hubs/:hubId/activate
```

### Authentication

```http
Authorization: Bearer <admin-token>
```

Role: `ADMIN`

### Path Parameter

`hubId`: UUID, required.

### Request Body

None.

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "hub-uuid",
    "hub_code": "HUB-DHK-001",
    "status": "ACTIVE",
    "is_active": true
  },
  "message": "Hub activated successfully",
  "timestamp": "2026-09-22T00:00:00.000Z"
}
```

### Error Response

Hub not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Hub with ID 'hub-uuid' not found",
  "timestamp": "2026-09-22T00:00:00.000Z",
  "path": "/hubs/hub-uuid/activate"
}
```

### Business Rules

- It sets `is_active` to `true`.
- It currently does not change the hub `status` enum.
- This endpoint is intended to reverse temporary deactivation.

## Current Integration Notes

- `GET /hubs` currently does not include `is_active` in each hub item.
  Consequently, after a list refresh the frontend cannot determine the saved
  active/deactivated state from the hub list response.
- The service contains logic intended to activate or deactivate the related
  manager user. However, the hub lookup used by these endpoints does not load
  the `manager_user` relation, so that related user is not reliably updated by
  the current endpoint execution.
