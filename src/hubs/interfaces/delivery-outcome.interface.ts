/**
 * Delivery Outcome Response Interface
 * 
 * Used by Hub Managers to view parcels with delivery outcomes
 * (PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED)
 */

export interface DeliveryOutcomeItem {
  parcel_id: string;
  tracking_number: string;
  status: string;
  reason: string | null;
  
  // Destination info
  destination: {
    address: string;
    zone: string | null;
  };
  
  // Merchant info (minimal)
  merchant: {
    name: string;
    phone: string;
  };
  
  // COD breakdown
  cod: {
    total_charge: number;
    delivery_charge: number;
    cod_charge: number;
    weight_charge: number;
    cod_amount: number;
    collected_amount: number | null;
  };
  
  // Age tracking
  age: {
    display: string;        // "2 days 3h 15m"
    created_at: Date;
    updated_at: Date;
  };
}

export interface DeliveryOutcomeResponse {
  success: boolean;
  data: {
    parcels: DeliveryOutcomeItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  message: string;
}
