export enum SettlementStatus {
  PENDING = 'PENDING', // Settlement recorded but rider still owes money
  COMPLETED = 'COMPLETED', // Full settlement, no due amount
  PARTIAL = 'PARTIAL', // Partial payment received
}

