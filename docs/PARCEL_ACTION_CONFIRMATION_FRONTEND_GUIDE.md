# Parcel Action and Confirm & Complete Frontend Guide

This guide covers parcel workflow items 4, 5, 7, 11, 16, 17, 20, and 22.

## Confirmed behavior

- A rider action immediately removes the parcel from the rider's Pending tab and adds it to today's Completed tab.
- The hub may correct that action as part of Confirm & Complete.
- A reschedule is counted only when the hub confirms it.
- A confirmed reschedule is automatically assigned to the same rider. Its operational `status` becomes `ASSIGNED_TO_RIDER`, while `rider_action_status` remains `DELIVERY_RESCHEDULED` for the completed attempt.
- Rider transfer accepts only parcels whose current status is `ASSIGNED_TO_RIDER`. It never changes `reschedule_count`.
- All "today" task endpoints use the Bangladesh calendar day (`Asia/Dhaka`).
- A reschedule date is not required because the current rider form does not collect one.

## 1. Rider submits an outcome

```http
POST /delivery-verifications/parcels/:parcelId/initiate
Authorization: Bearer <rider-token>
Content-Type: application/json
```

Example reschedule request:

```json
{
  "selected_status": "DELIVERY_RESCHEDULED",
  "collected_amount": 0,
  "reason": "Customer is unavailable today and requested another delivery attempt"
}
```

Response:

```json
{
  "success": true,
  "verification_id": "b2430244-3cae-4f42-86a8-a56646046c1f",
  "selected_status": "DELIVERY_RESCHEDULED",
  "expected_amount": 1260,
  "collected_amount": 0,
  "has_difference": true,
  "difference": -1260,
  "reason": "Customer is unavailable today and requested another delivery attempt",
  "otp_required": false,
  "message": "Delivery completed successfully. OTP verification was not required."
}
```

After success, refresh both rider tabs:

```http
GET /riders/deliveries?tab=pending
GET /riders/deliveries?tab=completed
```

The completed row exposes:

```json
{
  "status": "DELIVERY_RESCHEDULED",
  "rider_action_status": "DELIVERY_RESCHEDULED",
  "hub_confirmation_status": "PENDING",
  "cod_status": "NOT_APPLICABLE",
  "rider_action_at": "2026-09-12T09:30:00.000Z",
  "hub_confirmed_at": null,
  "completed_at": null,
  "is_delivery_rescheduled": true,
  "reschedule_count": 0
}
```

Use `rider_action_status` for the Completed-tab badge. `status` is the parcel's current operational state.

## 2. Hub loads COD and pending actions

```http
GET /hubs/parcels/cleared-deliveries?rider_id=:riderId&page=1&limit=100
Authorization: Bearer <hub-manager-token>
```

Relevant row fields:

```json
{
  "parcel_id": "9e1f6e5a-5f28-4300-89af-e273d6316ff4",
  "parcel_tx_id": "MF300826KY7A",
  "status": "DELIVERY_RESCHEDULED",
  "action_status": "DELIVERY_RESCHEDULED",
  "rider_action_status": "DELIVERY_RESCHEDULED",
  "hub_confirmation_status": "PENDING",
  "cod_status": "NOT_APPLICABLE",
  "can_confirm": true,
  "collectable_amount": 0,
  "merchant_amount_status": "NOT_APPLICABLE",
  "reschedule_count": 0
}
```

Frontend rules:

- Store `parcel_id` (the UUID) as the selected row ID. Do not submit `parcel_tx_id`.
- `parcel_ids` is required by Confirm & Complete; never send an empty selection.
- Display `action_status` in the action/status column.
- Enable selection only when `can_confirm` is `true`.
- The counted cash total is the sum of `collectable_amount` for selected rows.
- Keep status dropdown changes in local state and send them in `corrections`.
- `merchant_amount_status` is `PENDING`, `AVAILABLE`, or `NOT_APPLICABLE`.
- Filter parcel actions with `status=DELIVERED` (and other parcel statuses). Filter COD independently with `codStatus=PENDING`, `codStatus=COLLECTED`, `codStatus=REFUNDED`, or `codStatus=NOT_APPLICABLE`.

## 3. Hub confirms selected rows

The same request supports delivered, returned, rescheduled, and other selected actions together.

```http
POST /hubs/finance/collect-cod/:riderId
Authorization: Bearer <hub-manager-token>
Content-Type: application/json
```

Request without corrections:

```json
{
  "parcel_ids": [
    "9e1f6e5a-5f28-4300-89af-e273d6316ff4",
    "aa808512-5454-430f-88ec-a116f7ac77f7"
  ],
  "counted_amount": 500
}
```

Request with a hub correction (`DELIVERED` changed to `DELIVERY_RESCHEDULED`):

```json
{
  "parcel_ids": [
    "9e1f6e5a-5f28-4300-89af-e273d6316ff4",
    "aa808512-5454-430f-88ec-a116f7ac77f7"
  ],
  "counted_amount": 0,
  "corrections": [
    {
      "parcel_id": "aa808512-5454-430f-88ec-a116f7ac77f7",
      "action_status": "DELIVERY_RESCHEDULED"
    }
  ]
}
```

If the COD state also needs correction, add it to the same correction object:

```json
{
  "parcel_id": "aa808512-5454-430f-88ec-a116f7ac77f7",
  "action_status": "RETURNED",
  "cod_status": "REFUNDED"
}
```

Valid correction values for this screen are:

```text
DELIVERED
PARTIAL_DELIVERY
EXCHANGE
PAID_RETURN
RETURNED
RETURN_TO_MERCHANT
DELIVERY_RESCHEDULED
CANCELLED
ASSIGNED_TO_RIDER
```

Successful response:

```json
{
  "success": true,
  "message": "Selected rider actions confirmed successfully",
  "data": {
    "rider_id": "c96a3446-d159-47a9-833d-753b683de837",
    "parcel_count": 2,
    "parcel_ids": [
      "9e1f6e5a-5f28-4300-89af-e273d6316ff4",
      "aa808512-5454-430f-88ec-a116f7ac77f7"
    ],
    "total_expected_amount": 0,
    "counted_amount": 0,
    "hub_confirmed_at": "2026-09-12T09:35:00.000Z",
    "action_counts": {
      "delivered": 0,
      "partial_delivery": 0,
      "exchange": 0,
      "paid_return": 0,
      "returned": 0,
      "delivery_rescheduled": 2
    },
    "results": [
      {
        "parcel_id": "9e1f6e5a-5f28-4300-89af-e273d6316ff4",
        "previous_action": "DELIVERY_RESCHEDULED",
        "confirmed_action": "DELIVERY_RESCHEDULED",
        "status": "ASSIGNED_TO_RIDER",
        "cod_status": "NOT_APPLICABLE",
        "reschedule_count": 1,
        "automatically_reassigned": true
      },
      {
        "parcel_id": "aa808512-5454-430f-88ec-a116f7ac77f7",
        "previous_action": "DELIVERED",
        "confirmed_action": "DELIVERY_RESCHEDULED",
        "status": "ASSIGNED_TO_RIDER",
        "cod_status": "NOT_APPLICABLE",
        "reschedule_count": 1,
        "automatically_reassigned": true
      }
    ],
    "current_balance": 160
  }
}
```

After success:

- Clear selected row IDs and local corrections.
- Clear the counted amount input.
- Refresh the COD list, rider dashboard, pending tasks, completed tasks, processed lists, and rider-transfer list.
- A confirmed reschedule can appear again as a new Pending delivery assigned today. Its completed attempt still has `rider_action_status: DELIVERY_RESCHEDULED`.

The operation is transactional. If any selected ID is not pending confirmation for that rider, the request fails without confirming or counting any selected row. Retrying cannot increment a reschedule twice.

## 4. Processed and hub-transfer lists

```http
GET /hubs/parcels/rescheduled
```

This endpoint returns only unassigned `DELIVERY_RESCHEDULED` parcels. Rider reschedules awaiting confirmation and confirmed auto-reassignments do not appear here.

```http
GET /hubs/parcels/outgoing
```

This endpoint is the active Assigned Parcel List for hub transfers. It returns only parcels currently `IN_TRANSIT` to another hub. A delivery reschedule is not a hub transfer and will not appear here.

```http
GET /hubs/rider-transfer/riders/:riderId/parcels
```

This endpoint returns only `ASSIGNED_TO_RIDER` parcels. The transfer mutation is:

```http
POST /hubs/rider-transfer/transfer
```

```json
{
  "target_rider_id": "a27e8958-bb61-4eae-a343-42d243b91d4d",
  "parcel_ids": ["9e1f6e5a-5f28-4300-89af-e273d6316ff4"],
  "notes": "Workload reassignment"
}
```

Reassignment updates `assigned_at`, removes the parcel from the previous rider, and does not change `reschedule_count`.

## 5. Rider task cards and lists

```http
GET /riders/dashboard
GET /riders/summary
GET /riders/deliveries?tab=pending
GET /riders/deliveries?tab=completed
GET /riders/returns?tab=pending
GET /riders/returns?tab=completed
```

The dashboard and summary use the current Bangladesh day. The Pickup card counts pickup requests assigned today. The Deliveries card counts rider actions submitted today. The Return card counts return parcels assigned by the hub today. Pending Deliveries contains today's normal parcel assignments, Pending Returns contains today's return-parcel assignments, and Completed contains today's rider actions:

```text
DELIVERED
PARTIAL_DELIVERY
EXCHANGE
PAID_RETURN
RETURNED
RETURN_TO_MERCHANT
DELIVERY_RESCHEDULED
```

Use the API counts directly so the cards and lists stay consistent.
