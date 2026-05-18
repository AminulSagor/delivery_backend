## Parcel tracking — quick, human guide

This page explains, in plain language, what the backend sends in `tracking` and how to show it in your UI.

Purpose: the backend already turns internal parcel timestamps and status values into a small, ready-to-display `tracking` object. Use that object directly — it tells you what steps are done and provides a short activity history.

What you get:

- `parcel_id`: the parcel reference (show this at the top).
- `current_status`: one of the parcel status enums (use for a badge).
- `delivery_milestones`: ordered steps with `is_completed` booleans (use for a stepper/progress view).
- `activities`: short messages with timestamps (use for a timeline, newest-first).

Simple example (typical shape):

```json
{
  "tracking": {
    "parcel_id": "MF120526DHV4",
    "current_status": "ASSIGNED_TO_THIRD_PARTY",
    "delivery_milestones": [
      { "key": "picked", "label": "Picked", "is_completed": true },
      { "key": "sorted", "label": "Sorted", "is_completed": true },
      { "key": "in_transit", "label": "In Transit", "is_completed": false }
    ],
    "activities": [
      { "id": 1, "message": "Assigned to third-party provider", "timestamp": "2026-05-12T11:00:00.000Z", "location": null }
    ]
  }
}
```

How milestones become `is_completed` (server rules):

- `picked` = `picked_up_at` exists, or any later physical-progress state exists (hub, received, assigned, out-for-delivery, delivered)
- `sorted` = parcel is in hub / in transit or `picked` is already true
- `in_transit` = parcel.status === `IN_TRANSIT`
- `received_at_lmh` = `received_at` or `received_at_destination_hub` exists
- `assigned_for_delivery` = `assigned_at` exists
- `delivered` = `delivered_at` exists

How activity messages are made (server-side):

- The backend collects events from parcel fields (created, weight change, picked up, hub update, assignment, out-for-delivery, delivered) and pushes short human messages into an array.
- If the rider enters a delivery-initiation note, the backend stores it on the parcel and adds it to `activities` as a rider note message.
- Messages are fixed text templates inside `toParcelDetail()` and include small contextual bits (e.g. rider name/phone, hub branch name).
- The array is sorted oldest→newest, assigned incremental IDs, then reversed so the API returns newest-first.

Where to change text or add events:

- Edit `toParcelDetail()` in `src/common/interfaces/responses.interface.ts` — that's where milestone array and activity messages are built.

Quick mapping you can paste into your frontend (status → badge color):

- ASSIGNED_TO_THIRD_PARTY → orange
- PICKED_UP → green
- IN_TRANSIT → blue
- IN_HUB → cyan
- OUT_FOR_DELIVERY → purple
- DELIVERED → green
- RETURNED → red
- FAILED_DELIVERY → red

Simple rendering rules for UI:

1. Show `tracking.parcel_id` and `tracking.current_status` at top.
2. Render `delivery_milestones` in the order provided; use `is_completed` to colour/mark each step.
3. Render `activities` newest-first; show `message`, formatted `timestamp`, and `location` if present.
4. If `tracking` is missing, show a friendly fallback like "Tracking not available yet." and refresh after actions.

Tiny React example (copy-paste):

```tsx
export function ParcelTrackingCard({ tracking }: { tracking?: any }) {
  if (!tracking) return <div>Tracking not available.</div>;

  return (
    <div>
      <div><strong>{tracking.parcel_id}</strong> — {tracking.current_status}</div>
      <ol>
        {tracking.delivery_milestones.map((m: any) => (
          <li key={m.key} style={{ color: m.is_completed ? 'green' : 'gray' }}>{m.label}</li>
        ))}
      </ol>
      <div>
        {tracking.activities.map((a: any) => (
          <div key={a.id}>
            <div><strong>{a.message}</strong></div>
            <small>{new Date(a.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

If you'd like, I can also:
Below is a visual mapping that shows how backend parcel fields flow into the
`tracking` object and into frontend components. Use this to wire your UI
components to the server model.

```mermaid
flowchart TD
  ParcelEntity[Parcel entity fields]
  ParcelEntity -->|mapper: toParcelDetail()| TrackingObj[tracking object]
  TrackingObj --> CurrentStatus[current_status]
  TrackingObj --> Milestones[delivery_milestones]
  TrackingObj --> Activities[activities]

  CurrentStatus --> Badge[UI: Status Badge]
  Milestones --> Stepper[UI: Stepper / Progress]
  Activities --> Timeline[UI: Activity Timeline]

  style ParcelEntity fill:#f9f,stroke:#333,stroke-width:1px
  style TrackingObj fill:#ff9,stroke:#333,stroke-width:1px
  style Badge fill:#9f9,stroke:#333
  style Stepper fill:#9ff,stroke:#333
  style Timeline fill:#f99,stroke:#333
```

Concise field → UI mapping:

- Parcel entity `created_at`, `picked_up_at`, `assigned_at`, `out_for_delivery_at`, `delivered_at` → used by `toParcelDetail()` to populate `activities` (timeline entries) and `delivery_milestones`.
- Parcel entity `status` → `tracking.current_status` (use for the status badge color/label).
- `delivery_milestones[].is_completed` → Stepper completed state (boolean: filled/checked).
- `activities[]` (id, message, timestamp, location) → render as newest-first timeline rows.

Where to change text or add events:

- Edit `toParcelDetail()` in `src/common/interfaces/responses.interface.ts` — that's where milestone array and activity messages are built and where you can adjust wording or add events.


Source for the server logic:

- `src/common/interfaces/responses.interface.ts` — builds `tracking` and activity messages
- `src/parcels/entities/parcel.entity.ts` — defines the parcel fields used by the builder

