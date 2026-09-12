import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PaginationMeta } from '../../common/dto/pagination.dto';
import {
  ParcelAssignmentFilter,
  ParcelQueryDto,
} from '../dto/parcel-query.dto';
import { Parcel, ParcelStatus } from '../entities/parcel.entity';
import {
  RiderParcelSummaryQueryDto,
  RiderParcelSummaryType,
} from '../../riders/dto/rider-parcel-summary-query.dto';

export const COMPLETED_PARCEL_STATUSES: ParcelStatus[] = [
  ParcelStatus.DELIVERED,
  ParcelStatus.PARTIAL_DELIVERY,
  ParcelStatus.EXCHANGE,
  ParcelStatus.PAID_RETURN,
  ParcelStatus.RETURNED,
  ParcelStatus.RETURN_TO_MERCHANT,
];

const ACTIVE_PARCEL_STATUSES: ParcelStatus[] = [
  ParcelStatus.PENDING,
  ParcelStatus.PICKED_UP,
  ParcelStatus.IN_HUB,
  ParcelStatus.ASSIGNED_TO_RIDER,
  ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
  ParcelStatus.OUT_FOR_PICKUP,
  ParcelStatus.OUT_FOR_DELIVERY,
  ParcelStatus.IN_TRANSIT,
  ParcelStatus.FAILED_DELIVERY,
  ParcelStatus.DELIVERY_RESCHEDULED,
];

export interface ParcelQueryResult {
  items: Parcel[];
  pagination: PaginationMeta;
  summary: {
    total: number;
    by_status: Record<string, number>;
    cod_amount: number;
    total_charge: number;
  };
}

export interface RiderParcelSummaryResult {
  type: RiderParcelSummaryType;
  total: number;
  cod_amount: number;
  parcels: Parcel[];
  pagination: PaginationMeta;
}

@Injectable()
export class ParcelQueryService {
  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
  ) {}

  async queryHubParcels(
    hubId: string,
    options: ParcelQueryDto,
  ): Promise<ParcelQueryResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const query = this.createBaseQuery().where(
      `(
        parcel.current_hub_id = :hubId OR
        (parcel.current_hub_id IS NULL AND store.hub_id = :hubId)
      )`,
      { hubId },
    );

    this.applyStatusAndAssignmentFilters(query, options);
    this.applyCommonFilters(query, options);
    this.applyDateFilter(query, options);

    const summaryQuery = query.clone();
    const total = await query.getCount();
    const summaryRows: Array<{
      status: ParcelStatus;
      count: string;
      cod_amount: string;
      total_charge: string;
    }> = await summaryQuery
      .select('parcel.status', 'status')
      .addSelect('COUNT(parcel.id)', 'count')
      .addSelect('COALESCE(SUM(parcel.cod_amount), 0)', 'cod_amount')
      .addSelect('COALESCE(SUM(parcel.total_charge), 0)', 'total_charge')
      .groupBy('parcel.status')
      .getRawMany();

    this.applySorting(query, options.sortBy, options.order);
    query.skip((page - 1) * limit).take(limit);
    const items = await query.getMany();

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      summary: {
        total,
        by_status: Object.fromEntries(
          summaryRows.map((row) => [row.status, Number(row.count) || 0]),
        ),
        cod_amount: summaryRows.reduce(
          (sum, row) => sum + (Number(row.cod_amount) || 0),
          0,
        ),
        total_charge: summaryRows.reduce(
          (sum, row) => sum + (Number(row.total_charge) || 0),
          0,
        ),
      },
    };
  }

  async queryRiderParcelSummary(
    riderId: string,
    options: RiderParcelSummaryQueryDto,
  ): Promise<RiderParcelSummaryResult> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const query = this.createBaseQuery();
    const dateField =
      options.type === RiderParcelSummaryType.DELIVERED
        ? 'COALESCE(parcel.rider_action_at, parcel.delivered_at, parcel.updated_at)'
        : 'parcel.assigned_at';

    if (options.type === RiderParcelSummaryType.DELIVERED) {
      query.where(
        `(
          (parcel.rider_action_rider_id = :riderId AND parcel.rider_action_status = :delivered) OR
          (parcel.rider_action_rider_id IS NULL AND parcel.assigned_rider_id = :riderId AND parcel.status = :delivered)
        )`,
        {
          riderId,
          delivered: ParcelStatus.DELIVERED,
        },
      );
    } else {
      query
        .where('parcel.assigned_rider_id = :riderId', { riderId })
        .andWhere('parcel.is_return_parcel = :isReturnParcel', {
          isReturnParcel: true,
        })
        .andWhere('parcel.assigned_at IS NOT NULL');
    }

    if (
      (options.startDate && !options.endDate) ||
      (!options.startDate && options.endDate)
    ) {
      throw new BadRequestException(
        'startDate and endDate must be provided together',
      );
    }
    if (options.startDate && options.endDate) {
      const start = this.parseDhakaDate(options.startDate, false);
      const end = this.parseDhakaDate(options.endDate, true);
      if (start > end) {
        throw new BadRequestException(
          'startDate must be less than or equal to endDate',
        );
      }
      query.andWhere(`${dateField} BETWEEN :summaryStart AND :summaryEnd`, {
        summaryStart: start,
        summaryEnd: end,
      });
    }

    if (options.search?.trim()) {
      const summarySearch = `%${options.search.trim()}%`;
      query.andWhere(
        `(
          CAST(parcel.id AS TEXT) ILIKE :summarySearch OR
          parcel.parcel_tx_id ILIKE :summarySearch OR
          parcel.tracking_number ILIKE :summarySearch OR
          parcel.customer_name ILIKE :summarySearch OR
          parcel.customer_phone ILIKE :summarySearch OR
          parcel.customer_address ILIKE :summarySearch OR
          parcel.delivery_area ILIKE :summarySearch OR
          coverageArea.area ILIKE :summarySearch OR
          coverageArea.zone ILIKE :summarySearch OR
          coverageArea.city ILIKE :summarySearch
        )`,
        { summarySearch },
      );
    }

    const total = await query.getCount();
    const amountResult: { cod_amount?: string } | undefined = await query
      .clone()
      .select('COALESCE(SUM(parcel.cod_amount), 0)', 'cod_amount')
      .getRawOne();

    query
      .orderBy(dateField, 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const parcels = await query.getMany();

    return {
      type: options.type,
      total,
      cod_amount: Number(amountResult?.cod_amount) || 0,
      parcels,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  private createBaseQuery(): SelectQueryBuilder<Parcel> {
    return this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider');
  }

  private applyStatusAndAssignmentFilters(
    query: SelectQueryBuilder<Parcel>,
    options: ParcelQueryDto,
  ): void {
    if (options.history) {
      if (
        options.status &&
        options.status !== 'ACTIVE' &&
        !COMPLETED_PARCEL_STATUSES.includes(options.status)
      ) {
        throw new BadRequestException(
          `History status must be one of: ${COMPLETED_PARCEL_STATUSES.join(', ')}`,
        );
      }

      query.andWhere('parcel.status IN (:...completedStatuses)', {
        completedStatuses:
          options.status && options.status !== 'ACTIVE'
            ? [options.status]
            : COMPLETED_PARCEL_STATUSES,
      });
      query.andWhere(
        '(parcel.hub_confirmation_status = :confirmed OR parcel.hub_confirmation_status IS NULL)',
        { confirmed: 'CONFIRMED' },
      );
    } else if (options.status === 'ACTIVE') {
      query.andWhere('parcel.status IN (:...activeStatuses)', {
        activeStatuses: ACTIVE_PARCEL_STATUSES,
      });
    } else if (options.status) {
      query.andWhere('parcel.status = :status', { status: options.status });
    }

    if (options.assignment === ParcelAssignmentFilter.UNASSIGNED) {
      query
        .andWhere('parcel.assigned_rider_id IS NULL')
        .andWhere('parcel.third_party_provider_id IS NULL');
    } else if (options.assignment === ParcelAssignmentFilter.RIDER) {
      query.andWhere('parcel.assigned_rider_id IS NOT NULL');
    } else if (options.assignment === ParcelAssignmentFilter.THIRD_PARTY) {
      query.andWhere('parcel.third_party_provider_id IS NOT NULL');
    }

    if (options.riderId) {
      query.andWhere('parcel.assigned_rider_id = :riderId', {
        riderId: options.riderId,
      });
    }
    if (options.providerId) {
      query.andWhere('parcel.third_party_provider_id = :providerId', {
        providerId: options.providerId,
      });
    }
  }

  private applyCommonFilters(
    query: SelectQueryBuilder<Parcel>,
    options: ParcelQueryDto,
  ): void {
    if (options.merchantId) {
      query.andWhere('parcel.merchant_id = :merchantId', {
        merchantId: options.merchantId,
      });
    }
    if (options.storeId) {
      query.andWhere('parcel.store_id = :storeId', {
        storeId: options.storeId,
      });
    }
    if (options.paymentStatus) {
      query.andWhere('parcel.payment_status = :paymentStatus', {
        paymentStatus: options.paymentStatus,
      });
    }
    if (options.deliveryType !== undefined) {
      query.andWhere('parcel.delivery_type = :deliveryType', {
        deliveryType: options.deliveryType,
      });
    }
    if (options.customerName?.trim()) {
      query.andWhere('parcel.customer_name ILIKE :customerName', {
        customerName: `%${options.customerName.trim()}%`,
      });
    }
    if (options.customerPhone?.trim()) {
      query.andWhere('parcel.customer_phone ILIKE :customerPhone', {
        customerPhone: `%${options.customerPhone.trim()}%`,
      });
    }
    if (options.merchantName?.trim()) {
      query.andWhere(
        '(merchantUser.full_name ILIKE :merchantName OR store.business_name ILIKE :merchantName)',
        { merchantName: `%${options.merchantName.trim()}%` },
      );
    }
    if (options.area?.trim()) {
      query.andWhere(
        '(coverageArea.area ILIKE :area OR coverageArea.zone ILIKE :area OR coverageArea.city ILIKE :area OR parcel.delivery_area ILIKE :area OR parcel.customer_address ILIKE :area)',
        { area: `%${options.area.trim()}%` },
      );
    }
    if (options.minAmount !== undefined) {
      query.andWhere('parcel.cod_amount >= :minAmount', {
        minAmount: options.minAmount,
      });
    }
    if (options.maxAmount !== undefined) {
      query.andWhere('parcel.cod_amount <= :maxAmount', {
        maxAmount: options.maxAmount,
      });
    }

    if (options.search?.trim()) {
      const search = `%${options.search.trim()}%`;
      query.andWhere(
        `(
          CAST(parcel.id AS TEXT) ILIKE :search OR
          parcel.parcel_tx_id ILIKE :search OR
          parcel.tracking_number ILIKE :search OR
          parcel.merchant_order_id ILIKE :search OR
          parcel.customer_name ILIKE :search OR
          parcel.customer_phone ILIKE :search OR
          parcel.customer_address ILIKE :search OR
          parcel.delivery_area ILIKE :search OR
          merchantUser.full_name ILIKE :search OR
          store.business_name ILIKE :search OR
          assignedRiderUser.full_name ILIKE :search OR
          assignedRiderUser.phone ILIKE :search OR
          coverageArea.area ILIKE :search OR
          coverageArea.zone ILIKE :search OR
          coverageArea.city ILIKE :search OR
          thirdPartyProvider.provider_name ILIKE :search OR
          thirdPartyProvider.provider_code ILIKE :search OR
          parcel.carrybee_consignment_id ILIKE :search
        )`,
        { search },
      );
    }
  }

  private applyDateFilter(
    query: SelectQueryBuilder<Parcel>,
    options: ParcelQueryDto,
  ): void {
    if (
      (options.startDate && !options.endDate) ||
      (!options.startDate && options.endDate)
    ) {
      throw new BadRequestException(
        'startDate and endDate must be provided together',
      );
    }

    let start: Date | undefined;
    let end: Date | undefined;
    if (options.startDate && options.endDate) {
      start = this.parseDhakaDate(options.startDate, false);
      end = this.parseDhakaDate(options.endDate, true);
      if (start > end) {
        throw new BadRequestException(
          'startDate must be less than or equal to endDate',
        );
      }
    } else if (options.days) {
      end = new Date();
      const dhakaDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(end);
      start = this.parseDhakaDate(dhakaDate, false);
      start.setUTCDate(start.getUTCDate() - (options.days - 1));
    }

    if (!start || !end) return;

    const dateExpression = options.history
      ? 'COALESCE(parcel.completed_at, parcel.delivered_at, parcel.updated_at)'
      : 'parcel.created_at';
    query.andWhere(`${dateExpression} BETWEEN :startDate AND :endDate`, {
      startDate: start,
      endDate: end,
    });
  }

  private parseDhakaDate(value: string, endOfDay: boolean): Date {
    const dateOnly = value.slice(0, 10);
    const result = new Date(
      `${dateOnly}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+06:00`,
    );
    if (Number.isNaN(result.getTime())) {
      throw new BadRequestException('Invalid date filter');
    }
    return result;
  }

  private applySorting(
    query: SelectQueryBuilder<Parcel>,
    sortBy = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): void {
    const fields: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      completed_at: 'parcel.completed_at',
      received_at: 'parcel.received_at',
      assigned_at: 'parcel.assigned_at',
      tracking_number: 'parcel.tracking_number',
      customer_name: 'parcel.customer_name',
      merchant: 'merchantUser.full_name',
      rider: 'assignedRiderUser.full_name',
      status: 'parcel.status',
      cod_amount: 'parcel.cod_amount',
      total_charge: 'parcel.total_charge',
    };
    query.orderBy(
      fields[sortBy] ?? fields.created_at,
      order === 'ASC' ? 'ASC' : 'DESC',
    );
  }
}
