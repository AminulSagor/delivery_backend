/**
 * Clean response interfaces for API endpoints
 * Only includes fields that frontend actually needs
 */

import { StoreStatus } from 'src/stores/entities/store.entity';

// ===== PARCEL RESPONSES =====

export interface ParcelListItem {
  id: string;
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
}

// ===== PICKUP REQUEST RESPONSES =====

export interface PickupRequestListItem {
  id: string;
  request_code: string | null; // Unique code: REQ-2001
  pickup_count: number;        // Main field: number of parcels to pick up
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

export function toParcelListItem(parcel: any): ParcelListItem {
  return {
    id: parcel.id,
    tracking_number: parcel.tracking_number,
    merchant_order_id: parcel.merchant_order_id,
    customer_name: parcel.customer_name,
    customer_phone: parcel.customer_phone,
    customer_secondary_phone: parcel.customer_secondary_phone || null,
    customer_address: parcel.customer_address,
    product_description: parcel.product_description,
    product_weight: parcel.product_weight,
    total_charge: parcel.total_charge,
    cod_amount: parcel.cod_amount,
    is_cod: parcel.is_cod,
    status: parcel.status,
    delivery_type: parcel.delivery_type,
    created_at: parcel.created_at,
    store: parcel.store
      ? {
          id: parcel.store.id,
          business_name: parcel.store.business_name,
        }
      : undefined,
    delivery_area: parcel.delivery_coverage_area
      ? {
          id: parcel.delivery_coverage_area.id,
          area: parcel.delivery_coverage_area.area,
          zone: parcel.delivery_coverage_area.zone,
          city: parcel.delivery_coverage_area.city,
          division: parcel.delivery_coverage_area.division,
        }
      : null,
    assigned_rider: parcel.assignedRider
      ? {
          id: parcel.assignedRider.id,
          full_name:
            parcel.assignedRider.user?.full_name ||
            parcel.assignedRider.full_name,
          phone: parcel.assignedRider.user?.phone || parcel.assignedRider.phone,
        }
      : null,
  };
}

export function toParcelDetail(parcel: any): ParcelDetail {
  return {
    ...toParcelListItem(parcel),
    product_price: parcel.product_price,
    delivery_charge: parcel.delivery_charge,
    weight_charge: parcel.weight_charge,
    cod_charge: parcel.cod_charge,
    payment_status: parcel.payment_status,
    special_instructions: parcel.special_instructions,
    assigned_at: parcel.assigned_at,
    picked_up_at: parcel.picked_up_at,
    delivered_at: parcel.delivered_at,
    current_hub: parcel.currentHub
      ? {
          id: parcel.currentHub.id,
          branch_name: parcel.currentHub.branch_name,
        }
      : null,
  };
}

export function toParcelActionResponse(parcel: any): ParcelActionResponse {
  return {
    id: parcel.id,
    tracking_number: parcel.tracking_number,
    status: parcel.status,
  };
}

export function toRiderListItem(rider: any): RiderListItem {
  return {
    id: rider.id,
    full_name: rider.user?.full_name || rider.full_name,
    phone: rider.user?.phone || rider.phone,
    email: rider.user?.email || rider.email || null,
    photo: rider.photo,
    bike_type: rider.bike_type,
    is_active: rider.is_active,
    hub: rider.hub
      ? {
          id: rider.hub.id,
          branch_name: rider.hub.branch_name,
        }
      : null,
  };
}

export function toRiderDetail(rider: any): RiderDetail {
  return {
    ...toRiderListItem(rider),
    guardian_mobile_no: rider.guardian_mobile_no,
    nid_number: rider.nid_number,
    license_no: rider.license_no,
    present_address: rider.present_address,
    permanent_address: rider.permanent_address,
    fixed_salary: rider.fixed_salary,
    commission_per_delivery: rider.commission_per_delivery,
    created_at: rider.created_at,
  };
}

export function toRiderActionResponse(rider: any): RiderActionResponse {
  return {
    id: rider.id,
    full_name: rider.user?.full_name || rider.full_name,
    is_active: rider.is_active,
  };
}

export function toPickupRequestListItem(pickup: any): PickupRequestListItem {
  return {
    id: pickup.id,
    request_code: pickup.request_code || null,  // Unique code: REQ-2001
    pickup_count: pickup.estimated_parcels || 0,  // pickup_count = estimated_parcels
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

export function toStoreListItem(store: any): StoreListItem {
  return {
    id: store.id,
    store_code: store.store_code || null,
    business_name: store.business_name,
    business_address: store.business_address,
    phone_number: store.phone_number,
    email: store.email,
    facebook_page: store.facebook_page || null,
    is_default: store.is_default,
    is_carrybee_synced: store.is_carrybee_synced || false,
    performance: store.performance || {
      total_parcels_handled: 0,
      successfully_delivered: 0,
      total_returns: 0,
    },
    hub: store.hub
      ? {
          id: store.hub.id,
          branch_name: store.hub.branch_name,
        }
      : null,
  };
}

export function toStoreDetail(store: any): StoreDetail {
  return {
    ...toStoreListItem(store),
    district: store.district || null,
    thana: store.thana || null,
    area: store.area || null,
    facebook_page: store.facebook_page || null,
    carrybee_store_id: store.carrybee_store_id || null,
    created_at: store.created_at,
    status: store.status,
  };
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
  };
}
