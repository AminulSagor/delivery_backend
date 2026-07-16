import { AuthService } from './auth.service';
import { UserRole } from '../common/enums/user-role.enum';

describe('AuthService.getProfile', () => {
  it('returns is_advance_payment_active for merchant users', async () => {
    const usersService = {
      findById: jest.fn(),
    } as any;

    const merchantRepository = {
      findOne: jest.fn(),
    } as any;

    const storeRepository = {
      count: jest.fn(),
    } as any;

    const service = new AuthService(
      usersService,
      merchantRepository,
      storeRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    usersService.findById.mockResolvedValue({
      id: 'user-1',
      full_name: 'Merchant User',
      phone: '01700000000',
      email: 'merchant@example.com',
      role: UserRole.MERCHANT,
      is_active: true,
      created_at: new Date('2024-01-01T00:00:00.000Z'),
    });

    merchantRepository.findOne.mockResolvedValue({
      id: 'merchant-1',
      thana: 'Dhaka',
      district: 'Dhaka',
      full_address: 'Test address',
      secondary_number: null,
      status: 'APPROVED',
      approved_at: null,
      merchant_profile: null,
      is_advance_payment_disabled: false,
    });

    storeRepository.count.mockResolvedValue(2);

    const profile = await service.getProfile('user-1');

    expect(profile.is_advance_payment_active).toBe(true);
  });
});
