# Hub Panel Dashboard API

All endpoints require a Hub Manager bearer token. The hub is always taken from
the authenticated JWT; clients cannot request another hub's data.

Both `/hubs/...` and the existing `/api/hubs/...` controller aliases work.

## Initial dashboard load

```http
GET /hubs/dashboard/overview
Authorization: Bearer <hub-manager-token>
```

Optional query parameters:

- `date=YYYY-MM-DD` (defaults to the current UTC date)
- `flow_range=today|last_7_days|last_30_days`
- `rider_limit=1..50`
- `ongoing_limit=1..50`
- `lifetime_start_date=YYYY-MM-DD`
- `lifetime_end_date=YYYY-MM-DD`

The two lifetime dates must be provided together.

The response `data` contains the screenshot sections:

- `top_cards`
- `summary_for_todays_parcel`
- `parcel_flow`
- `pending_actions`
- `rider_status`
- `ongoing_deliveries`
- `live_delivery_map`
- `summary_for_lifetime_parcel`

Amounts are numeric BDT values. Percentages are numbers rounded to two decimal
places. All day boundaries are returned in `date_context` and use UTC.

## Independently refreshable widgets

### Parcel flow

```http
GET /hubs/dashboard/parcel-flow?range=today&date=2026-07-15
```

`range` supports `today`, `last_7_days`, and `last_30_days`.

### Pending actions

```http
GET /hubs/dashboard/pending-actions
```

Returns actionable counts for pending OTP-bypass approvals, parcels waiting for
rider assignment, and returns waiting to be processed. Each action includes the
existing API route the UI should open.

### Rider status

```http
GET /hubs/dashboard/rider-status?status=all&page=1&limit=10
```

`status` supports `all`, `on_duty`, `break`, and `leave`.

- `on_duty`: active rider with an active assigned parcel
- `break`: active rider without an active assigned parcel
- `leave`: inactive rider

The endpoint also supports `search`, `sortBy`, and `order=ASC|DESC` from the
shared pagination contract.

### Ongoing delivery table

```http
GET /hubs/dashboard/ongoing-deliveries?page=1&limit=20
```

Optional parameters:

- `date=YYYY-MM-DD`
- `status=<ParcelStatus>`
- `search=<parcel, address, or rider>`
- `sortBy=created_at|updated_at|status|parcel_tx_id`
- `order=ASC|DESC`

Without a status filter, the endpoint returns active deliveries plus delivery
outcomes updated on the selected day.

### Lifetime parcel cards

```http
GET /hubs/dashboard/lifetime-summary
GET /hubs/dashboard/lifetime-summary?start_date=2026-01-01&end_date=2026-07-15
```

Both date parameters must be provided together. The response includes total,
delivered, partially delivered, paid return, return, pending return, pending,
return to merchant, and exchanged cards.

## Backward compatibility

These existing routes and their response shapes are unchanged:

- `GET /hubs/dashboard/summary`
- `GET /hubs/dashboard/today-parcels`
- `GET /hubs/dashboard/parcels/:id`

The new implementation is additive and does not add or alter database columns.

## Live map limitation

The current Rider and Parcel models do not store continuously updated GPS
coordinates. `live_delivery_map.tracking_available` is therefore `false`, with
an empty `markers` array and an `unlocated_deliveries` list containing the real
rider and destination metadata. Coordinates should only be enabled after a
rider-location ingestion flow is added; the API does not fabricate map points.
