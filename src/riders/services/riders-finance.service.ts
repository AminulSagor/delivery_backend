import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { Rider } from '../entities/rider.entity';
import {
  Parcel,
  ParcelStatus,
  RIDER_DELIVERY_STATUSES,
} from '../../parcels/entities/parcel.entity';
import { PickupRequest } from '../../pickup-requests/entities/pickup-request.entity';
import { PickupRequestStatus } from '../../common/enums/pickup-request-status.enum';
import { startOfDay, endOfDay, startOfMonth, subDays } from 'date-fns';
import { RiderFinanceSummaryMetric } from '../dto/rider-finance-summary-breakdown-query.dto';

@Injectable()
export class RiderFinanceService {
  constructor(
    @InjectRepository(Rider)
    private riderRepository: Repository<Rider>,
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(PickupRequest)
    private pickupRequestRepository: Repository<PickupRequest>,
  ) {}

  async getFinanceSummaryByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const rider = await this.riderRepository.findOne({
      where: { user_id: userId },
    });
    if (!rider)
      throw new NotFoundException('Rider profile not found for this user');
    return this.getFinanceSummary(rider.id, startDate, endDate);
  }

  async getFinanceSummaryBreakdownByUserId(
    userId: string,
    metric: RiderFinanceSummaryMetric,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
  ) {
    const rider = await this.riderRepository.findOne({
      where: { user_id: userId },
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for this user');
    }

    return this.getFinanceSummaryBreakdown(
      rider.id,
      metric,
      startDate,
      endDate,
      page,
      limit,
    );
  }

  async getFinanceSummary(riderId: string, startDate?: Date, endDate?: Date) {
    // Validate Rider
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());

    // 1. Earning Today
    const earningsToday = await this.calculateEarnings(
      rider,
      todayStart,
      todayEnd,
    );

    // 2. Earning This Month
    const earningsMonth = await this.calculateEarnings(
      rider,
      monthStart,
      todayEnd,
    );

    // 3. Lifetime Cash Collection (Last 30 days as per user request)
    const thirtyDaysAgo = subDays(todayStart, 30);
    const lifetimeCashCollection = await this.calculateCashCollection(
      riderId,
      thirtyDaysAgo,
      todayEnd,
    );

    // 4. COD Summary for Today
    const codSummary = await this.calculateCODSummary(
      riderId,
      todayStart,
      todayEnd,
    );

    // 5. Tasks for today cards (pickups + deliveries + today's returned parcels)
    const tasksForToday = await this.calculateTasksForToday(
      riderId,
      todayStart,
      todayEnd,
    );

    // 6. Detailed Summary (Default last 90 days inclusive, or Custom Date Range)
    const { summaryStart, summaryEnd } = this.resolveSummaryDateRange(
      startDate,
      endDate,
      rider.created_at,
    );
    const detailedSummary = await this.calculateDetailedSummary(
      riderId,
      summaryStart,
      summaryEnd,
    );

    const totalTasksToday =
      tasksForToday.pickups +
      tasksForToday.deliveries +
      tasksForToday.returned;

    return {
      earnings: {
        today: earningsToday,
        this_month: earningsMonth,
      },
      tasks_for_today: {
        total: totalTasksToday,
        pickups: tasksForToday.pickups,
        deliveries: tasksForToday.deliveries,
        returned: tasksForToday.returned,
      },
      cards: {
        tasks_for_today: {
          title: 'Tasks for Today',
          total: totalTasksToday,
          pickups: tasksForToday.pickups,
          deliveries: tasksForToday.deliveries,
          returned: tasksForToday.returned,
        },
        cod_collected: {
          title: 'COD Collected',
          total: codSummary.total_collected_amount,
        },
        earning_today: {
          title: 'Earning Today',
          total: earningsToday,
        },
      },
      lifetime_cash_collection_30_days: lifetimeCashCollection,
      cod_summary_today: codSummary,
      summary: {
        date_range: {
          start: summaryStart,
          end: summaryEnd,
        },
        ...detailedSummary,
      },
    };
  }

  async getFinanceSummaryBreakdown(
    riderId: string,
    metric: RiderFinanceSummaryMetric,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
  ) {
    const rider = await this.riderRepository.findOne({
      where: { id: riderId },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    const { summaryStart, summaryEnd } = this.resolveSummaryDateRange(
      startDate,
      endDate,
      rider.created_at,
    );

    if (metric === RiderFinanceSummaryMetric.PICKUP) {
      const pickupWhere = {
        completed_by_rider_id: riderId,
        status: PickupRequestStatus.PICKED_UP,
        picked_up_at: Between(summaryStart, summaryEnd),
      };

      const [pickupRequests, totalRequests] =
        await this.pickupRequestRepository.findAndCount({
          where: pickupWhere,
          relations: [
            'store',
            'merchant',
            'merchant.user',
            'hub',
            'completedByRider',
            'completedByRider.user',
            'assignedRider',
            'assignedRider.user',
          ],
          order: { picked_up_at: 'DESC' },
          skip,
          take: safeLimit,
        });

      const { totalPickedUpCount } = await this.pickupRequestRepository
        .createQueryBuilder('pr')
        .select('SUM(pr.picked_up_count)', 'totalPickedUpCount')
        .where('pr.completed_by_rider_id = :riderId', { riderId })
        .andWhere('pr.status = :status', {
          status: PickupRequestStatus.PICKED_UP,
        })
        .andWhere('pr.picked_up_at BETWEEN :start AND :end', {
          start: summaryStart,
          end: summaryEnd,
        })
        .getRawOne();

      const total = Number(totalPickedUpCount) || 0;
      const totalPages = Math.ceil(totalRequests / safeLimit);

      return {
        metric,
        item_type: 'pickup_request' as const,
        date_range: {
          start: summaryStart,
          end: summaryEnd,
        },
        total,
        list_count: totalRequests,
        items: pickupRequests,
        pagination: {
          total: totalRequests,
          page: safePage,
          limit: safeLimit,
          totalPages,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1,
        },
      };
    }

    const parcelMetricConfig: Record<
      Exclude<RiderFinanceSummaryMetric, RiderFinanceSummaryMetric.PICKUP>,
      {
        status: ParcelStatus;
        dateField: 'delivered_at' | 'updated_at';
      }
    > = {
      [RiderFinanceSummaryMetric.DELIVERED]: {
        status: ParcelStatus.DELIVERED,
        dateField: 'delivered_at',
      },
      [RiderFinanceSummaryMetric.PARTIALLY_DELIVERED]: {
        status: ParcelStatus.PARTIAL_DELIVERY,
        dateField: 'delivered_at',
      },
      [RiderFinanceSummaryMetric.RETURN]: {
        status: ParcelStatus.RETURNED,
        dateField: 'updated_at',
      },
      [RiderFinanceSummaryMetric.PAID_RETURN]: {
        status: ParcelStatus.PAID_RETURN,
        dateField: 'updated_at',
      },
      [RiderFinanceSummaryMetric.EXCHANGED]: {
        status: ParcelStatus.EXCHANGE,
        dateField: 'delivered_at',
      },
      [RiderFinanceSummaryMetric.RETURN_TO_MERCHANT]: {
        status: ParcelStatus.RETURN_TO_MERCHANT,
        dateField: 'updated_at',
      },
    };

    const config = parcelMetricConfig[metric];

    const where: any = {
      assigned_rider_id: riderId,
      status: config.status,
      [config.dateField]: Between(summaryStart, summaryEnd),
    };

    const [parcels, total] = await this.parcelRepository.findAndCount({
      where,
      relations: [
        'merchant',
        'merchant.user',
        'customer',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'delivery_coverage_area',
        'currentHub',
        'originHub',
        'destinationHub',
        'thirdPartyProvider',
      ],
      order: {
        [config.dateField]: 'DESC',
      } as any,
      skip,
      take: safeLimit,
    });

    const totalPages = Math.ceil(total / safeLimit);

    return {
      metric,
      item_type: 'parcel' as const,
      date_range: {
        start: summaryStart,
        end: summaryEnd,
      },
      total,
      list_count: total,
      items: parcels,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
      },
    };
  }

  private resolveSummaryDateRange(
    startDate?: Date,
    endDate?: Date,
    riderCreatedAt?: Date,
  ) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const defaultSummaryStart = riderCreatedAt
      ? startOfDay(new Date(riderCreatedAt))
      : startOfDay(new Date('1970-01-01T00:00:00.000Z'));
    const hasCustomSummaryRange = Boolean(startDate || endDate);

    const summaryStart = startDate
      ? startOfDay(new Date(startDate))
      : hasCustomSummaryRange
        ? todayStart
        : defaultSummaryStart;

    const summaryEnd = endDate ? endOfDay(new Date(endDate)) : todayEnd;

    return {
      summaryStart,
      summaryEnd,
    };
  }

  private async calculateEarnings(
    rider: Rider,
    start: Date,
    end: Date,
  ): Promise<number> {
    // Commission is earned on successful delivery statuses
    const commissionableStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    const count = await this.parcelRepository.count({
      where: {
        assigned_rider_id: rider.id,
        status: In(commissionableStatuses),
        delivered_at: Between(start, end),
      },
    });

    // Fixed commission per parcel
    return count * (Number(rider.commission_per_delivery) || 0);
  }

  private async calculateCashCollection(
    riderId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    // Cash collected from parcels
    // Assuming 'cod_collected_amount' is the field tracking actual cash collected by rider
    const { total } = await this.parcelRepository
      .createQueryBuilder('parcel')
      .select('SUM(parcel.cod_collected_amount)', 'total')
      .where('parcel.assigned_rider_id = :riderId', { riderId })
      .andWhere('parcel.delivered_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    return Number(total) || 0;
  }

  private async calculateCODSummary(riderId: string, start: Date, end: Date) {
    // Total Collected Amount (Today)
    const totalCollected = await this.calculateCashCollection(
      riderId,
      start,
      end,
    );

    // Total Pending (Out for Delivery Today)
    // Pending amount is the expected COD amount for parcels currently out for delivery
    const { pending } = await this.parcelRepository
      .createQueryBuilder('parcel')
      .select('SUM(parcel.cod_amount)', 'pending')
      .where('parcel.assigned_rider_id = :riderId', { riderId })
      .andWhere('parcel.status = :status', {
        status: ParcelStatus.OUT_FOR_DELIVERY,
      })
      // We might want to filter Out For Delivery parcels that were updated today, or just all currently OFD
      // User request says "Summary for Today", usually implies current state or active today.
      // Let's stick to status = OUT_FOR_DELIVERY (Live status)
      .getRawOne();

    const pendingAmount = Number(pending) || 0;

    return {
      total_collected_amount: totalCollected,
      total_pending: pendingAmount,
      total_collection: totalCollected + pendingAmount, // Total Expected + Collected
    };
  }

  private async calculateTasksForToday(
    riderId: string,
    todayStart: Date,
    todayEnd: Date,
  ) {
    // Keep this consistent with dashboard logic so app cards match across endpoints.
    const pickups = await this.pickupRequestRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: PickupRequestStatus.CONFIRMED,
      },
    });

    const deliveries = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.ASSIGNED_TO_RIDER,
      },
    });

    const returned = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.RETURNED,
        updated_at: Between(todayStart, todayEnd),
      },
    });

    return {
      pickups,
      deliveries,
      returned,
    };
  }

  private async calculateDetailedSummary(
    riderId: string,
    start: Date,
    end: Date,
  ) {
    // Helper to count parcels by status in range
    const countByStatus = async (statuses: ParcelStatus[]) => {
      return this.parcelRepository.count({
        where: {
          assigned_rider_id: riderId,
          status: In(statuses),
          updated_at: Between(start, end), // specific status changes are best tracked by updated_at or specific timestamp fields if available
          // For specific statuses like DELIVERED, we have delivered_at. For others, updated_at is a proxy.
          // Given the schema has specific timestamps for some but not all, updated_at is a generic fallback
          // but might catch non-status updates.
          // Ideally we'd use a transaction log, but for now we look at current status + updated_at
          // OR specifically map timestamps where available.
        },
      });
    };

    // For precise daily reporting on "Delivered/Partially Delivered/Exchange/Paid Return/Return",
    // normally we use 'delivered_at' or the specific completion timestamp.
    // Schema has 'delivered_at'. It doesn't seem to have 'returned_at' etc explicitly,
    // but 'updated_at' with status check works for a daily summary snapshot.

    // Better approach for strict "Events happened today":
    // Delivered -> delivered_at
    // Picked Up -> picked_up_at
    // Others -> updated_at (approximate)

    // 1. Total Parcel (Assigned to rider and active/completed in this period)
    // This is vague. "Total Parcel" usually means "Tasks for today".
    // Let's assume: Parcels completed today + Parcels currently active/assigned today.
    // OR simply Sum of all breakdown counts below.

    // Breakdown counts:
    const delivered = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.DELIVERED,
        delivered_at: Between(start, end),
      },
    });

    const partiallyDelivered = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.PARTIAL_DELIVERY,
        delivered_at: Between(start, end),
      },
    });

    // Exchange also typically has a delivered_at or similar completion time
    const exchanged = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.EXCHANGE,
        delivered_at: Between(start, end),
      },
    });

    // Paid Return - likely handled same as delivery flow in terms of timing
    const paidReturn = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.PAID_RETURN,
        updated_at: Between(start, end),
      },
    });

    // Return - Returned to Hub? Or just Returned from customer?
    // Status: RETURNED (from customer), RETURNED_TO_HUB (final)
    // User asked for "Return". Let's count 'RETURNED' (attempted delivery, failed, returning).
    const returned = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.RETURNED,
        updated_at: Between(start, end),
      },
    });

    const returnToMerchant = await this.parcelRepository.count({
      where: {
        assigned_rider_id: riderId,
        status: ParcelStatus.RETURN_TO_MERCHANT,
        updated_at: Between(start, end),
      },
    });

    // Price Change - Not a status. Likely an event.
    // Schema doesn't have "PRICE_CHANGED" status. Checking for "Price Change" feature.
    // Assuming it's not implemented or handled as an issue.
    // I will return 0 for now or check if there's a flag.
    // Scanning schema... no obvious 'is_price_changed' flag.
    const priceChange = 0;

    // Pickup (From Pickup Requests)
    const { pickupCount } = await this.pickupRequestRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.picked_up_count)', 'pickupCount')
      .where('pr.completed_by_rider_id = :riderId', { riderId })
      .andWhere('pr.picked_up_at BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const pickups = Number(pickupCount) || 0;

    const totalParcel =
      delivered +
      partiallyDelivered +
      exchanged +
      paidReturn +
      returned +
      returnToMerchant +
      pickups;

    return {
      total_parcel: totalParcel, // Sum of work done
      delivered,
      partially_delivered: partiallyDelivered,
      return: returned,
      paid_return: paidReturn,
      pickup: pickups,
      exchanged,
      return_to_merchant: returnToMerchant,
      price_change: priceChange,
    };
  }
}
