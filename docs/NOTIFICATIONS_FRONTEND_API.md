# In-App Notifications Frontend Integration

## Overview

Notifications are available to the four application panels:

- `ADMIN`
- `MERCHANT`
- `HUB_MANAGER`
- `RIDER`

This is a database-backed in-app notification system. It does not use push
notifications, Firebase, WebSockets, SMS, or email. The frontend obtains new
notifications by calling the API after login, on page refresh, when the browser
tab becomes active, or on a polling interval.

All routes require the existing bearer token:

```http
Authorization: Bearer <access_token>
```

The backend uses `userId` and `role` from the JWT. Do not send a user ID,
merchant ID, Hub ID, or rider ID in notification requests. A user can only read
or update their own notifications.

## Routes

| Method | Route | Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/notifications` | None | Paginated notification list |
| `GET` | `/notifications/unread-count` | None | Notification badge count |
| `PATCH` | `/notifications/:id/read` | None | Mark one notification as read |
| `PATCH` | `/notifications/read-all` | None | Mark all current-user notifications as read |

The existing Admin route below now creates a real Hub Manager notification:

| Method | Route | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/admin/hub-collections/:hubId/notify` | `{ "message": "..." }` | Send an in-app message to that Hub's manager |

## 1. Get Notifications

```http
GET /notifications?page=1&limit=20&status=ALL
```

### Query parameters

| Parameter | Required | Default | Allowed values |
| --- | --- | --- | --- |
| `page` | No | `1` | Integer greater than or equal to `1` |
| `limit` | No | `20` | Integer from `1` to `100` |
| `status` | No | `ALL` | `ALL`, `READ`, `UNREAD` |
| `category` | No | — | `PARCEL`, `PICKUP`, `FINANCE`, `ACCOUNT`, `SYSTEM` |
| `type` | No | — | An exact notification event type |

Values are uppercase and case-sensitive.

Examples:

```http
GET /notifications?page=1&limit=20
GET /notifications?page=1&limit=20&status=UNREAD
GET /notifications?page=2&limit=10&category=PARCEL
GET /notifications?page=1&limit=20&type=RIDER_ASSIGNED
```

### Success response

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "78c8feb5-5c00-43e6-a972-f91a9f874f73",
        "recipient_user_id": "28645721-a5b5-4355-948a-a4f55bb3da0c",
        "recipient_role": "MERCHANT",
        "type": "HUB_RECEIVED",
        "category": "PARCEL",
        "title": "Received at hub",
        "message": "Parcel TRK-20260905-0012: The parcel was received and is being processed at Mirpur Hub.",
        "entity_type": "PARCEL",
        "entity_id": "9709e313-9cf0-4d02-a217-c040283e86bf",
        "action_url": "/parcels/9709e313-9cf0-4d02-a217-c040283e86bf",
        "metadata": {
          "tracking_number": "TRK-20260905-0012",
          "parcel_tx_id": "#139679",
          "from_status": "PICKED_UP",
          "to_status": "IN_HUB",
          "hub_id": "9496ae3c-0cba-41d5-acb2-9df29ea14cef",
          "rider_id": null
        },
        "is_read": false,
        "read_at": null,
        "created_at": "2026-09-05T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "unread_count": 8
  },
  "message": "Notifications retrieved"
}
```

`unread_count` always represents all unread notifications for the logged-in
user. It is not limited by the current page, category, type, or status filter.

The list is ordered newest first. Use `id` as the React/Vue list key.

## 2. Get Unread Count

Use this lightweight endpoint for the header or sidebar badge:

```http
GET /notifications/unread-count
```

Response:

```json
{
  "success": true,
  "data": {
    "unread_count": 8
  },
  "message": "Unread notification count retrieved"
}
```

## 3. Mark One Notification as Read

```http
PATCH /notifications/78c8feb5-5c00-43e6-a972-f91a9f874f73/read
```

There is no request body.

Response:

```json
{
  "success": true,
  "data": {
    "notification": {
      "id": "78c8feb5-5c00-43e6-a972-f91a9f874f73",
      "is_read": true,
      "read_at": "2026-09-05T10:35:00.000Z"
    }
  },
  "message": "Notification marked as read"
}
```

Calling this route for an already-read notification is safe and returns the
same notification. A notification belonging to another user returns `404`.

Recommended click behavior:

1. Mark the notification as read.
2. Update the unread badge locally.
3. Navigate using `entity_type` and `entity_id` (or `action_url`).

## 4. Mark All Notifications as Read

```http
PATCH /notifications/read-all
```

There is no request body.

Response:

```json
{
  "success": true,
  "data": {
    "updated_count": 8,
    "read_at": "2026-09-05T10:40:00.000Z"
  },
  "message": "All notifications marked as read"
}
```

This affects only the logged-in user.

## Automatic Parcel Notifications by Panel

### Merchant

The merchant receives lifecycle changes performed by a Hub, rider, admin, or
delivery partner for the merchant's parcel, including:

- Parcel picked up or received at a Hub
- Parcel details, actual weight, Collect Amount, or charges updated externally
- Rider or third-party provider assigned
- Out for delivery
- Delivered, partial delivery, exchange, failed, or rescheduled
- Return started, returned to Hub, or returning to merchant
- Parcel issue reported, resolved, reopened, or cleared
- Parcel cancelled

The merchant is not notified about the merchant's own parcel creation or own
parcel edits.

### Hub Manager

The Hub Manager receives notifications scoped to their Hub, including:

- Merchant created a parcel waiting for Hub processing
- Parcel linked to a pickup request
- Incoming inter-Hub transfer started
- Origin Hub informed when its transfer is received
- Rider accepted a parcel
- Parcel moved out for delivery
- Delivery completed, partial delivery, exchange, failure, or reschedule
- Return or paid return started
- Returned parcel reached the Hub
- Parcel issue reported or reopened

A Hub does not receive a notification for an action performed by that same Hub.

### Rider

The rider receives notifications requiring assignment attention:

- Parcel assigned to the rider
- Parcel transferred to the rider
- Rider assignment removed

The rider does not receive a notification for the rider's own delivery action.

### Admin

Active admins receive exception notifications:

- Delivery failed
- Partial delivery
- Delivery rescheduled
- Return or paid return started
- Parcel issue reported or reopened
- Parcel cancelled

Routine successful parcel events are excluded from the Admin panel to avoid
excessive notification volume.

## Event Type Values

The most common `type` values are:

```text
PARCEL_DETAILS_UPDATED
PICKED_UP
HUB_RECEIVED
HUB_TRANSFER_STARTED
HUB_TRANSFER_RECEIVED
RIDER_ASSIGNED
RIDER_TRANSFERRED
RIDER_UNASSIGNED
RIDER_ACCEPTED
THIRD_PARTY_ASSIGNED
OUT_FOR_DELIVERY
DELIVERY_COMPLETED
PARTIAL_DELIVERY
EXCHANGE_COMPLETED
DELIVERY_FAILED
DELIVERY_RESCHEDULED
RETURN_INITIATED
PAID_RETURN_INITIATED
RETURNED_TO_HUB
RETURN_TO_MERCHANT
ISSUE_REPORTED
ISSUE_RESOLVED
ISSUE_REOPENED
ISSUE_CLEARED
CANCELLED
```

The frontend should display unknown future types using the provided `title` and
`message` instead of rejecting them.

## Frontend Synchronization

Recommended behavior without push notifications:

1. After login, call `GET /notifications/unread-count`.
2. When the notification menu/page opens, call
   `GET /notifications?page=1&limit=20`.
3. Poll `/notifications/unread-count` every 30–60 seconds while authenticated.
4. Call it immediately when the browser tab becomes visible again.
5. If the unread count changes, refresh notification page 1.
6. Stop polling when logged out or when the tab is hidden.

Do not automatically mark notifications as read merely because they were
fetched. Mark one when the user opens it, or mark all only when the user chooses
the “Mark all as read” action.

## Admin Message to Hub

Admin panel only:

```http
POST /admin/hub-collections/9496ae3c-0cba-41d5-acb2-9df29ea14cef/notify
Content-Type: application/json

{
  "message": "Please review today's collection discrepancy."
}
```

The body is optional. When `message` is omitted, the backend supplies a default
message. The assigned Hub Manager receives an `ADMIN_MESSAGE` notification in
the same paginated notification API. A Hub without an assigned Hub Manager
returns `404`.

## Example TypeScript Client

```ts
type NotificationStatus = 'ALL' | 'READ' | 'UNREAD';

export async function getNotifications(
  token: string,
  page = 1,
  limit = 20,
  status: NotificationStatus = 'ALL',
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
  });

  const response = await fetch(`/notifications?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to load notifications');
  return response.json();
}

export async function markNotificationRead(token: string, id: string) {
  const response = await fetch(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to mark notification as read');
  return response.json();
}

export async function markAllNotificationsRead(token: string) {
  const response = await fetch('/notifications/read-all', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to mark notifications as read');
  return response.json();
}
```

## Current Scope

Parcel lifecycle notifications are generated automatically now. The database
model and notification service also support `PICKUP`, `FINANCE`, `ACCOUNT`, and
`SYSTEM` categories so those domain events can be connected later without any
frontend API changes.
