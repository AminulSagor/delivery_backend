# Rider management and earnings frontend guide

All endpoints require the existing bearer token. Hub managers can only view,
edit, or deactivate riders belonging to their own hub.

## Create rider

`POST /riders`

`nid_number`, `license_no`, all NID images, and all driving-licence images are
optional. Omit them or send `null`; blank strings for the two numbers are
normalized to `null`.

```json
{
  "full_name": "Ahmed Wasi",
  "phone": "01700000000",
  "password": "password123",
  "guardian_mobile_no": "01800000000",
  "bike_type": "MOTORCYCLE",
  "present_address": "Dhaka",
  "permanent_address": "Dhaka",
  "fixed_salary": 10000,
  "commission_per_delivery": 20,
  "nid_number": null,
  "license_no": null
}
```

Remove the required marker and client validation from the NID/licence number
and document controls.

## View and update rider

- View: `GET /riders/:riderId`
- Update: `PATCH /riders/:riderId`

The update request is partial. Send only changed fields:

```json
{
  "full_name": "Ahmed Wasi",
  "phone": "01700000000",
  "fixed_salary": 12000,
  "commission_per_delivery": 25,
  "nid_number": null,
  "license_no": null
}
```

Use the returned `data` object as the refreshed rider. Do not send
`is_active` through this endpoint; status has explicit actions below.

## Deactivate and reactivate

- Deactivate: `PATCH /riders/:riderId/deactivate` with no body
- Reactivate (admin only): `PATCH /riders/:riderId/activate` with no body
- Include inactive riders in the list: `GET /riders?isActive=all`
- Inactive riders only: `GET /riders?isActive=false`

The red trash icon must not call `DELETE`. It represents deactivation, so use
a pause/user-off icon and confirmation text such as “Deactivate rider?”. On a
successful response, `data.is_active` is `false`. Existing rider history is
preserved, and the linked login/staff record is disabled.

## Rider earnings

Use either `GET /riders/summary` or `GET /riders/finance/summary` while logged
in as the rider.

Relevant response fields:

```json
{
  "success": true,
  "data": {
    "earnings": {
      "today": 100,
      "this_month": 3000,
      "breakdown": {
        "today": {
          "fixed_salary": 0,
          "commission": 100,
          "total": 100
        },
        "this_month": {
          "fixed_salary": 1000,
          "commission": 2000,
          "total": 3000
        }
      }
    }
  }
}
```

Display “Earnings Today” from `earnings.today` (today's delivery commission).
Display “Earning This Month” from `earnings.this_month` (full fixed monthly
salary plus this month's delivery commission). The Bangladesh calendar day
and month boundaries are applied by the backend.

`lifetime_cash_collection_30_days` is cash handled in the last 30 days; it is
not lifetime rider earnings. Keep that card label explicit to avoid confusing
cash collection with salary/commission.
