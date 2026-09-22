# Hub Third-Party Availability API

The hub-level `third_party_enabled` flag controls whether the frontend should
show third-party delivery features for a hub. New and existing hubs default to
`false`.

## Read the current hub setting after login

### API Name

Get My Hub

### Method + Endpoint

```http
GET /hubs/my-hub
```

### Authentication

```http
Authorization: Bearer <hub-manager-token>
```

Role: `HUB_MANAGER`

### Success Response

```json
{
  "success": true,
  "data": {
    "hub": {
      "id": "hub-uuid",
      "hub_code": "HUB-DHK-001",
      "branch_name": "Dhaka Hub",
      "area": "Dhaka",
      "address": "Dhaka",
      "manager_name": "Hub Manager",
      "manager_phone": "01700000000",
      "third_party_enabled": true,
      "manager_email": "manager@example.com",
      "created_at": "2026-09-22T00:00:00.000Z",
      "updated_at": "2026-09-22T00:00:00.000Z"
    }
  },
  "message": "Hub information retrieved successfully",
  "timestamp": "2026-09-22T00:00:00.000Z"
}
```

Read the toggle value from `data.hub.third_party_enabled`.

The same field is also returned for each hub by `GET /hubs` and by the hub
object from `GET /hubs/:id`.

## Toggle third-party availability for a hub

### API Name

Toggle Hub Third-Party Availability

### Method + Endpoint

```http
PATCH /hubs/:hubId/third-party
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
  "enabled": true
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "hub-uuid",
    "hub_code": "HUB-DHK-001",
    "third_party_enabled": true
  },
  "message": "Third-party delivery enabled for hub successfully"
}
```

### Error Responses

Invalid request body (`400 Bad Request`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["enabled must be a boolean"]
}
```

Hub not found (`404 Not Found`):

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Hub with ID 'hub-uuid' not found"
}
```

## Business Rules

- The value is persisted per hub.
- New and existing hubs default to `false`.
- Only an administrator can change the value.
- A hub manager can read the value for their assigned hub after login.
- The frontend should use `data.hub.third_party_enabled` as its source of
  truth and must not default the switch locally.
- The setting is returned by the admin hub list so every row can display its
  persisted switch state.
- This flag is a feature-availability signal. It does not activate or
  deactivate an individual third-party provider.
