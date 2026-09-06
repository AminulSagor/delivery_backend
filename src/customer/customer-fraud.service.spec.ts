import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerFraudService } from './customer-fraud.service';
import { Customer } from './entities/customer.entity';

describe('CustomerFraudService phone lookup', () => {
  function createService(primaryMatch: Customer | null, secondary: Customer[]) {
    const customerRepo = {
      findOne: jest.fn().mockResolvedValue(primaryMatch),
      find: jest.fn().mockResolvedValue(secondary),
    };
    const service = new CustomerFraudService(
      customerRepo as any,
      {} as any,
      {} as any,
    );

    return { service, customerRepo };
  }

  const customer = (id: string, phone: string, secondary?: string) =>
    ({
      id,
      phone_number: phone,
      secondary_number: secondary ?? null,
    }) as Customer;

  it('prefers an exact primary phone match over another secondary match', async () => {
    const primaryCustomer = customer('primary-id', '01760652024');
    const { service, customerRepo } = createService(primaryCustomer, [
      customer('other-id', '01800000000', '01760652024'),
    ]);

    const result = await (service as any).findCustomerByIdOrPhone(
      undefined,
      '01760652024',
    );

    expect(result).toBe(primaryCustomer);
    expect(customerRepo.findOne).toHaveBeenCalledWith({
      where: { phone_number: '01760652024' },
    });
    expect(customerRepo.find).not.toHaveBeenCalled();
  });

  it('falls back to one exact secondary phone match', async () => {
    const secondaryCustomer = customer(
      'secondary-id',
      '01800000000',
      '01760652024',
    );
    const { service, customerRepo } = createService(null, [secondaryCustomer]);

    const result = await (service as any).findCustomerByIdOrPhone(
      undefined,
      ' 01760652024 ',
    );

    expect(result).toBe(secondaryCustomer);
    expect(customerRepo.find).toHaveBeenCalledWith({
      where: { secondary_number: '01760652024' },
      order: { created_at: 'ASC' },
      take: 2,
    });
  });

  it('rejects an ambiguous secondary phone instead of returning a random customer', async () => {
    const { service } = createService(null, [
      customer('first-id', '01800000000', '01760652024'),
      customer('second-id', '01900000000', '01760652024'),
    ]);

    await expect(
      (service as any).findCustomerByIdOrPhone(undefined, '01760652024'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when neither phone field matches', async () => {
    const { service } = createService(null, []);

    await expect(
      (service as any).findCustomerByIdOrPhone(undefined, '01760652024'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
