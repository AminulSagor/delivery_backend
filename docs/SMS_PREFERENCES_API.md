# SMS Preference Settings Frontend API

## Available Recipients

```text
CUSTOMER
MERCHANT
```

## Available Event Keys

```text
PARCEL_CREATED
PICKUP_MAN_ASSIGNED
PARCEL_PICKUP_RESCHEDULED
PARCEL_RECEIVED_BY_PICKUP_MAN
PARCEL_RECEIVED_TO_BRANCH
PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED
PARCEL_RECEIVED_BY_BRANCH
DELIVERY_MAN_ASSIGNED
PARCEL_DELIVERY_RESCHEDULED
SUCCESSFULLY_DELIVERED_TO_CUSTOMER
PARCEL_RETURN_TO_BRANCH
PARCEL_RETURN_ASSIGN_TO_MERCHANT
PARCEL_RETURNED_TO_MERCHANT
PARCEL_CANCELLED
```

## Event Labels

- `PARCEL_CREATED`: Parcel Created
- `PICKUP_MAN_ASSIGNED`: Pickup Man Assigned
- `PARCEL_PICKUP_RESCHEDULED`: Parcel Pickup Re-scheduled
- `PARCEL_RECEIVED_BY_PICKUP_MAN`: Parcel Received By Pickup Man
- `PARCEL_RECEIVED_TO_BRANCH`: Parcel Received To Branch
- `PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED`: Parcel Transferred To Branch Assigned
- `PARCEL_RECEIVED_BY_BRANCH`: Parcel Received By Branch
- `DELIVERY_MAN_ASSIGNED`: Delivery Man Assigned
- `PARCEL_DELIVERY_RESCHEDULED`: Parcel Delivery Re-scheduled
- `SUCCESSFULLY_DELIVERED_TO_CUSTOMER`: Successfully Delivered To Customer
- `PARCEL_RETURN_TO_BRANCH`: Parcel Return To Branch
- `PARCEL_RETURN_ASSIGN_TO_MERCHANT`: Parcel Return Assign To Merchant
- `PARCEL_RETURNED_TO_MERCHANT`: Parcel Returned To Merchant
- `PARCEL_CANCELLED`: Parcel Cancelled

---

### API Name

Get SMS Preferences

### Method + Endpoint

GET /admin/sms/preferences

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Request Body

No request body.

### Success Response

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
          "id": "customer-preference-uuid",
          "event": "PARCEL_CREATED",
          "label": "Parcel Created",
          "enabled": true,
          "updated_at": "2026-09-28T16:00:00.000Z"
        },
        {
          "id": "customer-preference-uuid-2",
          "event": "DELIVERY_MAN_ASSIGNED",
          "label": "Delivery Man Assigned",
          "enabled": false,
          "updated_at": "2026-09-28T16:00:00.000Z"
        }
      ]
    },
    "merchant": {
      "recipient": "MERCHANT",
      "title": "Parcel Status SMS to Merchant",
      "description": "Merchant will receive parcel event change SMS",
      "events": [
        {
          "id": "merchant-preference-uuid",
          "event": "PARCEL_CREATED",
          "label": "Parcel Created",
          "enabled": true,
          "updated_at": "2026-09-28T16:00:00.000Z"
        }
      ]
    }
  },
  "timestamp": "2026-09-28T16:00:00.000Z"
}
```

The real response contains every supported event under both `customer.events` and `merchant.events`.

### Error Response

401 Unauthorized

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized",
  "timestamp": "2026-09-28T16:00:00.000Z",
  "path": "/admin/sms/preferences"
}
```

403 Forbidden

```json
{
  "success": false,
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Forbidden resource",
  "timestamp": "2026-09-28T16:00:00.000Z",
  "path": "/admin/sms/preferences"
}
```

### Business Rules

- Only an Admin can access this API.
- The backend returns separate Customer and Merchant sections.
- Render `data.customer.events` in the Customer table.
- Render `data.merchant.events` in the Merchant table.
- Use `label` for the Event column.
- Bind the toggle to `enabled`.
- Use `event` and `recipient` when sending an update.
- Missing preference rows are created automatically with `enabled: true`.
- The frontend must not create event labels itself; use the returned `label`.

---

### API Name

Update SMS Preferences

### Method + Endpoint

PATCH /admin/sms/preferences

### Authentication

Authorization: Bearer \<admin-token>

Role:

ADMIN

### Request Body

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

The frontend can send one changed switch or multiple changed switches in the same request.

Single-toggle example:

```json
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

### Success Response

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
          "id": "customer-preference-uuid",
          "event": "DELIVERY_MAN_ASSIGNED",
          "label": "Delivery Man Assigned",
          "enabled": false,
          "updated_at": "2026-09-28T16:05:00.000Z"
        }
      ]
    },
    "merchant": {
      "recipient": "MERCHANT",
      "title": "Parcel Status SMS to Merchant",
      "description": "Merchant will receive parcel event change SMS",
      "events": [
        {
          "id": "merchant-preference-uuid",
          "event": "PARCEL_CREATED",
          "label": "Parcel Created",
          "enabled": true,
          "updated_at": "2026-09-28T16:05:00.000Z"
        }
      ]
    }
  },
  "timestamp": "2026-09-28T16:05:00.000Z"
}
```

The actual response returns the complete Customer and Merchant preference matrix, not only the changed rows.

### Error Response

400 Bad Request — Empty preferences array

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["preferences must contain at least 1 elements"],
  "timestamp": "2026-09-28T16:05:00.000Z",
  "path": "/admin/sms/preferences"
}
```

400 Bad Request — Invalid recipient

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "recipient must be one of the following values: CUSTOMER, MERCHANT"
  ],
  "timestamp": "2026-09-28T16:05:00.000Z",
  "path": "/admin/sms/preferences"
}
```

400 Bad Request — Invalid event

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "event must be one of the following values: PARCEL_CREATED, PICKUP_MAN_ASSIGNED, PARCEL_PICKUP_RESCHEDULED, PARCEL_RECEIVED_BY_PICKUP_MAN, PARCEL_RECEIVED_TO_BRANCH, PARCEL_TRANSFERRED_TO_BRANCH_ASSIGNED, PARCEL_RECEIVED_BY_BRANCH, DELIVERY_MAN_ASSIGNED, PARCEL_DELIVERY_RESCHEDULED, SUCCESSFULLY_DELIVERED_TO_CUSTOMER, PARCEL_RETURN_TO_BRANCH, PARCEL_RETURN_ASSIGN_TO_MERCHANT, PARCEL_RETURNED_TO_MERCHANT, PARCEL_CANCELLED"
  ],
  "timestamp": "2026-09-28T16:05:00.000Z",
  "path": "/admin/sms/preferences"
}
```

### Business Rules

- `preferences` must be a non-empty array.
- `recipient` must be `CUSTOMER` or `MERCHANT`.
- `event` must be one of the supported event keys in this document.
- `enabled` must be boolean `true` or `false`, not `1`, `0`, or a string.
- Sending one switch does not overwrite other preferences.
- Duplicate recipient/event combinations are updated through database upsert.
- Return and replace the frontend's local matrix with the full response after a successful update.
- The Customer and Merchant values for the same event are independent.
- Do not send the preference row `id` in the update payload.

## Frontend Example

```ts
type SmsRecipient = 'CUSTOMER' | 'MERCHANT';

async function updateSmsPreference(
  recipient: SmsRecipient,
  event: string,
  enabled: boolean,
) {
  const response = await api.patch('/admin/sms/preferences', {
    preferences: [{ recipient, event, enabled }],
  });

  return response.data.data;
}
```

## Current Backend Enforcement

The preference APIs and database storage are implemented for every event shown on the screen.

Currently, only this preference is checked before an existing SMS is sent:

```text
Recipient: CUSTOMER
Event: DELIVERY_MAN_ASSIGNED
```

The remaining switches are stored correctly and returned to the frontend, but their parcel-event SMS sender hooks are not implemented yet. Until those hooks are connected, changing those switches will not affect actual SMS delivery.

The global SMS provider status is separate from event preferences. Even when an event preference is enabled, SMS will not send if the global SMS service is disabled.
