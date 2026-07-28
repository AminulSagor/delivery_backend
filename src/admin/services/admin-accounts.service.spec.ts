import { AdminAccountsService } from './admin-accounts.service';

jest.mock('src/common/enums/account-type.enum', () => ({
  AccountReferenceType: {
    OPENING_BALANCE: 'OPENING_BALANCE',
    EXPENSE: 'EXPENSE',
  },
  AccountTransactionType: {
    CREDIT: 'CREDIT',
    DEBIT: 'DEBIT',
  },
  AccountProviderType: {
    BANK: 'BANK',
  },
}));

describe('AdminAccountsService.normalizeAnalyticsRange', () => {
  it('defaults to a lifetime range when no dates are provided', () => {
    const service = new AdminAccountsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const now = new Date();
    const range = (service as any).normalizeAnalyticsRange(
      undefined,
      undefined,
    );

    expect(range.start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(range.end.getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(range.start.getFullYear()).toBeLessThan(now.getFullYear() + 1);
  });
});
