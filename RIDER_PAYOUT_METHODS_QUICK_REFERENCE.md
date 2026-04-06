# Rider Payout Methods - Very Short Doc

Base: `/riders/profile/payout-methods`  
Auth: Rider JWT

## Tested (runtime)
- GET `/available` -> 401 (auth required)
- GET `/` -> 401 (auth required)
- POST `/` -> 401 (auth required)
- PATCH `/:id` -> 401 (auth required)
- PATCH `/:id/set-default` -> 401 (auth required)
- PATCH `/:id/status` -> 404 (removed)

## Endpoint / Body / Response / Comment

### GET `/riders/profile/payout-methods/available`
- Body: none
- Response: `{"success":true,"data":{"available_methods":["BANK_ACCOUNT","BKASH","NAGAD","CASH"]},"message":"Available payout methods retrieved successfully"}`
- Comment: returns all supported method types.

### GET `/riders/profile/payout-methods`
- Body: none
- Response: `{"success":true,"data":{"methods":[{"id":"uuid","method_type":"BANK_ACCOUNT","status":"ACTIVE","is_active":true,"is_default":true,"bank":{"bank_name":"Bank A","branch_name":"Main Branch","account_name":"Rider Name","account_number":"*******123","routing_number":"123456789"}}]},"message":"Payout methods retrieved successfully"}`
- Comment: sensitive numbers are masked.

### POST `/riders/profile/payout-methods`
- Body: `{"method_type":"BANK_ACCOUNT","bank_name":"Bank A","branch_name":"Main Branch","account_holder_name":"Rider Name","account_number":"1234567890","routing_number":"123456789","is_default":true}`
- Response: `{"success":true,"data":{"method":{"id":"uuid","method_type":"BANK_ACCOUNT","is_default":true,"is_active":true,"bank":{"bank_name":"Bank A","branch_name":"Main Branch","account_name":"Rider Name","account_number":"*******890","routing_number":"123456789"}}},"message":"Payout method added successfully"}`
- Comment: `is_active` cannot be set by rider.

### PATCH `/riders/profile/payout-methods/:id`
- Body: `{"bank_name":"City Bank","branch_name":"Dhanmondi","account_holder_name":"Updated Rider Name","routing_number":"987654321"}`
- Response: `{"success":true,"data":{"method":{"id":"uuid","method_type":"BANK_ACCOUNT","is_default":false,"is_active":true,"bank":{"bank_name":"City Bank","branch_name":"Dhanmondi","account_name":"Updated Rider Name","account_number":"*******890","routing_number":"987654321"}}},"message":"Payout method updated successfully"}`
- Comment: cannot change `method_type` or default/status here.

### PATCH `/riders/profile/payout-methods/:id/set-default`
- Body: none
- Response: `{"success":true,"data":{"method":{"id":"uuid","is_default":true}},"message":"Default payout method set successfully"}`
- Comment: old default is auto-unset; inactive method is blocked.

## Common Errors
- 400: Only admin can update payout method status
- 400: Use set-default endpoint to update default method
- 400: Method type cannot be changed. Create a new payout method instead.
- 404: Payout method not found
- 409: Bank account number already exists
- 409: bKash number already exists
- 409: Nagad number already exists

## Behavior Note
- Rider can add multiple payout methods with the same `method_type`.
- Within a rider account, payout identifiers must be unique (`account_number`, `bkash_number`, `nagad_number`).
