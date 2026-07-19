# Parcel lifecycle tracking API

The backend exposes a public, authentication-free parcel tracker:

```http
GET /parcels/tracking/:trackingNumber
```

`:trackingNumber` accepts either `tracking_number` or `parcel_tx_id`. Leading
and trailing whitespace is ignored.

## Backward compatibility

The endpoint still returns the complete `parcel` object and keeps these older
tracking fields unchanged:

- `tracking.parcel_id`
- `tracking.current_status`
- `tracking.delivery_milestones`
- `tracking.activities` (newest first)

The durable lifecycle fields below are additive, so an existing frontend can
keep working and adopt the richer tracker gradually.

## New lifecycle fields

```json
{
  "parcel": {
    "tracking_number": "MF120526DHV4",
    "status": "IN_TRANSIT",
    "tracking": {
      "parcel_id": "#139679",
      "current_status": "IN_TRANSIT",
      "current_stage": "HUB_TRANSFER_STARTED",
      "direction": "RETURN",
      "is_return_parcel": false,
      "is_returning": true,
      "is_terminal": false,
      "is_successful_delivery": false,
      "is_return_completed": false,
      "delivery_milestones": [],
      "lifecycle_milestones": [],
      "activities": [],
      "events": [
        {
          "id": "event-uuid",
          "event_type": "HUB_TRANSFER_STARTED",
          "title": "Hub transfer started",
          "description": "The parcel departed from Dhaka Hub for Cumilla Hub.",
          "message": "The parcel departed from Dhaka Hub for Cumilla Hub.",
          "from_status": "RETURNED_TO_HUB",
          "to_status": "IN_TRANSIT",
          "status": "IN_TRANSIT",
          "timestamp": "2026-07-19T10:00:00.000Z",
          "location": "Dhaka Hub",
          "actor": {
            "type": "HUB",
            "id": "hub-uuid",
            "name": "Dhaka Hub",
            "source": "PARCEL_SERVICE"
          },
          "hub": null,
          "route": {
            "from_hub": { "id": "hub-1", "name": "Dhaka Hub" },
            "to_hub": { "id": "hub-2", "name": "Cumilla Hub" }
          },
          "rider": null,
          "related_parcel": null,
          "metadata": null,
          "is_legacy_backfill": false
        }
      ],
      "journey": {
        "current_hub": null,
        "origin_hub": { "id": "hub-1", "branch_name": "Dhaka Hub" },
        "destination_hub": {
          "id": "hub-2",
          "branch_name": "Cumilla Hub"
        },
        "is_inter_hub_transfer": true,
        "is_in_transit": true,
        "transferred_at": "2026-07-19T10:00:00.000Z",
        "received_at_destination_hub": null
      },
      "linked_parcels": {
        "original": null,
        "returns": [
          {
            "id": "return-parcel-uuid",
            "tracking_number": "RTN-MF120526DHV4",
            "parcel_tx_id": "#RTN123",
            "status": "IN_HUB",
            "is_return_parcel": true,
            "original_parcel_id": "original-parcel-uuid"
          }
        ]
      }
    }
  },
  "message": "Parcel retrieved successfully"
}
```

## Events recorded

The tracker persists immutable rows in `parcel_tracking_events`. A later update
never overwrites an earlier hub, rider, delivery attempt, or return step.

Covered lifecycle groups include:

- parcel creation and merchant/hub/admin detail changes;
- pickup request linkage, pickup, and initial hub receipt;
- every inter-hub departure and destination receipt, including three or more
  hub legs;
- rider assignment, rider-to-rider transfer, acceptance, and unassignment;
- internal and Carrybee/third-party handoffs and status webhooks;
- out for pickup, out for delivery, delivered, partial delivery, and exchange;
- failed attempts, reasons, rescheduling, and redelivery preparation;
- returned, paid return, returned to hub, return to merchant, and the separately
  linked `RTN-...` parcel journey;
- issue reported, resolved, reopened, and cleared;
- cancellation and other status transitions.

For a partial pickup, send the optional `parcel_ids` array to
`PATCH /pickup-requests/:id/rider/complete`. Its length must match
`picked_up_count`. This lets the backend mark the exact parcels as `PICKED_UP`
and move them to the completed pickup record. Older clients may omit the field;
their count-only behavior remains supported, but individual parcels cannot be
identified from a count alone.

Hub and rider names are saved as event-time snapshots. Renaming a hub or rider
later therefore does not rewrite historical tracking text.

## Existing parcels

Parcels created before this feature do not need a migration job. If they have no
stored events, the API builds a compatible legacy timeline from their existing
timestamps. When a legacy parcel is changed for the first time, the subscriber
stores the recoverable baseline before recording the new mutation.

Legacy events have `is_legacy_backfill: true`. Historical repeated actions that
were overwritten before this feature existed cannot be reconstructed, but every
new action is durable.

## Frontend rendering

1. Use `current_status` for the main badge and `direction` for forward/return UI.
2. Use `lifecycle_milestones` for a detailed stepper; keep
   `delivery_milestones` if the old six-step UI must remain unchanged.
3. Render `events` newest first for the complete audit-style timeline.
4. For a simple timeline, render `activities` using `message`, `timestamp`, and
   `location`.
5. Render `route.from_hub` and `route.to_hub` for hub-transfer events.
6. Use `linked_parcels.original` and `linked_parcels.returns` to let users switch
   between the forward parcel and its return tracking number.

## Implementation locations

- `src/parcels/entities/parcel-tracking-event.entity.ts`: immutable event table
- `src/parcels/subscribers/parcel-tracking.subscriber.ts`: automatic mutation capture
- `src/parcels/services/parcel-tracking.service.ts`: event loading and legacy fallback
- `src/common/interfaces/responses.interface.ts`: public response mapping
