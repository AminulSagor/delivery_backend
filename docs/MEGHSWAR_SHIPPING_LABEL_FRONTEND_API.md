# Meghswar Shipping Label — Frontend Integration Guide

## What this API provides

The backend generates a Meghswar-branded, print-ready PDF directly from the
latest parcel data. The frontend does not need to draw the label, generate the
barcode, or map parcel fields into a template.

The label contains:

- Meghswar branding and a scannable Code 128 tracking barcode
- Tracking number
- Merchant/store name and store code
- Pickup hub and delivery hub
- COD amount, product weight, and merchant order ID
- Recipient name, phone, and address
- Product description/special instructions and parcel creation time

## Which panels should show it

| Panel       | Single label | Bulk labels | Access rule                                  |
| ----------- | ------------ | ----------- | -------------------------------------------- |
| Merchant    | Yes          | Yes         | Only parcels owned by the signed-in merchant |
| Hub Manager | Yes          | Yes         | Only parcels currently assigned to that hub  |
| Admin       | Yes          | Yes         | Any parcel                                   |
| Rider       | No           | No          | Label endpoints are not available to riders  |

Recommended placement:

- Add **Print label** to the parcel details/actions menu in Merchant, Hub, and Admin panels.
- Add row selection and **Print selected labels** to parcel tables in Merchant, Hub, and Admin panels.
- Keep the existing financial invoice screens separate. This document is the parcel shipping label/parcel invoice used on the package.

## Authentication

Both endpoints require the existing JWT access token:

```http
Authorization: Bearer <access_token>
```

## 1. Download one label

```http
GET /parcels/:parcelId/label?layout=THERMAL
```

Path:

- `parcelId`: parcel UUID

Optional query:

- `layout=THERMAL`: one label per 100 × 150 mm page; this is the default
- `layout=A4`: one label in the next available half-page slot

Success response:

- Status: `200 OK`
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="meghswar-label-<tracking>.pdf"`
- Body: raw PDF bytes, not JSON

## 2. Download labels for selected parcels

```http
POST /parcels/labels
Content-Type: application/json
```

Body:

```json
{
  "parcel_ids": [
    "3b03dbf4-48cb-44e4-bc2a-c2c801d9dd31",
    "8bb28e0a-56c5-45a2-8329-265c7c4f3339"
  ],
  "layout": "A4"
}
```

Rules:

- `parcel_ids` is required and accepts 1–100 parcel UUIDs.
- `layout` is optional: `A4` or `THERMAL`.
- The bulk default is `A4`, with two labels per page.
- `THERMAL` generates one 100 × 150 mm page for every parcel.
- Labels follow the same order as `parcel_ids`.
- If any parcel is missing or unauthorized, the whole request fails; the API does not return a partial PDF.

Success response is a raw PDF file:

- Status: `200 OK`
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="meghswar-shipping-labels-YYYY-MM-DD.pdf"`

## Frontend example using Axios

Configure `responseType: 'blob'`. Without it, the PDF can be corrupted because
the client may try to parse the response as JSON/text.

```ts
type LabelLayout = 'A4' | 'THERMAL';

function savePdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadParcelLabel(
  parcelId: string,
  layout: LabelLayout = 'THERMAL',
) {
  const response = await api.get(`/parcels/${parcelId}/label`, {
    params: { layout },
    responseType: 'blob',
  });

  savePdf(response.data, `meghswar-label-${parcelId}.pdf`);
}

export async function downloadSelectedLabels(
  parcelIds: string[],
  layout: LabelLayout = 'A4',
) {
  const response = await api.post(
    '/parcels/labels',
    { parcel_ids: parcelIds, layout },
    { responseType: 'blob' },
  );

  savePdf(response.data, 'meghswar-shipping-labels.pdf');
}
```

## Preview or print instead of download

Use the returned Blob to open the browser PDF viewer:

```ts
const url = URL.createObjectURL(response.data);
const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

// Revoke after the new window has loaded; do not revoke immediately.
setTimeout(() => URL.revokeObjectURL(url), 60_000);
```

The user can print from the PDF viewer. Do not apply HTML print CSS to the PDF.
For thermal printers select actual size/100% and a 100 × 150 mm paper size.

## Error handling

Errors use the backend's normal JSON error response even though a successful
response is a PDF Blob.

| Status | Meaning                                                                                 |
| ------ | --------------------------------------------------------------------------------------- |
| `400`  | Invalid UUID, invalid layout, empty list, or more than 100 parcel IDs                   |
| `401`  | Missing/expired access token                                                            |
| `403`  | Role not allowed, merchant does not own a parcel, or parcel is not currently in the hub |
| `404`  | At least one requested parcel was not found                                             |

When Axios uses `responseType: 'blob'`, parse an error Blob before displaying it:

```ts
export async function getPdfErrorMessage(error: any) {
  const data = error?.response?.data;
  if (!(data instanceof Blob)) return data?.message || 'Could not create label';

  try {
    const payload = JSON.parse(await data.text());
    return Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'Could not create label';
  } catch {
    return 'Could not create label';
  }
}
```

## Important integration notes

- No parcel field names or existing APIs were changed.
- No frontend-generated HTML/image is required for the label.
- No database migration is required.
- Use parcel UUIDs (`parcel.id`), not tracking numbers, in both routes.
- The PDF always uses current backend values, so re-downloading after an allowed charge or parcel update reflects the latest saved data.
- Existing merchant financial invoice APIs remain unchanged and are not replaced by these label endpoints.
