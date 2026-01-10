/**
 * Response DTOs for merchant finance dashboard
 */

export interface MerchantFinanceOverview {
  merchant: {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    email: string;
  };

  balance: {
    current_balance: number;
    pending_balance: number;
    invoiced_balance: number;
    processing_balance: number;
    hold_amount: number;
    available_for_withdrawal: number;
  };

  lifetime_stats: {
    total_earned: number;
    total_withdrawn: number;
    total_cod_collected: number;
    total_delivery_charges: number;
    total_return_charges: number;
    total_parcels_delivered: number;
    total_parcels_returned: number;
  };

  credit: {
    credit_limit: number;
    credit_used: number;
    credit_available: number;
  };

  last_activity: {
    last_transaction_at: Date | null;
    last_withdrawal_at: Date | null;
  };
}

export interface TransactionListResponse {
  transactions: TransactionItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  summary: {
    total_credits: number;
    total_debits: number;
    net_change: number;
  };
}

export interface TransactionItem {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string;
  reference_id: string | null;
  reference_code: string | null;
  description: string | null;
  cod_amount: number | null;
  delivery_charge: number | null;
  return_charge: number | null;
  created_at: Date;
  created_by: string | null;
}

export interface AdminFinanceSummary {
  totals: {
    total_merchants: number;
    total_current_balance: number;
    total_pending_balance: number;
    total_invoiced_balance: number;
    total_processing_balance: number;
    total_hold_amount: number;
  };

  merchants: MerchantFinanceSummaryItem[];

  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface MerchantFinanceSummaryItem {
  merchant_id: string;
  user_id: string;
  name: string;
  phone: string;
  current_balance: number;
  pending_balance: number;
  invoiced_balance: number;
  total_earned: number;
  total_parcels_delivered: number;
  last_transaction_at: Date | null;
}

