# Admin Panel Dashboard API

This API contract supports the Admin Panel dashboard shown in the supplied design. It is additive: no existing parcel, hub, rider, merchant, invoice, or finance endpoint is changed.

## Authentication

Every endpoint in this document requires an admin JWT.

```http
Authorization: Bearer <admin_access_token>
```

- Allowed role: `ADMIN`
- `401 Unauthorized`: token is missing, invalid, or expired.
- `403 Forbidden`: the authenticated user is not an admin.

All successful dashboard responses use this envelope:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

## Dashboard endpoints

| Dashboard section | Method | Endpoint |
| --- | --- | --- |
| Top cards, today's summary, quick actions, alerts | `GET` | `/admin/dashboard/overview` |
| Parcel Flow chart | `GET` | `/admin/dashboard/parcel-flow` |
| Pending Actions panel | `GET` | `/admin/dashboard/pending-actions` |
| Earning Trends chart | `GET` | `/admin/dashboard/earning-trends` |
| Summary for Lifetime Parcel | `GET` | `/admin/dashboard/lifetime-summary` |
| HUB selector options (existing API) | `GET` | `/hubs?page=1&limit=100` |

The dashboard should load `overview` first. The three large chart/card sections can load in parallel and refresh independently.

---

## 1. Dashboard overview

```http
GET /admin/dashboard/overview
GET /admin/dashboard/overview?date=2026-07-21
```

### Query parameters

| Name | Required | Format | Meaning |
| --- | --- | --- | --- |
| `date` | No | `YYYY-MM-DD` | UTC day used by the "today" summary and comparison. Defaults to the current UTC day. |

### Example response

```json
{
  "success": true,
  "data": {
    "generated_at": "2026-07-21T10:30:00.000Z",
    "scope": {
      "type": "ALL_HUBS",
      "hub": null
    },
    "date_context": {
      "timezone": "UTC",
      "date": "2026-07-21",
      "start": "2026-07-21T00:00:00.000Z",
      "end_exclusive": "2026-07-22T00:00:00.000Z"
    },
    "top_cards": {
      "parcels_to_process": {
        "value": 24,
        "received_last_hour": 3
      },
      "riders_active": {
        "value": 15,
        "total": 30
      },
      "deliveries_in_progress": {
        "value": 75,
        "average_per_active_rider": 5
      },
      "total_active_hubs": {
        "value": 123,
        "total": 130
      },
      "live_success_rate": {
        "value": 88.42,
        "unit": "percent",
        "today_change": 0.5,
        "comparison": "today_vs_previous_day"
      }
    },
    "summary_for_todays_parcel": {
      "currency": "BDT",
      "new_parcels": { "count": 12, "amount": 48000 },
      "pick_up": { "count": 45, "amount": 48000 },
      "assigned": { "count": 23, "amount": 48000 },
      "delivered": { "count": 12, "amount": 48000 },
      "delivery_rescheduled": { "count": 7, "amount": 48000 }
    },
    "quick_actions": [
      {
        "id": "manage_hubs",
        "label": "Manage HUB",
        "endpoint": "/hubs",
        "method": "GET"
      },
      {
        "id": "view_reports",
        "label": "View Report",
        "endpoint": "/hubs/parcels/reports",
        "method": "GET"
      },
      {
        "id": "approve_rider",
        "label": "Approve Rider",
        "endpoint": "/riders?approval_status=PENDING&isActive=all",
        "method": "GET"
      },
      {
        "id": "create_invoice",
        "label": "Create Invoice",
        "endpoint": "/merchant-invoices",
        "method": "POST"
      },
      {
        "id": "all_parcels",
        "label": "All Parcel",
        "endpoint": "/admin/parcels",
        "method": "GET"
      }
    ],
    "pending_actions": {
      "counts": {
        "rider_approval": 4,
        "merchant_payment": 2,
        "merchant_approval": 3,
        "total": 9
      },
      "actions": []
    }
  },
  "message": "Admin dashboard overview retrieved successfully"
}
```

### Top-card definitions

| Field | Definition |
| --- | --- |
| `parcels_to_process.value` | Parcels in `PENDING`, `PICKED_UP`, `IN_HUB`, `FAILED_DELIVERY`, `DELIVERY_RESCHEDULED`, or `RETURNED_TO_HUB`. |
| `parcels_to_process.received_last_hour` | Parcels created during the latest hour of the selected UTC day. For the current day, the interval ends at the current time. |
| `riders_active.value` | Riders that are both active and admin-approved. |
| `riders_active.total` | All registered riders, including pending, rejected, and inactive records. |
| `deliveries_in_progress.value` | Parcels in `ASSIGNED_TO_RIDER`, `ASSIGNED_TO_THIRD_PARTY`, `OUT_FOR_DELIVERY`, or `IN_TRANSIT`. |
| `average_per_active_rider` | In-progress deliveries divided by active approved riders. Returns `0` when no rider is active. |
| `total_active_hubs.value` | HUBs where `status=ACTIVE` and `is_active=true`. |
| `total_active_hubs.total` | All registered HUBs. |
| `live_success_rate.value` | Lifetime successful outcomes divided by completed outcomes, as a percentage. Successful outcomes are delivered, partial delivery, and exchange. |
| `live_success_rate.today_change` | Selected-day success rate minus previous-day success rate, in percentage points. This can be negative. |

### Today's parcel summary definitions

Every `amount` is the sum of `product_price`, returned in BDT.

| Field | Definition |
| --- | --- |
| `new_parcels` | Every parcel created during the selected UTC day. |
| `pick_up` | Created that day and currently `PICKED_UP` or `OUT_FOR_PICKUP`. |
| `assigned` | Created that day and currently assigned to a rider/third party, out for delivery, or in transit. |
| `delivered` | Created that day and currently `DELIVERED`. |
| `delivery_rescheduled` | Created that day and currently `DELIVERY_RESCHEDULED`. |

`new_parcels` is the total created that day. The other cards are status subsets, so their counts should not be added to `new_parcels`.

---

## 2. Parcel Flow

```http
GET /admin/dashboard/parcel-flow
GET /admin/dashboard/parcel-flow?range=last_7_days
GET /admin/dashboard/parcel-flow?hub_id=<hub_uuid>&range=last_30_days
GET /admin/dashboard/parcel-flow?hub_id=<hub_uuid>&start_date=2026-07-01&end_date=2026-07-21
```

### Query parameters

| Name | Required | Allowed value | Meaning |
| --- | --- | --- | --- |
| `hub_id` | No | HUB UUID | Omit for all HUBs. Set it when the admin selects a HUB. |
| `range` | No | `today`, `last_7_days`, `last_30_days` | Preset range. Defaults to `today`. |
| `date` | No | `YYYY-MM-DD` | End day for a preset range. Defaults to the current UTC day. |
| `start_date` | Conditional | `YYYY-MM-DD` | Custom inclusive start day. Must be sent with `end_date`. |
| `end_date` | Conditional | `YYYY-MM-DD` | Custom inclusive end day. Must be sent with `start_date`. |

When a custom range is supplied, it takes precedence over `range` and `date`.

### Example response

```json
{
  "success": true,
  "data": {
    "scope": {
      "type": "HUB",
      "hub": {
        "id": "a0bd7d87-ecfa-40c5-a066-f9bad84a9629",
        "hub_code": "HUB-001",
        "branch_name": "Dhanmondi HUB",
        "area": "Dhanmondi",
        "status": "ACTIVE",
        "is_active": true
      }
    },
    "range": {
      "preset": "custom",
      "start_date": "2026-07-01",
      "end_date": "2026-07-21",
      "start": "2026-07-01T00:00:00.000Z",
      "end_exclusive": "2026-07-22T00:00:00.000Z"
    },
    "metrics": {
      "parcels_received": 892,
      "parcels_dispatched": 756,
      "parcels_reported": 103
    }
  },
  "message": "Admin dashboard parcel flow retrieved successfully"
}
```

### Metric definitions

| Metric | Timestamp used |
| --- | --- |
| `parcels_received` | Destination-HUB received time, otherwise pickup time, otherwise creation time. |
| `parcels_dispatched` | `out_for_delivery_at`. |
| `parcels_reported` | `issue_reported_at`. |

For a HUB filter, the API uses the parcel's current HUB. If legacy data has no current HUB, it falls back to the parcel store's assigned HUB.

---

## 3. Pending Actions

```http
GET /admin/dashboard/pending-actions
```

This endpoint can be polled independently after an approval or payment is completed.

### Example response

```json
{
  "success": true,
  "data": {
    "counts": {
      "rider_approval": 4,
      "merchant_payment": 2,
      "merchant_approval": 3,
      "total": 9
    },
    "actions": [
      {
        "type": "RIDER_APPROVAL",
        "priority": "high",
        "count": 4,
        "title": "Approve rider for Dhanmondi Branch",
        "description": "Rider: Ahmed Wasi",
        "reference_id": "<rider_uuid>",
        "list_endpoint": "/riders?approval_status=PENDING&isActive=all",
        "action_endpoint": "/riders/<rider_uuid>/approve",
        "action_method": "PATCH"
      },
      {
        "type": "MERCHANT_PAYMENT",
        "priority": "medium",
        "count": 2,
        "title": "Pay request from merchant: TechHUB",
        "description": "Invoice ID: #4234",
        "reference_id": "<invoice_uuid>",
        "amount": 1250.5,
        "currency": "BDT",
        "list_endpoint": "/merchant-invoices/pending-list",
        "action_endpoint": "/merchant-invoices/<invoice_uuid>/pay",
        "action_method": "POST"
      },
      {
        "type": "MERCHANT_APPROVAL",
        "priority": "normal",
        "count": 3,
        "title": "Approve merchant",
        "description": "New merchant: Tech HUB",
        "reference_id": "<merchant_uuid>",
        "list_endpoint": "/merchants?status=PENDING",
        "action_endpoint": "/merchants/<merchant_uuid>/approve",
        "action_method": "PATCH"
      }
    ]
  },
  "message": "Admin dashboard pending actions retrieved successfully"
}
```

The `actions` array only contains action types whose count is greater than zero. It gives the oldest waiting record as a preview. `count` is the total backlog for that action, not the number of preview records.

`MERCHANT_PAYMENT` includes invoices in `UNPAID` or `PROCESSING` state. The payment endpoint still performs the existing invoice validation and payment workflow; the dashboard does not bypass it.

---

## 4. Earning Trends

```http
GET /admin/dashboard/earning-trends
GET /admin/dashboard/earning-trends?start_year=2024&end_year=2026
GET /admin/dashboard/earning-trends?hub_id=<hub_uuid>&start_year=2025&end_year=2026
```

### Query parameters

| Name | Required | Allowed value | Meaning |
| --- | --- | --- | --- |
| `hub_id` | No | HUB UUID | Omit for all HUBs. |
| `start_year` | No | Integer `2000`-`2100` | First year. Defaults to two years before `end_year`. |
| `end_year` | No | Integer `2000`-`2100` | Last year. Defaults to the current UTC year. |

The inclusive range is limited to five calendar years. This prevents an accidental oversized chart query.

### Example response

```json
{
  "success": true,
  "data": {
    "scope": { "type": "ALL_HUBS", "hub": null },
    "currency": "BDT",
    "metric": "courier_revenue",
    "revenue_components": [
      "delivery_charge",
      "cod_charge",
      "weight_charge",
      "return_charge"
    ],
    "range": {
      "start_year": 2024,
      "end_year": 2026
    },
    "series": [
      {
        "year": 2024,
        "total": 8500000,
        "monthly": [
          { "month": 1, "label": "January", "amount": 500000 },
          { "month": 2, "label": "February", "amount": 850000 },
          { "month": 3, "label": "March", "amount": 200000 },
          { "month": 4, "label": "April", "amount": 900000 },
          { "month": 5, "label": "May", "amount": 650000 },
          { "month": 6, "label": "June", "amount": 380000 },
          { "month": 7, "label": "July", "amount": 230000 },
          { "month": 8, "label": "August", "amount": 830000 },
          { "month": 9, "label": "September", "amount": 930000 },
          { "month": 10, "label": "October", "amount": 500000 },
          { "month": 11, "label": "November", "amount": 370000 },
          { "month": 12, "label": "December", "amount": 500000 }
        ]
      }
    ]
  },
  "message": "Admin dashboard earning trends retrieved successfully"
}
```

The response always includes all 12 months for every requested year. Months with no revenue return `amount: 0`, so the frontend does not have to fill chart gaps.

`courier_revenue` is the sum of delivery, COD, weight, and return charges for completed revenue-bearing parcel outcomes. The accounting-focused API remains available at `GET /admin/accounts/finance/analytics` for revenue-versus-expense, liquidity, and profit reporting.

---

## 5. Lifetime Parcel Summary

```http
GET /admin/dashboard/lifetime-summary
GET /admin/dashboard/lifetime-summary?hub_id=<hub_uuid>
GET /admin/dashboard/lifetime-summary?start_date=2026-01-01&end_date=2026-07-21
GET /admin/dashboard/lifetime-summary?hub_id=<hub_uuid>&start_date=2026-01-01&end_date=2026-07-21
```

### Query parameters

| Name | Required | Format | Meaning |
| --- | --- | --- | --- |
| `hub_id` | No | HUB UUID | Omit for all HUBs. |
| `start_date` | Conditional | `YYYY-MM-DD` | Parcel creation date, inclusive. Must be sent with `end_date`. |
| `end_date` | Conditional | `YYYY-MM-DD` | Parcel creation date, inclusive. Must be sent with `start_date`. |

Omit both dates for the true lifetime totals.

### Example response

```json
{
  "success": true,
  "data": {
    "scope": { "type": "ALL_HUBS", "hub": null },
    "date_range": {
      "start_date": null,
      "end_date": null
    },
    "currency": "BDT",
    "total_parcel": { "count": 324519, "amount": 6456000 },
    "delivered": { "count": 240000, "amount": 4800000 },
    "partially_delivered": { "count": 18000, "amount": 320000 },
    "paid_return": { "count": 10500, "amount": 210000 },
    "return": { "count": 9500, "amount": 190000 },
    "pending_return": { "count": 6000, "amount": 120000 },
    "pending": { "count": 30519, "amount": 610000 },
    "return_to_merchant": { "count": 5500, "amount": 110000 },
    "exchanged": { "count": 4500, "amount": 90000 }
  },
  "message": "Admin dashboard lifetime summary retrieved successfully"
}
```

### Card definitions

| Card | Parcel status definition |
| --- | --- |
| `total_parcel` | Every parcel in the selected scope. |
| `delivered` | `DELIVERED` |
| `partially_delivered` | `PARTIAL_DELIVERY` |
| `paid_return` | `PAID_RETURN` |
| `return` | `RETURNED` |
| `pending_return` | `RETURNED_TO_HUB` |
| `pending` | Pending, pickup, HUB, assignment, delivery/transit, failed delivery, and rescheduled statuses. |
| `return_to_merchant` | `RETURN_TO_MERCHANT` |
| `exchanged` | `EXCHANGE` |

Each `amount` is the sum of parcel `product_price` for that card. These cards intentionally overlap in one place: `total_parcel` contains every other category.

---

## Frontend loading sequence

Recommended initial requests:

```text
1. GET /admin/dashboard/overview
2. In parallel:
   GET /admin/dashboard/parcel-flow?range=today
   GET /admin/dashboard/earning-trends
   GET /admin/dashboard/lifetime-summary
```

When an admin selects a HUB, pass the same `hub_id` to Parcel Flow, Earning Trends, and Lifetime Summary. The top KPI cards and today's summary remain system-wide, matching the Admin Panel design.

Refresh only the affected endpoint after an action:

- Rider/merchant approval or invoice payment: refresh `pending-actions` and optionally `overview`.
- HUB selector or chart range change: refresh `parcel-flow`.
- Earning year/HUB change: refresh `earning-trends`.
- Lifetime date/HUB change: refresh `lifetime-summary`.

## Validation errors

Examples of rejected requests:

- Invalid UUID in `hub_id`.
- Invalid or impossible calendar date.
- Only one of `start_date` and `end_date` supplied.
- `start_date` after `end_date`.
- `start_year` after `end_year`.
- Earning trend range longer than five years.
- HUB UUID is valid but does not exist (`404 Not Found`).

No database migration is required for these dashboard endpoints.
