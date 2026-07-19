import { MerchantFinanceService } from './merchant-finance.service';

describe('MerchantFinanceService.getAvailableBalance', () => {
  it('subtracts held funds and returns a money-rounded non-negative value', async () => {
    const service = Object.create(
      MerchantFinanceService.prototype,
    ) as MerchantFinanceService;
    service.getOrCreateFinance = jest.fn().mockResolvedValue({
      current_balance: '1000.556',
      hold_amount: '125.111',
    });

    await expect(service.getAvailableBalance('merchant-user-1')).resolves.toBe(
      875.45,
    );
  });

  it('returns zero when held funds exceed the current balance', async () => {
    const service = Object.create(
      MerchantFinanceService.prototype,
    ) as MerchantFinanceService;
    service.getOrCreateFinance = jest.fn().mockResolvedValue({
      current_balance: 50,
      hold_amount: 75,
    });

    await expect(service.getAvailableBalance('merchant-user-1')).resolves.toBe(
      0,
    );
  });
});
