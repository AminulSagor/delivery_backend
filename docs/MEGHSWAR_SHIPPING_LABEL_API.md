# Meghswar Dynamic Shipping Label API

## API Name

Download Single Meghswar Shipping Label

## Method + Endpoint

GET /parcels/:parcelId/label?layout=THERMAL

## Authentication

Authorization: Bearer \<access-token>

Roles:

ADMIN, HUB_MANAGER, MERCHANT

## Path Parameter

`parcelId`: Parcel UUID, required

## Query Parameter

`layout`: `THERMAL` or `A4`, optional, default `THERMAL`

## Request Body

None.

## Success Response

Status: `200 OK`

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="meghswar-label-<tracking-number>.pdf"
```

The response body contains the generated PDF bytes.

## Error Response

404 Not Found

```json
{
  "success": false,
  "message": "Parcel with ID <parcelId> not found"
}
```

403 Forbidden

```json
{
  "success": false,
  "message": "You do not have permission to print this shipping label"
}
```

## Business Rules

- The label is generated from the latest parcel data; frontend does not send label values.
- The QR code opens the Meghswar tracking URL for the parcel tracking number.
- The Code 128 barcode contains the parcel tracking number.
- Sort hub, delivery hub, zone, area, COD, weight, order ID, merchant, recipient, note, and creation time are populated dynamically.
- Return parcels and return statuses display the `RETURN` badge automatically.
- Company phone, address, and tracking website can be configured with `MEGHSWAR_COMPANY_PHONE`, `MEGHSWAR_COMPANY_ADDRESS`, and `MEGHSWAR_WEBSITE`.
- `THERMAL` creates one 100 x 150 mm label.
- `A4` creates a half-page label.
- A merchant can print only its own parcel.
- A hub manager can print only a parcel currently assigned to their hub.
- An admin can print any parcel.

---

## API Name

Download Bulk Meghswar Shipping Labels

## Method + Endpoint

POST /parcels/labels

## Authentication

Authorization: Bearer \<access-token>

Roles:

ADMIN, HUB_MANAGER, MERCHANT

## Request Body

```json
{
  "parcel_ids": [
    "3b03dbf4-48cb-44e4-bc2a-c2c801d9dd31",
    "8bb28e0a-56c5-45a2-8329-265c7c4f3339"
  ],
  "layout": "A4"
}
```

`parcel_ids`: Required array containing 1-100 parcel UUIDs.

`layout`: `A4` or `THERMAL`, optional, default `A4`.

## Success Response

Status: `200 OK`

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="meghswar-shipping-labels-YYYY-MM-DD.pdf"
```

The response body contains the generated multi-label PDF bytes.

## Error Response

400 Bad Request

```json
{
  "success": false,
  "message": ["parcel_ids must contain no more than 100 elements"]
}
```

403 Forbidden

```json
{
  "success": false,
  "message": "One or more parcels do not belong to this merchant"
}
```

## Business Rules

- Labels are returned in the same order as `parcel_ids`.
- Duplicate parcel IDs are printed once.
- `A4` prints two labels per page.
- `THERMAL` prints one parcel per 100 x 150 mm page.
- If any parcel is missing or unauthorized, the complete request fails and no partial PDF is returned.
- This API prints package shipping labels; it does not create or modify merchant financial invoices.
