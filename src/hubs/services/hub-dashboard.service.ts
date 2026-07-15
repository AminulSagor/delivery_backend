import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { Rider } from '../../riders/entities/rider.entity';
import { DeliveryVerification } from '../../delivery-verifications/entities/delivery-verification.entity';
import {
  HubDashboardFlowQueryDto,
  HubDashboardFlowRange,
  HubDashboardLifetimeQueryDto,
  HubDashboardOngoingQueryDto,
  HubDashboardOverviewQueryDto,
  HubDashboardRiderQueryDto,
  HubDashboardRiderStatus,
} from '../dto/hub-dashboard-query.dto';

type DateRange = {
  start: Date;
  endExclusive: Date;
  startDate: string;
  endDate: string;
};

type StatusSummary = {
  count: number;
  amount: number;
};

type RiderStatusRaw = {
  id: string;
  rider_code: string | null;
  full_name: string | null;
  phone: string | null;
  photo: string | null;
  bike_type: string | null;
  is_active: unknown;
  assigned_count: unknown;
  created_at: Date | string | null;
};

type RiderStatusItem = {
  id: string;
  rider_code: string | null;
  name: string;
  phone: string | null;
  photo: string | null;
  bike_type: string | null;
  status: HubDashboardRiderStatus;
  status_label: string;
  assigned_parcels_count: number;
  is_active: boolean;
  created_at: Date | string | null;
};

type ParcelMetricsRaw = {
  process_count: unknown;
  in_progress_count: unknown;
  received_last_hour: unknown;
  success_count: unknown;
  outcome_count: unknown;
  today_success_count: unknown;
  today_outcome_count: unknown;
  previous_success_count: unknown;
  previous_outcome_count: unknown;
};

type TodayStatusRaw = {
  status: ParcelStatus;
  count: unknown;
  amount: unknown;
};

type RiderCountsRaw = {
  total_count: unknown;
  active_count: unknown;
};

type ParcelFlowRaw = {
  received_count: unknown;
  dispatched_count: unknown;
  reported_count: unknown;
};

@Injectable()
export class HubDashboardService {
  private readonly processingStatuses: ParcelStatus[] = [
    ParcelStatus.PENDING,
    ParcelStatus.PICKED_UP,
    ParcelStatus.IN_HUB,
    ParcelStatus.FAILED_DELIVERY,
    ParcelStatus.DELIVERY_RESCHEDULED,
    ParcelStatus.RETURNED_TO_HUB,
  ];

  private readonly inProgressStatuses: ParcelStatus[] = [
    ParcelStatus.ASSIGNED_TO_RIDER,
    ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.IN_TRANSIT,
  ];

  private readonly successfulStatuses: ParcelStatus[] = [
    ParcelStatus.DELIVERED,
    ParcelStatus.PARTIAL_DELIVERY,
    ParcelStatus.EXCHANGE,
  ];

  private readonly completedOutcomeStatuses: ParcelStatus[] = [
    ParcelStatus.DELIVERED,
    ParcelStatus.PARTIAL_DELIVERY,
    ParcelStatus.EXCHANGE,
    ParcelStatus.FAILED_DELIVERY,
    ParcelStatus.DELIVERY_RESCHEDULED,
    ParcelStatus.PAID_RETURN,
    ParcelStatus.RETURNED,
    ParcelStatus.RETURN_TO_MERCHANT,
    ParcelStatus.CANCELLED,
  ];

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(DeliveryVerification)
    private readonly deliveryVerificationRepository: Repository<DeliveryVerification>,
  ) {}

  async getOverview(hubId: string, query: HubDashboardOverviewQueryDto) {
    const day = this.resolveDayRange(query.date);
    const flowRange = this.resolveFlowRange(
      query.flow_range ?? HubDashboardFlowRange.TODAY,
      day,
    );

    const [
      parcelMetrics,
      todaySummary,
      riderCounts,
      parcelFlow,
      pendingActions,
      riderStatus,
      ongoingDeliveries,
      lifetimeSummary,
    ] = await Promise.all([
      this.getParcelMetrics(hubId, day),
      this.getTodayParcelSummary(hubId, day),
      this.getRiderCounts(hubId),
      this.getParcelFlowForRange(hubId, flowRange),
      this.getPendingActions(hubId),
      this.getRiderStatus(hubId, {
        page: 1,
        limit: query.rider_limit ?? 5,
        status: HubDashboardRiderStatus.ALL,
        sortBy: 'created_at',
        order: 'DESC',
      }),
      this.getOngoingDeliveries(hubId, {
        page: 1,
        limit: query.ongoing_limit ?? 6,
        date: query.date,
        sortBy: 'updated_at',
        order: 'DESC',
      }),
      this.getLifetimeSummary(hubId, {
        start_date: query.lifetime_start_date,
        end_date: query.lifetime_end_date,
      }),
    ]);

    const activeRiders = riderCounts.active;
    const averagePerActiveRider =
      activeRiders > 0
        ? Number((parcelMetrics.deliveriesInProgress / activeRiders).toFixed(2))
        : 0;

    const liveDeliveryMap = {
      tracking_available: false,
      reason:
        'Live rider coordinates are not stored by the current backend schema.',
      markers: [],
      unlocated_deliveries: ongoingDeliveries.items.map((item) => ({
        parcel_id: item.parcel_id,
        rider_id: item.rider?.id ?? null,
        rider_name: item.rider?.name ?? null,
        destination: item.destination,
      })),
    };

    return {
      generated_at: new Date().toISOString(),
      date_context: {
        timezone: 'UTC',
        date: day.startDate,
        start: day.start.toISOString(),
        end_exclusive: day.endExclusive.toISOString(),
      },
      top_cards: {
        parcels_to_process: {
          value: parcelMetrics.parcelsToProcess,
          received_last_hour: parcelMetrics.receivedLastHour,
        },
        riders_active: {
          value: riderCounts.active,
          total: riderCounts.total,
        },
        deliveries_in_progress: {
          value: parcelMetrics.deliveriesInProgress,
          average_per_active_rider: averagePerActiveRider,
        },
        live_success_rate: {
          value: parcelMetrics.liveSuccessRate,
          unit: 'percent',
          today_change: parcelMetrics.todaySuccessRateChange,
          comparison: 'selected_day_vs_previous_day',
        },
      },
      summary_for_todays_parcel: todaySummary,
      parcel_flow: parcelFlow,
      pending_actions: pendingActions,
      rider_status: riderStatus,
      ongoing_deliveries: ongoingDeliveries,
      live_delivery_map: liveDeliveryMap,
      summary_for_lifetime_parcel: lifetimeSummary,
    };
  }

  async getParcelFlow(hubId: string, query: HubDashboardFlowQueryDto) {
    const day = this.resolveDayRange(query.date);
    const range = this.resolveFlowRange(
      query.range ?? HubDashboardFlowRange.TODAY,
      day,
    );

    return this.getParcelFlowForRange(hubId, range);
  }

  async getPendingActions(hubId: string) {
    const otpQuery = this.deliveryVerificationRepository
      .createQueryBuilder('verification')
      .innerJoinAndSelect('verification.parcel', 'parcel')
      .leftJoin('parcel.store', 'store')
      .leftJoinAndSelect('verification.rider', 'rider')
      .leftJoinAndSelect('rider.user', 'riderUser')
      .where(this.hubScopeCondition(), { hubId })
      .andWhere(
        'verification.otp_bypass_request_status = :pendingOtpApproval',
        { pendingOtpApproval: 'PENDING' },
      )
      .orderBy('verification.otp_bypass_requested_at', 'ASC')
      .take(1);

    const assignQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .where(this.hubScopeCondition(), { hubId })
      .andWhere('parcel.status = :assignmentStatus', {
        assignmentStatus: ParcelStatus.IN_HUB,
      })
      .andWhere('parcel.assigned_rider_id IS NULL');

    const returnQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .where(this.hubScopeCondition(), { hubId })
      .andWhere('parcel.status = :returnStatus', {
        returnStatus: ParcelStatus.RETURNED_TO_HUB,
      });

    const [[otpItems, otpCount], assignCount, returnCount] = await Promise.all([
      otpQuery.getManyAndCount(),
      assignQuery.getCount(),
      returnQuery.getCount(),
    ]);

    const firstOtp = otpItems[0] ?? null;
    const actions = [
      {
        type: 'OTP_BYPASS_APPROVAL',
        priority: 'high',
        count: otpCount,
        title: firstOtp
          ? `Review delivery verification for parcel ${this.parcelCode(firstOtp.parcel)}`
          : 'Review delivery verification requests',
        description: firstOtp
          ? `${firstOtp.rider?.user?.full_name ?? 'A rider'} requested hub approval for ${this.formatStatus(firstOtp.selected_status)}`
          : 'No delivery verification request is waiting for approval',
        reference: firstOtp
          ? {
              verification_id: firstOtp.id,
              parcel_id: firstOtp.parcel?.id ?? null,
              parcel_code: this.parcelCode(firstOtp.parcel),
              rider_id: firstOtp.rider?.id ?? null,
            }
          : null,
        api_target: '/delivery-verifications/hub-approval/pending',
      },
      {
        type: 'ASSIGN_RIDER',
        priority: 'medium',
        count: assignCount,
        title: 'Assign riders to remaining parcels',
        description: `${assignCount} parcel${assignCount === 1 ? '' : 's'} waiting for rider assignment`,
        reference: null,
        api_target: '/hubs/parcels/for-assignment',
      },
      {
        type: 'PROCESS_RETURN',
        priority: 'normal',
        count: returnCount,
        title: 'Process return parcels',
        description: `${returnCount} return parcel${returnCount === 1 ? '' : 's'} waiting at the hub`,
        reference: null,
        api_target: '/hubs/parcels/return-to-merchant',
      },
    ];

    return {
      counts: {
        otp_approval: otpCount,
        rider_assignment: assignCount,
        return_processing: returnCount,
        total: otpCount + assignCount + returnCount,
      },
      actions: actions.filter((action) => action.count > 0),
    };
  }

  async getRiderStatus(hubId: string, query: HubDashboardRiderQueryDto) {
    const activeAssignmentStatuses = [
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.OUT_FOR_DELIVERY,
      ParcelStatus.IN_TRANSIT,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];

    const riderQuery = this.riderRepository
      .createQueryBuilder('rider')
      .leftJoin('rider.user', 'user')
      .leftJoin(
        'rider.assignedParcels',
        'assignedParcel',
        'assignedParcel.status IN (:...activeAssignmentStatuses)',
        { activeAssignmentStatuses },
      )
      .select('rider.id', 'id')
      .addSelect('rider.rider_code', 'rider_code')
      .addSelect('rider.photo', 'photo')
      .addSelect('rider.bike_type', 'bike_type')
      .addSelect('rider.is_active', 'is_active')
      .addSelect('rider.created_at', 'created_at')
      .addSelect('user.full_name', 'full_name')
      .addSelect('user.phone', 'phone')
      .addSelect('COUNT(DISTINCT assignedParcel.id)', 'assigned_count')
      .where('rider.hub_id = :hubId', { hubId })
      .groupBy('rider.id')
      .addGroupBy('user.id');

    if (query.search?.trim()) {
      riderQuery.andWhere(
        '(LOWER(user.full_name) LIKE LOWER(:search) OR LOWER(user.phone) LIKE LOWER(:search) OR LOWER(rider.rider_code) LIKE LOWER(:search))',
        { search: `%${query.search.trim()}%` },
      );
    }

    const rawRiders = await riderQuery.getRawMany<RiderStatusRaw>();
    const riders: RiderStatusItem[] = rawRiders.map((row) => {
      const isActive = this.toBoolean(row.is_active);
      const assignedCount = this.toCount(row.assigned_count);
      const status = !isActive
        ? HubDashboardRiderStatus.LEAVE
        : assignedCount > 0
          ? HubDashboardRiderStatus.ON_DUTY
          : HubDashboardRiderStatus.BREAK;

      return {
        id: row.id,
        rider_code: row.rider_code ?? null,
        name: row.full_name ?? 'N/A',
        phone: row.phone ?? null,
        photo: row.photo ?? null,
        bike_type: row.bike_type ?? null,
        status,
        status_label: this.formatRiderStatus(status),
        assigned_parcels_count: assignedCount,
        is_active: isActive,
        created_at: row.created_at,
      };
    });

    const counts = {
      all: riders.length,
      on_duty: riders.filter(
        (rider) => rider.status === HubDashboardRiderStatus.ON_DUTY,
      ).length,
      break: riders.filter(
        (rider) => rider.status === HubDashboardRiderStatus.BREAK,
      ).length,
      leave: riders.filter(
        (rider) => rider.status === HubDashboardRiderStatus.LEAVE,
      ).length,
    };

    const status = query.status ?? HubDashboardRiderStatus.ALL;
    const filtered =
      status === HubDashboardRiderStatus.ALL
        ? riders
        : riders.filter((rider) => rider.status === status);

    this.sortRiders(filtered, query.sortBy, query.order);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const items = filtered.slice((page - 1) * limit, page * limit);

    return {
      counts,
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

  async getOngoingDeliveries(
    hubId: string,
    query: HubDashboardOngoingQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const day = this.resolveDayRange(query.date);

    const parcelQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'riderUser')
      .leftJoinAndSelect(
        'parcel.delivery_coverage_area',
        'deliveryCoverageArea',
      )
      .where(this.hubScopeCondition(), { hubId });

    if (query.status) {
      parcelQuery.andWhere('parcel.status = :requestedStatus', {
        requestedStatus: query.status,
      });
    } else {
      const dashboardOutcomeStatuses = [
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
        ParcelStatus.DELIVERY_RESCHEDULED,
        ParcelStatus.PAID_RETURN,
        ParcelStatus.RETURNED,
      ];

      parcelQuery.andWhere(
        '(parcel.status IN (:...inProgressStatuses) OR (parcel.updated_at >= :dayStart AND parcel.updated_at < :dayEnd AND parcel.status IN (:...dashboardOutcomeStatuses)))',
        {
          inProgressStatuses: this.inProgressStatuses,
          dayStart: day.start,
          dayEnd: day.endExclusive,
          dashboardOutcomeStatuses,
        },
      );
    }

    if (query.search?.trim()) {
      parcelQuery.andWhere(
        '(LOWER(parcel.tracking_number) LIKE LOWER(:search) OR LOWER(parcel.parcel_tx_id) LIKE LOWER(:search) OR LOWER(parcel.customer_address) LIKE LOWER(:search) OR LOWER(riderUser.full_name) LIKE LOWER(:search))',
        { search: `%${query.search.trim()}%` },
      );
    }

    const allowedSortFields: Record<string, string> = {
      created_at: 'parcel.created_at',
      updated_at: 'parcel.updated_at',
      status: 'parcel.status',
      parcel_tx_id: 'parcel.parcel_tx_id',
    };
    const sortField =
      allowedSortFields[query.sortBy ?? 'updated_at'] ?? 'parcel.updated_at';
    const order = query.order ?? 'DESC';

    parcelQuery
      .orderBy(sortField, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [parcels, total] = await parcelQuery.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      items: parcels.map((parcel) => ({
        id: parcel.id,
        parcel_id: this.parcelCode(parcel),
        tracking_number: parcel.tracking_number,
        rider: parcel.assignedRider
          ? {
              id: parcel.assignedRider.id,
              name: parcel.assignedRider.user?.full_name ?? 'N/A',
              phone: parcel.assignedRider.user?.phone ?? null,
              photo: parcel.assignedRider.photo ?? null,
              vehicle: parcel.assignedRider.bike_type ?? null,
            }
          : null,
        destination: {
          address: parcel.customer_address,
          area: parcel.delivery_coverage_area?.area ?? parcel.delivery_area,
          city: parcel.delivery_coverage_area?.city ?? null,
          zone: parcel.delivery_coverage_area?.zone ?? null,
        },
        status: parcel.status,
        status_label: this.formatStatus(parcel.status),
        actions: {
          can_view: true,
          can_call_rider: Boolean(parcel.assignedRider?.user?.phone),
        },
        updated_at: parcel.updated_at,
      })),
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

  async getLifetimeSummary(hubId: string, query: HubDashboardLifetimeQueryDto) {
    const range = this.resolveOptionalDateRange(
      query.start_date,
      query.end_date,
    );
    const pendingDeliveryStatuses = [
      ParcelStatus.PENDING,
      ParcelStatus.PICKED_UP,
      ParcelStatus.IN_HUB,
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      ParcelStatus.OUT_FOR_DELIVERY,
      ParcelStatus.OUT_FOR_PICKUP,
      ParcelStatus.IN_TRANSIT,
      ParcelStatus.FAILED_DELIVERY,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .select('COUNT(parcel.id)', 'total_count')
      .addSelect('COALESCE(SUM(parcel.product_price), 0)', 'total_amount')
      .addSelect(
        'SUM(CASE WHEN parcel.status = :delivered THEN 1 ELSE 0 END)',
        'delivered_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :delivered THEN parcel.product_price ELSE 0 END), 0)',
        'delivered_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :partial THEN 1 ELSE 0 END)',
        'partial_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :partial THEN parcel.product_price ELSE 0 END), 0)',
        'partial_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :paidReturn THEN 1 ELSE 0 END)',
        'paid_return_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :paidReturn THEN parcel.product_price ELSE 0 END), 0)',
        'paid_return_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :returned THEN 1 ELSE 0 END)',
        'return_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :returned THEN parcel.product_price ELSE 0 END), 0)',
        'return_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :pendingReturn THEN 1 ELSE 0 END)',
        'pending_return_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :pendingReturn THEN parcel.product_price ELSE 0 END), 0)',
        'pending_return_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...pendingDeliveryStatuses) THEN 1 ELSE 0 END)',
        'pending_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status IN (:...pendingDeliveryStatuses) THEN parcel.product_price ELSE 0 END), 0)',
        'pending_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :returnToMerchant THEN 1 ELSE 0 END)',
        'return_to_merchant_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :returnToMerchant THEN parcel.product_price ELSE 0 END), 0)',
        'return_to_merchant_amount',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status = :exchanged THEN 1 ELSE 0 END)',
        'exchanged_count',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN parcel.status = :exchanged THEN parcel.product_price ELSE 0 END), 0)',
        'exchanged_amount',
      )
      .where(this.hubScopeCondition(), { hubId })
      .setParameters({
        delivered: ParcelStatus.DELIVERED,
        partial: ParcelStatus.PARTIAL_DELIVERY,
        paidReturn: ParcelStatus.PAID_RETURN,
        returned: ParcelStatus.RETURNED,
        pendingReturn: ParcelStatus.RETURNED_TO_HUB,
        pendingDeliveryStatuses,
        returnToMerchant: ParcelStatus.RETURN_TO_MERCHANT,
        exchanged: ParcelStatus.EXCHANGE,
      });

    if (range) {
      queryBuilder
        .andWhere('parcel.created_at >= :lifetimeStart', {
          lifetimeStart: range.start,
        })
        .andWhere('parcel.created_at < :lifetimeEnd', {
          lifetimeEnd: range.endExclusive,
        });
    }

    const raw = (await queryBuilder.getRawOne<Record<string, unknown>>()) ?? {};
    return {
      date_range: range
        ? { start_date: range.startDate, end_date: range.endDate }
        : { start_date: null, end_date: null },
      currency: 'BDT',
      total_parcel: this.rawSummary(raw, 'total'),
      delivered: this.rawSummary(raw, 'delivered'),
      partially_delivered: this.rawSummary(raw, 'partial'),
      paid_return: this.rawSummary(raw, 'paid_return'),
      return: this.rawSummary(raw, 'return'),
      pending_return: this.rawSummary(raw, 'pending_return'),
      pending: this.rawSummary(raw, 'pending'),
      return_to_merchant: this.rawSummary(raw, 'return_to_merchant'),
      exchanged: this.rawSummary(raw, 'exchanged'),
    };
  }

  private async getParcelMetrics(hubId: string, day: DateRange) {
    const previousStart = new Date(day.start);
    previousStart.setUTCDate(previousStart.getUTCDate() - 1);
    const previousEnd = day.start;
    const now = new Date();
    const lastHourEnd =
      now >= day.start && now < day.endExclusive ? now : day.endExclusive;
    const lastHourStart = new Date(lastHourEnd.getTime() - 60 * 60 * 1000);

    const raw = await this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .select(
        'SUM(CASE WHEN parcel.status IN (:...processingStatuses) THEN 1 ELSE 0 END)',
        'process_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...inProgressStatuses) THEN 1 ELSE 0 END)',
        'in_progress_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.created_at >= :lastHourStart AND parcel.created_at < :lastHourEnd THEN 1 ELSE 0 END)',
        'received_last_hour',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...successfulStatuses) THEN 1 ELSE 0 END)',
        'success_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.status IN (:...completedOutcomeStatuses) THEN 1 ELSE 0 END)',
        'outcome_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.updated_at >= :dayStart AND parcel.updated_at < :dayEnd AND parcel.status IN (:...successfulStatuses) THEN 1 ELSE 0 END)',
        'today_success_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.updated_at >= :dayStart AND parcel.updated_at < :dayEnd AND parcel.status IN (:...completedOutcomeStatuses) THEN 1 ELSE 0 END)',
        'today_outcome_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.updated_at >= :previousStart AND parcel.updated_at < :previousEnd AND parcel.status IN (:...successfulStatuses) THEN 1 ELSE 0 END)',
        'previous_success_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.updated_at >= :previousStart AND parcel.updated_at < :previousEnd AND parcel.status IN (:...completedOutcomeStatuses) THEN 1 ELSE 0 END)',
        'previous_outcome_count',
      )
      .where(this.hubScopeCondition(), { hubId })
      .setParameters({
        processingStatuses: this.processingStatuses,
        inProgressStatuses: this.inProgressStatuses,
        successfulStatuses: this.successfulStatuses,
        completedOutcomeStatuses: this.completedOutcomeStatuses,
        lastHourStart,
        lastHourEnd,
        dayStart: day.start,
        dayEnd: day.endExclusive,
        previousStart,
        previousEnd,
      })
      .getRawOne<ParcelMetricsRaw>();

    const successCount = this.toCount(raw?.success_count);
    const outcomeCount = this.toCount(raw?.outcome_count);
    const todaySuccessCount = this.toCount(raw?.today_success_count);
    const todayOutcomeCount = this.toCount(raw?.today_outcome_count);
    const previousSuccessCount = this.toCount(raw?.previous_success_count);
    const previousOutcomeCount = this.toCount(raw?.previous_outcome_count);
    const todayRate = this.percentage(todaySuccessCount, todayOutcomeCount);
    const previousRate = this.percentage(
      previousSuccessCount,
      previousOutcomeCount,
    );

    return {
      parcelsToProcess: this.toCount(raw?.process_count),
      deliveriesInProgress: this.toCount(raw?.in_progress_count),
      receivedLastHour: this.toCount(raw?.received_last_hour),
      liveSuccessRate: this.percentage(successCount, outcomeCount),
      todaySuccessRateChange: Number((todayRate - previousRate).toFixed(2)),
    };
  }

  private async getTodayParcelSummary(hubId: string, day: DateRange) {
    const rows = await this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .select('parcel.status', 'status')
      .addSelect('COUNT(parcel.id)', 'count')
      .addSelect('COALESCE(SUM(parcel.product_price), 0)', 'amount')
      .where(this.hubScopeCondition(), { hubId })
      .andWhere('parcel.created_at >= :dayStart', { dayStart: day.start })
      .andWhere('parcel.created_at < :dayEnd', {
        dayEnd: day.endExclusive,
      })
      .groupBy('parcel.status')
      .getRawMany<TodayStatusRaw>();

    const byStatus = new Map<ParcelStatus, StatusSummary>();
    let totalCount = 0;
    let totalAmount = 0;

    for (const row of rows) {
      const summary = {
        count: this.toCount(row.count),
        amount: this.toMoney(row.amount),
      };
      byStatus.set(row.status, summary);
      totalCount += summary.count;
      totalAmount += summary.amount;
    }

    return {
      currency: 'BDT',
      new_parcels: {
        count: totalCount,
        amount: this.toMoney(totalAmount),
      },
      pick_up: this.statusSummary(byStatus, [
        ParcelStatus.PICKED_UP,
        ParcelStatus.OUT_FOR_PICKUP,
      ]),
      assigned: this.statusSummary(byStatus, this.inProgressStatuses),
      delivered: this.statusSummary(byStatus, [ParcelStatus.DELIVERED]),
      delivery_rescheduled: this.statusSummary(byStatus, [
        ParcelStatus.DELIVERY_RESCHEDULED,
      ]),
    };
  }

  private async getRiderCounts(hubId: string) {
    const raw = await this.riderRepository
      .createQueryBuilder('rider')
      .select('COUNT(rider.id)', 'total_count')
      .addSelect(
        'SUM(CASE WHEN rider.is_active = :active THEN 1 ELSE 0 END)',
        'active_count',
      )
      .where('rider.hub_id = :hubId', { hubId })
      .setParameter('active', true)
      .getRawOne<RiderCountsRaw>();

    return {
      total: this.toCount(raw?.total_count),
      active: this.toCount(raw?.active_count),
    };
  }

  private async getParcelFlowForRange(hubId: string, range: DateRange) {
    const raw = await this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .select(
        'SUM(CASE WHEN COALESCE(parcel.received_at_destination_hub, parcel.picked_up_at, parcel.created_at) >= :rangeStart AND COALESCE(parcel.received_at_destination_hub, parcel.picked_up_at, parcel.created_at) < :rangeEnd THEN 1 ELSE 0 END)',
        'received_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.out_for_delivery_at >= :rangeStart AND parcel.out_for_delivery_at < :rangeEnd THEN 1 ELSE 0 END)',
        'dispatched_count',
      )
      .addSelect(
        'SUM(CASE WHEN parcel.issue_reported_at >= :rangeStart AND parcel.issue_reported_at < :rangeEnd THEN 1 ELSE 0 END)',
        'reported_count',
      )
      .where(this.hubScopeCondition(), { hubId })
      .setParameters({
        rangeStart: range.start,
        rangeEnd: range.endExclusive,
      })
      .getRawOne<ParcelFlowRaw>();

    return {
      range: {
        start_date: range.startDate,
        end_date: range.endDate,
        start: range.start.toISOString(),
        end_exclusive: range.endExclusive.toISOString(),
      },
      metrics: {
        parcels_received: this.toCount(raw?.received_count),
        parcels_dispatched: this.toCount(raw?.dispatched_count),
        parcels_reported: this.toCount(raw?.reported_count),
      },
    };
  }

  private hubScopeCondition() {
    return '(parcel.current_hub_id = :hubId OR (parcel.current_hub_id IS NULL AND store.hub_id = :hubId))';
  }

  private resolveDayRange(date?: string): DateRange {
    const dateOnly = date ?? new Date().toISOString().substring(0, 10);
    const start = this.parseDateOnly(dateOnly, 'date');
    const endExclusive = new Date(start);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    return {
      start,
      endExclusive,
      startDate: dateOnly,
      endDate: dateOnly,
    };
  }

  private resolveFlowRange(
    range: HubDashboardFlowRange,
    day: DateRange,
  ): DateRange {
    const start = new Date(day.start);
    if (range === HubDashboardFlowRange.LAST_7_DAYS) {
      start.setUTCDate(start.getUTCDate() - 6);
    } else if (range === HubDashboardFlowRange.LAST_30_DAYS) {
      start.setUTCDate(start.getUTCDate() - 29);
    }

    return {
      start,
      endExclusive: day.endExclusive,
      startDate: start.toISOString().substring(0, 10),
      endDate: day.endDate,
    };
  }

  private resolveOptionalDateRange(
    startDate?: string,
    endDate?: string,
  ): DateRange | null {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException(
        'start_date and end_date must be provided together',
      );
    }

    if (!startDate || !endDate) {
      return null;
    }

    const start = this.parseDateOnly(startDate, 'start_date');
    const end = this.parseDateOnly(endDate, 'end_date');
    if (start > end) {
      throw new BadRequestException(
        'start_date must be less than or equal to end_date',
      );
    }

    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { start, endExclusive, startDate, endDate };
  }

  private parseDateOnly(value: string, field: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().substring(0, 10) !== value
    ) {
      throw new BadRequestException(`${field} must be a valid calendar date`);
    }
    return parsed;
  }

  private statusSummary(
    byStatus: Map<ParcelStatus, StatusSummary>,
    statuses: ParcelStatus[],
  ): StatusSummary {
    return statuses.reduce(
      (total, status) => {
        const current = byStatus.get(status);
        return {
          count: total.count + (current?.count ?? 0),
          amount: this.toMoney(total.amount + (current?.amount ?? 0)),
        };
      },
      { count: 0, amount: 0 },
    );
  }

  private rawSummary(
    raw: Record<string, unknown>,
    prefix: string,
  ): StatusSummary {
    return {
      count: this.toCount(raw[`${prefix}_count`]),
      amount: this.toMoney(raw[`${prefix}_amount`]),
    };
  }

  private sortRiders(
    riders: RiderStatusItem[],
    sortBy = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ) {
    const multiplier = order === 'ASC' ? 1 : -1;

    riders.sort((left, right) => {
      const leftValue = this.riderSortValue(left, sortBy);
      const rightValue = this.riderSortValue(right, sortBy);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * multiplier;
      }
      return (
        String(leftValue).localeCompare(String(rightValue), undefined, {
          sensitivity: 'base',
        }) * multiplier
      );
    });
  }

  private riderSortValue(rider: RiderStatusItem, sortBy: string) {
    if (sortBy === 'full_name') return rider.name;
    if (sortBy === 'status') return rider.status;
    if (sortBy === 'assigned_parcels_count') {
      return rider.assigned_parcels_count;
    }

    const timestamp = rider.created_at
      ? new Date(rider.created_at).getTime()
      : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private formatRiderStatus(status: HubDashboardRiderStatus) {
    const labels: Record<HubDashboardRiderStatus, string> = {
      [HubDashboardRiderStatus.ALL]: 'All',
      [HubDashboardRiderStatus.ON_DUTY]: 'On Duty',
      [HubDashboardRiderStatus.BREAK]: 'Break',
      [HubDashboardRiderStatus.LEAVE]: 'Leave',
    };
    return labels[status];
  }

  private formatStatus(status: ParcelStatus | string) {
    return String(status)
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private parcelCode(parcel?: Parcel | null) {
    if (!parcel) return null;
    return parcel.parcel_tx_id ?? parcel.tracking_number ?? parcel.id;
  }

  private percentage(numerator: number, denominator: number) {
    return denominator > 0
      ? Number(((numerator / denominator) * 100).toFixed(2))
      : 0;
  }

  private toCount(value: unknown) {
    const count = Number(value ?? 0);
    return Number.isFinite(count) ? Math.trunc(count) : 0;
  }

  private toMoney(value: unknown) {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
  }

  private toBoolean(value: unknown) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }
}
