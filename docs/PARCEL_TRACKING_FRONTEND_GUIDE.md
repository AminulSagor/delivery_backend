# Parcel tracking API: complete frontend and integration contract

## Coverage verdict

`GET /parcels/tracking/:trackingNumber` covers every parcel lifecycle state
currently modeled by this backend. New actions are stored as immutable tracking
events, so repeated actions are not lost when the main `parcels` row changes.

Covered flows include:

- merchant, hub-manager, and admin parcel creation and operational detail edits;
- pickup-request linkage, out-for-pickup, pickup, and first-hub receipt;
- every hub departure and destination receipt, including any number of hub legs;
- rider assignment, transfer, acceptance, unassignment, and last-mile dispatch;
- internal rider and Carrybee/third-party status updates;
- delivery, partial delivery, exchange, failed attempts, and cancellation;
- delivery issues, resolution, reopening, and clearing;
- rescheduling and preparation for another delivery attempt;
- return initiation, paid return, rider return to hub, return-to-merchant
  creation, and the complete linked `RTN-...` parcel journey.

This is full coverage of the lifecycle represented by the application. The
endpoint does not invent data the backend does not store: there is currently no
ETA, live GPS position, signature/photo proof-of-delivery, or public exception
resolution estimate.

## Endpoint

```http
GET /parcels/tracking/:trackingNumber
```

Authentication is not required because the controller is marked public.

### Path parameter

| Parameter | Type | Required | Accepted value |
| --- | --- | --- | --- |
| `trackingNumber` | string | Yes | Exact `tracking_number` or exact `parcel_tx_id`; surrounding whitespace is ignored. |

Examples:

```http
GET /parcels/tracking/TRK-20260721-00001
GET /parcels/tracking/%23139679
GET /parcels/tracking/RTN-TRK-20260721-00001
```

`#` must be URL encoded as `%23` when a `parcel_tx_id` is placed in the path.
Matching is exact and case-sensitive.

## HTTP responses

| Status | Meaning |
| --- | --- |
| `200 OK` | Parcel found; the current snapshot and lifecycle timeline are returned. |
| `400 Bad Request` | The decoded tracking value is empty. |
| `404 Not Found` | Neither `tracking_number` nor `parcel_tx_id` matched a parcel. |
| `500 Internal Server Error` | The parcel or tracking ledger could not be loaded. |

Successful controllers are wrapped by the global response interceptor:

```json
{
  "success": true,
  "data": {
    "parcel": {}
  },
  "message": "Parcel retrieved successfully",
  "timestamp": "2026-07-21T10:30:00.000Z"
}
```

Errors use this envelope:

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Parcel not found",
  "timestamp": "2026-07-21T10:30:00.000Z",
  "path": "/parcels/tracking/UNKNOWN"
}
```

## Representative success response

This example emphasizes lifecycle data. The `parcel` object also contains the
snapshot fields documented later in this guide.

```json
{
  "success": true,
  "data": {
    "parcel": {
      "id": "a8b33d7a-7340-4e44-bbd8-209b352ed901",
      "parcel_tx_id": "#139679",
      "tracking_number": "TRK-20260721-00001",
      "merchant_order_id": "ORDER-4421",
      "customer_name": "Customer Name",
      "status": "IN_TRANSIT",
      "current_hub": null,
      "origin_hub": {
        "id": "ad02a34b-616b-4bf5-ad97-123b82476941",
        "hub_code": "DHK-01",
        "branch_name": "Dhaka Hub"
      },
      "destination_hub": {
        "id": "b78033a9-15d8-4cc6-9ed4-a02a0cc6881d",
        "hub_code": "CUM-01",
        "branch_name": "Cumilla Hub"
      },
      "tracking": {
        "parcel_id": "#139679",
        "current_status": "IN_TRANSIT",
        "current_stage": "HUB_TRANSFER_STARTED",
        "direction": "RETURN",
        "is_return_parcel": false,
        "is_returning": true,
        "is_terminal": false,
        "is_journey_complete": false,
        "is_successful_delivery": false,
        "is_return_completed": false,
        "event_count": 5,
        "last_event_at": "2026-07-21T10:00:00.000Z",
        "timeline_order": "DESC",
        "delivery_milestones": [],
        "lifecycle_milestones": [],
        "activities": [],
        "events": [
          {
            "id": "2ea949c7-8e8a-424f-ab44-a77bd6633e6f",
            "sequence": 5,
            "event_type": "HUB_TRANSFER_STARTED",
            "title": "Hub transfer started",
            "description": "The parcel departed from Dhaka Hub for Cumilla Hub.",
            "message": "The parcel departed from Dhaka Hub for Cumilla Hub.",
            "from_status": "RETURNED_TO_HUB",
            "to_status": "IN_TRANSIT",
            "status": "IN_TRANSIT",
            "timestamp": "2026-07-21T10:00:00.000Z",
            "occurred_at": "2026-07-21T10:00:00.000Z",
            "location": "Dhaka Hub",
            "actor": {
              "type": "HUB",
              "id": "ad02a34b-616b-4bf5-ad97-123b82476941",
              "name": "Dhaka Hub",
              "source": "PARCEL_SERVICE"
            },
            "hub": null,
            "route": {
              "from_hub": {
                "id": "ad02a34b-616b-4bf5-ad97-123b82476941",
                "name": "Dhaka Hub"
              },
              "to_hub": {
                "id": "b78033a9-15d8-4cc6-9ed4-a02a0cc6881d",
                "name": "Cumilla Hub"
              }
            },
            "rider": null,
            "related_parcel": null,
            "metadata": null,
            "is_legacy_backfill": false
          }
        ],
        "journey": {
          "current_hub": null,
          "origin_hub": {
            "id": "ad02a34b-616b-4bf5-ad97-123b82476941",
            "branch_name": "Dhaka Hub"
          },
          "destination_hub": {
            "id": "b78033a9-15d8-4cc6-9ed4-a02a0cc6881d",
            "branch_name": "Cumilla Hub"
          },
          "is_inter_hub_transfer": true,
          "is_in_transit": true,
          "transferred_at": "2026-07-21T10:00:00.000Z",
          "received_at_destination_hub": null
        },
        "linked_parcels": {
          "original": null,
          "returns": [
            {
              "id": "9557dccf-2d23-45f7-aa96-c121b4c3ac9d",
              "tracking_number": "RTN-TRK-20260721-00001",
              "parcel_tx_id": "#RTN140001",
              "status": "IN_HUB",
              "is_return_parcel": true,
              "original_parcel_id": "a8b33d7a-7340-4e44-bbd8-209b352ed901",
              "created_at": "2026-07-21T09:00:00.000Z",
              "updated_at": "2026-07-21T09:00:00.000Z"
            }
          ],
          "active_return": {
            "id": "9557dccf-2d23-45f7-aa96-c121b4c3ac9d",
            "tracking_number": "RTN-TRK-20260721-00001",
            "parcel_tx_id": "#RTN140001",
            "status": "IN_HUB",
            "is_return_parcel": true,
            "original_parcel_id": "a8b33d7a-7340-4e44-bbd8-209b352ed901",
            "created_at": "2026-07-21T09:00:00.000Z",
            "updated_at": "2026-07-21T09:00:00.000Z"
          }
        }
      }
    }
  },
  "message": "Parcel retrieved successfully",
  "timestamp": "2026-07-21T10:30:00.000Z"
}
```

## Tracking object contract

Frontend tracking pages should treat `data.parcel.tracking` as the canonical
tracking view.

| Field | Type | Meaning |
| --- | --- | --- |
| `parcel_id` | string | Display identifier: `parcel_tx_id`, falling back to `tracking_number`, then UUID. |
| `current_status` | `ParcelStatus` | Current status stored on this parcel row. |
| `current_stage` | string | Latest event type; falls back to current status if no event exists. |
| `direction` | `FORWARD \| RETURN` | `RETURN` for a return parcel or a forward parcel that has entered a return flow. |
| `is_return_parcel` | boolean | Whether this row is the separately trackable return shipment. |
| `is_returning` | boolean | A return journey exists and is not yet complete. |
| `is_terminal` | boolean | Compatibility flag for whether this parcel row is in a terminal operational status. `RETURN_TO_MERCHANT` is terminal for the original row even while its linked return parcel is moving. |
| `is_journey_complete` | boolean | Recommended end-to-end completion flag. It remains `false` until an active return parcel reaches a successful terminal state. |
| `is_successful_delivery` | boolean | Forward journey ended as `DELIVERED`, `PARTIAL_DELIVERY`, or `EXCHANGE`. |
| `is_return_completed` | boolean | Latest linked return parcel, or the current return parcel, reached a successful delivery outcome. |
| `event_count` | integer | Number of public events in `events`. |
| `last_event_at` | ISO date-time \| null | Timestamp of the newest public event. |
| `timeline_order` | `DESC` | Declares that `events` and durable `activities` are newest first. |
| `delivery_milestones` | `DeliveryMilestone[]` | Older six-step compatibility model. |
| `lifecycle_milestones` | `LifecycleMilestone[]` | Recommended detailed progress model. |
| `activities` | `Activity[]` | Simplified timeline derived from durable events. |
| `events` | `TrackingEvent[]` | Complete immutable public timeline for this parcel row. |
| `journey` | object | Current hub-routing snapshot. |
| `linked_parcels` | object | Original/return shipment links. |

### Event ordering and sequence

`events[0]` is always the newest event. `sequence` is chronological: the first
event in the parcel's life is `1`, and the newest event equals `event_count`.
When timestamps match, database creation time is the tie-breaker.

### Tracking event

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | UUID/string | Durable event UUID, or a deterministic `legacy-...` ID for a synthesized old event. |
| `sequence` | integer | One-based chronological position. |
| `event_type` | `ParcelTrackingEventType` | Machine-readable lifecycle action. |
| `title` | string | Short display heading. |
| `description` | string \| null | Human-readable event explanation. |
| `message` | string | `description`, falling back to `title`; convenient for simple timelines. |
| `from_status` | `ParcelStatus \| null` | Status immediately before the event when known. |
| `to_status` | `ParcelStatus \| null` | Status immediately after the event when known. |
| `status` | `ParcelStatus \| null` | Convenience value: `to_status`, otherwise `from_status`. |
| `timestamp` | ISO date-time | Canonical display timestamp. |
| `occurred_at` | ISO date-time | Alias of `timestamp` for event-oriented clients. |
| `location` | string \| null | Event-time hub/location snapshot. |
| `actor` | object | Actor `type`, optional `id`/`name`, and write-path `source`. |
| `hub` | object \| null | Single involved hub as `{ id, name }`. |
| `route` | object \| null | Transfer route with nullable `{ id, name }` `from_hub` and `to_hub`. |
| `rider` | object \| null | Involved rider as `{ id, name }`. |
| `related_parcel` | object \| null | Linked parcel as `{ id, tracking_number }`, mainly for returns. |
| `metadata` | object \| null | Event-specific context such as reason, changed field names, provider, pickup request, or notes. |
| `is_legacy_backfill` | boolean | `true` when reconstructed from old parcel timestamps rather than captured live. |

Names in events are snapshots. Renaming a hub, rider, or provider later does not
rewrite historical event text.

### Simplified activity

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | UUID/string/integer | Durable event ID; integer only for the old synthetic fallback. |
| `event_type` | string \| absent | Present when activity comes from a durable event. |
| `message` | string | Human-readable activity text. |
| `timestamp` | ISO date-time | Activity time. |
| `location` | string \| null | Activity location. |
| `status` | `ParcelStatus \| null` | Resulting or associated status. |
| `actor` | object \| absent | Event actor when durable tracking is available. |

### Milestones

`delivery_milestones` preserves the existing frontend contract:

| Key | Label |
| --- | --- |
| `picked` | Picked |
| `sorted` | Sorted |
| `in_transit` | In Transit |
| `received_at_lmh` | Received At LMH |
| `assigned_for_delivery` | Assigned For Delivery |
| `delivered` | Delivered |

Each item contains `key`, `label`, and `is_completed`.

`lifecycle_milestones` is the recommended stepper:

| Key | Extra behavior |
| --- | --- |
| `created` | Complete once parcel creation is known. |
| `picked_up` | Complete from pickup timestamp or event. |
| `hub_processing` | Complete after any hub receipt/change. |
| `inter_hub_transit` | Includes `is_applicable`; complete once any transfer starts. |
| `assigned_for_delivery` | Complete after rider assignment/transfer. |
| `out_for_delivery` | Complete after dispatch. |
| `finalized` | Label becomes `Returned To Merchant` for return journeys; uses end-to-end return completion. |

Milestones summarize progress; they are not an audit trail. Use `events` when
multiple delivery attempts, hub legs, or rider assignments must be shown.

### Journey

| Field | Type | Meaning |
| --- | --- | --- |
| `current_hub` | `HubSummary \| null` | Hub currently holding the parcel; null while moving between hubs. |
| `origin_hub` | `HubSummary \| null` | First/original hub recorded on the parcel. |
| `destination_hub` | `HubSummary \| null` | Next hub while an inter-hub leg is active. |
| `is_inter_hub_transfer` | boolean | Parcel has participated in an inter-hub transfer. |
| `is_in_transit` | boolean | Current status is `IN_TRANSIT`. |
| `transferred_at` | ISO date-time \| null | Most recent hub departure time on the snapshot row. Older legs remain in `events`. |
| `received_at_destination_hub` | ISO date-time \| null | Most recent destination-hub receipt time. Reset when a new leg starts. |

### Linked parcels and returns

| Field | Type | Meaning |
| --- | --- | --- |
| `original` | `LinkedParcel \| null` | Forward/original parcel when tracking an `RTN-...` parcel. |
| `returns` | `LinkedParcel[]` | Every return descendant, oldest first, including chained returns. |
| `active_return` | `LinkedParcel \| null` | Latest unfinished return when the requested number belongs to the original parcel. |

A `LinkedParcel` contains `id`, `tracking_number`, `parcel_tx_id`, `status`,
`is_return_parcel`, `original_parcel_id`, `created_at`, and `updated_at`.

The original and return parcels have separate immutable timelines. To display
the exact return-hub and return-rider events, call this same endpoint with the
`active_return.tracking_number`. The original response always supplies that
link, so no internal UUID lookup is required.

## Parcel status reference

| Status | Meaning | Default tracking event |
| --- | --- | --- |
| `PENDING` | Created and waiting to enter pickup/delivery processing. | `STATUS_CHANGED` |
| `OUT_FOR_PICKUP` | Pickup rider is going to the merchant. | `OUT_FOR_PICKUP` |
| `PICKED_UP` | Collected from merchant/pickup point. | `PICKED_UP` |
| `IN_HUB` | Received and being processed at a hub. | `HUB_RECEIVED` |
| `IN_TRANSIT` | Moving through the network, normally between hubs. | `STATUS_CHANGED`; a hub departure is more specifically `HUB_TRANSFER_STARTED`. |
| `ASSIGNED_TO_RIDER` | Assigned for internal rider delivery. | `RIDER_ASSIGNED` |
| `ASSIGNED_TO_THIRD_PARTY` | Assigned to Carrybee or another provider. | `THIRD_PARTY_ASSIGNED` |
| `OUT_FOR_DELIVERY` | On the last-mile route to the recipient. | `OUT_FOR_DELIVERY` |
| `DELIVERED` | Fully delivered. | `DELIVERY_COMPLETED` |
| `PARTIAL_DELIVERY` | Delivery completed with a partial outcome. | `PARTIAL_DELIVERY` |
| `EXCHANGE` | Exchange completed. | `EXCHANGE_COMPLETED` |
| `FAILED_DELIVERY` | A delivery attempt failed. | `DELIVERY_FAILED` |
| `DELIVERY_RESCHEDULED` | Another delivery attempt was scheduled. | `DELIVERY_RESCHEDULED` |
| `RETURNED` | Return was initiated after the attempt. | `RETURN_INITIATED` |
| `PAID_RETURN` | Paid return outcome was confirmed. | `PAID_RETURN_INITIATED` |
| `RETURNED_TO_HUB` | Rider brought the parcel back to a hub. | `RETURNED_TO_HUB` |
| `RETURN_TO_MERCHANT` | Original parcel is closed into a linked merchant-return journey. | `RETURN_TO_MERCHANT` |
| `CANCELLED` | Delivery was cancelled. | `CANCELLED` |

## Event type reference

| Event type | When emitted |
| --- | --- |
| `PARCEL_CREATED` | Normal forward parcel created. |
| `RETURN_PARCEL_CREATED` | Separate linked return parcel created. |
| `PARCEL_DETAILS_UPDATED` | Tracked operational recipient/shipment fields changed; metadata lists field names, never previous PII values. |
| `PICKUP_REQUEST_LINKED` | Parcel linked or relinked to a pickup request. |
| `OUT_FOR_PICKUP` | Pickup started. |
| `PICKED_UP` | Pickup completed. |
| `HUB_RECEIVED` | First/non-transfer hub receipt. |
| `HUB_TRANSFER_STARTED` | Parcel left one hub for another. |
| `HUB_TRANSFER_RECEIVED` | Destination hub scanned the parcel. |
| `HUB_CHANGED` | Hub changed outside the standard transfer pair. |
| `RIDER_ASSIGNED` | Rider assigned. |
| `RIDER_TRANSFERRED` | Assignment moved from one rider to another. |
| `RIDER_UNASSIGNED` | Rider assignment cleared. |
| `RIDER_ACCEPTED` | Rider accepted custody. |
| `THIRD_PARTY_ASSIGNED` | External provider assigned. |
| `OUT_FOR_DELIVERY` | Last-mile dispatch started. |
| `DELIVERY_COMPLETED` | Full delivery completed. |
| `PARTIAL_DELIVERY` | Partial delivery completed. |
| `EXCHANGE_COMPLETED` | Exchange completed. |
| `DELIVERY_FAILED` | Delivery attempt failed. |
| `DELIVERY_RESCHEDULED` | Delivery moved to another attempt. |
| `REDELIVERY_PREPARED` | Hub moved a rescheduled parcel back into its assignment queue. |
| `RETURN_INITIATED` | Return outcome started. |
| `PAID_RETURN_INITIATED` | Paid-return outcome started. |
| `RETURNED_TO_HUB` | Failed/returned parcel arrived back at hub. |
| `RETURN_TO_MERCHANT` | Merchant-return journey created/started. |
| `ISSUE_REPORTED` | Rider reported an operational issue. |
| `ISSUE_RESOLVED` | Hub/admin resolved the issue. |
| `ISSUE_REOPENED` | Issue marked unresolved again. |
| `ISSUE_CLEARED` | Resolved issue record cleared from the current snapshot. |
| `CANCELLED` | Parcel cancelled. |
| `STATUS_CHANGED` | Valid status transition without a more specific event name. |

Actor `type` is one of `MERCHANT`, `HUB`, `RIDER`, `ADMIN`, `THIRD_PARTY`,
`CARRYBEE`, or `SYSTEM`. `source` identifies the backend path, such as
`MERCHANT_CREATE`, `PICKUP_REQUEST`, `DELIVERY_VERIFICATION`,
`CARRYBEE_WEBHOOK`, `RETURN_TO_MERCHANT`, `REDELIVERY`, or `PARCEL_SERVICE`.

## Parcel snapshot fields

The fields beside `tracking` describe the current parcel snapshot. They remain
for backward compatibility.

### Identity, recipient, and shipment

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | UUID | Internal parcel ID. |
| `customer_id` | UUID \| null | Linked customer record. |
| `merchant_id` | UUID \| null | Merchant owner. |
| `store_id` | UUID \| null | Merchant store. |
| `pickup_request_id` | UUID \| null | Current pickup request. |
| `parcel_tx_id` | string \| null | Human display ID. |
| `tracking_number` | string | Primary tracking identifier. |
| `merchant_order_id` | string \| null | Merchant's own order reference. |
| `delivery_area_text` | string \| null | Original free-text delivery area. |
| `delivery_coverage_area_id` | UUID \| null | Structured delivery area ID. |
| `customer_name` | string | Recipient name. |
| `customer_phone` | string | Recipient phone. |
| `customer_secondary_phone` | string \| null | Alternate phone. |
| `customer_address` | string | Delivery address. |
| `product_description` | string \| null | Shipment contents/description. |
| `product_price` | decimal | Declared product price. |
| `product_weight` | decimal | Weight in the application's configured unit. |
| `parcel_type` | number \| null | Parcel/product type enum value. |
| `delivery_type` | number \| null | Delivery-speed/type enum value. |
| `special_instructions` | string \| null | Delivery instructions. |
| `admin_notes` | string \| null | Current operational note. |

### Charges, collection, and settlement

| Field | Type | Meaning |
| --- | --- | --- |
| `delivery_charge` | decimal | Base delivery fee. |
| `weight_charge` | decimal | Weight fee. |
| `cod_charge` | decimal | Cash-on-delivery fee. |
| `discount` | number | Computed as `max(0, delivery + weight + COD charge - total charge)`. |
| `total_charge` | decimal | Total courier charge after discount. |
| `is_cod` | boolean | Whether COD applies. |
| `cod_amount` | decimal | Amount expected from recipient. |
| `is_exchange` | boolean | Exchange shipment flag. |
| `receivable_amount` | decimal | Merchant receivable snapshot. |
| `cod_collected_amount` | decimal | Amount actually collected. |
| `return_charge` | decimal | Calculated return fee. |
| `delivery_charge_applicable` | boolean | Whether delivery fee applies to outcome. |
| `return_charge_applicable` | boolean | Whether return fee applies to outcome. |
| `financial_status` | string \| null | Invoice/finance processing state. |
| `invoice_id` | UUID \| null | Linked invoice. |
| `clearance_required` | boolean | Clearance is required. |
| `clearance_done` | boolean | Clearance completed. |
| `clearance_invoice_id` | UUID \| null | Clearance invoice. |
| `paid_amount` | decimal \| null | Amount paid through invoice. |
| `payment_status` | `UNPAID \| PAID \| COD_COLLECTED \| null` | Collection/payment state. |
| `paid_to_merchant` | boolean | Merchant settlement flag. |
| `paid_to_merchant_at` | ISO date-time \| null | Settlement time. |
| `cod_cleared_at` | ISO date-time \| null | Rider-to-hub COD clearance time. |

PostgreSQL decimal columns may serialize as JSON strings depending on the
database driver. Clients should parse decimal fields explicitly and must not
use binary floating-point for accounting.

### Operations, routing, provider, issue, and return

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | `ParcelStatus` | Current parcel status. |
| `assigned_rider_id` | UUID \| null | Current rider. |
| `assigned_at` | ISO date-time \| null | Current/most recent assignment time. |
| `rider_accepted_at` | ISO date-time \| null | Rider acceptance time. |
| `out_for_delivery_at` | ISO date-time \| null | Dispatch time. |
| `reschedule_count` | integer | Number of redelivery assignments counted by the workflow. |
| `return_reason` | string \| null | Current failure/return reason. |
| `current_hub_id` | UUID \| null | Hub holding the parcel. |
| `origin_hub_id` | UUID \| null | First/original hub. |
| `destination_hub_id` | UUID \| null | Active transfer destination. |
| `is_inter_hub_transfer` | boolean | Whether an inter-hub transfer occurred. |
| `transferred_at` | ISO date-time \| null | Latest transfer start. |
| `received_at_destination_hub` | ISO date-time \| null | Latest destination receipt. |
| `transfer_notes` | string \| null | Latest transfer note. |
| `delivery_provider` | string \| null | Internal or external provider enum. |
| `third_party_provider_id` | UUID \| null | External provider record. |
| `issue_type` | string \| null | Current reported issue. |
| `issue_description` | string \| null | Current issue details. |
| `issue_reported_by_id` | UUID \| null | Reporting rider/user. |
| `issue_reported_at` | ISO date-time \| null | Report time. |
| `is_issue_resolved` | boolean | Current resolution flag. |
| `carrybee_consignment_id` | string \| null | Carrybee reference. |
| `carrybee_delivery_fee` | decimal \| null | Carrybee delivery fee. |
| `carrybee_cod_fee` | decimal \| null | Carrybee COD fee. |
| `assigned_to_carrybee_at` | ISO date-time \| null | Carrybee handoff time. |
| `recipient_carrybee_city_id` | integer \| null | Carrybee city mapping. |
| `recipient_carrybee_zone_id` | integer \| null | Carrybee zone mapping. |
| `recipient_carrybee_area_id` | integer \| null | Carrybee area mapping. |
| `original_parcel_id` | UUID \| null | Parent parcel for a return shipment. |
| `is_return_parcel` | boolean | Separate return-shipment flag. |

### Timestamps and derived values

| Field | Type | Meaning |
| --- | --- | --- |
| `picked_up_at` | ISO date-time \| null | Pickup time. |
| `delivered_at` | ISO date-time \| null | Delivery/outcome completion time. |
| `created_at` | ISO date-time \| null | Parcel creation time. |
| `updated_at` | ISO date-time \| null | Latest snapshot update. |
| `received_at` | ISO date-time \| null | Compatibility alias using hub-receipt data when available. |
| `age` | integer \| null | Whole days from receipt, otherwise creation, to response-generation time. |

## Nested snapshot objects

All nested objects may be `null` when a relationship is absent. A nullable
property is still normally returned as `null`, not omitted.

### `merchant`

Fields: `id`, `user_id`, `thana`, `district`, `full_address`,
`secondary_number`, `status`, `is_advance_payment_disabled`, `approved_at`,
`approved_by`, `created_at`, `updated_at`, and `user`.

`user` contains `id`, `full_name`, `phone`, `email`, `role`, `is_active`,
`created_at`, and `updated_at`.

### `store`

Fields: `id`, `store_code`, `merchant_id`, `business_name`,
`business_address`, `phone_number`, `email`, `facebook_page`, `hub_id`,
`is_default`, `status`, `district`, `thana`, `area`, `carrybee_store_id`,
`carrybee_city_id`, `carrybee_zone_id`, `carrybee_area_id`,
`is_carrybee_synced`, `carrybee_synced_at`, `auto_assign_to_carrybee`,
`created_at`, `updated_at`, `performance`, `hub`, and `merchant`.

`performance` contains `total_parcels_handled`, `successfully_delivered`, and
`total_returns`; missing aggregates default to zero.

### `customer`

Fields: `id`, `customer_name`, `phone_number`, `secondary_number`,
`customer_address`, `delivery_coverage_area_id`, `created_at`, and `updated_at`.

### `delivery_area` and `delivery_coverage_area`

Both keys contain the same structured area summary for compatibility: `id`,
`division`, `city`, `city_id`, `zone`, `zone_id`, `area`, `area_id`,
`inside_dhaka_flag`, `created_at`, and `updated_at`.

### `assigned_rider`

Fields: `id`, `rider_code`, `user_id`, `hub_id`, `photo`,
`guardian_mobile_no`, `bike_type`, `nid_number`, `license_no`,
`present_address`, `permanent_address`, `fixed_salary`,
`commission_per_delivery`, `bank_name`, `bank_account_number`, `bank_branch`,
`nid_front_photo`, `nid_back_photo`, `license_front_photo`,
`license_back_photo`, `parent_nid_front_photo`, `parent_nid_back_photo`,
`approval_status`, `approved_at`, `approved_by`, `is_active`, `created_at`,
`updated_at`, `full_name`, `phone`, `user`, `hub`, `approver`, `rider_status`,
and `assigned_parcels_count`.

`rider_status` is presentation data: `Leave` when inactive, `On duty` while
assigned to this parcel, otherwise `Break`.

### Hub summaries

`current_hub`, `origin_hub`, `destination_hub`, and nested hub objects contain
`id`, `hub_code`, `branch_name`, `area`, `address`, `manager_name`,
`manager_phone`, `manager_user_id`, `status`, `is_active`, `created_at`, and
`updated_at`.

### `third_party_provider`

Fields: `id`, `provider_code`, `provider_name`, `description`, `is_active`,
derived `status` (`active` or `inactive`), `unique_id`, `delivered_count`,
`type`, `created_at`, and `updated_at`.

## Lifecycle behavior by workflow

### Repeated hub movement

For each leg:

1. departure writes `HUB_TRANSFER_STARTED`, snapshots both hubs, clears
   `current_hub`, and sets `IN_TRANSIT`;
2. receipt writes `HUB_TRANSFER_RECEIVED`, snapshots the destination, restores
   `current_hub`, and sets `IN_HUB`;
3. another transfer creates another pair of events. Older legs are never
   overwritten even though snapshot timestamps describe only the latest leg.

### Rider and delivery attempts

Every assignment or transfer has its own event. A failed attempt, reschedule,
redelivery preparation, reassignment, and later successful outcome therefore
remain distinct. Do not infer attempts from only the current rider fields.

### Return to merchant

The backend atomically:

1. changes the original parcel to `RETURN_TO_MERCHANT`;
2. creates a linked return parcel with its own tracking number;
3. writes the cross-link into the original timeline;
4. starts the return parcel in `IN_HUB`, ready for assignment/transfer;
5. records all later return events on that return parcel.

Use `is_journey_complete`, not only `is_terminal`, for the final customer-facing
completion badge.

### Existing parcels and legacy history

Parcels created before the immutable ledger require no data backfill job. If a
parcel has no stored events, the read path synthesizes the recoverable timeline
from `created_at`, `picked_up_at`, hub timestamps, assignment timestamps,
`out_for_delivery_at`, `delivered_at`, and current status. On its next normal
update, that recoverable baseline is persisted before the new event.

Legacy events have `is_legacy_backfill: true`. Repeated actions that happened
before the ledger existed cannot be reconstructed if the old parcel row had
already overwritten them.

For partial pickup completion, modern clients should send exact `parcel_ids` to
`PATCH /pickup-requests/:id/rider/complete`. The older count-only request remains
supported, but a count alone cannot identify which individual parcels moved.

## Frontend implementation rules

1. Use `current_status` for the status badge and `current_stage` for detailed
   copy/icon selection.
2. Use `is_journey_complete` for the final completion state.
3. Render `events` in response order; do not reverse them unless the UI is
   explicitly oldest-first.
4. Use `sequence` as the displayed event number, never the array index.
5. Use `route` for hub-to-hub events and `hub` for single-hub events.
6. Use `metadata.reason` for failed/return context when present.
7. Use `active_return.tracking_number` to load the live return timeline.
8. Treat unknown future statuses and event types as displayable values instead
   of failing the page.
9. Parse every timestamp as UTC/ISO and format it in the viewer's time zone.
10. Treat nullable relationships as normal parcel states, especially while a
    parcel is in transit or unassigned.

## Compatibility guarantees

The following pre-ledger fields remain unchanged:

- the complete `data.parcel` snapshot;
- `tracking.parcel_id`;
- `tracking.current_status`;
- `tracking.delivery_milestones`;
- `tracking.activities` in newest-first order.

The durable event timeline, lifecycle milestones, journey, linked parcels,
event counters, aliases, and end-to-end completion flag are additive.

## Operational and security notes

- Normal application writes use TypeORM entity `save` and are captured by the
  tracking subscriber. Manual SQL performed outside the application can bypass
  this ledger and must write a corresponding event itself.
- Event rows cascade-delete if the parcel is deliberately deleted; this is an
  operational history ledger, not a legally immutable archival system.
- Only events with `is_public !== false` are returned.
- This route currently returns the legacy full parcel object, including contact,
  finance, merchant, store, and rider details. That preserves existing clients,
  but it exposes more information than a typical public courier tracking page.
  Before exposing this endpoint to untrusted internet users, protect it with an
  additional verification factor or introduce a masked public DTO and keep the
  full DTO behind authorization.

## Implementation locations

- `src/parcels/entities/parcel-tracking-event.entity.ts`: event schema.
- `src/migrations/1784592000000-CreateParcelTrackingEvents.ts`: explicit schema migration.
- `src/parcels/subscribers/parcel-tracking.subscriber.ts`: automatic mutation capture.
- `src/parcels/services/parcel-tracking.service.ts`: event loading, linked returns, and legacy fallback.
- `src/common/interfaces/responses.interface.ts`: wire-response mapper.
- `src/parcels/parcel-tracking.spec.ts`: lifecycle contract tests.
