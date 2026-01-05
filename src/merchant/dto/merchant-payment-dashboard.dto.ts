import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * Query DTO for payment history
 */
export class PaymentHistoryQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsDateString()
  from_date?: string;

  @IsOptional()
  @IsDateString()
  to_date?: string;

  @IsOptional()
  @IsString()
  status?: 'PAID' | 'UNPAID' | 'PROCESSING';
}

/**
 * Response interface for merchant payment dashboard
 */
export interface MerchantPaymentDashboardResponse {
  merchant: {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    email: string | null;
  };

  payment_summary: {
    total_earning: number; // All-time total earned (from PAID invoices)
    available_balance: number; // Current balance available for withdrawal
    pending_clearance: number; // Amount in UNPAID/PROCESSING invoices
    last_paid_at: Date | null; // When merchant was last paid
    last_paid_amount: number | null; // Last payment amount
  };

  balance_breakdown: {
    uninvoiced_amount: number; // Eligible parcels not yet invoiced
    invoiced_unpaid: number; // In UNPAID invoices
    invoiced_processing: number; // In PROCESSING invoices
  };

  statistics: {
    total_invoices: number;
    paid_invoices: number;
    unpaid_invoices: number;
    processing_invoices: number;
    total_parcels_delivered: number;
    total_parcels_returned: number;
  };

  recent_payments: Array<{
    invoice_id: string;
    invoice_no: string;
    amount: number;
    paid_at: Date;
    payment_reference: string | null;
  }>;
}

/**
 * Response interface for payment history
 */
export interface PaymentHistoryResponse {
  payments: Array<{
    invoice_id: string;
    invoice_no: string;
    transaction_id: string | null;
    date: Date;
    total_parcels: number;
    total_cod_collected: number;
    total_delivery_charges: number;
    total_return_charges: number;
    payable_amount: number;
    status: string;
    paid_at: Date | null;
    payment_reference: string | null;
    payment_method: {
      type: string;
      details: any;
    } | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  summary: {
    total_paid: number;
    total_pending: number;
    total_processing: number;
  };
}

