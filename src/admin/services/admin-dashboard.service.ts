import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { HubStatus } from '../../common/enums/hub-status.enum';
import { MerchantStatus } from '../../common/enums/merchant-status.enum';
import { RiderApprovalStatus } from '../../common/enums/rider-approval-status.enum';
import { Hub } from '../../hubs/entities/hub.entity';
import {
  InvoiceStatus,
  MerchantInvoice,
} from '../../merchant/entities/merchant-invoice.entity';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { Rider } from '../../riders/entities/rider.entity';
import {
  AdminDashboardEarningTrendsQueryDto,
  AdminDashboardFlowQueryDto,
  AdminDashboardFlowRange,
  AdminDashboardLifetimeQueryDto,
  AdminDashboardOverviewQueryDto,
} from '../dto/admin-dashboard-query.dto';

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

type HubCountsRaw = {
  total_count: unknown;
  active_count: unknown;
};

type ParcelFlowRaw = {
  received_count: unknown;
  dispatched_count: unknown;
  reported_count: unknown;
};

type EarningTrendRaw = {
  year: unknown;
  month: unknown;
  amount: unknown;
};

@Injectable()
export class AdminDashboardService {
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

  private readonly revenueStatuses: ParcelStatus[] = [
    ParcelStatus.DELIVERED,
    ParcelStatus.PARTIAL_DELIVERY,
    ParcelStatus.EXCHANGE,
    ParcelStatus.PAID_RETURN,
    ParcelStatus.RETURNED,
    ParcelStatus.RETURNED_TO_HUB,
    ParcelStatus.RETURN_TO_MERCHANT,
  ];

  private readonly monthLabels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Hub)
    private readonly hubRepository: Repository<Hub>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(MerchantInvoice)
    private readonly merchantInvoiceRepository: Repository<MerchantInvoice>,
  ) {}

  async getOverview(query: AdminDashboardOverviewQueryDto) {
    const day = this.resolveDayRange(query.date);
    const [
      parcelMetrics,
      todaySummary,
      riderCounts,
      hubCounts,
      pendingActions,
    ] = await Promise.all([
      this.getParcelMetrics(day),
      this.getTodayParcelSummary(day),
      this.getRiderCounts(),
      this.getHubCounts(),
      this.getPendingActions(),
    ]);

    const averagePerActiveRider =
      riderCounts.active > 0
        ? Number(
            (parcelMetrics.deliveriesInProgress / riderCounts.active).toFixed(
              2,
            ),
          )
        : 0;

    return {
      generated_at: new Date().toISOString(),
      scope: { type: 'ALL_HUBS', hub: null },
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
        total_active_hubs: {
          value: hubCounts.active,
          total: hubCounts.total,
        },
        live_success_rate: {
          value: parcelMetrics.liveSuccessRate,
          unit: 'percent',
          today_change: parcelMetrics.todaySuccessRateChange,
          comparison: 'today_vs_previous_day',
        },
      },
      summary_for_todays_parcel: todaySummary,
      quick_actions: this.getQuickActions(),
      pending_actions: pendingActions,
    };
  }

  async getParcelFlow(query: AdminDashboardFlowQueryDto) {
    const [range, scope] = await Promise.all([
      Promise.resolve(this.resolveFlowRange(query)),
      this.resolveScope(query.hub_id),
    ]);
    const raw = await this.getParcelFlowForRange(query.hub_id, range);

    return {
      scope,
      range: {
        preset:
          query.start_date || query.end_date
            ? 'custom'
            : (query.range ?? AdminDashboardFlowRange.TODAY),
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

  async getPendingActions() {
    const [riderResult, invoiceResult, merchantResult] = await Promise.all([
      this.riderRepository.findAndCount({
        where: { approval_status: RiderApprovalStatus.PENDING },
        relations: { user: true, hub: true },
        order: { created_at: 'ASC' },
        take: 1,
      }),
      this.merchantInvoiceRepository.findAndCount({
        where: {
          invoice_status: In([InvoiceStatus.UNPAID, InvoiceStatus.PROCESSING]),
        },
        relations: { merchant: { user: true } },
        order: { created_at: 'ASC' },
        take: 1,
      }),
      this.merchantRepository.findAndCount({
        where: { status: MerchantStatus.PENDING },
        relations: { user: true },
        order: { created_at: 'ASC' },
        take: 1,
      }),
    ]);

    const [riders, riderApproval] = riderResult;
    const [invoices, merchantPayment] = invoiceResult;
    const [merchants, merchantApproval] = merchantResult;
    const firstRider = riders[0];
    const firstInvoice = invoices[0];
    const firstMerchant = merchants[0];
    const actions: Array<Record<string, unknown>> = [];

    if (riderApproval > 0) {
      actions.push({
        type: 'RIDER_APPROVAL',
        priority: 'high',
        count: riderApproval,
        title: firstRider?.hub?.branch_name
          ? `Approve rider for ${firstRider.hub.branch_name}`
          : 'Approve rider',
        description: firstRider?.user?.full_name
          ? `Rider: ${firstRider.user.full_name}`
          : `${riderApproval} rider approval request(s) waiting`,
        reference_id: firstRider?.id ?? null,
        list_endpoint: '/riders?approval_status=PENDING&isActive=all',
        action_endpoint: firstRider ? `/riders/${firstRider.id}/approve` : null,
        action_method: 'PATCH',
      });
    }

    if (merchantPayment > 0) {
      actions.push({
        type: 'MERCHANT_PAYMENT',
        priority: 'medium',
        count: merchantPayment,
        title: firstInvoice?.merchant?.user?.full_name
          ? `Pay request from merchant: ${firstInvoice.merchant.user.full_name}`
          : 'Merchant invoice payment request',
        description: firstInvoice
          ? `Invoice ID: ${firstInvoice.invoice_no}`
          : `${merchantPayment} merchant invoice(s) waiting`,
        reference_id: firstInvoice?.id ?? null,
        amount: firstInvoice ? this.toMoney(firstInvoice.payable_amount) : null,
        currency: 'BDT',
        list_endpoint: '/merchant-invoices/pending-list',
        action_endpoint: firstInvoice
          ? `/merchant-invoices/${firstInvoice.id}/pay`
          : null,
        action_method: 'POST',
      });
    }

    if (merchantApproval > 0) {
      actions.push({
        type: 'MERCHANT_APPROVAL',
        priority: 'normal',
        count: merchantApproval,
        title: 'Approve merchant',
        description: firstMerchant?.user?.full_name
          ? `New merchant: ${firstMerchant.user.full_name}`
          : `${merchantApproval} merchant approval request(s) waiting`,
        reference_id: firstMerchant?.id ?? null,
        list_endpoint: '/merchants?status=PENDING',
        action_endpoint: firstMerchant
          ? `/merchants/${firstMerchant.id}/approve`
          : null,
        action_method: 'PATCH',
      });
    }

    return {
      counts: {
        rider_approval: riderApproval,
        merchant_payment: merchantPayment,
        merchant_approval: merchantApproval,
        total: riderApproval + merchantPayment + merchantApproval,
      },
      actions,
    };
  }

  async getEarningTrends(query: AdminDashboardEarningTrendsQueryDto) {
    const currentYear = new Date().getUTCFullYear();
    const endYear = query.end_year ?? currentYear;
    const startYear = query.start_year ?? Math.max(2000, endYear - 2);

    if (startYear > endYear) {
      throw new BadRequestException(
        'start_year must be less than or equal to end_year',
      );
    }
    if (endYear - startYear > 4) {
      throw new BadRequestException(
        'Earning trend range cannot exceed 5 calendar years',
      );
    }

    const scope = await this.resolveScope(query.hub_id);
    const trendDate =
      'COALESCE(parcel.delivered_at, parcel.updated_at, parcel.created_at)';
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoin('parcel.store', 'store')
      .select(`EXTRACT(YEAR FROM ${trendDate})`, 'year')
      .addSelect(`EXTRACT(MONTH FROM ${trendDate})`, 'month')
      .addSelect(
        'COALESCE(SUM(COALESCE(parcel.delivery_charge, 0) + COALESCE(parcel.cod_charge, 0) + COALESCE(parcel.weight_charge, 0) + COALESCE(parcel.return_charge, 0)), 0)',
        'amount',
      )
      .where('parcel.status IN (:...revenueStatuses)', {
        revenueStatuses: this.revenueStatuses,
      })
      .andWhere(`${trendDate} >= :trendStart`, {
        trendStart: new Date(Date.UTC(startYear, 0, 1)),
      })
      .andWhere(`${trendDate} < :trendEnd`, {
        trendEnd: new Date(Date.UTC(endYear + 1, 0, 1)),
      });
    this.applyHubScope(queryBuilder, query.hub_id);
    const rows = await queryBuilder
      .groupBy(`EXTRACT(YEAR FROM ${trendDate})`)
      .addGroupBy(`EXTRACT(MONTH FROM ${trendDate})`)
      .orderBy(`EXTRACT(YEAR FROM ${trendDate})`, 'ASC')
      .addOrderBy(`EXTRACT(MONTH FROM ${trendDate})`, 'ASC')
      .getRawMany<EarningTrendRaw>();

    const earnings = new Map<string, number>();
    for (const row of rows) {
      earnings.set(
        `${this.toCount(row.year)}-${this.toCount(row.month)}`,
        this.toMoney(row.amount),
      );
    }

    const series: Array<{
      year: number;
      total: number;
      monthly: Array<{ month: number; label: string; amount: number }>;
    }> = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const monthly = this.monthLabels.map((label, index) => ({
        month: index + 1,
        label,
        amount: earnings.get(`${year}-${index + 1}`) ?? 0,
      }));
      series.push({
        year,
        total: this.toMoney(
          monthly.reduce((sum, point) => sum + point.amount, 0),
        ),
        monthly,
      });
    }

    return {
      scope,
      currency: 'BDT',
      metric: 'courier_revenue',
      revenue_components: [
        'delivery_charge',
        'cod_charge',
        'weight_charge',
        'return_charge',
      ],
      range: { start_year: startYear, end_year: endYear },
      series,
    };
  }

  async getLifetimeSummary(query: AdminDashboardLifetimeQueryDto) {
    const [range, scope] = await Promise.all([
      Promise.resolve(
        this.resolveOptionalDateRange(query.start_date, query.end_date),
      ),
      this.resolveScope(query.hub_id),
    ]);
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
      .where('1 = 1')
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
    this.applyHubScope(queryBuilder, query.hub_id);

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
      scope,
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

  private async getParcelMetrics(day: DateRange) {
    const previousStart = new Date(day.start);
    previousStart.setUTCDate(previousStart.getUTCDate() - 1);
    const previousEnd = day.start;
    const now = new Date();
    const lastHourEnd =
      now >= day.start && now < day.endExclusive ? now : day.endExclusive;
    const lastHourStart = new Date(lastHourEnd.getTime() - 60 * 60 * 1000);

    const raw = await this.parcelRepository
      .createQueryBuilder('parcel')
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
    const todayRate = this.percentage(
      this.toCount(raw?.today_success_count),
      this.toCount(raw?.today_outcome_count),
    );
    const previousRate = this.percentage(
      this.toCount(raw?.previous_success_count),
      this.toCount(raw?.previous_outcome_count),
    );

    return {
      parcelsToProcess: this.toCount(raw?.process_count),
      deliveriesInProgress: this.toCount(raw?.in_progress_count),
      receivedLastHour: this.toCount(raw?.received_last_hour),
      liveSuccessRate: this.percentage(successCount, outcomeCount),
      todaySuccessRateChange: Number((todayRate - previousRate).toFixed(2)),
    };
  }

  private async getTodayParcelSummary(day: DateRange) {
    const rows = await this.parcelRepository
      .createQueryBuilder('parcel')
      .select('parcel.status', 'status')
      .addSelect('COUNT(parcel.id)', 'count')
      .addSelect('COALESCE(SUM(parcel.product_price), 0)', 'amount')
      .where('parcel.created_at >= :dayStart', { dayStart: day.start })
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

  private async getRiderCounts() {
    const raw = await this.riderRepository
      .createQueryBuilder('rider')
      .select('COUNT(rider.id)', 'total_count')
      .addSelect(
        'SUM(CASE WHEN rider.is_active = :active AND rider.approval_status = :approved THEN 1 ELSE 0 END)',
        'active_count',
      )
      .setParameters({
        active: true,
        approved: RiderApprovalStatus.APPROVED,
      })
      .getRawOne<RiderCountsRaw>();

    return {
      total: this.toCount(raw?.total_count),
      active: this.toCount(raw?.active_count),
    };
  }

  private async getHubCounts() {
    const raw = await this.hubRepository
      .createQueryBuilder('hub')
      .select('COUNT(hub.id)', 'total_count')
      .addSelect(
        'SUM(CASE WHEN hub.is_active = :active AND hub.status = :activeStatus THEN 1 ELSE 0 END)',
        'active_count',
      )
      .setParameters({ active: true, activeStatus: HubStatus.ACTIVE })
      .getRawOne<HubCountsRaw>();

    return {
      total: this.toCount(raw?.total_count),
      active: this.toCount(raw?.active_count),
    };
  }

  private async getParcelFlowForRange(
    hubId: string | undefined,
    range: DateRange,
  ) {
    const queryBuilder = this.parcelRepository
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
      .where('1 = 1')
      .setParameters({
        rangeStart: range.start,
        rangeEnd: range.endExclusive,
      });
    this.applyHubScope(queryBuilder, hubId);
    return queryBuilder.getRawOne<ParcelFlowRaw>();
  }

  private getQuickActions() {
    return [
      {
        id: 'manage_hubs',
        label: 'Manage HUB',
        endpoint: '/hubs',
        method: 'GET',
      },
      {
        id: 'view_reports',
        label: 'View Report',
        endpoint: '/hubs/parcels/reports',
        method: 'GET',
      },
      {
        id: 'approve_rider',
        label: 'Approve Rider',
        endpoint: '/riders?approval_status=PENDING&isActive=all',
        method: 'GET',
      },
      {
        id: 'create_invoice',
        label: 'Create Invoice',
        endpoint: '/merchant-invoices',
        method: 'POST',
      },
      {
        id: 'all_parcels',
        label: 'All Parcel',
        endpoint: '/admin/parcels',
        method: 'GET',
      },
    ];
  }

  private applyHubScope(
    queryBuilder: SelectQueryBuilder<Parcel>,
    hubId?: string,
  ) {
    if (hubId) {
      queryBuilder.andWhere(
        '(parcel.current_hub_id = :hubId OR (parcel.current_hub_id IS NULL AND store.hub_id = :hubId))',
        { hubId },
      );
    }
    return queryBuilder;
  }

  private async resolveScope(hubId?: string) {
    if (!hubId) {
      return { type: 'ALL_HUBS', hub: null };
    }

    const hub = await this.hubRepository.findOne({
      where: { id: hubId },
      select: {
        id: true,
        hub_code: true,
        branch_name: true,
        area: true,
        status: true,
        is_active: true,
      },
    });
    if (!hub) {
      throw new NotFoundException(`Hub with ID ${hubId} not found`);
    }

    return {
      type: 'HUB',
      hub: {
        id: hub.id,
        hub_code: hub.hub_code,
        branch_name: hub.branch_name,
        area: hub.area,
        status: hub.status,
        is_active: hub.is_active,
      },
    };
  }

  private resolveFlowRange(query: AdminDashboardFlowQueryDto): DateRange {
    if (query.start_date || query.end_date) {
      if (!query.start_date || !query.end_date) {
        throw new BadRequestException(
          'start_date and end_date must be provided together',
        );
      }
      return this.resolveDateRange(query.start_date, query.end_date);
    }

    const day = this.resolveDayRange(query.date);
    const range = query.range ?? AdminDashboardFlowRange.TODAY;
    const days =
      range === AdminDashboardFlowRange.LAST_30_DAYS
        ? 30
        : range === AdminDashboardFlowRange.LAST_7_DAYS
          ? 7
          : 1;
    const start = new Date(day.start);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    return {
      start,
      endExclusive: day.endExclusive,
      startDate: this.toDateOnly(start),
      endDate: day.endDate,
    };
  }

  private resolveDayRange(date?: string): DateRange {
    const start = date
      ? this.parseDateOnly(date)
      : this.startOfUtcDay(new Date());
    const endExclusive = new Date(start);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const dateOnly = this.toDateOnly(start);
    return {
      start,
      endExclusive,
      startDate: dateOnly,
      endDate: dateOnly,
    };
  }

  private resolveOptionalDateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return null;
    }
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'start_date and end_date must be provided together',
      );
    }
    return this.resolveDateRange(startDate, endDate);
  }

  private resolveDateRange(startDate: string, endDate: string): DateRange {
    const start = this.parseDateOnly(startDate);
    const end = this.parseDateOnly(endDate);
    if (start > end) {
      throw new BadRequestException(
        'start_date must be less than or equal to end_date',
      );
    }
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { start, endExclusive, startDate, endDate };
  }

  private parseDateOnly(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (this.toDateOnly(parsed) !== value) {
      throw new BadRequestException(`${value} is not a valid calendar date`);
    }
    return parsed;
  }

  private startOfUtcDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
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

  private rawSummary(raw: Record<string, unknown>, prefix: string) {
    return {
      count: this.toCount(raw[`${prefix}_count`]),
      amount: this.toMoney(raw[`${prefix}_amount`]),
    };
  }

  private percentage(value: number, total: number) {
    return total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;
  }

  private toCount(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  private toMoney(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }
}
