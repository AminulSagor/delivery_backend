erDiagram
  users {
    uuid id PK
    varchar full_name 
    varchar phone 
    varchar email 
    varchar password_hash 
    enum role 
    boolean is_active 
    text refresh_token 
    varchar reset_otp 
    timestamp reset_otp_expires 
    timestamp created_at 
    timestamp updated_at 
  }
  third_party_providers {
    uuid id PK
    varchar provider_code 
    varchar provider_name 
    text description 
    boolean is_active 
    timestamp created_at 
    timestamp updated_at 
  }
  merchant_profiles {
    uuid id PK
    uuid merchant_id FK
    text profile_img_url 
    varchar nid_number 
    text nid_front_url 
    text nid_back_url 
    boolean nid_verified 
    varchar trade_license_number 
    text trade_license_url 
    boolean trade_license_verified 
    varchar tin_number 
    text tin_certificate_url 
    boolean tin_verified 
    varchar bin_number 
    text bin_certificate_url 
    boolean bin_verified 
    timestamp created_at 
    timestamp updated_at 
  }
  merchant_profiles |o--|| merchants : "merchant"
  merchants {
    uuid id PK
    uuid user_id FK
    varchar thana 
    varchar district 
    text full_address 
    varchar secondary_number 
    enum status 
    boolean is_advance_payment_disabled 
    timestamp approved_at 
    uuid approved_by FK
    timestamp created_at 
    timestamp updated_at 
  }
  merchants }o--|| users : "user"
  merchants }o--|| users : "approver"
  hubs {
    uuid id PK
    varchar hub_code 
    varchar branch_name 
    varchar area 
    text address 
    varchar manager_name 
    varchar manager_phone 
    uuid manager_user_id FK
    enum status 
    boolean is_active 
    timestamp created_at 
    timestamp updated_at 
  }
  hubs }o--|| users : "manager_user"
  stores {
    uuid id PK
    varchar store_code 
    uuid merchant_id FK
    varchar business_name 
    text business_address 
    varchar phone_number 
    varchar email 
    varchar facebook_page 
    uuid hub_id FK
    boolean is_default 
    enum status 
    varchar district 
    varchar thana 
    varchar area 
    varchar carrybee_store_id 
    int carrybee_city_id 
    int carrybee_zone_id 
    int carrybee_area_id 
    boolean is_carrybee_synced 
    timestamp carrybee_synced_at 
    boolean auto_assign_to_carrybee 
    timestamp created_at 
    timestamp updated_at 
  }
  stores }o--|| merchants : "merchant"
  stores }o--|| hubs : "hub"
  coverage_areas {
    uuid id PK
    varchar division 
    varchar city 
    int city_id 
    varchar zone 
    int zone_id 
    varchar area 
    int area_id 
    boolean inside_dhaka_flag 
    timestamp created_at 
    timestamp updated_at 
  }
  customers {
    uuid id PK
    varchar customer_name 
    varchar phone_number 
    varchar secondary_number 
    text customer_address 
    uuid delivery_coverage_area_id FK
    timestamp created_at 
    timestamp updated_at 
  }
  customers }o--|| coverage_areas : "deliveryCoverageArea"
  pickup_requests {
    uuid id PK
    varchar request_code 
    uuid merchant_id FK
    uuid store_id FK
    uuid hub_id FK
    uuid assigned_rider_id FK
    timestamp rider_assigned_at 
    uuid completed_by_rider_id FK
    int estimated_parcels 
    int actual_parcels 
    int picked_up_count 
    text comment 
    enum status 
    timestamp requested_at 
    timestamp confirmed_at 
    timestamp picked_up_at 
    timestamp cancelled_at 
    timestamp created_at 
    timestamp updated_at 
  }
  pickup_requests }o--|| merchants : "merchant"
  pickup_requests }o--|| stores : "store"
  pickup_requests }o--|| hubs : "hub"
  pickup_requests }o--|| riders : "assignedRider"
  pickup_requests }o--|| riders : "completedByRider"
  parcels {
    uuid id PK
    uuid customer_id FK
    uuid merchant_id FK
    uuid store_id FK
    uuid pickup_request_id FK
    varchar tracking_number 
    varchar parcel_tx_id 
    varchar merchant_order_id 
    text delivery_area 
    uuid delivery_coverage_area_id FK
    varchar customer_name 
    varchar customer_phone 
    varchar customer_secondary_phone 
    text customer_address 
    varchar product_description 
    decimal product_price 
    decimal product_weight 
    smallint parcel_type 
    decimal delivery_charge 
    decimal weight_charge 
    decimal cod_charge 
    decimal total_charge 
    boolean is_cod 
    decimal cod_amount 
    boolean is_exchange 
    decimal receivable_amount 
    decimal cod_collected_amount 
    decimal return_charge 
    boolean delivery_charge_applicable 
    boolean return_charge_applicable 
    enum financial_status 
    uuid invoice_id 
    boolean clearance_required 
    boolean clearance_done 
    uuid clearance_invoice_id 
    decimal paid_amount 
    enum status 
    enum payment_status 
    boolean paid_to_merchant 
    timestamp paid_to_merchant_at 
    timestamp cod_cleared_at 
    smallint delivery_type 
    uuid assigned_rider_id FK
    timestamp assigned_at 
    timestamp rider_accepted_at 
    timestamp out_for_delivery_at 
    smallint reschedule_count 
    text special_instructions 
    text admin_notes 
    text return_reason 
    uuid current_hub_id FK
    uuid origin_hub_id FK
    uuid destination_hub_id FK
    boolean is_inter_hub_transfer 
    timestamp transferred_at 
    timestamp received_at_destination_hub 
    text transfer_notes 
    enum delivery_provider 
    uuid third_party_provider_id FK
    enum issue_type 
    text issue_description 
    uuid issue_reported_by_id 
    timestamp issue_reported_at 
    boolean is_issue_resolved 
    varchar carrybee_consignment_id 
    decimal carrybee_delivery_fee 
    decimal carrybee_cod_fee 
    timestamp assigned_to_carrybee_at 
    int recipient_carrybee_city_id 
    int recipient_carrybee_zone_id 
    int recipient_carrybee_area_id 
    uuid original_parcel_id FK
    boolean is_return_parcel 
    timestamp picked_up_at 
    timestamp delivered_at 
    timestamp created_at 
    timestamp updated_at 
  }
  parcels }o--|| customers : "customer"
  parcels }o--|| merchants : "merchant"
  parcels }o--|| stores : "store"
  parcels }o--|| pickup_requests : "pickupRequest"
  parcels }o--|| coverage_areas : "delivery_coverage_area"
  parcels }o--|| riders : "assignedRider"
  parcels }o--|| hubs : "currentHub"
  parcels }o--|| hubs : "originHub"
  parcels }o--|| hubs : "destinationHub"
  parcels }o--|| third_party_providers : "thirdPartyProvider"
  parcels }o--|| parcels : "originalParcel"
  riders {
    uuid id PK
    varchar rider_code 
    uuid user_id FK
    uuid hub_id FK
    varchar photo 
    varchar guardian_mobile_no 
    enum bike_type 
    varchar nid_number 
    varchar license_no 
    text present_address 
    text permanent_address 
    decimal fixed_salary 
    decimal commission_per_delivery 
    varchar bank_name 
    varchar bank_account_number 
    varchar bank_branch 
    varchar nid_front_photo 
    varchar nid_back_photo 
    varchar license_front_photo 
    varchar license_back_photo 
    varchar parent_nid_front_photo 
    varchar parent_nid_back_photo 
    enum approval_status 
    timestamp approved_at 
    uuid approved_by FK
    boolean is_active 
    timestamp created_at 
    timestamp updated_at 
  }
  riders }o--|| users : "user"
  riders }o--|| hubs : "hub"
  riders }o--|| users : "approver"
  staff {
    uuid id PK
    varchar staff_code 
    uuid user_id FK
    uuid hub_id FK
    enum position 
    varchar photo 
    varchar secondary_phone 
    varchar guardian_mobile_no 
    enum bike_type 
    varchar nid_number 
    varchar license_no 
    text present_address 
    text permanent_address 
    decimal fixed_salary 
    varchar bank_name 
    varchar bank_account_number 
    varchar bank_branch 
    varchar nid_front_photo 
    varchar nid_back_photo 
    varchar license_front_photo 
    varchar license_back_photo 
    varchar parent_nid_front_photo 
    varchar parent_nid_back_photo 
    boolean is_active 
    timestamp created_at 
    timestamp updated_at 
  }
  staff }o--|| users : "user"
  staff }o--|| hubs : "hub"
  rider_finances {
    uuid id PK
    uuid rider_id FK
    decimal current_balance 
    decimal total_collected_amount 
    decimal total_deposited_amount 
    decimal total_earnings 
    decimal pending_balance 
    timestamp last_settlement_at 
    timestamp last_collection_at 
    timestamp created_at 
    timestamp updated_at 
  }
  rider_finances |o--|| riders : "rider"
  rider_payout_methods {
    uuid id PK
    uuid rider_id FK
    enum method_type 
    boolean is_default 
    boolean is_active 
    varchar bank_name 
    varchar branch_name 
    varchar account_holder_name 
    varchar account_number 
    varchar routing_number 
    varchar bkash_number 
    varchar bkash_account_holder_name 
    enum bkash_account_type 
    varchar nagad_number 
    varchar nagad_account_holder_name 
    enum nagad_account_type 
    timestamp created_at 
    timestamp updated_at 
  }
  rider_payout_methods }o--|| riders : "rider"
  emergency_alerts {
    uuid id PK
    uuid rider_id FK
    uuid hub_id FK
    enum type 
    text description 
    decimal latitude 
    decimal longitude 
    text location_address 
    enum status 
    uuid resolved_by_id FK
    text resolution_notes 
    timestamp resolved_at 
    timestamp created_at 
    timestamp updated_at 
  }
  emergency_alerts }o--|| riders : "rider"
  emergency_alerts }o--|| hubs : "hub"
  emergency_alerts }o--|| users : "resolvedBy"
  return_charge_configurations {
    uuid id PK
    uuid store_id FK
    enum return_status 
    enum zone 
    decimal return_delivery_charge 
    decimal return_weight_charge_per_kg 
    decimal return_cod_percentage 
    decimal discount_percentage 
    timestamp start_date 
    timestamp end_date 
    timestamp created_at 
    timestamp updated_at 
  }
  return_charge_configurations }o--|| stores : "store"
  pricing_configurations {
    uuid id PK
    uuid store_id FK
    enum zone 
    decimal delivery_charge 
    decimal weight_step_kg 
    decimal cod_percentage 
    decimal discount_percentage 
    timestamp start_date 
    timestamp end_date 
    timestamp created_at 
    timestamp updated_at 
  }
  pricing_configurations }o--|| stores : "store"
  merchant_finances {
    uuid id PK
    uuid merchant_id FK
    decimal current_balance 
    decimal pending_balance 
    decimal invoiced_balance 
    decimal processing_balance 
    decimal hold_amount 
    decimal total_earned 
    decimal total_withdrawn 
    decimal total_delivery_charges 
    decimal total_return_charges 
    decimal total_cod_collected 
    int total_parcels_delivered 
    int total_parcels_returned 
    decimal credit_limit 
    decimal credit_used 
    timestamp last_transaction_at 
    timestamp last_withdrawal_at 
    timestamp created_at 
    timestamp updated_at 
  }
  merchant_finances |o--|| users : "merchant"
  merchant_payout_methods {
    uuid id PK
    uuid merchant_id FK
    enum method_type 
    enum status 
    boolean is_default 
    varchar bank_name 
    varchar branch_name 
    varchar account_holder_name 
    varchar account_number 
    varchar routing_number 
    varchar bkash_number 
    varchar bkash_account_holder_name 
    enum bkash_account_type 
    varchar nagad_number 
    varchar nagad_account_holder_name 
    enum nagad_account_type 
    timestamp verified_at 
    uuid verified_by FK
    timestamp created_at 
    timestamp updated_at 
  }
  merchant_payout_methods }o--|| merchants : "merchant"
  merchant_payout_methods }o--|| users : "verifier"
  payout_transactions {
    uuid id PK
    uuid merchant_id FK
    uuid payout_method_id FK
    decimal amount 
    varchar reference_number 
    enum status 
    text admin_notes 
    text failure_reason 
    timestamp initiated_at 
    timestamp processed_at 
    timestamp completed_at 
    uuid initiated_by FK
    timestamp created_at 
    timestamp updated_at 
  }
  payout_transactions }o--|| merchants : "merchant"
  payout_transactions }o--|| merchant_payout_methods : "payout_method"
  payout_transactions }o--|| users : "initiator"
  merchant_finance_transactions {
    uuid id PK
    uuid merchant_id FK
    enum transaction_type 
    decimal amount 
    decimal balance_after 
    decimal balance_before 
    enum reference_type 
    uuid reference_id 
    varchar reference_code 
    text description 
    text notes 
    decimal cod_amount 
    decimal delivery_charge 
    decimal return_charge 
    uuid created_by FK
    jsonb metadata 
    timestamp created_at 
  }
  merchant_finance_transactions }o--|| merchant_finances : "merchantFinance"
  merchant_finance_transactions }o--|| users : "creator"
  merchant_invoices {
    uuid id PK
    varchar invoice_no 
    varchar transaction_id 
    uuid merchant_id FK
    uuid merchant_profile_id FK
    uuid payout_method_id FK
    int total_parcels 
    int delivered_count 
    int partial_delivery_count 
    int returned_count 
    int paid_return_count 
    decimal total_cod_amount 
    decimal total_cod_collected 
    decimal total_delivery_charges 
    decimal total_return_charges 
    decimal payable_amount 
    enum invoice_status 
    timestamp paid_at 
    uuid paid_by FK
    varchar payment_reference 
    text notes 
    timestamp created_at 
    timestamp updated_at 
  }
  merchant_invoices }o--|| merchants : "merchant"
  merchant_invoices }o--|| merchants : "merchantProfile"
  merchant_invoices }o--|| merchant_payout_methods : "payoutMethod"
  merchant_invoices }o--|| users : "paidByUser"
  hub_managers {
    uuid id PK
    uuid user_id FK
    uuid hub_id FK
    timestamp created_at 
    timestamp updated_at 
  }
  hub_managers }o--|| users : "user"
  hub_managers }o--|| hubs : "hub"
  rider_settlements {
    uuid id PK
    uuid rider_id FK
    uuid hub_id FK
    uuid hub_manager_id FK
    decimal total_collected_amount 
    decimal cash_received 
    decimal discrepancy_amount 
    decimal previous_due_amount 
    decimal new_due_amount 
    int completed_deliveries 
    int delivered_count 
    int partial_delivery_count 
    int exchange_count 
    int paid_return_count 
    int returned_count 
    enum settlement_status 
    timestamp period_start 
    timestamp period_end 
    timestamp settled_at 
    timestamp created_at 
    timestamp updated_at 
  }
  rider_settlements }o--|| riders : "rider"
  rider_settlements }o--|| hubs : "hub"
  rider_settlements }o--|| hub_managers : "hubManager"
  admin_account_statements {
    uuid id PK
    uuid account_id FK
    enum type 
    decimal credit_amount 
    decimal debit_amount 
    decimal balance_before 
    decimal balance_after 
    varchar description 
    enum reference_type 
    varchar reference_id 
    uuid created_by_id FK
    timestamp created_at 
    timestamp updated_at 
  }
  admin_account_statements }o--|| admin_accounts : "account"
  admin_account_statements }o--|| users : "createdBy"
  admin_accounts {
    uuid id PK
    varchar account_name 
    varchar account_number 
    varchar account_holder_name 
    varchar district 
    varchar branch_name 
    varchar routing 
    enum provider_type 
    decimal current_balance 
    boolean is_active 
    text notes 
    timestamp created_at 
    timestamp updated_at 
  }
  hub_transfer_records {
    uuid id PK
    uuid hub_manager_id FK
    uuid hub_id FK
    decimal transferred_amount 
    uuid admin_account_id FK
    varchar admin_account_name 
    varchar admin_account_number 
    varchar admin_account_holder_name 
    varchar transaction_reference_id 
    varchar proof_file_url 
    enum status 
    uuid reviewed_by FK
    timestamp reviewed_at 
    text admin_notes 
    text rejection_reason 
    text notes 
    timestamp transfer_date 
    timestamp created_at 
    timestamp updated_at 
  }
  hub_transfer_records }o--|| hub_managers : "hubManager"
  hub_transfer_records }o--|| hubs : "hub"
  hub_transfer_records }o--|| admin_accounts : "adminAccount"
  hub_transfer_records }o--|| users : "reviewer"
  hub_manager_finances {
    uuid id PK
    uuid hub_manager_id FK
    uuid hub_id FK
    decimal current_balance 
    decimal total_collected_from_riders 
    decimal total_transferred_to_admin 
    timestamp last_collection_at 
    timestamp last_transfer_at 
    timestamp created_at 
    timestamp updated_at 
  }
  hub_manager_finances |o--|| hub_managers : "hubManager"
  hub_manager_finances }o--|| hubs : "hub"
  hub_expenses {
    uuid id PK
    uuid hub_id FK
    uuid hub_manager_id FK
    decimal amount 
    enum category 
    text reason 
    varchar proof_file_url 
    enum status 
    uuid reviewed_by FK
    timestamp reviewed_at 
    text rejection_reason 
    timestamp created_at 
    timestamp updated_at 
  }
  hub_expenses }o--|| hubs : "hub"
  hub_expenses }o--|| hub_managers : "hubManager"
  hub_expenses }o--|| users : "reviewer"
  customer_fraud_list {
    uuid id PK
    uuid customer_id FK
    uuid merchant_id FK
    text reason 
    enum status 
    boolean is_active 
    uuid reviewed_by_admin_id FK
    timestamp reviewed_at 
    text admin_note 
    uuid removed_by_merchant_id FK
    timestamp removed_at 
    timestamp created_at 
    timestamp updated_at 
  }
  customer_fraud_list }o--|| customers : "customer"
  customer_fraud_list }o--|| merchants : "merchant"
  customer_fraud_list }o--|| users : "reviewedByAdmin"
  customer_fraud_list }o--|| merchants : "removedByMerchant"
  advance_payments {
    uuid id PK
    varchar invoice_id 
    uuid merchant_id FK
    uuid created_by_id FK
    int total_parcels 
    varchar payment_method 
    decimal total_collectable_amount 
    decimal delivery_fee 
    decimal cod_charge 
    decimal previous_weight_charge 
    decimal return_amount 
    decimal net_amount_paid 
    enum status 
    text merchant_review_note 
    text admin_note 
    boolean is_paid 
    timestamp paid_at 
    timestamp created_at 
    timestamp updated_at 
  }
  advance_payments }o--|| merchants : "merchant"
  advance_payments }o--|| users : "createdBy"
  banks {
    uuid id PK
    varchar name 
    varchar short_name 
    varchar district 
    varchar branch_name 
    varchar routing 
    boolean is_active 
    int display_order 
    timestamp created_at 
    timestamp updated_at 
  }
  admin_finances {
    uuid id PK
    uuid admin_id FK
    decimal current_system_balance 
    decimal total_revenue 
    decimal total_collected_from_hubs 
    decimal total_paid_to_merchants 
    timestamp last_collection_at 
    timestamp last_payout_at 
    timestamp created_at 
    timestamp updated_at 
  }
  admin_finances |o--|| users : "admin"
  delivery_verifications {
    uuid id PK
    uuid parcel_id FK
    uuid rider_id FK
    varchar selected_status 
    decimal expected_cod_amount 
    decimal collected_amount 
    decimal amount_difference 
    boolean has_amount_difference 
    text difference_reason 
    boolean requires_otp_verification 
    enum otp_recipient_type 
    varchar otp_sent_to_phone 
    varchar otp_code 
    timestamp otp_sent_at 
    timestamp otp_verified_at 
    int otp_attempts 
    timestamp otp_expires_at 
    enum verification_status 
    varchar otp_bypass_request_status 
    text otp_bypass_request_reason 
    timestamp otp_bypass_requested_at 
    timestamp otp_bypass_reviewed_at 
    uuid otp_bypass_reviewed_by_hub_manager_id 
    text otp_bypass_rejection_reason 
    varchar merchant_phone_used 
    varchar customer_phone_used 
    enum otp_verified_by 
    boolean merchant_approved 
    timestamp merchant_approved_at 
    timestamp delivery_attempted_at 
    timestamp delivery_completed_at 
    timestamp created_at 
    timestamp updated_at 
  }
  delivery_verifications }o--|| parcels : "parcel"
  delivery_verifications }o--|| riders : "rider"
  carrybee_locations {
    uuid id PK
    int carrybee_id 
    varchar name 
    enum type 
    int parent_id 
    int city_id 
    boolean is_active 
    timestamp created_at 
    timestamp updated_at 
  }
