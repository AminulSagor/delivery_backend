import { Injectable } from '@nestjs/common';
import { Parcel } from '../../parcels/entities/parcel.entity';

export interface ParcelFinancialBreakdown {
  parcel_id: string;
  tracking_number: string;
  status: string;
  cod_amount: number;
  cod_collected: number;
  delivery_charge: number;
  return_charge: number;
  delivery_charge_applicable: boolean;
  return_charge_applicable: boolean;
  net_payable: number;
}

export interface InvoiceTotals {
  total_parcels: number;
  delivered_count: number;
  partial_delivery_count: number;
  returned_count: number;
  paid_return_count: number;
  total_cod_amount: number;
  total_cod_collected: number;
  total_delivery_charges: number;
  total_return_charges: number;
  payable_amount: number;
  parcel_breakdowns: ParcelFinancialBreakdown[];
}

@Injectable()
export class InvoiceCalculationService {
  /**
   * Calculate net payable amount for a single parcel
   * Formula: COD Collected - Applicable Charges
   */
  calculateParcelPayable(parcel: Parcel): number {
    const codCollected = Number(parcel.cod_collected_amount) || 0;

    const deliveryCharge = parcel.delivery_charge_applicable
      ? Number(parcel.total_charge) || 0
      : 0;

    const returnCharge = parcel.return_charge_applicable
      ? Number(parcel.return_charge) || 0
      : 0;

    // Net payable can be negative (merchant owes us for return charges)
    return codCollected - deliveryCharge - returnCharge;
  }

  /**
   * Calculate detailed breakdown for a single parcel
   */
  calculateParcelBreakdown(parcel: Parcel): ParcelFinancialBreakdown {
    return {
      parcel_id: parcel.id,
      tracking_number: parcel.tracking_number,
      status: parcel.status,
      cod_amount: Number(parcel.cod_amount) || 0,
      cod_collected: Number(parcel.cod_collected_amount) || 0,
      delivery_charge: Number(parcel.total_charge) || 0,
      return_charge: Number(parcel.return_charge) || 0,
      delivery_charge_applicable: parcel.delivery_charge_applicable,
      return_charge_applicable: parcel.return_charge_applicable,
      net_payable: this.calculateParcelPayable(parcel),
    };
  }

  /**
   * Calculate totals for multiple parcels (for invoice generation)
   */
  calculateInvoiceTotals(parcels: Parcel[]): InvoiceTotals {
    const parcelBreakdowns = parcels.map((p) => this.calculateParcelBreakdown(p));

    const totals = {
      total_parcels: parcels.length,
      delivered_count: 0,
      partial_delivery_count: 0,
      returned_count: 0,
      paid_return_count: 0,
      total_cod_amount: 0,
      total_cod_collected: 0,
      total_delivery_charges: 0,
      total_return_charges: 0,
      payable_amount: 0,
      parcel_breakdowns: parcelBreakdowns,
    };

    parcels.forEach((parcel) => {
      // Count by status
      if (parcel.status === 'DELIVERED') totals.delivered_count++;
      if (parcel.status === 'PARTIAL_DELIVERY') totals.partial_delivery_count++;
      if (parcel.status === 'RETURNED') totals.returned_count++;
      if (parcel.status === 'PAID_RETURN') totals.paid_return_count++;

      // Sum amounts
      totals.total_cod_amount += Number(parcel.cod_amount) || 0;
      totals.total_cod_collected += Number(parcel.cod_collected_amount) || 0;

      if (parcel.delivery_charge_applicable) {
        totals.total_delivery_charges += Number(parcel.total_charge) || 0;
      }

      if (parcel.return_charge_applicable) {
        totals.total_return_charges += Number(parcel.return_charge) || 0;
      }
    });

    // Calculate final payable amount
    totals.payable_amount =
      totals.total_cod_collected -
      totals.total_delivery_charges -
      totals.total_return_charges;

    return totals;
  }

  /**
   * Calculate clearance amount (money to recover from merchant)
   */
  calculateClearanceAmount(parcel: Parcel): number {
    // Amount already paid to merchant
    const alreadyPaid = Number(parcel.paid_amount) || 0;

    // What should have been paid (recalculate)
    const shouldPay = this.calculateParcelPayable(parcel);

    // Recovery amount = Already Paid - Should Pay
    // Positive = We need to recover money from merchant
    // Negative = We owe merchant more money
    return alreadyPaid - shouldPay;
  }
}

