# Customer Fraud Phone Lookup — Frontend API Guide

Use this endpoint to retrieve a customer’s delivery history and fraud-report information by phone number.

## Endpoint

```http
GET /customers/fraud/customers/phone/:phone
```

Production example:

```http
GET https://deliverybackend-production-f9bf.up.railway.app/customers/fraud/customers/phone/01760652024
```

No request body is required.

## Authentication

This is a merchant endpoint. Send the merchant JWT:

```http
Authorization: Bearer <merchant_access_token>
```

## Phone parameter

Pass the complete phone number as the URL parameter and URL-encode it before building the request.

```ts
const encodedPhone = encodeURIComponent(phone.trim());
```

The backend performs an exact match using this priority:

1. Primary customer phone (`phone_number`).
2. Secondary customer phone (`secondary_number`) only when no primary match exists.

This prevents another customer’s secondary phone from overriding an exact primary-phone match.

## Successful response

Status: `200 OK`

```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "6a114375-77bc-4a65-90f8-a51a12345678",
      "name": "Customer Name",
      "address": "Customer address",
      "phone": "01760652024",
      "is_new_customer": false,
      "customer_tag": "EXISTING_CUSTOMER",
      "last_order_placed_on": "5th September, 2026"
    },
    "order_history_breakdown": {
      "delivered": 8,
      "cancelled_returned": 2,
      "total_orders": 10,
      "successfully_delivered": 8,
      "success_rate": "80%",
      "overall_success_rate": "80%",
      "overall_success_rate_formula": "(8 Delivered / 10 Orders)"
    },
    "fraud_list": {
      "is_in_fraud_list": true,
      "approved_reports_count": 1,
      "pending_reports_count": 0,
      "reports": [
        {
          "id": "<reportId>",
          "status": "APPROVED",
          "reason": "Fraud report reason",
          "created_at": "2026-09-05T10:00:00.000Z",
          "updated_at": "2026-09-05T11:00:00.000Z",
          "is_active": true,
          "added_by": {
            "merchant_id": "<merchantId>",
            "merchant_name": "Merchant Name",
            "merchant_phone": "01700000000"
          },
          "admin_review": {
            "reviewed_by_admin_id": "<adminId>",
            "reviewed_by_admin_name": "Admin Name",
            "reviewed_at": "2026-09-05T11:00:00.000Z",
            "admin_note": "Approved"
          }
        }
      ]
    }
  },
  "message": "Customer fraud details retrieved successfully"
}
```

### Secondary-number lookup

When the searched number exists only as a secondary number, the API returns that customer, but `data.customer.phone` remains the customer’s **primary phone number**. The frontend should keep the original searched value separately if it also needs to display “Searched number.”

## Customer not found

Status: `404 Not Found`

```json
{
  "success": false,
  "statusCode": 404,
  "error": "Not Found",
  "message": "Customer not found",
  "timestamp": "2026-09-05T14:00:00.000Z",
  "path": "/customers/fraud/customers/phone/01760652024"
}
```

Show a message such as: **No customer found with this phone number.**

## Ambiguous secondary number

Status: `409 Conflict`

This occurs only when no primary phone matches and the same number is assigned as a secondary phone to multiple customers.

```json
{
  "success": false,
  "statusCode": 409,
  "error": "Conflict",
  "message": "Multiple customers use this secondary phone number. Use the primary phone number instead.",
  "timestamp": "2026-09-05T14:00:00.000Z",
  "path": "/customers/fraud/customers/phone/01760652024"
}
```

Display the API `message` and ask the merchant to search using the customer’s primary phone number.

## Other errors

- `401 Unauthorized`: token missing, expired, or invalid.
- `403 Forbidden`: logged-in user is not permitted to use the merchant endpoint.
- `500 Internal Server Error`: unexpected server failure.

## Frontend example

```ts
type ApiError = {
  success: false;
  statusCode: number;
  message: string | string[];
};

export async function getCustomerFraudByPhone(phone: string) {
  const normalizedPhone = phone.trim();
  const response = await api.get(
    `/customers/fraud/customers/phone/${encodeURIComponent(normalizedPhone)}`,
  );

  return response.data.data;
}
```

Suggested UI flow:

1. Trim the phone entered by the merchant.
2. Disable the search button while the request is loading.
3. On `200`, render `customer`, `order_history_breakdown`, and `fraud_list`.
4. On `404`, show the customer-not-found state.
5. On `409`, show the backend message and request a primary phone number.
6. For all other errors, display the API `message` or a general retry message.

## Compatibility

The method, route, parameters, and successful response mapping have not changed. Frontend changes are needed only to handle the possible `409 Conflict` response explicitly.
