/**
 * Response interfaces and mappers for API endpoints.
 * Returns full non-sensitive business data for store/rider/parcel payloads.
 */

import { StoreStatus } from 'src/stores/entities/store.entity';
import { ParcelStatus } from 'src/parcels/entities/parcel.entity';

// ===== PARCEL RESPONSES =====

export interface ParcelListItem {
  id: string;
  parcel_tx_id: string | null; // Display ID like #139679
  tracking_number: string;
  merchant_order_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_secondary_phone: string | null;
  customer_address: string;
  product_description: string | null;
  product_weight: number;
  total_charge: number;
  cod_amount: number;
  is_cod: boolean;
  status: string;
  delivery_type: number;
  created_at: Date;
  // Minimal store info
  store?: {
    id: string;
    business_name: string;
  };
  // Delivery area info
  delivery_area?: {
    id: string;
    area: string;
    zone: string;
    city: string;
    division: string;
  } | null;
  // Minimal rider info (if assigned)
  assigned_rider?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
}

export interface ParcelDetail extends ParcelListItem {
  product_price: number;
  delivery_charge: number;
  weight_charge: number;
  cod_charge: number;
  payment_status: string;
  special_instructions: string | null;
  assigned_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  // Hub info
  current_hub?: {
    id: string;
    branch_name: string;
  } | null;
}

export interface ParcelActionResponse {
  id: string;
  parcel_tx_id: string | null; // Display ID like #139679
  tracking_number: string;
  status: string;
}

// ===== RIDER RESPONSES =====

export interface RiderListItem {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  photo: string | null;
  bike_type: string;
  is_active: boolean;
  rider_status: string;
  // Total number of parcels currently assigned to this rider
  assigned_parcels_count: number;

  // Driving license number (if available)
  license_no: string | null;

  hub?: {
    id: string;
    branch_name: string;
  } | null;
}

export interface RiderDetail extends RiderListItem {
  guardian_mobile_no: string;
  nid_number: string;
  license_no: string | null;
  present_address: string;
  permanent_address: string;
  fixed_salary: number;
  /**
   * Commission per delivered parcel (flat rate in BDT)
   * This is NOT a percentage - it's a fixed amount per delivery
   * e.g., 20 means rider gets 20 BDT for each delivered parcel
   */
  commission_per_delivery: number;
  created_at: Date;
}

export interface RiderActionResponse {
  id: string;
  full_name: string;
  is_active: boolean;
  rider_status: string;
}

// ===== STAFF RESPONSES =====

export interface StaffListItem {
  id: string;
  staff_code: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  photo: string | null;
  position: string;
  bike_type: string;
  is_active: boolean;
  hub?: {
    id: string;
    branch_name: string;
  } | null;
}

export interface StaffDetail extends StaffListItem {
  secondary_phone: string | null;
  guardian_mobile_no: string;
  nid_number: string;
  license_no: string | null;
  present_address: string;
  permanent_address: string;
  fixed_salary: number;
  created_at: Date;
}

export interface StaffActionResponse {
  id: string;
  full_name: string;
  is_active: boolean;
}

// ===== PICKUP REQUEST RESPONSES =====

export interface PickupRequestListItem {
  id: string;
  request_code: string | null; // Unique code: REQ-2001
  pickup_count: number; // Main field: number of parcels to pick up
  status: string;
  comment: string | null;
  created_at: Date;
  store?: {
    id: string;
    business_name: string;
    phone_number: string;
    business_address: string;
  };
  assigned_rider?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
}

export interface PickupRequestActionResponse {
  id: string;
  request_code: string | null;
  status: string;
  pickup_count: number;
  assigned_rider_id: string | null;
}

export interface PickupRequestDetail extends PickupRequestListItem {
  merchant_id: string;
  store_id: string;
  hub_id: string;
  assigned_rider_id: string | null;
  completed_by_rider_id: string | null;
  actual_parcels: number;
  picked_up_count: number;
  requested_at: Date;
  confirmed_at: Date | null;
  picked_up_at: Date | null;
  cancelled_at: Date | null;
  updated_at: Date;
  merchant?: any;
  hub?: any;
  assigned_rider_full?: any;
  completed_by_rider?: any;
  parcels?: Array<{
    id: string;
    parcel_tx_id: string | null;
    tracking_number: string;
    status: string;
    total_charge: number;
    cod_amount: number;
    is_cod: boolean;
    created_at: Date;
    updated_at: Date;
  }>;
}

// ===== STORE RESPONSES =====

export interface StoreListItem {
  id: string;
  store_code: string | null; // Auto-generated unique code
  business_name: string;
  business_address: string;
  phone_number: string;
  email: string | null;
  facebook_page: string | null;
  is_default: boolean;
  is_carrybee_synced: boolean;
  performance?: {
    total_parcels_handled: number;
    successfully_delivered: number;
    total_returns: number;
  };
  hub?: {
    id: string;
    branch_name: string;
  } | null;
}

export interface StoreDetail extends StoreListItem {
  district: string;
  thana: string;
  area: string | null;
  facebook_page: string | null;
  carrybee_store_id: string | null;
  created_at: Date;
  status: StoreStatus;
}

// ===== MERCHANT RESPONSES =====

export interface MerchantListItem {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  thana: string;
  district: string;
  status: string;
  created_at: Date;
}

export interface MerchantDetail extends MerchantListItem {
  full_address: string | null;
  secondary_number: string | null;
  approved_at: Date | null;
  is_advance_payment_disabled: boolean;
}

// ===== HUB RESPONSES =====

export interface HubListItem {
  id: string;
  hub_code: string;
  branch_name: string;
  area: string;
  address: string;
  manager_name: string;
  manager_phone: string;
}

export interface HubDetail extends HubListItem {
  manager_email: string | null;
  created_at: Date;
  updated_at: Date;
}

// ===== HELPER FUNCTIONS =====

function toSafeUser(user: any) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    full_name: user.full_name ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    role: user.role ?? null,
    is_active: user.is_active ?? null,
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
  };
}

function toCoverageAreaSummary(coverageArea: any) {
  if (!coverageArea) {
    return null;
  }

  return {
    id: coverageArea.id,
    division: coverageArea.division,
    city: coverageArea.city,
    city_id: coverageArea.city_id,
    zone: coverageArea.zone,
    zone_id: coverageArea.zone_id,
    area: coverageArea.area,
    area_id: coverageArea.area_id,
    inside_dhaka_flag: coverageArea.inside_dhaka_flag,
    created_at: coverageArea.created_at ?? null,
    updated_at: coverageArea.updated_at ?? null,
  };
}

function toHubSummary(hub: any) {
  if (!hub) {
    return null;
  }

  return {
    id: hub.id,
    hub_code: hub.hub_code ?? null,
    branch_name: hub.branch_name ?? null,
    area: hub.area ?? null,
    address: hub.address ?? null,
    manager_name: hub.manager_name ?? null,
    manager_phone: hub.manager_phone ?? null,
    manager_user_id: hub.manager_user_id ?? null,
    status: hub.status ?? null,
    is_active: hub.is_active ?? null,
    created_at: hub.created_at ?? null,
    updated_at: hub.updated_at ?? null,
  };
}

function toMerchantSummary(merchant: any) {
  if (!merchant) {
    return null;
  }

  return {
    id: merchant.id,
    user_id: merchant.user_id ?? null,
    thana: merchant.thana ?? null,
    district: merchant.district ?? null,
    full_address: merchant.full_address ?? null,
    secondary_number: merchant.secondary_number ?? null,
    status: merchant.status ?? null,
    is_advance_payment_disabled: !!merchant.is_advance_payment_disabled,
    approved_at: merchant.approved_at ?? null,
    approved_by: merchant.approved_by ?? null,
    created_at: merchant.created_at ?? null,
    updated_at: merchant.updated_at ?? null,
    user: toSafeUser(merchant.user),
  };
}

function toCustomerSummary(customer: any) {
  if (!customer) {
    return null;
  }

  return {
    id: customer.id,
    customer_name: customer.customer_name ?? null,
    phone_number: customer.phone_number ?? null,
    secondary_number: customer.secondary_number ?? null,
    customer_address: customer.customer_address ?? null,
    delivery_coverage_area_id: customer.delivery_coverage_area_id ?? null,
    created_at: customer.created_at ?? null,
    updated_at: customer.updated_at ?? null,
  };
}

function toThirdPartyProviderSummary(provider: any) {
  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    provider_code: provider.provider_code,
    provider_name: provider.provider_name,
    description: provider.description ?? null,
    is_active: provider.is_active,
    // human readable status
    status: provider.is_active ? 'active' : 'inactive',
    // include unique code as `unique_id` for convenience
    unique_id: provider.provider_code ?? null,
    // include aggregated delivered count if present
    delivered_count: provider.delivered_count ?? 0,
    // include inferred provider type if present
    type: provider.type ?? null,
    created_at: provider.created_at ?? null,
    updated_at: provider.updated_at ?? null,
  };
}

function toFullStoreSummary(store: any, includeMerchant = true) {
  if (!store) {
    return null;
  }

  return {
    id: store.id,
    store_code: store.store_code ?? null,
    merchant_id: store.merchant_id ?? null,
    business_name: store.business_name,
    business_address: store.business_address,
    phone_number: store.phone_number,
    email: store.email ?? null,
    facebook_page: store.facebook_page ?? null,
    hub_id: store.hub_id ?? null,
    is_default: !!store.is_default,
    status: store.status ?? null,
    district: store.district ?? null,
    thana: store.thana ?? null,
    area: store.area ?? null,
    carrybee_store_id: store.carrybee_store_id ?? null,
    carrybee_city_id: store.carrybee_city_id ?? null,
    carrybee_zone_id: store.carrybee_zone_id ?? null,
    carrybee_area_id: store.carrybee_area_id ?? null,
    is_carrybee_synced: !!store.is_carrybee_synced,
    carrybee_synced_at: store.carrybee_synced_at ?? null,
    auto_assign_to_carrybee: !!store.auto_assign_to_carrybee,
    created_at: store.created_at ?? null,
    updated_at: store.updated_at ?? null,
    performance: store.performance || {
      total_parcels_handled: 0,
      successfully_delivered: 0,
      total_returns: 0,
    },
    hub: toHubSummary(store.hub),
    merchant: includeMerchant ? toMerchantSummary(store.merchant) : undefined,
  };
}

function toFullRiderSummary(rider: any) {
  if (!rider) {
    return null;
  }

  const assignedCount = Number(
    rider.assigned_parcels_count ??
      (Array.isArray(rider.assignedParcels) ? rider.assignedParcels.length : 0),
  );

  const riderStatus = !rider.is_active
    ? 'Leave'
    : assignedCount > 0
      ? 'On duty'
      : 'Break';

  return {
    id: rider.id,
    rider_code: rider.rider_code ?? null,
    user_id: rider.user_id ?? null,
    hub_id: rider.hub_id ?? null,
    photo: rider.photo ?? null,
    guardian_mobile_no: rider.guardian_mobile_no ?? null,
    bike_type: rider.bike_type ?? null,
    nid_number: rider.nid_number ?? null,
    license_no: rider.license_no ?? null,
    present_address: rider.present_address ?? null,
    permanent_address: rider.permanent_address ?? null,
    fixed_salary: rider.fixed_salary ?? null,
    commission_per_delivery: rider.commission_per_delivery ?? null,
    bank_name: rider.bank_name ?? null,
    bank_account_number: rider.bank_account_number ?? null,
    bank_branch: rider.bank_branch ?? null,
    nid_front_photo: rider.nid_front_photo ?? null,
    nid_back_photo: rider.nid_back_photo ?? null,
    license_front_photo: rider.license_front_photo ?? null,
    license_back_photo: rider.license_back_photo ?? null,
    parent_nid_front_photo: rider.parent_nid_front_photo ?? null,
    parent_nid_back_photo: rider.parent_nid_back_photo ?? null,
    approval_status: rider.approval_status ?? null,
    approved_at: rider.approved_at ?? null,
    approved_by: rider.approved_by ?? null,
    is_active: !!rider.is_active,
    created_at: rider.created_at ?? null,
    updated_at: rider.updated_at ?? null,
    // Top-level convenience fields
    full_name: rider.user?.full_name || rider.full_name || null,
    phone: rider.user?.phone || rider.phone || null,
    user: toSafeUser(rider.user),
    hub: toHubSummary(rider.hub),
    approver: toSafeUser(rider.approver),
    rider_status: riderStatus,
    assigned_parcels_count: assignedCount,
  };
}

// Helper to calculate parcel age in days
function calculateParcelAge(parcel: any): number | null {
  const now = new Date();
  const receivedSource =
    parcel.received_at ?? parcel.received_at_destination_hub ?? null;
  const received = receivedSource ? new Date(receivedSource) : null;
  const created = parcel.created_at ? new Date(parcel.created_at) : null;
  const baseDate = received || created;
  if (!baseDate) return null;
  const diffMs = now.getTime() - baseDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function toParcelListItem(parcel: any): any {
  const deliveryCharge = Number(parcel.delivery_charge ?? 0);
  const weightCharge = Number(parcel.weight_charge ?? 0);
  const codCharge = Number(parcel.cod_charge ?? 0);
  const totalCharge = Number(parcel.total_charge ?? 0);
  const computedDiscount = Math.max(
    0,
    Math.round(
      (deliveryCharge + weightCharge + codCharge - totalCharge) * 100,
    ) / 100,
  );

  // Add received_at and age fields
  const received_at =
    parcel.received_at ?? parcel.received_at_destination_hub ?? null;
  const age = calculateParcelAge(parcel);

  // Prepare assigned rider summary and ensure that when this rider
  // is embedded inside a parcel response and the parcel has an
  // assigned_rider_id, we mark the rider as 'On duty'.
  const assignedRiderSummary = toFullRiderSummary(parcel.assignedRider);
  if (assignedRiderSummary && parcel.assigned_rider_id) {
    assignedRiderSummary.rider_status = 'On duty';
  }

  return {
    id: parcel.id,
    customer_id: parcel.customer_id ?? null,
    merchant_id: parcel.merchant_id ?? null,
    store_id: parcel.store_id ?? null,
    pickup_request_id: parcel.pickup_request_id ?? null,
    parcel_tx_id: parcel.parcel_tx_id || null,
    tracking_number: parcel.tracking_number,
    merchant_order_id: parcel.merchant_order_id ?? null,
    delivery_area_text: parcel.delivery_area ?? null,
    delivery_coverage_area_id: parcel.delivery_coverage_area_id ?? null,
    customer_name: parcel.customer_name,
    customer_phone: parcel.customer_phone,
    customer_secondary_phone: parcel.customer_secondary_phone || null,
    customer_address: parcel.customer_address,
    product_description: parcel.product_description ?? null,
    product_price: parcel.product_price ?? null,
    product_weight: parcel.product_weight ?? null,
    parcel_type: parcel.parcel_type ?? null,
    delivery_charge: parcel.delivery_charge ?? 0,
    weight_charge: parcel.weight_charge ?? 0,
    cod_charge: parcel.cod_charge ?? 0,
    discount: computedDiscount,
    total_charge: parcel.total_charge ?? 0,
    is_cod: !!parcel.is_cod,
    cod_amount: parcel.cod_amount ?? 0,
    is_exchange: !!parcel.is_exchange,
    receivable_amount: parcel.receivable_amount ?? 0,
    cod_collected_amount: parcel.cod_collected_amount ?? 0,
    return_charge: parcel.return_charge ?? 0,
    delivery_charge_applicable: !!parcel.delivery_charge_applicable,
    return_charge_applicable: !!parcel.return_charge_applicable,
    financial_status: parcel.financial_status ?? null,
    invoice_id: parcel.invoice_id ?? null,
    clearance_required: !!parcel.clearance_required,
    clearance_done: !!parcel.clearance_done,
    clearance_invoice_id: parcel.clearance_invoice_id ?? null,
    paid_amount: parcel.paid_amount ?? null,
    status: parcel.status,
    payment_status: parcel.payment_status ?? null,
    paid_to_merchant: !!parcel.paid_to_merchant,
    paid_to_merchant_at: parcel.paid_to_merchant_at ?? null,
    cod_cleared_at: parcel.cod_cleared_at ?? null,
    delivery_type: parcel.delivery_type ?? null,
    assigned_rider_id: parcel.assigned_rider_id ?? null,
    assigned_at: parcel.assigned_at ?? null,
    rider_accepted_at: parcel.rider_accepted_at ?? null,
    out_for_delivery_at: parcel.out_for_delivery_at ?? null,
    reschedule_count: parcel.reschedule_count ?? 0,
    special_instructions: parcel.special_instructions ?? null,
    admin_notes: parcel.admin_notes ?? null,
    return_reason: parcel.return_reason ?? null,
    current_hub_id: parcel.current_hub_id ?? null,
    origin_hub_id: parcel.origin_hub_id ?? null,
    destination_hub_id: parcel.destination_hub_id ?? null,
    is_inter_hub_transfer: !!parcel.is_inter_hub_transfer,
    transferred_at: parcel.transferred_at ?? null,
    received_at_destination_hub: parcel.received_at_destination_hub ?? null,
    transfer_notes: parcel.transfer_notes ?? null,
    delivery_provider: parcel.delivery_provider ?? null,
    third_party_provider_id: parcel.third_party_provider_id ?? null,
    issue_type: parcel.issue_type ?? null,
    issue_description: parcel.issue_description ?? null,
    issue_reported_by_id: parcel.issue_reported_by_id ?? null,
    issue_reported_at: parcel.issue_reported_at ?? null,
    is_issue_resolved: !!parcel.is_issue_resolved,
    carrybee_consignment_id: parcel.carrybee_consignment_id ?? null,
    carrybee_delivery_fee: parcel.carrybee_delivery_fee ?? null,
    carrybee_cod_fee: parcel.carrybee_cod_fee ?? null,
    assigned_to_carrybee_at: parcel.assigned_to_carrybee_at ?? null,
    recipient_carrybee_city_id: parcel.recipient_carrybee_city_id ?? null,
    recipient_carrybee_zone_id: parcel.recipient_carrybee_zone_id ?? null,
    recipient_carrybee_area_id: parcel.recipient_carrybee_area_id ?? null,
    original_parcel_id: parcel.original_parcel_id ?? null,
    is_return_parcel: !!parcel.is_return_parcel,
    picked_up_at: parcel.picked_up_at ?? null,
    delivered_at: parcel.delivered_at ?? null,
    created_at: parcel.created_at ?? null,
    updated_at: parcel.updated_at ?? null,
    received_at,
    age,

    merchant: toMerchantSummary(parcel.merchant),
    store: toFullStoreSummary(parcel.store),
    customer: toCustomerSummary(parcel.customer),

    delivery_area: toCoverageAreaSummary(parcel.delivery_coverage_area),
    delivery_coverage_area: toCoverageAreaSummary(
      parcel.delivery_coverage_area,
    ),

    assigned_rider: assignedRiderSummary,
    current_hub: toHubSummary(parcel.currentHub),
    origin_hub: toHubSummary(parcel.originHub),
    destination_hub: toHubSummary(parcel.destinationHub),
    third_party_provider: toThirdPartyProviderSummary(
      parcel.thirdPartyProvider,
    ),
  };
}

export function toParcelDetail(parcel: any): any {
  const base = toParcelListItem(parcel);

  const pickedEvidence = !!(
    parcel.picked_up_at ||
    parcel.currentHub ||
    parcel.received_at ||
    parcel.received_at_destination_hub ||
    parcel.assigned_at ||
    parcel.out_for_delivery_at ||
    parcel.delivered_at ||
    parcel.status === ParcelStatus.IN_HUB ||
    parcel.status === ParcelStatus.IN_TRANSIT
  );

  const milestones = [
    { key: 'picked', label: 'Picked', is_completed: pickedEvidence },
    {
      key: 'sorted',
      label: 'Sorted',
      is_completed:
        parcel.status === ParcelStatus.IN_HUB ||
        parcel.status === ParcelStatus.IN_TRANSIT ||
        pickedEvidence,
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      is_completed: parcel.status === ParcelStatus.IN_TRANSIT,
    },
    {
      key: 'received_at_lmh',
      label: 'Received At LMH',
      is_completed: !!(
        parcel.received_at || parcel.received_at_destination_hub
      ),
    },
    {
      key: 'assigned_for_delivery',
      label: 'Assigned For Delivery',
      is_completed: !!parcel.assigned_at,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      is_completed: !!parcel.delivered_at,
    },
  ];

  // Enforce sequential milestone completion: if a later milestone is completed,
  // ensure all earlier milestones are also marked completed. This keeps the
  // presentation model consistent for all clients.
  try {
    const completedFlags = milestones.map((m) => !!m.is_completed);
    const lastCompleted = completedFlags.lastIndexOf(true);
    if (lastCompleted > -1) {
      for (let i = 0; i <= lastCompleted; i++) {
        milestones[i].is_completed = true;
      }
    }
  } catch (err) {
    // Defensive: if anything unexpected happens, leave milestones as-is.
  }

  // Human-friendly status labels used in activity messages
  const STATUS_LABELS: Record<string, string> = {
    ASSIGNED_TO_THIRD_PARTY: 'Assigned to Third Party',
    PICKED_UP: 'Picked Up',
    IN_TRANSIT: 'In Transit',
    IN_HUB: 'In Hub',
    OUT_FOR_DELIVERY: 'Out For Delivery',
    DELIVERED: 'Delivered',
    RETURNED: 'Returned',
    FAILED_DELIVERY: 'Failed Delivery',
  };

  const acts: any[] = [];
  if (parcel.created_at)
    acts.push({
      message: 'Order has been created',
      timestamp: parcel.created_at,
      location: null,
    });
  if (parcel.product_weight_changed_at)
    acts.push({
      message: 'Weight Changed',
      timestamp: parcel.product_weight_changed_at,
      location: null,
    });
  if (parcel.picked_up_at)
    acts.push({
      message: 'Order has been picked',
      timestamp: parcel.picked_up_at,
      location: null,
    });
  if (parcel.currentHub && parcel.currentHub.branch_name) {
    acts.push({
      message: `Order is being processed and sorted at ${parcel.currentHub.branch_name}`,
      timestamp: parcel.updated_at ?? parcel.picked_up_at ?? parcel.created_at,
      location: parcel.currentHub.branch_name,
    });
  }
  if (parcel.assigned_at && parcel.assignedRider) {
    const rName =
      parcel.assignedRider.user?.full_name ||
      parcel.assignedRider.full_name ||
      'Rider';
    const rPhone =
      parcel.assignedRider.user?.phone || parcel.assignedRider.phone || null;
    const statusLabel = STATUS_LABELS[parcel.status] ?? parcel.status ?? 'Assigned';
    acts.push({
      message: `Parcel assigned for delivery to ${rName}${rPhone ? ` (${rPhone})` : ''} (${statusLabel})`,
      timestamp: parcel.assigned_at,
      location: null,
    });
  }
  if (parcel.admin_notes) {
    acts.push({
      message: `Rider note: ${parcel.admin_notes}`,
      timestamp:
        parcel.updated_at ?? parcel.out_for_delivery_at ?? parcel.assigned_at ?? parcel.created_at,
      location: null,
    });
  }
  if (parcel.out_for_delivery_at && parcel.assignedRider) {
    const rName =
      parcel.assignedRider.user?.full_name ||
      parcel.assignedRider.full_name ||
      'Rider';
    const statusLabel = STATUS_LABELS[parcel.status] ?? parcel.status ?? 'Out For Delivery';
    acts.push({
      message: `${rName} is on the way to the recipient address (${statusLabel})`,
      timestamp: parcel.out_for_delivery_at,
      location: null,
    });
  }
  if (parcel.delivered_at) {
    const statusLabel = STATUS_LABELS[parcel.status] ?? parcel.status ?? 'Delivered';
    acts.push({
      message: `Parcel delivered (${statusLabel})`,
      timestamp: parcel.delivered_at,
      location: null,
    });
  }

  acts.sort(
    (a: any, b: any) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  acts.forEach((a: any, idx: number) => (a.id = idx + 1));
  const activities = acts.reverse();

  return {
    ...base,
    tracking: {
      parcel_id: base.parcel_tx_id || base.tracking_number || base.id,
      current_status: parcel.status,
      delivery_milestones: milestones,
      activities,
    },
  };
}

export function toParcelActionResponse(parcel: any): any {
  return toParcelDetail(parcel);
}

export function toRiderListItem(rider: any): any {
  return toFullRiderSummary(rider);
}

export function toRiderDetail(rider: any): any {
  return toFullRiderSummary(rider);
}

export function toRiderActionResponse(rider: any): any {
  return toFullRiderSummary(rider);
}

export function toPickupRequestListItem(pickup: any): PickupRequestListItem {
  return {
    id: pickup.id,
    request_code: pickup.request_code || null, // Unique code: REQ-2001
    pickup_count: pickup.estimated_parcels || 0, // pickup_count = estimated_parcels
    status: pickup.status,
    comment: pickup.comment,
    created_at: pickup.created_at,
    store: pickup.store
      ? {
          id: pickup.store.id,
          business_name: pickup.store.business_name,
          phone_number: pickup.store.phone_number,
          business_address: pickup.store.business_address,
        }
      : undefined,
    assigned_rider: pickup.assignedRider
      ? {
          id: pickup.assignedRider.id,
          full_name:
            pickup.assignedRider.user?.full_name ||
            pickup.assignedRider.full_name,
          phone: pickup.assignedRider.user?.phone || pickup.assignedRider.phone,
        }
      : null,
  };
}

export function toPickupRequestDetail(pickup: any): PickupRequestDetail {
  return {
    ...toPickupRequestListItem(pickup),
    merchant_id: pickup.merchant_id,
    store_id: pickup.store_id,
    hub_id: pickup.hub_id,
    assigned_rider_id: pickup.assigned_rider_id ?? null,
    completed_by_rider_id: pickup.completed_by_rider_id ?? null,
    actual_parcels: pickup.actual_parcels ?? 0,
    picked_up_count: pickup.picked_up_count ?? 0,
    requested_at: pickup.requested_at,
    confirmed_at: pickup.confirmed_at ?? null,
    picked_up_at: pickup.picked_up_at ?? null,
    cancelled_at: pickup.cancelled_at ?? null,
    updated_at: pickup.updated_at,
    merchant: toMerchantSummary(pickup.merchant),
    hub: toHubSummary(pickup.hub),
    assigned_rider_full: toFullRiderSummary(pickup.assignedRider),
    completed_by_rider: toFullRiderSummary(pickup.completedByRider),
    parcels: Array.isArray(pickup.parcels)
      ? pickup.parcels.map((parcel: any) => ({
          id: parcel.id,
          parcel_tx_id: parcel.parcel_tx_id ?? null,
          tracking_number: parcel.tracking_number,
          status: parcel.status,
          total_charge: parcel.total_charge ?? 0,
          cod_amount: parcel.cod_amount ?? 0,
          is_cod: !!parcel.is_cod,
          created_at: parcel.created_at,
          updated_at: parcel.updated_at,
        }))
      : [],
  };
}

export function toPickupRequestActionResponse(
  pickup: any,
): PickupRequestActionResponse {
  return {
    id: pickup.id,
    request_code: pickup.request_code || null,
    status: pickup.status,
    pickup_count: pickup.estimated_parcels || 0,
    assigned_rider_id: pickup.assigned_rider_id,
  };
}

export function toStoreListItem(store: any): any {
  return toFullStoreSummary(store);
}

export function toStoreDetail(store: any): any {
  return toFullStoreSummary(store);
}

export function toHubListItem(hub: any): HubListItem {
  return {
    id: hub.id,
    hub_code: hub.hub_code,
    branch_name: hub.branch_name,
    area: hub.area,
    address: hub.address,
    manager_name: hub.manager_name,
    manager_phone: hub.manager_phone,
  };
}

export function toHubDetail(hub: any): HubDetail {
  return {
    ...toHubListItem(hub),
    manager_email: hub.manager_email,
    created_at: hub.created_at,
    updated_at: hub.updated_at,
  };
}

export function toMerchantListItem(merchant: any): MerchantListItem {
  return {
    id: merchant.id,
    full_name: merchant.user?.full_name || '',
    phone: merchant.user?.phone || '',
    email: merchant.user?.email || null,
    thana: merchant.thana,
    district: merchant.district,
    status: merchant.status,
    created_at: merchant.created_at,
  };
}

export function toMerchantDetail(merchant: any): MerchantDetail {
  return {
    ...toMerchantListItem(merchant),
    full_address: merchant.full_address,
    secondary_number: merchant.secondary_number,
    approved_at: merchant.approved_at,
    is_advance_payment_disabled: !!merchant.is_advance_payment_disabled,
  };
}

/**
 * Comprehensive merchant detail for Admin GET /merchants/:id
 * Includes: personal info, documents, payout methods, all stores with performance, parcel stats
 */
export function toMerchantDetailFull(data: any): any {
  const merchant = data.merchant;
  const profile = merchant?.merchant_profile || null;

  return {
    // === Basic Info ===
    id: merchant.id,
    user_id: merchant.user_id,
    full_name: merchant.user?.full_name || '',
    phone: merchant.user?.phone || '',
    email: merchant.user?.email || null,
    thana: merchant.thana,
    district: merchant.district,
    full_address: merchant.full_address || null,
    secondary_number: merchant.secondary_number || null,
    status: merchant.status,
    is_active: merchant.user?.is_active ?? null,
    is_advance_payment_disabled: !!merchant.is_advance_payment_disabled,
    approved_at: merchant.approved_at || null,
    created_at: merchant.created_at,
    updated_at: merchant.updated_at,

    // === Documents ===
    documents: {
      nid: {
        number: profile?.nid_number || null,
        front_url: profile?.nid_front_url || null,
        back_url: profile?.nid_back_url || null,
        verified: profile?.nid_verified || false,
      },
      trade_license: {
        number: profile?.trade_license_number || null,
        url: profile?.trade_license_url || null,
        verified: profile?.trade_license_verified || false,
      },
      tin: {
        number: profile?.tin_number || null,
        url: profile?.tin_certificate_url || null,
        verified: profile?.tin_verified || false,
      },
      bin: {
        number: profile?.bin_number || null,
        url: profile?.bin_certificate_url || null,
        verified: profile?.bin_verified || false,
      },
    },

    // === Payout Methods ===
    payout_methods: (data.payout_methods || []).map((pm: any) => ({
      id: pm.id,
      method_type: pm.method_type,
      status: pm.status,
      is_default: !!pm.is_default,
      bank_name: pm.bank_name || null,
      branch_name: pm.branch_name || null,
      account_holder_name: pm.account_holder_name || null,
      account_number: pm.account_number || null,
      routing_number: pm.routing_number || null,
      bkash_number: pm.bkash_number || null,
      bkash_account_holder_name: pm.bkash_account_holder_name || null,
      bkash_account_type: pm.bkash_account_type || null,
      nagad_number: pm.nagad_number || null,
      nagad_account_holder_name: pm.nagad_account_holder_name || null,
      nagad_account_type: pm.nagad_account_type || null,
      verified_at: pm.verified_at || null,
      created_at: pm.created_at,
    })),

    // === Stores ===
    store_count: data.stores?.length || 0,
    stores: (data.stores || []).map((store: any) =>
      toFullStoreSummary(store, false),
    ),

    // === Aggregated Parcel Stats ===
    parcel_stats: data.parcel_stats || {
      total_parcels: 0,
      total_delivered: 0,
      total_returns: 0,
    },
  };
}

export function toStaffListItem(staff: any): StaffListItem {
  return {
    id: staff.id,
    staff_code: staff.staff_code || null,
    full_name: staff.user?.full_name || staff.full_name,
    phone: staff.user?.phone || staff.phone,
    email: staff.user?.email || staff.email || null,
    photo: staff.photo,
    position: staff.position,
    bike_type: staff.bike_type,
    is_active: staff.is_active,
    hub: staff.hub
      ? {
          id: staff.hub.id,
          branch_name: staff.hub.branch_name,
        }
      : null,
  };
}

export function toStaffDetail(staff: any): StaffDetail {
  return {
    ...toStaffListItem(staff),
    secondary_phone: staff.secondary_phone || null,
    guardian_mobile_no: staff.guardian_mobile_no,
    nid_number: staff.nid_number,
    license_no: staff.license_no,
    present_address: staff.present_address,
    permanent_address: staff.permanent_address,
    fixed_salary: staff.fixed_salary,
    created_at: staff.created_at,
  };
}

export function toStaffActionResponse(staff: any): StaffActionResponse {
  return {
    id: staff.id,
    full_name: staff.user?.full_name || staff.full_name,
    is_active: staff.is_active,
  };
}
