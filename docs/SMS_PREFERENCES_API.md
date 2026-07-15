# SMS Preference Settings API

Date: 2026-07-10

This guide documents the backend contract for:

`Dashboard > SMS Preference Settings`

Admins can turn parcel event SMS notifications on or off separately for customers and merchants.

Auth: all endpoints require a JWT bearer token with role `ADMIN`.

Base path:

`/admin/sms/preferences`

Global SMS controls still live under `/admin/sms/status`, `/admin/sms/toggle`, `/admin/sms/balance`, `/admin/sms/test`, and `/admin/sms/report`. The preference API controls event-level SMS permission; the global SMS toggle controls whether the SMS provider is active at all.

## Data Model

The backend stores one row per recipient and event in the `sms_preferences` table.

Recipients:

- `CUSTOMER`
- `MERCHANT`

Every preference has:

- `recipient`: who receives the SMS
- `event`: parcel lifecycle event
- `enabled`: whether SMS is allowed for that recipient/event

All preferences default to `enabled: true`. On the first `GET`, the backend auto-creates any missing rows.

## Events

Use these event keys in API payloads:

| Label | Event key |
| --- | --- |
| Parcel Created | `PARCEL_CREATED` |
| Pickup Man Assigned | `PICKUP_MAN_ASSIGNED` |
| Parcel Pickup Re-scheduled | `PARCEL_PICKUP_RESCHEDULED` |
| Parcel Received By Pickup Man | `PARCEL_RECEIVED_BY_PICKUP_MAN` |
| Parcel Received To Branch | `PARCEL_RECEIVED_TO_BRANCH` |
| Parcel Transferred To Branch Assigned | `PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED` |
| Parcel Received By Branch | `PARCEL_RECEIVED_BY_BRANCH` |
| Delivery Man Assigned | `DELIVERY_MAN_ASSIGNED` |
| Parcel Delivery Re-scheduled | `PARCEL_DELIVERY_RESCHEDULED` |
| Successfully Delivered To Customer | `SUCCESSFULLY_DELIVERED_TO_CUSTOMER` |
| Parcel Return To Branch | `PARCEL_RETURN_TO_BRANCH` |
| Parcel Return Assign To Merchant | `PARCEL_RETURN_ASSIGN_TO_MERCHANT` |
| Parcel Returned To Merchant | `PARCEL_RETURNED_TO_MERCHANT` |
| Parcel Cancelled | `PARCEL_CANCELLED` |

## Get Preferences

Method: `GET`

Path: `/admin/sms/preferences`

Roles: `ADMIN`

Example request:

```http
GET /admin/sms/preferences
Authorization: Bearer <ADMIN_TOKEN>
```

Example response:

```json
{
  "success": true,
  "data": {
    "customer": {
      "recipient": "CUSTOMER",
      "title": "Parcel Status SMS to Customer",
      "description": "Customer will receive parcel event change SMS",
      "events": [
        {
          "id": "9f6d65d6-5ca1-42b3-9377-7c84c0ff1f1f",
          "event": "PARCEL_CREATED",
          "label": "Parcel Created",
          "enabled": true,
          "updated_at": "2026-07-10T08:30:00.000Z"
        },
        {
          "id": "2078798f-114c-423e-a011-8a2c9b61fa19",
          "event": "DELIVERY_MAN_ASSIGNED",
          "label": "Delivery Man Assigned",
          "enabled": false,
          "updated_at": "2026-07-10T08:30:00.000Z"
        }
      ]
    },
    "merchant": {
      "recipient": "MERCHANT",
      "title": "Parcel Status SMS to Merchant",
      "description": "Merchant will receive parcel event change SMS",
      "events": [
        {
          "id": "575538dd-cf30-47ed-8648-4c7ff255ac3a",
          "event": "PARCEL_CREATED",
          "label": "Parcel Created",
          "enabled": true,
          "updated_at": "2026-07-10T08:30:00.000Z"
        }
      ]
    }
  },
  "timestamp": "2026-07-10T08:30:00.000Z"
}
```

The example only shows a few events to keep it short. The real response includes all event keys for both `customer.events` and `merchant.events`.

## Update Preferences

Method: `PATCH`

Path: `/admin/sms/preferences`

Roles: `ADMIN`

Content type: `application/json`

Request body:

```json
{
  "preferences": [
    {
      "recipient": "CUSTOMER",
      "event": "DELIVERY_MAN_ASSIGNED",
      "enabled": false
    },
    {
      "recipient": "MERCHANT",
      "event": "PARCEL_CREATED",
      "enabled": true
    }
  ]
}
```

Example request:

```http
PATCH /admin/sms/preferences
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json

{
  "preferences": [
    {
      "recipient": "CUSTOMER",
      "event": "DELIVERY_MAN_ASSIGNED",
      "enabled": false
    }
  ]
}
```

Example response:

```json
{
  "success": true,
  "data": {
    "customer": {
      "recipient": "CUSTOMER",
      "title": "Parcel Status SMS to Customer",
      "description": "Customer will receive parcel event change SMS",
      "events": [
        {
          "id": "2078798f-114c-423e-a011-8a2c9b61fa19",
          "event": "DELIVERY_MAN_ASSIGNED",
          "label": "Delivery Man Assigned",
          "enabled": false,
          "updated_at": "2026-07-10T08:35:00.000Z"
        }
      ]
    },
    "merchant": {
      "recipient": "MERCHANT",
      "title": "Parcel Status SMS to Merchant",
      "description": "Merchant will receive parcel event change SMS",
      "events": []
    }
  },
  "timestamp": "2026-07-10T08:35:00.000Z"
}
```

The real response returns all events for both recipients, not just the changed item.

Validation rules:

- `preferences` must be a non-empty array.
- `recipient` must be `CUSTOMER` or `MERCHANT`.
- `event` must be one of the event keys listed above.
- `enabled` must be boolean `true` or `false`.

Invalid payloads return `400 Bad Request`.

## Frontend Rendering Notes

Render two sections from the `GET` response:

- `data.customer`
- `data.merchant`

For each section:

1. Show `title`.
2. Show `description`.
3. Render `events` as rows.
4. Use `label` for the Event column.
5. Bind the Status switch or checkbox to `enabled`.
6. On save, send only changed rows or the whole matrix to `PATCH`.

Single-toggle save example:

```ts
await fetch(`${API_URL}/admin/sms/preferences`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    preferences: [
      {
        recipient: 'CUSTOMER',
        event: 'DELIVERY_MAN_ASSIGNED',
        enabled: false,
      },
    ],
  }),
});
```

## Backend Enforcement Notes

Current implemented enforcement:

- Customer `DELIVERY_MAN_ASSIGNED` preference is checked before sending the existing rider assignment SMS.

The rest of the events are stored and ready for UI control, but they need sender hooks when those parcel-event SMS messages are implemented. New SMS senders should call:

```ts
await smsPreferencesService.isEnabled(recipient, event)
```

before calling:

```ts
await smsService.sendSms(phone, message)
```

Relevant files:

- `src/admin/controllers/admin-sms-preferences.controller.ts`
- `src/admin/dto/update-sms-preferences.dto.ts`
- `src/admin/entities/sms-preference.entity.ts`
- `src/admin/services/sms-preferences.service.ts`
- `src/parcels/parcels.service.ts`
