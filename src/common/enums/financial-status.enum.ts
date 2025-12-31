export enum FinancialStatus {
  PENDING = 'PENDING', // Not yet invoiced
  INVOICED = 'INVOICED', // Included in an invoice
  PAID = 'PAID', // Merchant has been paid
  CLEARANCE_PENDING = 'CLEARANCE_PENDING', // Needs money recovery
  CLEARANCE_INVOICED = 'CLEARANCE_INVOICED', // In clearance invoice
  SETTLED = 'SETTLED', // Fully settled (after clearance)
}

