import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BikeType } from '../entities/rider.entity';
import { CreateRiderDto } from './create-rider.dto';

describe('CreateRiderDto', () => {
  const validPayload = {
    full_name: 'Test Rider',
    phone: '01700000000',
    password: 'password123',
    guardian_mobile_no: '01800000000',
    bike_type: BikeType.MOTORCYCLE,
    present_address: 'Dhaka',
    permanent_address: 'Dhaka',
    fixed_salary: 10000,
    commission_per_delivery: 20,
  };

  it('allows rider creation without NID or driving licence', async () => {
    const dto = plainToInstance(CreateRiderDto, validPayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normalizes blank NID and licence values to null', async () => {
    const dto = plainToInstance(CreateRiderDto, {
      ...validPayload,
      nid_number: '   ',
      license_no: '',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.nid_number).toBeNull();
    expect(dto.license_no).toBeNull();
  });
});
