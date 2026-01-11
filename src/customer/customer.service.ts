// customer.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerResponseDto } from './dto/check-customer-phone.dto';
import { Parcel, ParcelStatus } from 'src/parcels/entities/parcel.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Parcel)
    private parcelsRepository: Repository<Parcel>,
  ) {}

  // Standard create (if you call it directly)
  async create(dto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customersRepository.findOne({
      where: { phone_number: dto.phone_number },
    });

    if (existing) {
      throw new BadRequestException(
        'Customer with this phone number already exists',
      );
    }

    const customer = this.customersRepository.create({
      customer_name: dto.customer_name,
      phone_number: dto.phone_number,
      secondary_number: dto.secondary_number,
      delivery_address: dto.delivery_address,
    });

    await this.customersRepository.save(customer);

    this.logger.log(
      `Customer created: ${customer.customer_name} (${customer.phone_number})`,
    );

    return customer;
  }

  // customer.service.ts
  async checkByPhone(phone: string): Promise<{
    exists: boolean;
    customer: Customer | null;
  }> {
    const customer = await this.customersRepository.findOne({
      where: { phone_number: phone },
    });

    if (customer) {
      return {
        exists: true,
        customer,
      };
    }

    return {
      exists: false,
      customer: null,
    };
  }

  // ✅ RACE-SAFE helper used from parcel creation
  async findOrCreateFromParcelPayload(payload: {
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
  }): Promise<{ customer: Customer; isNew: boolean }> {
    // 1) Quick check – most requests will hit this path in prod
    const existing = await this.customersRepository.findOne({
      where: { phone_number: payload.customer_phone },
    });

    if (existing) {
      return { customer: existing, isNew: false };
    }

    // 2) Try to create, but be ready for unique violation if two
    //    requests race with the same phone number
    try {
      const customer = this.customersRepository.create({
        customer_name: payload.customer_name,
        phone_number: payload.customer_phone,
        delivery_address: payload.delivery_address,
      });

      await this.customersRepository.save(customer);

      this.logger.log(
        `Customer created from parcel: ${customer.customer_name} (${customer.phone_number})`,
      );

      return { customer, isNew: true };
    } catch (error: any) {
      // Postgres unique violation
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint hit for phone ${payload.customer_phone}, re-fetching existing customer`,
        );

        const existingAfterRace = await this.customersRepository.findOne({
          where: { phone_number: payload.customer_phone },
        });

        if (existingAfterRace) {
          return { customer: existingAfterRace, isNew: false };
        }
      }

      this.logger.error(
        `Failed to find or create customer for phone ${payload.customer_phone}`,
        error?.stack || String(error),
      );
      throw error;
    }
  }

  async findAll(): Promise<Customer[]> {
    return this.customersRepository.find({
      order: { customer_name: 'ASC' },
    });
  }

  async findOneByPhone(phone: string): Promise<Customer> {
    const customer = await this.customersRepository.findOne({
      where: [
        { phone_number: phone }, // Check primary number
        { secondary_number: phone }, // OR check secondary number
      ],
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with phone number ${phone} not found`,
      );
    }

    return customer;
  }

  async getCustomerByPhone(
    phone: string,
    merchantId: string,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customersRepository.findOne({
      where: { phone_number: phone },
    });

    if (!customer) {
      // Return empty/null structure if customer doesn't exist yet
      return {
        id: null,
        customer_name: '',
        phone_number: phone,
        secondary_number: '',
        delivery_address: '',
        history: {
          delivered_count: 0,
          cancelled_count: 0,
        },
      };
    }

    // 2. Define Status Groups
    // Successful statuses (Money Received)
    const successStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    // Failure statuses (Returned/Rejected)
    const cancelStatuses = [
      // ParcelStatus.RETURNED,
      // ParcelStatus.RETURNED_TO_HUB,
      // ParcelStatus.RETURN_TO_MERCHANT,
      ParcelStatus.CANCELLED,
      // ParcelStatus.FAILED_DELIVERY,
    ];

    // 3. Aggregate Stats for THIS Merchant only
    const history = await this.parcelsRepository
      .createQueryBuilder('parcel')
      .select('COUNT(parcel.id)', 'total_count')
      // Sum SUCCESS counts
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...successStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      // Sum CANCEL counts
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...cancelStatuses) THEN 1 ELSE 0 END)`,
        'cancelled_count',
      )
      .where('parcel.customer_id = :customerId', { customerId: customer.id })
      .andWhere('parcel.merchant_id = :merchantId', { merchantId }) // Filter by Merchant
      .setParameters({ successStatuses, cancelStatuses })
      .getRawOne();

    // 4. Calculate Percentage
    const deliveredCount = parseInt(history.delivered_count || '0', 10);
    const cancelledCount = parseInt(history.cancelled_count || '0', 10);

    return {
      id: customer.id,
      customer_name: customer.customer_name,
      phone_number: customer.phone_number,
      secondary_number: customer.secondary_number || '',
      delivery_address: customer.delivery_address,
      history: {
        delivered_count: deliveredCount,
        cancelled_count: cancelledCount,
      },
    };
  }

  async update(phone: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOneByPhone(phone);

    if (dto.customer_name !== undefined) {
      customer.customer_name = dto.customer_name;
    }

    if (dto.phone_number !== undefined) {
      const existing = await this.customersRepository.findOne({
        where: { phone_number: dto.phone_number },
      });

      if (existing && existing.id !== customer.id) {
        throw new BadRequestException(
          'Another customer already uses this phone number',
        );
      }

      customer.phone_number = dto.phone_number;
    }

    if (dto.secondary_number !== undefined) {
      customer.secondary_number = dto.secondary_number;
    }

    if (dto.delivery_address !== undefined) {
      customer.delivery_address = dto.delivery_address;
    }

    await this.customersRepository.save(customer);

    this.logger.log(
      `Customer updated: ${customer.id} (phone: ${customer.phone_number})`,
    );

    return customer;
  }

  async remove(phone: string): Promise<void> {
    const customer = await this.findOneByPhone(phone);

    await this.customersRepository.remove(customer);

    this.logger.log(`Customer deleted: ${customer.id} (phone: ${phone})`);
  }
}
