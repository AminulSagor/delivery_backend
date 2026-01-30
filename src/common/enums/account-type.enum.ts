export enum BkashAccountType {
  PERSONAL = 'PERSONAL',
  MERCHANT = 'MERCHANT',
  AGENT = 'AGENT',
}

export enum NagadAccountType {
  PERSONAL = 'PERSONAL',
  MERCHANT = 'MERCHANT',
}

export enum AccountProviderType {
  BANK = 'BANK',
  BKASH = 'BKASH', // Bkash, Nagad, Rocket
  NAGAD = 'NAGAD',
  CASH = 'CASH', // Office Petty Cash
}

export enum AccountTransactionType {
  CREDIT = 'CREDIT', // Money In (Deposit)
  DEBIT = 'DEBIT', // Money Out (Withdrawal/Expense)
}

export enum AccountReferenceType {
  OPENING_BALANCE = 'OPENING_BALANCE',
  MANUAL_DEPOSIT = 'MANUAL_DEPOSIT',
  MANUAL_WITHDRAWAL = 'MANUAL_WITHDRAWAL',
  INTERNAL_TRANSFER = 'INTERNAL_TRANSFER',
  MERCHANT_PAYOUT = 'MERCHANT_PAYOUT',
  HUB_COLLECTION = 'HUB_COLLECTION',
  EXPENSE = 'EXPENSE',
}
