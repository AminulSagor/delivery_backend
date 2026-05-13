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
import {
  CustomerResponseDto,
  DeliveryAddressDto,
} from './dto/check-customer-phone.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { CustomerFraud, CustomerFraudStatus } from './entities/customer-fraud.entity';
import { Parcel, ParcelStatus } from 'src/parcels/entities/parcel.entity';
import { CoverageArea } from 'src/coverage-areas/entities/coverage-area.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customersRepository: Repository<Customer>,
    @InjectRepository(Parcel)
    private parcelsRepository: Repository<Parcel>,
    @InjectRepository(CoverageArea)
    private coverageAreaRepository: Repository<CoverageArea>,
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

    // Validate coverage area if provided
    if (dto.delivery_coverage_area_id) {
      const coverageArea = await this.coverageAreaRepository.findOne({
        where: { id: dto.delivery_coverage_area_id },
      });
      if (!coverageArea) {
        throw new BadRequestException('Invalid delivery coverage area');
      }
    }

    // Check if secondary_number is already in use (if provided)
    if (dto.secondary_number) {
      const existingSecondary = await this.customersRepository.findOne({
        where: { secondary_number: dto.secondary_number },
      });
      if (existingSecondary) {
        throw new BadRequestException(
          'Secondary phone number is already in use by another customer',
        );
      }
    }

    try {
      const customer = this.customersRepository.create({
        customer_name: dto.customer_name,
        phone_number: dto.phone_number,
        secondary_number: dto.secondary_number || null,
        customer_address: dto.customer_address,
        delivery_coverage_area_id: dto.delivery_coverage_area_id || null,
      });

      await this.customersRepository.save(customer);

      this.logger.log(
        `Customer created: ${customer.customer_name} (${customer.phone_number})`,
      );

      return customer;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error?.code === '23505') {
        if (error.detail?.includes('phone_number')) {
          throw new BadRequestException(
            'Customer with this phone number already exists',
          );
        }
        if (error.detail?.includes('secondary_number')) {
          throw new BadRequestException(
            'Secondary phone number is already in use',
          );
        }
        throw new BadRequestException('Duplicate value detected');
      }
      throw error;
    }
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
    customer_address: string;
    customer_secondary_phone?: string;
    delivery_coverage_area_id?: string;
  }): Promise<{ customer: Customer; isNew: boolean }> {
    // 1) Quick check – most requests will hit this path in prod
    const existing = await this.customersRepository.findOne({
      where: { phone_number: payload.customer_phone },
    });

    if (existing) {
      // Update customer with new delivery info if provided
      let updated = false;

      if (
        payload.delivery_coverage_area_id &&
        existing.delivery_coverage_area_id !== payload.delivery_coverage_area_id
      ) {
        existing.delivery_coverage_area_id = payload.delivery_coverage_area_id;
        updated = true;
      }

      if (
        payload.customer_secondary_phone &&
        existing.secondary_number !== payload.customer_secondary_phone
      ) {
        existing.secondary_number = payload.customer_secondary_phone;
        updated = true;
      }

      // Update address if different
      if (
        payload.customer_address &&
        existing.customer_address !== payload.customer_address
      ) {
        existing.customer_address = payload.customer_address;
        updated = true;
      }

      // Update name if different
      if (
        payload.customer_name &&
        existing.customer_name !== payload.customer_name
      ) {
        existing.customer_name = payload.customer_name;
        updated = true;
      }

      if (updated) {
        await this.customersRepository.save(existing);
        this.logger.log(
          `Customer updated from parcel: ${existing.customer_name} (${existing.phone_number})`,
        );
      }

      return { customer: existing, isNew: false };
    }

    // 2) Try to create, but be ready for unique violation if two
    //    requests race with the same phone number
    try {
      const customer = this.customersRepository.create({
        customer_name: payload.customer_name,
        phone_number: payload.customer_phone,
        customer_address: payload.customer_address,
        secondary_number: payload.customer_secondary_phone || null,
        delivery_coverage_area_id: payload.delivery_coverage_area_id || null,
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

  async findAll(
    merchantId: string,
    query: PaginationDto,
  ): Promise<PaginatedResponse<Customer>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const qb = this.customersRepository
      .createQueryBuilder('customer')
      .innerJoin(
        Parcel,
        'parcel',
        'parcel.customer_id = customer.id AND parcel.merchant_id = :merchantId',
        { merchantId },
      )
      .leftJoin(
        CustomerFraud,
        'fraud',
        'fraud.customer_id = customer.id AND fraud.merchant_id = :merchantId AND fraud.status IN (:...fraudStatuses) AND fraud.is_active = true',
        {
          merchantId,
          fraudStatuses: [
            CustomerFraudStatus.APPROVED,
            CustomerFraudStatus.PENDING,
          ],
        },
      )
      .andWhere('fraud.id IS NULL')
      .distinct(true);

    if (search) {
      qb.andWhere(
        '(customer.customer_name ILIKE :search OR customer.phone_number ILIKE :search OR customer.secondary_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const items =
      total === 0
        ? []
        : await qb
            .orderBy('customer.customer_name', 'ASC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
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
      relations: ['deliveryCoverageArea'],
    });

    if (!customer) {
      // Return empty/null structure if customer doesn't exist yet
      return {
        id: null,
        customer_name: '',
        phone_number: phone,
        secondary_number: '',
        delivery_address: null,
        customer_address: '',
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
    const cancelStatuses = [ParcelStatus.CANCELLED];

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

    // 5. Get delivery address from customer's coverage area
    let deliveryAddress: DeliveryAddressDto | null = null;
    const customerAddress = customer.customer_address || '';

    // First, check if customer has delivery_coverage_area_id
    if (customer.deliveryCoverageArea) {
      const coverageArea = customer.deliveryCoverageArea;
      deliveryAddress = {
        city: coverageArea.city,
        city_id: coverageArea.city_id,
        zone: coverageArea.zone,
        zone_id: coverageArea.zone_id,
        area: coverageArea.area,
        area_id: coverageArea.area_id,
        coverage_area_id: coverageArea.id,
      };
    } else {
      // Fall back to latest parcel's coverage area
      const latestParcel = await this.parcelsRepository.findOne({
        where: {
          customer_id: customer.id,
          merchant_id: merchantId,
        },
        relations: ['delivery_coverage_area'],
        order: { created_at: 'DESC' },
      });

      if (latestParcel?.delivery_coverage_area) {
        const coverageArea = latestParcel.delivery_coverage_area;
        deliveryAddress = {
          city: coverageArea.city,
          city_id: coverageArea.city_id,
          zone: coverageArea.zone,
          zone_id: coverageArea.zone_id,
          area: coverageArea.area,
          area_id: coverageArea.area_id,
          coverage_area_id: coverageArea.id,
        };
      }
    }

    return {
      id: customer.id,
      customer_name: customer.customer_name,
      phone_number: customer.phone_number,
      secondary_number: customer.secondary_number || '',
      delivery_address: deliveryAddress,
      customer_address: customerAddress,
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

    if (dto.customer_address !== undefined) {
      customer.customer_address = dto.customer_address;
    }

    // Update delivery coverage area
    if (dto.delivery_coverage_area_id !== undefined) {
      if (dto.delivery_coverage_area_id) {
        const coverageArea = await this.coverageAreaRepository.findOne({
          where: { id: dto.delivery_coverage_area_id },
        });
        if (!coverageArea) {
          throw new BadRequestException('Invalid delivery coverage area');
        }
      }
      customer.delivery_coverage_area_id =
        dto.delivery_coverage_area_id || null;
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
