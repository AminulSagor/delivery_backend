import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import {
  CustomerFraud,
  CustomerFraudStatus,
} from './entities/customer-fraud.entity';
import { CreateCustomerFraudDto } from './dto/create-customer-fraud.dto';
import {
  CustomerFraudReviewAction,
  ReviewCustomerFraudDto,
} from './dto/review-customer-fraud.dto';
import { CustomerFraudCustomerListQueryDto } from './dto/customer-fraud-customer-list-query.dto';
import { CustomerFraudRequestListQueryDto } from './dto/customer-fraud-request-list-query.dto';

@Injectable()
export class CustomerFraudService {
  private readonly logger = new Logger(CustomerFraudService.name);

  private readonly successStatuses: ParcelStatus[] = [
    ParcelStatus.DELIVERED,
    ParcelStatus.PARTIAL_DELIVERY,
    ParcelStatus.EXCHANGE,
  ];

  private readonly cancelledReturnedStatuses: ParcelStatus[] = [
    ParcelStatus.CANCELLED,
    ParcelStatus.RETURNED,
    ParcelStatus.PAID_RETURN,
    ParcelStatus.RETURNED_TO_HUB,
    ParcelStatus.RETURN_TO_MERCHANT,
  ];

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(CustomerFraud)
    private readonly fraudRepo: Repository<CustomerFraud>,
  ) {}

  private calculateSuccessRate(
    deliveredCount: number,
    cancelledReturnedCount: number,
  ): number {
    const total = deliveredCount + cancelledReturnedCount;
    if (total <= 0) return 0;
    return Math.round((deliveredCount / total) * 1000) / 10;
  }

  private formatDateWithOrdinal(date: Date | null): string | null {
    if (!date) return null;

    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();

    const suffix =
      day % 10 === 1 && day !== 11
        ? 'st'
        : day % 10 === 2 && day !== 12
          ? 'nd'
          : day % 10 === 3 && day !== 13
            ? 'rd'
            : 'th';

    return `${day}${suffix} ${month}, ${year}`;
  }

  private async findCustomerByIdOrPhone(
    customerId?: string,
    phoneNumber?: string,
  ): Promise<Customer> {
    if (!customerId && !phoneNumber) {
      throw new BadRequestException(
        'Either customer_id or phone_number is required',
      );
    }

    let customer: Customer | null = null;

    if (customerId) {
      customer = await this.customerRepo.findOne({ where: { id: customerId } });
    } else if (phoneNumber) {
      const normalizedPhone = phoneNumber.trim();
      if (!normalizedPhone) {
        throw new BadRequestException('Phone number is required');
      }

      // A number may be another customer's secondary number. Always prefer an
      // exact primary-number match so the result cannot depend on database row
      // order when both records match.
      customer = await this.customerRepo.findOne({
        where: { phone_number: normalizedPhone },
      });

      if (!customer) {
        const secondaryMatches = await this.customerRepo.find({
          where: { secondary_number: normalizedPhone },
          order: { created_at: 'ASC' },
          take: 2,
        });

        if (secondaryMatches.length > 1) {
          throw new ConflictException(
            'Multiple customers use this secondary phone number. Use the primary phone number instead.',
          );
        }

        customer = secondaryMatches[0] ?? null;
      }
    }

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async getRegisteredCustomers(
    query: CustomerFraudCustomerListQueryDto,
    merchantId: string,
  ) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'customer_name',
      order = 'ASC',
    } = query;

    const baseQb = this.customerRepo
      .createQueryBuilder('customer')
      .innerJoin(
        CustomerFraud,
        'fraud',
        'fraud.customer_id = customer.id AND fraud.merchant_id = :merchantId AND fraud.status = :approvedStatus AND fraud.is_active = true',
        {
          merchantId,
          approvedStatus: CustomerFraudStatus.APPROVED,
        },
      );

    if (search) {
      baseQb.andWhere(
        '(customer.customer_name ILIKE :search OR customer.phone_number ILIKE :search OR customer.secondary_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const totalResult = await baseQb
      .clone()
      .select('COUNT(DISTINCT customer.id)', 'count')
      .getRawOne();
    const total = Number(totalResult?.count || 0);

    const qb = this.customerRepo
      .createQueryBuilder('customer')
      .innerJoin(
        CustomerFraud,
        'fraud',
        'fraud.customer_id = customer.id AND fraud.merchant_id = :merchantId AND fraud.status = :approvedStatus AND fraud.is_active = true',
        {
          merchantId,
          approvedStatus: CustomerFraudStatus.APPROVED,
        },
      )
      .leftJoin(
        Parcel,
        'parcel',
        'parcel.customer_id = customer.id AND parcel.merchant_id = :merchantId',
      )
      .select('customer.id', 'id')
      .addSelect('customer.customer_name', 'customer_name')
      .addSelect('customer.phone_number', 'phone_number')
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...successStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...cancelledReturnedStatuses) THEN 1 ELSE 0 END)`,
        'cancelled_returned_count',
      )
      .addSelect('MAX(parcel.created_at)', 'last_order_at')
      .setParameters({
        successStatuses: this.successStatuses,
        cancelledReturnedStatuses: this.cancelledReturnedStatuses,
      })
      .groupBy('customer.id')
      .addGroupBy('customer.customer_name')
      .addGroupBy('customer.phone_number');

    if (search) {
      qb.andWhere(
        '(customer.customer_name ILIKE :search OR customer.phone_number ILIKE :search OR customer.secondary_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (sortBy === 'total_orders') {
      qb.orderBy(
        `SUM(CASE WHEN parcel.status IN (:...successStatuses) THEN 1 ELSE 0 END) + SUM(CASE WHEN parcel.status IN (:...cancelledReturnedStatuses) THEN 1 ELSE 0 END)`,
        order,
      );
    } else if (sortBy === 'last_order_at') {
      qb.orderBy('MAX(parcel.created_at)', order);
    } else if (sortBy === 'phone_number') {
      qb.orderBy('customer.phone_number', order);
    } else {
      qb.orderBy('customer.customer_name', order);
    }

    qb.setParameter('merchantId', merchantId)
      .skip((page - 1) * limit)
      .take(limit);

    const rows = await qb.getRawMany();

    const customerIds = rows.map((row) => row.id);

    const fraudSummary =
      customerIds.length === 0
        ? []
        : await this.fraudRepo
            .createQueryBuilder('fraud')
            .select('fraud.customer_id', 'customer_id')
            .addSelect(
              `SUM(CASE WHEN fraud.status = :approvedStatus AND fraud.is_active = true THEN 1 ELSE 0 END)`,
              'approved_count',
            )
            .addSelect(
              `SUM(CASE WHEN fraud.status = :pendingStatus AND fraud.is_active = true THEN 1 ELSE 0 END)`,
              'pending_count',
            )
            .where('fraud.customer_id IN (:...customerIds)', { customerIds })
            .setParameters({
              approvedStatus: CustomerFraudStatus.APPROVED,
              pendingStatus: CustomerFraudStatus.PENDING,
            })
            .groupBy('fraud.customer_id')
            .getRawMany();

    const fraudMap = new Map(
      fraudSummary.map((item) => [item.customer_id, item]),
    );

    const items = rows.map((row) => {
      const deliveredCount = Number(row.delivered_count || 0);
      const cancelledReturnedCount = Number(row.cancelled_returned_count || 0);
      const totalOrders = deliveredCount + cancelledReturnedCount;
      const successRate = this.calculateSuccessRate(
        deliveredCount,
        cancelledReturnedCount,
      );
      const isNewCustomer = totalOrders === 0;

      const fraud = fraudMap.get(row.id);
      const approvedCount = Number(fraud?.approved_count || 0);
      const pendingCount = Number(fraud?.pending_count || 0);

      return {
        customer_id: row.id,
        customer_name: row.customer_name,
        phone_number: row.phone_number,
        total_orders: totalOrders,
        is_new_customer: isNewCustomer,
        customer_tag: isNewCustomer ? 'NEW_CUSTOMER' : 'EXISTING_CUSTOMER',
        customer_rating: `${successRate}%`,
        success_rate: successRate,
        delivered_count: deliveredCount,
        cancelled_returned_count: cancelledReturnedCount,
        fraud_status: {
          in_fraud_list: approvedCount > 0,
          approved_reports_count: approvedCount,
          pending_reports_count: pendingCount,
        },
      };
    });

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

  async getCustomerFraudDetailsById(customerId: string) {
    const customer = await this.findCustomerByIdOrPhone(customerId);
    return this.buildCustomerFraudDetails(customer);
  }

  async getCustomerFraudDetailsByPhone(phoneNumber: string) {
    const customer = await this.findCustomerByIdOrPhone(undefined, phoneNumber);
    return this.buildCustomerFraudDetails(customer);
  }

  private async buildCustomerFraudDetails(customer: Customer) {
    const history = await this.parcelRepo
      .createQueryBuilder('parcel')
      .select(
        `SUM(CASE WHEN parcel.status IN (:...successStatuses) THEN 1 ELSE 0 END)`,
        'delivered_count',
      )
      .addSelect(
        `SUM(CASE WHEN parcel.status IN (:...cancelledReturnedStatuses) THEN 1 ELSE 0 END)`,
        'cancelled_returned_count',
      )
      .addSelect('MAX(parcel.created_at)', 'last_order_at')
      .where('parcel.customer_id = :customerId', { customerId: customer.id })
      .setParameters({
        successStatuses: this.successStatuses,
        cancelledReturnedStatuses: this.cancelledReturnedStatuses,
      })
      .getRawOne();

    const deliveredCount = Number(history?.delivered_count || 0);
    const cancelledReturnedCount = Number(
      history?.cancelled_returned_count || 0,
    );
    const totalOrders = deliveredCount + cancelledReturnedCount;
    const successRate = this.calculateSuccessRate(
      deliveredCount,
      cancelledReturnedCount,
    );
    const isNewCustomer = totalOrders === 0;

    const fraudReports = await this.fraudRepo.find({
      where: { customer_id: customer.id },
      relations: [
        'merchant',
        'merchant.user',
        'reviewedByAdmin',
        'removedByMerchant',
        'removedByMerchant.user',
      ],
      order: { created_at: 'DESC' },
    });

    const approvedReportsCount = fraudReports.filter(
      (report) =>
        report.status === CustomerFraudStatus.APPROVED && report.is_active,
    ).length;

    const pendingReportsCount = fraudReports.filter(
      (report) =>
        report.status === CustomerFraudStatus.PENDING && report.is_active,
    ).length;

    return {
      customer: {
        id: customer.id,
        name: customer.customer_name,
        address: customer.customer_address,
        phone: customer.phone_number,
        is_new_customer: isNewCustomer,
        customer_tag: isNewCustomer ? 'NEW_CUSTOMER' : 'EXISTING_CUSTOMER',
        last_order_placed_on: this.formatDateWithOrdinal(
          history?.last_order_at ? new Date(history.last_order_at) : null,
        ),
      },
      order_history_breakdown: {
        delivered: deliveredCount,
        cancelled_returned: cancelledReturnedCount,
        total_orders: totalOrders,
        successfully_delivered: deliveredCount,
        success_rate: `${successRate}%`,
        overall_success_rate: `${successRate}%`,
        overall_success_rate_formula: `(${deliveredCount} Delivered / ${Math.max(totalOrders, 1)} Orders)`,
      },
      fraud_list: {
        is_in_fraud_list: approvedReportsCount > 0,
        approved_reports_count: approvedReportsCount,
        pending_reports_count: pendingReportsCount,
        reports: fraudReports.map((report) => ({
          id: report.id,
          status: report.status,
          reason: report.reason,
          created_at: report.created_at,
          updated_at: report.updated_at,
          is_active: report.is_active,
          added_by: {
            merchant_id: report.merchant_id,
            merchant_name: report.merchant?.user?.full_name || null,
            merchant_phone: report.merchant?.user?.phone || null,
          },
          admin_review: {
            reviewed_by_admin_id: report.reviewed_by_admin_id,
            reviewed_by_admin_name: report.reviewedByAdmin?.full_name || null,
            reviewed_at: report.reviewed_at,
            admin_note: report.admin_note,
          },
        })),
      },
    };
  }

  async createFraudRequest(
    dto: CreateCustomerFraudDto,
    merchantId: string,
  ): Promise<CustomerFraud> {
    const customer = await this.findCustomerByIdOrPhone(
      dto.customer_id,
      dto.phone_number,
    );

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Reason is required');
    }

    const existing = await this.fraudRepo.findOne({
      where: {
        customer_id: customer.id,
        merchant_id: merchantId,
        status: In([CustomerFraudStatus.PENDING, CustomerFraudStatus.APPROVED]),
        is_active: true,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have an active fraud request for this customer',
      );
    }

    const fraudRequest = this.fraudRepo.create({
      customer_id: customer.id,
      merchant_id: merchantId,
      reason,
      status: CustomerFraudStatus.PENDING,
      is_active: true,
    });

    const saved = await this.fraudRepo.save(fraudRequest);

    this.logger.log(
      `Fraud request created. Customer: ${customer.id}, Merchant: ${merchantId}, Request: ${saved.id}`,
    );

    return saved;
  }

  async removeCustomerFromFraudList(
    customerId: string,
    merchantId: string,
  ): Promise<CustomerFraud> {
    await this.findCustomerByIdOrPhone(customerId);

    const request = await this.fraudRepo.findOne({
      where: {
        customer_id: customerId,
        merchant_id: merchantId,
        status: In([CustomerFraudStatus.PENDING, CustomerFraudStatus.APPROVED]),
        is_active: true,
      },
      order: { created_at: 'DESC' },
    });

    if (!request) {
      throw new NotFoundException(
        'No active fraud list entry found for this customer by your account',
      );
    }

    request.status = CustomerFraudStatus.REMOVED;
    request.is_active = false;
    request.removed_at = new Date();
    request.removed_by_merchant_id = merchantId;

    const saved = await this.fraudRepo.save(request);

    this.logger.log(
      `Fraud request removed. Customer: ${customerId}, Merchant: ${merchantId}, Request: ${saved.id}`,
    );

    return saved;
  }

  async removeCustomerFromFraudListByPhone(
    phoneNumber: string,
    merchantId: string,
  ): Promise<CustomerFraud> {
    const customer = await this.findCustomerByIdOrPhone(undefined, phoneNumber);
    return this.removeCustomerFromFraudList(customer.id, merchantId);
  }

  async listFraudRequestsForAdmin(query: CustomerFraudRequestListQueryDto) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;

    const qb = this.fraudRepo
      .createQueryBuilder('fraud')
      .leftJoinAndSelect('fraud.customer', 'customer')
      .leftJoinAndSelect('fraud.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('fraud.reviewedByAdmin', 'reviewedByAdmin');

    if (status) {
      qb.andWhere('fraud.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(customer.customer_name ILIKE :search OR customer.phone_number ILIKE :search OR merchantUser.full_name ILIKE :search OR merchantUser.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const sortFieldMap: Record<string, string> = {
      created_at: 'fraud.created_at',
      updated_at: 'fraud.updated_at',
      status: 'fraud.status',
      customer_name: 'customer.customer_name',
    };

    const sortField = sortFieldMap[sortBy] || 'fraud.created_at';

    qb.orderBy(sortField, order)
      .skip((page - 1) * limit)
      .take(limit);

    const items = await qb.getMany();

    return {
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        reason: item.reason,
        is_active: item.is_active,
        created_at: item.created_at,
        reviewed_at: item.reviewed_at,
        admin_note: item.admin_note,
        customer: {
          id: item.customer?.id || null,
          name: item.customer?.customer_name || null,
          phone: item.customer?.phone_number || null,
        },
        added_by_merchant: {
          id: item.merchant_id,
          name: item.merchant?.user?.full_name || null,
          phone: item.merchant?.user?.phone || null,
        },
        reviewed_by_admin: {
          id: item.reviewed_by_admin_id,
          name: item.reviewedByAdmin?.full_name || null,
        },
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async reviewFraudRequest(
    requestId: string,
    dto: ReviewCustomerFraudDto,
    adminUserId: string,
  ): Promise<CustomerFraud> {
    const request = await this.fraudRepo.findOne({ where: { id: requestId } });

    if (!request) {
      throw new NotFoundException('Fraud request not found');
    }

    if (request.status !== CustomerFraudStatus.PENDING || !request.is_active) {
      throw new BadRequestException(
        'Only active pending fraud requests can be reviewed',
      );
    }

    if (dto.action === CustomerFraudReviewAction.REJECT && !dto.admin_note) {
      throw new BadRequestException('admin_note is required when rejecting');
    }

    request.status =
      dto.action === CustomerFraudReviewAction.APPROVE
        ? CustomerFraudStatus.APPROVED
        : CustomerFraudStatus.REJECTED;

    request.is_active = dto.action === CustomerFraudReviewAction.APPROVE;
    request.reviewed_by_admin_id = adminUserId;
    request.reviewed_at = new Date();
    request.admin_note = dto.admin_note?.trim() || null;

    const saved = await this.fraudRepo.save(request);

    this.logger.log(
      `Fraud request reviewed. Request: ${requestId}, Action: ${dto.action}, Admin: ${adminUserId}`,
    );

    return saved;
  }
}
