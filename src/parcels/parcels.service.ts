import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In, IsNull } from 'typeorm';
import {
  PaginatedResponse,
  PaginationMeta,
} from '../common/dto/pagination.dto';
import {
  Parcel,
  ParcelIssueType,
  ParcelStatus,
  PaymentStatus,
} from './entities/parcel.entity';
import { FinancialStatus } from '../common/enums/financial-status.enum';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto } from './dto/update-parcel.dto';
import { UpdateParcelChargesDto } from './dto/update-parcel-charges.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { CoverageArea } from '../coverage-areas/entities/coverage-area.entity';
import { Store } from '../stores/entities/store.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Hub } from '../hubs/entities/hub.entity';
import { PricingService } from '../pricing/pricing.service';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import { CustomerService } from '../customer/customer.service';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { CalculateTotalPricingDto } from './dto/calculate-total-pricing.dto';
import { PickupRequestsService } from '../pickup-requests/pickup-requests.service';
import { Rider } from '../riders/entities/rider.entity';
import { AssignParcelToRiderDto } from '../riders/dto/assign-parcel.dto';
import { BulkAssignParcelsToRiderDto } from '../riders/dto/bulk-assign-parcel.dto';
import { BulkTransferDto, TransferParcelDto } from './dto/transfer-parcel.dto';
import { ParcelType } from '../common/enums/parcel-type.enum';
import { DeliveryType } from '../common/enums/delivery-type.enum';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid
import { BulkOrderItemDto } from './dto/bulk-suggest.dto';

// --- EXPORTED TYPES (Required for Controller) ---
export interface ParcelCreationResult {
  success: boolean;
  tracking?: string;
  error?: string;
}

export interface SuggestionResult {
  original_row: BulkOrderItemDto;
  status: 'SUCCESS' | 'FAILED' | 'RESOLVED';
  error?: string;

  // Suggestion fields
  suggested_area_id?: string;
  suggested_city?: string;
  suggested_zone?: string;
  total_charge?: number;
  delivery_charge?: number;
  cod_charge?: number;
}

interface AddressComponents {
  division: string;
  city: string;
  zone: string;
  area: string;
}

type CoverageAreaWithNorms = CoverageArea & {
  _zone_norm: string;
  _city_norm: string;
  _area_norm: string;
};
import { User } from '../users/entities/user.entity';
import { ParcelReportQueryDto } from 'src/hubs/dto/parcel-report-query.dto';
import {
  BulkResolveReportDto,
  ResolveReportDto,
} from 'src/hubs/dto/resolve-report.dto';
import { BulkAcceptDto } from 'src/hubs/dto/bulk-accept-parcels.dto';
import { CarrybeeService } from '../carrybee/carrybee.service';
import { SmsService } from '../utils/sms.service';
import { toParcelListItem } from '../common/interfaces/responses.interface';

type ParcelStatusFilter = ParcelStatus | 'ACTIVE';

@Injectable()
export class ParcelsService {
  private readonly logger = new Logger(ParcelsService.name);
  private readonly activeParcelStatuses: ParcelStatus[] = [
    ParcelStatus.PENDING,
    ParcelStatus.PICKED_UP,
    ParcelStatus.IN_TRANSIT,
    ParcelStatus.IN_HUB,
    ParcelStatus.ASSIGNED_TO_RIDER,
    ParcelStatus.OUT_FOR_DELIVERY,
    ParcelStatus.DELIVERY_RESCHEDULED,
  ];

  private coverageCache: CoverageAreaWithNorms[] | null = null;
  private coverageByCityNorm: Map<string, CoverageAreaWithNorms[]> = new Map();

  constructor(
    @InjectRepository(Parcel)
    private parcelRepository: Repository<Parcel>,
    @InjectRepository(CoverageArea)
    private coverageAreaRepository: Repository<CoverageArea>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @InjectRepository(Rider)
    private riderRepository: Repository<Rider>,
    @InjectRepository(Hub)
    private hubRepository: Repository<Hub>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private pricingService: PricingService,
    private customerService: CustomerService,
    private pickupRequestsService: PickupRequestsService,
    @Inject(forwardRef(() => CarrybeeService))
    private carrybeeService: CarrybeeService,
    private smsService: SmsService,
  ) {}

  private formatSmsAmount(amount: number): string {
    const value = Number(amount || 0);
    if (Number.isInteger(value)) {
      return `${value}`;
    }
    return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  private async sendAssignForRiderSms(parcel: Parcel, rider: Rider) {
    if (!parcel.customer_phone) {
      return;
    }

    const parcelId = parcel.parcel_tx_id || parcel.tracking_number || parcel.id;
    const riderName = rider.user?.full_name || 'Delivery Rider';
    const riderPhone = rider.user?.phone || 'N/A';

    const message =
      `[Meghswar Courier] Your parcel (${parcelId}) is out for delivery by ${riderName} (${riderPhone}). ` +
      `Use OTP to receive your order. Please share it only with the delivery agent.`;

    try {
      await this.smsService.sendSms(parcel.customer_phone, message);
      this.logger.log(
        `[ASSIGN SMS SENT] Parcel: ${parcel.tracking_number}, To: ${parcel.customer_phone}`,
      );
    } catch (error: any) {
      this.logger.warn(
        `[ASSIGN SMS FAILED] Parcel: ${parcel.tracking_number}, Error: ${error.message}`,
      );
    }
  }

  /**
   * Generate unique tracking number with retry logic for race conditions
   * Format: TRK-YYYYMMDD-XXXXX (with random suffix on collision)
   */
  private async generateTrackingNumber(retryCount = 0): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.parcelRepository.count({
      where: { created_at: Between(startOfDay, endOfDay) as any },
    });

    // Base sequence number
    let sequenceNumber = (count + 1).toString().padStart(5, '0');

    // On retry, add random suffix to avoid collision
    if (retryCount > 0) {
      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase();
      sequenceNumber = `${sequenceNumber}-${randomSuffix}`;
    }

    const trackingNumber = `TRK-${dateStr}-${sequenceNumber}`;

    // Check if tracking number already exists
    const existing = await this.parcelRepository.findOne({
      where: { tracking_number: trackingNumber },
      select: ['id'],
    });

    if (existing) {
      if (retryCount >= 5) {
        // Fallback to UUID-based tracking after 5 retries
        const uuid = uuidv4().substring(0, 8).toUpperCase();
        return `TRK-${dateStr}-${uuid}`;
      }
      // Retry with incremented counter
      return this.generateTrackingNumber(retryCount + 1);
    }

    return trackingNumber;
  }

  /**
   * Generate unique parcel_tx_id for display purposes
   * Format: [PREFIX][DDMMYY][RANDOM4]
   * Example: MF020426A9X2
   */
  private async generateParcelTxId(
    prefix: 'MF' | 'ME' | 'MR',
    date: Date = new Date(),
    retryCount = 0,
  ): Promise<string> {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const datePart = `${day}${month}${year}`;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const txId = `${prefix}${datePart}${randomPart}`;

    const existing = await this.parcelRepository.findOne({
      where: { parcel_tx_id: txId },
      select: ['id'],
    });

    if (existing) {
      if (retryCount >= 20) {
        throw new InternalServerErrorException(
          'Unable to generate unique parcel display ID',
        );
      }
      return this.generateParcelTxId(prefix, date, retryCount + 1);
    }

    return txId;
  }

  private getParcelIdPrefix(options: {
    isExchange?: boolean;
    isReturnParcel?: boolean;
    status?: ParcelStatus;
  }): 'MF' | 'ME' | 'MR' {
    if (options.isReturnParcel) return 'MR';
    if (options.status === ParcelStatus.RETURN_TO_MERCHANT) return 'MR';
    if (options.status === ParcelStatus.RETURNED) return 'MR';
    if (options.status === ParcelStatus.PAID_RETURN) return 'MR';
    if (options.status === ParcelStatus.EXCHANGE || options.isExchange) {
      return 'ME';
    }
    return 'MF';
  }

  private determinePricingZone(coverageArea: CoverageArea | null): PricingZone {
    if (!coverageArea) return PricingZone.OUTSIDE_DHAKA;
    if (coverageArea.division === 'Dhaka') {
      return coverageArea.inside_dhaka_flag
        ? PricingZone.INSIDE_DHAKA
        : PricingZone.SUB_DHAKA;
    }
    return PricingZone.OUTSIDE_DHAKA;
  }

  /**
   * Get today's parcel summary for merchant
   * Shows count and total COD amount for each status category
   */
  async getTodaySummary(
    merchantId: string,
    date?: string,
  ): Promise<{
    date: string;
    summary: {
      new_parcels: { count: number; amount: number };
      pickup: { count: number; amount: number };
      in_transit: { count: number; amount: number };
      assigned: { count: number; amount: number };
      out_for_delivery: { count: number; amount: number };
      delivered: { count: number; amount: number };
      delivery_rescheduled: { count: number; amount: number };
      returned: { count: number; amount: number };
      cancelled: { count: number; amount: number };
    };
    total: { count: number; amount: number };
  }> {
    // Use provided date or default to today
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Helper function to calculate count and amount
    const calculateStats = async (
      whereCondition: FindOptionsWhere<Parcel> | FindOptionsWhere<Parcel>[],
    ): Promise<{ count: number; amount: number }> => {
      const parcels = await this.parcelRepository.find({
        where: whereCondition,
        select: ['id', 'cod_amount'],
      });

      return {
        count: parcels.length,
        amount: parcels.reduce(
          (sum, p) => sum + (Number(p.cod_amount) || 0),
          0,
        ),
      };
    };

    // 1. New Parcels (PENDING, created today)
    const newParcels = await calculateStats({
      merchant_id: merchantId,
      status: ParcelStatus.PENDING,
      created_at: Between(startOfDay, endOfDay),
    });

    // 2. Pickup (PICKED_UP, OUT_FOR_PICKUP - picked up today)
    const pickup = await calculateStats([
      {
        merchant_id: merchantId,
        status: ParcelStatus.PICKED_UP,
        picked_up_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.OUT_FOR_PICKUP,
        updated_at: Between(startOfDay, endOfDay),
      },
    ]);

    // 3. In Transit (IN_TRANSIT, IN_HUB - in transit today)
    const inTransit = await calculateStats([
      {
        merchant_id: merchantId,
        status: ParcelStatus.IN_TRANSIT,
        updated_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.IN_HUB,
        updated_at: Between(startOfDay, endOfDay),
      },
    ]);

    // 4. Assigned (ASSIGNED_TO_RIDER, ASSIGNED_TO_THIRD_PARTY - assigned today)
    const assigned = await calculateStats([
      {
        merchant_id: merchantId,
        status: ParcelStatus.ASSIGNED_TO_RIDER,
        assigned_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
        assigned_at: Between(startOfDay, endOfDay),
      },
    ]);

    // 5. Out for Delivery
    const outForDelivery = await calculateStats({
      merchant_id: merchantId,
      status: ParcelStatus.OUT_FOR_DELIVERY,
      out_for_delivery_at: Between(startOfDay, endOfDay),
    });

    // 6. Delivered (DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN - delivered today)
    const delivered = await calculateStats([
      {
        merchant_id: merchantId,
        status: ParcelStatus.DELIVERED,
        delivered_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.PARTIAL_DELIVERY,
        delivered_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.EXCHANGE,
        delivered_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.PAID_RETURN,
        delivered_at: Between(startOfDay, endOfDay),
      },
    ]);

    // 7. Delivery Rescheduled
    const deliveryRescheduled = await calculateStats({
      merchant_id: merchantId,
      status: ParcelStatus.DELIVERY_RESCHEDULED,
      updated_at: Between(startOfDay, endOfDay),
    });

    // 8. Returned (RETURNED, PAID_RETURN, RETURN_TO_MERCHANT, RETURNED_TO_HUB)
    const returned = await calculateStats([
      {
        merchant_id: merchantId,
        status: ParcelStatus.RETURNED,
        updated_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.PAID_RETURN,
        updated_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.RETURN_TO_MERCHANT,
        updated_at: Between(startOfDay, endOfDay),
      },
      {
        merchant_id: merchantId,
        status: ParcelStatus.RETURNED_TO_HUB,
        updated_at: Between(startOfDay, endOfDay),
      },
    ]);

    // 9. Cancelled
    const cancelled = await calculateStats({
      merchant_id: merchantId,
      status: ParcelStatus.CANCELLED,
      updated_at: Between(startOfDay, endOfDay),
    });

    // Calculate total for today (all parcels created today)
    const totalToday = await calculateStats({
      merchant_id: merchantId,
      created_at: Between(startOfDay, endOfDay),
    });

    return {
      date: targetDate.toISOString().split('T')[0],
      summary: {
        new_parcels: newParcels,
        pickup: pickup,
        in_transit: inTransit,
        assigned: assigned,
        out_for_delivery: outForDelivery,
        delivered: delivered,
        delivery_rescheduled: deliveryRescheduled,
        returned: returned,
        cancelled: cancelled,
      },
      total: totalToday,
    };
  }

  /**
   * Get lifetime parcel summary for merchant
   * Shows count and total COD amount for each status category (all time)
   */
  async getLifetimeSummary(
    merchantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    summary: {
      new_parcels: { count: number; amount: number };
      pickup: { count: number; amount: number };
      in_transit: { count: number; amount: number };
      assigned: { count: number; amount: number };
      out_for_delivery: { count: number; amount: number };
      delivered: { count: number; amount: number };
      delivery_rescheduled: { count: number; amount: number };
      returned: { count: number; amount: number };
      cancelled: { count: number; amount: number };
    };
    total: { count: number; amount: number };
  }> {
    const dateRange = this.resolveLifetimeSummaryDateRange(startDate, endDate);

    // Helper function to calculate count and amount
    const calculateStats = async (
      whereCondition: FindOptionsWhere<Parcel> | FindOptionsWhere<Parcel>[],
    ): Promise<{ count: number; amount: number }> => {
      const parcels = await this.parcelRepository.find({
        where: whereCondition,
        select: ['id', 'cod_amount'],
      });

      return {
        count: parcels.length,
        amount: parcels.reduce(
          (sum, p) => sum + (Number(p.cod_amount) || 0),
          0,
        ),
      };
    };

    // 1. New Parcels (PENDING)
    const newParcels = await calculateStats(
      this.applyCreatedAtDateRange(
        {
          merchant_id: merchantId,
          status: ParcelStatus.PENDING,
        },
        dateRange,
      ),
    );

    // 2. Pickup (PICKED_UP, OUT_FOR_PICKUP)
    const pickup = await calculateStats(
      this.applyCreatedAtDateRange(
        [
          {
            merchant_id: merchantId,
            status: ParcelStatus.PICKED_UP,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.OUT_FOR_PICKUP,
          },
        ],
        dateRange,
      ),
    );

    // 3. In Transit (IN_TRANSIT, IN_HUB)
    const inTransit = await calculateStats(
      this.applyCreatedAtDateRange(
        [
          {
            merchant_id: merchantId,
            status: ParcelStatus.IN_TRANSIT,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.IN_HUB,
          },
        ],
        dateRange,
      ),
    );

    // 4. Assigned (ASSIGNED_TO_RIDER, ASSIGNED_TO_THIRD_PARTY)
    const assigned = await calculateStats(
      this.applyCreatedAtDateRange(
        [
          {
            merchant_id: merchantId,
            status: ParcelStatus.ASSIGNED_TO_RIDER,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
          },
        ],
        dateRange,
      ),
    );

    // 5. Out for Delivery
    const outForDelivery = await calculateStats(
      this.applyCreatedAtDateRange(
        {
          merchant_id: merchantId,
          status: ParcelStatus.OUT_FOR_DELIVERY,
        },
        dateRange,
      ),
    );

    // 6. Delivered (DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN)
    const delivered = await calculateStats(
      this.applyCreatedAtDateRange(
        [
          {
            merchant_id: merchantId,
            status: ParcelStatus.DELIVERED,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.PARTIAL_DELIVERY,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.EXCHANGE,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.PAID_RETURN,
          },
        ],
        dateRange,
      ),
    );

    // 7. Delivery Rescheduled
    const deliveryRescheduled = await calculateStats(
      this.applyCreatedAtDateRange(
        {
          merchant_id: merchantId,
          status: ParcelStatus.DELIVERY_RESCHEDULED,
        },
        dateRange,
      ),
    );

    // 8. Returned (RETURNED, PAID_RETURN, RETURN_TO_MERCHANT, RETURNED_TO_HUB)
    const returned = await calculateStats(
      this.applyCreatedAtDateRange(
        [
          {
            merchant_id: merchantId,
            status: ParcelStatus.RETURNED,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.PAID_RETURN,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.RETURN_TO_MERCHANT,
          },
          {
            merchant_id: merchantId,
            status: ParcelStatus.RETURNED_TO_HUB,
          },
        ],
        dateRange,
      ),
    );

    // 9. Cancelled
    const cancelled = await calculateStats(
      this.applyCreatedAtDateRange(
        {
          merchant_id: merchantId,
          status: ParcelStatus.CANCELLED,
        },
        dateRange,
      ),
    );

    // Calculate total (all parcels)
    const total = await calculateStats(
      this.applyCreatedAtDateRange(
        {
          merchant_id: merchantId,
        },
        dateRange,
      ),
    );

    return {
      summary: {
        new_parcels: newParcels,
        pickup: pickup,
        in_transit: inTransit,
        assigned: assigned,
        out_for_delivery: outForDelivery,
        delivered: delivered,
        delivery_rescheduled: deliveryRescheduled,
        returned: returned,
        cancelled: cancelled,
      },
      total: total,
    };
  }

  private resolveLifetimeSummaryDateRange(
    startDate?: string,
    endDate?: string,
  ): { start: Date; endInclusive: Date } | null {
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw new BadRequestException(
        'startDate and endDate must be provided together',
      );
    }

    if (!startDate || !endDate) {
      return null;
    }

    const start = this.parseDateOnlyAsUtc(startDate, 'startDate');
    const end = this.parseDateOnlyAsUtc(endDate, 'endDate');

    if (start > end) {
      throw new BadRequestException(
        'startDate must be less than or equal to endDate',
      );
    }

    const endInclusive = new Date(end);
    endInclusive.setUTCHours(23, 59, 59, 999);

    return {
      start,
      endInclusive,
    };
  }

  private parseDateOnlyAsUtc(value: string, fieldName: string): Date {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException(`${fieldName} must be in YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} is not a valid calendar date`);
    }

    return parsed;
  }

  private applyCreatedAtDateRange(
    whereCondition: FindOptionsWhere<Parcel> | FindOptionsWhere<Parcel>[],
    dateRange: { start: Date; endInclusive: Date } | null,
  ): FindOptionsWhere<Parcel> | FindOptionsWhere<Parcel>[] {
    if (!dateRange) {
      return whereCondition;
    }

    const createdAtCondition = Between(dateRange.start, dateRange.endInclusive);

    if (Array.isArray(whereCondition)) {
      return whereCondition.map((condition) => ({
        ...condition,
        created_at: createdAtCondition,
      }));
    }

    return {
      ...whereCondition,
      created_at: createdAtCondition,
    };
  }

  private parseRawNumeric(raw: string | undefined): number {
    const val = raw ? parseFloat(raw) : NaN;
    if (isNaN(val) || val < 0) {
      // Throwing an error here is essential for failing the suggestion/creation step
      throw new BadRequestException(`Invalid numeric value: ${raw}`);
    }
    return val;
  }

  // --- TEXT NORMALIZATION HELPERS ---

  private normalizeText(input?: string | null): string {
    if (!input) return '';
    return input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // keep letters & digits (Bangla + English)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize address.
   * - keeps numbers (10, 14, 32 etc.)
   * - drops tiny noise words like rd, h, r, no, etc.
   */
  private tokenizeAddress(input?: string | null): string[] {
    const norm = this.normalizeText(input);
    if (!norm) return [];
    return norm
      .split(' ')
      .filter((t) => t.length >= 3 || /^\d+$/.test(t))
      .filter(
        (t) => !['road', 'rd', 'house', 'flat', 'h', 'r', 'no'].includes(t),
      );
  }

  // --- SIMILARITY HELPERS ---

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
    const cur = new Array(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(
          prev[j] + 1, // delete
          cur[j - 1] + 1, // insert
          prev[j - 1] + cost, // substitute
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
    }
    return prev[b.length];
  }

  private similarity(a: string, b: string): number {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const dist = this.levenshtein(a, b);
    return 1 - dist / Math.max(a.length, b.length);
  }

  private jaccard(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const sa = new Set(a);
    const sb = new Set(b);
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    const union = sa.size + sb.size - inter;
    return union === 0 ? 0 : inter / union;
  }

  private scoreCoverageForAddress(
    addressTokens: string[],
    area: CoverageAreaWithNorms,
  ): number {
    const areaTokens = this.tokenizeAddress(area.area);
    const zoneTokens = this.tokenizeAddress(area.zone);
    const cityTokens = this.tokenizeAddress(area.city);

    return (
      3 * this.jaccard(addressTokens, areaTokens) +
      2 * this.jaccard(addressTokens, zoneTokens) +
      1 * this.jaccard(addressTokens, cityTokens)
    );
  }

  private findBestCoverageAreaFromAddress(
    rawAddress: string,
    coverageAreas: CoverageAreaWithNorms[],
  ): CoverageArea | null {
    const addrNorm = this.normalizeText(rawAddress);
    const addrNormWS = ` ${addrNorm} `;
    const addrTokens = this.tokenizeAddress(rawAddress);

    // --------------------------------
    // Build city map once from passed areas
    // --------------------------------
    const cityMap = new Map<string, CoverageAreaWithNorms[]>();
    for (const c of coverageAreas) {
      const cn = c._city_norm;
      if (!cn) continue;
      const list = cityMap.get(cn) || [];
      list.push(c);
      cityMap.set(cn, list);
    }
    const cityKeys = Array.from(cityMap.keys());

    // --------------------------------
    // 1. Split into comma parts and normalize
    // --------------------------------
    const partsRaw = rawAddress
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const partsNorm = partsRaw.map((p) => this.normalizeText(p));

    // --------------------------------
    // 2. CITY DETECTION (right to left)
    //    Typically last part is division/city ("Dhaka", "Sylhet", "Narayanganj")
    // --------------------------------
    let cityIndex: number | null = null;
    let candidateCities: string[] = [];

    for (let i = partsNorm.length - 1; i >= 0; i--) {
      const segment = partsNorm[i];
      if (!segment) continue;

      let bestCityKey = '';
      let bestSim = 0;

      for (const cityKey of cityKeys) {
        if (!cityKey) continue;
        const sim = this.similarity(segment, cityKey);
        if (sim > bestSim) {
          bestSim = sim;
          bestCityKey = cityKey;
        }
      }

      // strict for city
      if (bestSim >= 0.8) {
        candidateCities = [bestCityKey];
        cityIndex = i;
        break;
      }
    }

    // fallback: old full-address gating if no city found from parts
    if (candidateCities.length === 0) {
      const matchedCityKeys = cityKeys.filter(
        (k) => k && addrNormWS.includes(` ${k} `),
      );
      if (matchedCityKeys.length > 0) {
        candidateCities = matchedCityKeys;
      }
    }

    let candidates: CoverageAreaWithNorms[] = coverageAreas;
    if (candidateCities.length > 0) {
      candidates = candidateCities.flatMap((key) => cityMap.get(key) || []);
    }

    // --------------------------------
    // 3. ZONE / AREA DETECTION from parts (right to left)
    //    This fixes:
    //    - Bashundhora R/A -> Bashundhara R/A
    //    - Mirpur 10 vs Mirpur 1
    //    - Deep Jungle Area, Unknown -> no match
    // --------------------------------
    let bestZoneCandidate: CoverageAreaWithNorms | null = null;
    let bestZoneSim = 0;

    for (let i = partsNorm.length - 1; i >= 0; i--) {
      if (cityIndex !== null && i === cityIndex) continue; // skip the city segment

      const segment = partsNorm[i];
      if (!segment || segment.length < 3) continue;

      for (const c of candidates) {
        const zoneNorm = c._zone_norm || '';
        const areaNorm = c._area_norm || '';

        const simZone = zoneNorm ? this.similarity(segment, zoneNorm) : 0;
        const simArea = areaNorm ? this.similarity(segment, areaNorm) : 0;
        const sim = Math.max(simZone, simArea);

        if (sim > bestZoneSim) {
          bestZoneSim = sim;
          bestZoneCandidate = c;
        }
      }

      // If this part clearly matches a zone/area (e.g. "bashundhora r a", "mirpur 10")
      if (bestZoneSim >= 0.8 && bestZoneCandidate) {
        return bestZoneCandidate;
      }
    }

    const zoneBackup =
      bestZoneCandidate && bestZoneSim >= 0.7 ? bestZoneCandidate : null;

    // --------------------------------
    // 4. OLD LOGIC: exact zone phrase, keyword+number, Jaccard
    // --------------------------------

    // 4.1 Exact zone phrase: "gulshan 1", "banani"
    const zonesSeen = new Map<string, CoverageAreaWithNorms>();
    for (const c of candidates) {
      if (!c._zone_norm) continue;
      if (!zonesSeen.has(c._zone_norm)) zonesSeen.set(c._zone_norm, c);
    }

    const exactZoneNorms: string[] = [];
    for (const [zn] of zonesSeen.entries()) {
      if (!zn) continue;
      if (addrNormWS.includes(` ${zn} `)) {
        exactZoneNorms.push(zn);
      }
    }

    if (exactZoneNorms.length > 0) {
      const exactCandidates = candidates.filter((c) =>
        exactZoneNorms.includes(c._zone_norm || ''),
      );
      const insideDhaka = exactCandidates.filter(
        (c) => String(c.inside_dhaka_flag).toUpperCase() === 'TRUE',
      );
      const picked = insideDhaka[0] || exactCandidates[0];
      return picked;
    }

    // 4.2 keyword+number: "sector 14", "mirpur 10", "gulshan 1"
    const patternRegex = /([a-zA-Zঅ-হ]+)\s*(\d+)/g;
    const keywordNumPairs: { word: string; num: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = patternRegex.exec(addrNorm)) !== null) {
      keywordNumPairs.push({ word: m[1], num: m[2] });
    }

    // 4.2.a exact "word num" phrase inside zone
    const strongMatches: CoverageAreaWithNorms[] = [];
    for (const { word, num } of keywordNumPairs) {
      const phrase = `${word} ${num}`;
      const phraseWS = ` ${phrase} `;
      for (const c of candidates) {
        const zn = c._zone_norm || '';
        if (!zn) continue;
        if (` ${zn} `.includes(phraseWS)) {
          strongMatches.push(c);
        }
      }
    }

    if (strongMatches.length > 0) {
      const insideDhaka = strongMatches.filter(
        (c) => String(c.inside_dhaka_flag).toUpperCase() === 'TRUE',
      );
      return insideDhaka[0] || strongMatches[0];
    }

    // 4.2.b fuzzy keyword+number: "golshan 1" -> "gulshan 1"
    const fuzzyMatches: { area: CoverageAreaWithNorms; score: number }[] = [];
    for (const { word, num } of keywordNumPairs) {
      for (const c of candidates) {
        const zn = c._zone_norm || '';
        if (!zn) continue;
        // require same number inside zone
        if (!` ${zn} `.includes(` ${num} `)) continue;

        const mainZoneText = this.normalizeText(
          (zn || '').replace(/\d+/g, '').trim(),
        );
        const mainWords = mainZoneText.split(' ').filter(Boolean);
        const mainKeyword = mainWords[0] || mainZoneText;

        const sim = this.similarity(word, mainKeyword);
        if (sim >= 0.7) {
          fuzzyMatches.push({ area: c, score: sim });
        }
      }
    }

    if (fuzzyMatches.length > 0) {
      fuzzyMatches.sort((a, b) => b.score - a.score);
      return fuzzyMatches[0].area;
    }

    // 4.3 Jaccard fallback
    let best: CoverageAreaWithNorms | null = null;
    let bestScore = 0;

    for (const c of candidates) {
      const score = this.scoreCoverageForAddress(addrTokens, c);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best) return best;

    // last fallback: any zone candidate from parts
    return zoneBackup;
  }

  /**
   * Calculate all charges for a parcel using zone-based weight charging
   *
   * WEIGHT CHARGE ALGORITHM (per zone):
   * 1. First 0.5 kg is FREE for all zones
   * 2. Remaining weight is charged per step:
   *    - INSIDE_DHAKA: 0.5 kg steps, 10 BDT/step
   *    - SUB_DHAKA: 2.0 kg steps, 20 BDT/step
   *    - OUTSIDE_DHAKA: 1.0 kg steps, 20 BDT/step
   * 3. Steps are rounded UP (any fraction = 1 step)
   *
   * @param merchantId - Merchant/Store ID for store-specific pricing
   * @param deliveryCoverageAreaId - Delivery area to determine zone
   * @param weight - Parcel weight in kg
   * @param isCod - Whether this is a Cash on Delivery order
   * @param codAmount - COD amount to collect
   */
  private async calculateCharges(
    merchantId: string,
    deliveryCoverageAreaId: string | null,
    weight: number = 0,
    isCod: boolean,
    codAmount: number,
  ): Promise<{
    delivery_charge: number;
    weight_charge: number;
    cod_charge: number;
    discount: number;
    total_charge: number;
    receivable_amount: number;
  }> {
    let deliveryArea: CoverageArea | null = null;
    if (deliveryCoverageAreaId) {
      deliveryArea = await this.coverageAreaRepository.findOne({
        where: { id: deliveryCoverageAreaId },
      });
      if (!deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area with ID ${deliveryCoverageAreaId} not found`,
        );
    }

    const pricingZone = this.determinePricingZone(deliveryArea);

    // Get base pricing configuration
    const pricingConfig = await this.pricingService.getActivePricing(
      merchantId,
      pricingZone,
    );

    // Base delivery charge and percentages
    let baseDeliveryCharge = 60;
    let codPercentage = 1.0;
    let discountPercentage = 0;

    if (pricingConfig) {
      baseDeliveryCharge = Number(pricingConfig.delivery_charge);
      codPercentage = Number(pricingConfig.cod_percentage);
      discountPercentage = pricingConfig.discount_percentage
        ? Number(pricingConfig.discount_percentage)
        : 0;
    } else {
      // Zone-specific fallback base charges
      if (pricingZone === PricingZone.OUTSIDE_DHAKA) {
        baseDeliveryCharge = 120;
        codPercentage = 2.5;
      } else if (pricingZone === PricingZone.SUB_DHAKA) {
        baseDeliveryCharge = 80;
        codPercentage = 2.0;
      }
    }

    // Calculate weight charge using the new zone-based algorithm
    const weightChargeResult = await this.pricingService.calculateWeightCharge(
      merchantId, // Use merchantId as storeId for lookup
      pricingZone,
      weight,
    );

    const weightCharge = weightChargeResult.weight_charge;

    // COD charge: percentage of COD amount
    const codCharge = isCod
      ? Math.round(((codAmount * codPercentage) / 100) * 100) / 100
      : 0;

    // Discount: percentage of delivery charge
    const discount =
      Math.round(((baseDeliveryCharge * discountPercentage) / 100) * 100) / 100;

    // Total charge = base delivery + weight charge + COD charge - discount
    const totalCharge =
      Math.round(
        (baseDeliveryCharge + weightCharge + codCharge - discount) * 100,
      ) / 100;

    // Receivable amount = COD amount - total charge
    const receivableAmount = Math.round((codAmount - totalCharge) * 100) / 100;

    this.logger.log(
      `[CHARGES CALCULATED] Zone: ${pricingZone}, Delivery: ${baseDeliveryCharge}, ` +
        `Weight: ${weightCharge} (${weight}kg), COD: ${codCharge}, Discount: ${discount}, ` +
        `Total: ${totalCharge}, Receivable: ${receivableAmount} BDT`,
    );

    return {
      delivery_charge: baseDeliveryCharge,
      weight_charge: weightCharge,
      cod_charge: codCharge,
      discount: discount,
      total_charge: totalCharge,
      receivable_amount: receivableAmount,
    };
  }

  async create(
    createParcelDto: CreateParcelDto,
    userId: string,
    merchantId?: string,
  ): Promise<Parcel> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');

      // Validate user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user)
        throw new NotFoundException('User not found. Please login again.');

      // If merchantId not provided (backward compatibility), fetch it
      if (!merchantId) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user. Please contact support.',
          );
        merchantId = merchant.id;
      }

      // Validate store and get pickup request
      let store: Store | null = null;
      let pickupRequest: any = null;
      if (createParcelDto.store_id) {
        store = await this.storeRepository.findOne({
          where: { id: createParcelDto.store_id, merchant_id: merchantId },
        });
        if (!store)
          throw new NotFoundException(
            'Store not found or does not belong to this merchant. Please check the store ID.',
          );

        // Phase 2: Auto-link to pickup request
        try {
          pickupRequest =
            await this.pickupRequestsService.findOrCreateActiveForStore(
              merchantId,
              createParcelDto.store_id,
            );
          this.logger.log(
            `[PICKUP REQUEST] Linked parcel to pickup request: ${pickupRequest.id}`,
          );
        } catch (error: any) {
          this.logger.error(
            `[PICKUP REQUEST ERROR] Could not create/find pickup request for store ${createParcelDto.store_id}, merchant ${merchantId}: ${error.message}`,
            error.stack,
          );
          // Continue without pickup request if it fails
        }
      }

      const deliveryArea = createParcelDto.delivery_coverage_area_id
        ? await this.coverageAreaRepository.findOne({
            where: { id: createParcelDto.delivery_coverage_area_id },
          })
        : null;
      if (createParcelDto.delivery_coverage_area_id && !deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area not found. Please select a valid delivery area.`,
        );

      // COD amount = product_price (if product has a price, it's COD)
      const codAmount = createParcelDto.product_price || 0;
      const isCod = codAmount > 0;

      if (createParcelDto.product_weight && createParcelDto.product_weight < 0)
        throw new BadRequestException('Product weight cannot be negative.');
      const phoneRegex = /^01[0-9]{9}$/;
      if (!phoneRegex.test(createParcelDto.customer_phone))
        throw new BadRequestException(
          'Invalid customer phone number. Must be in format: 01XXXXXXXXX',
        );
      let customer, isNewCustomer;
      try {
        const result = await this.customerService.findOrCreateFromParcelPayload(
          {
            customer_name: createParcelDto.customer_name,
            customer_phone: createParcelDto.customer_phone,
            customer_address: createParcelDto.customer_address,
            customer_secondary_phone: createParcelDto.customer_secondary_phone,
            delivery_coverage_area_id:
              createParcelDto.delivery_coverage_area_id,
          },
        );
        customer = result.customer;
        isNewCustomer = result.isNew;
      } catch (error: any) {
        this.logger.error(`[CUSTOMER ERROR] ${error.message}`, error.stack);
        throw new BadRequestException(
          'Failed to process customer information. Please check the customer details.',
        );
      }
      let charges;
      try {
        charges = await this.calculateCharges(
          merchantId,
          createParcelDto.delivery_coverage_area_id || null,
          createParcelDto.product_weight || 0,
          isCod,
          codAmount,
        );
      } catch (error: any) {
        this.logger.error(`[PRICING ERROR] ${error.message}`, error.stack);
        throw new BadRequestException(
          'Failed to calculate pricing. Please try again or contact support.',
        );
      }
      let trackingNumber;
      let parcelTxId;
      try {
        trackingNumber = await this.generateTrackingNumber();
        const parcelPrefix = this.getParcelIdPrefix({
          isExchange: createParcelDto.is_exchange,
        });
        parcelTxId = await this.generateParcelTxId(parcelPrefix);
      } catch (error: any) {
        this.logger.error(
          `[TRACKING/TX_ID ERROR] ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to generate tracking number. Please try again.',
        );
      }
      // Auto-populate Carrybee IDs from coverage area
      const recipient_carrybee_city_id =
        deliveryArea?.city_id ||
        createParcelDto.recipient_carrybee_city_id ||
        null;
      const recipient_carrybee_zone_id =
        deliveryArea?.zone_id ||
        createParcelDto.recipient_carrybee_zone_id ||
        null;
      const recipient_carrybee_area_id =
        deliveryArea?.area_id ||
        createParcelDto.recipient_carrybee_area_id ||
        null;

      const parcel = this.parcelRepository.create({
        ...createParcelDto,
        merchant_id: merchantId, // merchant_id references merchants table (FK constraint)
        merchant_order_id: createParcelDto.merchant_order_id, // From frontend
        customer_id: customer.id,
        tracking_number: trackingNumber,
        parcel_tx_id: parcelTxId, // Display ID like #139679
        pickup_request_id: pickupRequest?.id || null, // Phase 2: Link to pickup request
        status: ParcelStatus.PENDING,
        payment_status: PaymentStatus.UNPAID,
        financial_status: FinancialStatus.PENDING, // CRITICAL: Must always be PENDING on creation
        delivery_type: createParcelDto.delivery_type || DeliveryType.NORMAL, // Default to Normal (1)
        is_cod: isCod, // Auto-set based on product_price > 0
        cod_amount: codAmount, // Set from product_price
        is_exchange: createParcelDto.is_exchange || false, // Exchange flag
        delivery_charge: charges.delivery_charge,
        weight_charge: charges.weight_charge,
        cod_charge: charges.cod_charge,
        total_charge: charges.total_charge,
        // Receivable amount calculated by backend (same as /calculate-pricing)
        receivable_amount: Math.max(0, charges.receivable_amount),
        // Auto-populate Carrybee IDs from coverage area
        recipient_carrybee_city_id,
        recipient_carrybee_zone_id,
        recipient_carrybee_area_id,
      });
      let savedParcel;
      try {
        savedParcel = await this.parcelRepository.save(parcel);

        // Phase 2: Update pickup request actual parcels count
        if (pickupRequest) {
          try {
            await this.pickupRequestsService.updateActualParcelsCount(
              pickupRequest.id,
            );
          } catch (error: any) {
            this.logger.warn(
              `[PICKUP REQUEST] Could not update parcel count: ${error.message}`,
            );
          }
        }
      } catch (error: any) {
        this.logger.error(`[PARCEL SAVE ERROR] ${error.message}`, error.stack);
        if (error.code === '23505')
          throw new BadRequestException(
            'Duplicate tracking number detected. Please try again.',
          );
        else if (error.code === '23503') {
          // FK constraint violation - provide better error message
          const constraintMsg = error.constraint || 'unknown';
          this.logger.error(
            `[FK CONSTRAINT VIOLATION] Constraint: ${constraintMsg}, Detail: ${error.detail}`,
          );

          if (constraintMsg.includes('delivery_coverage_area')) {
            throw new BadRequestException(
              'Invalid delivery area ID. Please verify the delivery coverage area exists.',
            );
          } else if (constraintMsg.includes('store')) {
            throw new BadRequestException(
              'Invalid store ID. Please verify the store exists and belongs to your account.',
            );
          } else if (constraintMsg.includes('merchant')) {
            throw new BadRequestException(
              'Invalid merchant ID. Please contact support.',
            );
          } else if (constraintMsg.includes('customer')) {
            throw new BadRequestException(
              'Invalid customer ID. Please verify the customer exists.',
            );
          }
          throw new BadRequestException(
            'Invalid reference data. Please check store ID, delivery area ID, and customer ID.',
          );
        }
        throw new InternalServerErrorException(
          'Failed to create parcel. Please try again or contact support.',
        );
      }
      this.logger.log(
        `[PARCEL CREATED] Tracking: ${trackingNumber}, Merchant: ${merchantId}, Charge: ${charges.total_charge} BDT`,
      );

      // ===== AUTO-ASSIGN TO CARRYBEE (If Enabled) =====
      if (store && store.auto_assign_to_carrybee) {
        try {
          // Validate parcel has required Carrybee location IDs
          if (
            savedParcel.recipient_carrybee_city_id &&
            savedParcel.recipient_carrybee_zone_id &&
            savedParcel.recipient_carrybee_area_id &&
            store.hub_id // Store must be assigned to a hub
          ) {
            this.logger.log(
              `[AUTO-ASSIGN CARRYBEE] Attempting auto-assignment for parcel ${savedParcel.tracking_number}`,
            );

            // Trigger Carrybee assignment asynchronously (don't block parcel creation)
            // Note: carrybeeService.assignParcelToCarrybee will auto-fetch the provider
            this.carrybeeService
              .assignParcelToCarrybee(
                savedParcel.id,
                { provider_id: null, notes: 'Auto-assigned by system' } as any,
                store.hub_id,
              )
              .then(() => {
                this.logger.log(
                  `[AUTO-ASSIGN SUCCESS] Parcel ${savedParcel.tracking_number} assigned to Carrybee`,
                );
              })
              .catch((error) => {
                this.logger.error(
                  `[AUTO-ASSIGN FAILED] Could not auto-assign parcel ${savedParcel.tracking_number} to Carrybee: ${error.message}`,
                  error.stack,
                );
                // Don't throw error - parcel creation should succeed even if auto-assignment fails
              });
          } else {
            this.logger.warn(
              `[AUTO-ASSIGN SKIPPED] Parcel ${savedParcel.tracking_number} missing Carrybee location IDs or hub assignment`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `[AUTO-ASSIGN ERROR] ${error.message}`,
            error.stack,
          );
          // Don't throw - parcel creation succeeded
        }
      }

      return savedParcel;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[PARCEL CREATE ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the parcel. Please try again.',
      );
    }
  }

  /**
   * Create parcel by Hub Manager (Create & Receive)
   * Sets status to IN_HUB immediately
   */
  async createByHubManager(
    createParcelDto: CreateParcelDto,
    hubManagerUserId: string,
    hubId: string,
  ): Promise<Parcel> {
    try {
      // 1. Validate Merchant ID (Must be provided by Hub Manager)
      // The dropdown in frontend sends merchant_id
      const merchantId = createParcelDto.merchant_id;
      if (!merchantId) {
        throw new BadRequestException(
          'Merchant ID is required for Hub Manager creation',
        );
      }

      // 2. Validate Store
      // Ensure the store belongs to the merchant AND is assigned to this Hub
      const store = await this.storeRepository.findOne({
        where: {
          id: createParcelDto.store_id,
          merchant_id: merchantId,
          hub_id: hubId, // Security check: Ensure store belongs to this Hub
        },
      });

      if (!store) {
        throw new NotFoundException(
          'Store not found, does not belong to this merchant, or is not assigned to your hub.',
        );
      }

      // 3. Find/Create Customer (Reused logic)
      let customer;
      try {
        const result = await this.customerService.findOrCreateFromParcelPayload(
          {
            customer_name: createParcelDto.customer_name,
            customer_phone: createParcelDto.customer_phone,
            customer_address: createParcelDto.customer_address,
            customer_secondary_phone: createParcelDto.customer_secondary_phone,
            delivery_coverage_area_id:
              createParcelDto.delivery_coverage_area_id,
          },
        );
        customer = result.customer;
      } catch (error: any) {
        throw new BadRequestException(
          'Invalid customer details: ' + error.message,
        );
      }

      // 4. Calculate Charges
      const codAmount = createParcelDto.product_price || 0;
      const isCod = codAmount > 0;

      const charges = await this.calculateCharges(
        merchantId,
        createParcelDto.delivery_coverage_area_id || null,
        createParcelDto.product_weight || 0,
        isCod,
        codAmount,
      );

      // 5. Generate Tracking Number
      const trackingNumber = await this.generateTrackingNumber();
      const parcelPrefix = this.getParcelIdPrefix({
        isExchange: createParcelDto.is_exchange,
      });
      const parcelTxId = await this.generateParcelTxId(parcelPrefix);

      // 6. Carrybee Mapping (Optional/Existing logic)
      const deliveryArea = createParcelDto.delivery_coverage_area_id
        ? await this.coverageAreaRepository.findOne({
            where: { id: createParcelDto.delivery_coverage_area_id },
          })
        : null;

      // 7. Create Parcel Entity
      const parcel = this.parcelRepository.create({
        ...createParcelDto,
        merchant_id: merchantId,
        customer_id: customer.id,
        tracking_number: trackingNumber,
        parcel_tx_id: parcelTxId,

        // --- KEY DIFFERENCES FOR HUB MANAGER ---
        status: ParcelStatus.IN_HUB, // Directly Received
        current_hub_id: hubId, // Physically at this hub
        // -------------------------------------

        pickup_request_id: null, // No pickup request needed, it's already here
        payment_status: PaymentStatus.UNPAID,
        delivery_type: createParcelDto.delivery_type || DeliveryType.NORMAL,
        is_cod: isCod,
        cod_amount: codAmount,
        is_exchange: createParcelDto.is_exchange || false,

        // Financials
        delivery_charge: charges.delivery_charge,
        weight_charge: charges.weight_charge,
        cod_charge: charges.cod_charge,
        total_charge: charges.total_charge,
        receivable_amount: Math.max(0, charges.receivable_amount),

        // Carrybee fields
        recipient_carrybee_city_id: deliveryArea?.city_id || null,
        recipient_carrybee_zone_id: deliveryArea?.zone_id || null,
        recipient_carrybee_area_id: deliveryArea?.area_id || null,
      });

      const savedParcel = await this.parcelRepository.save(parcel);

      this.logger.log(
        `[HUB PARCEL CREATE] ${trackingNumber} created by Hub ${hubId} for Merchant ${merchantId}`,
      );

      // ===== AUTO-ASSIGN TO CARRYBEE (If Enabled) =====
      if (store.auto_assign_to_carrybee) {
        try {
          // Validate parcel has required Carrybee location IDs
          if (
            savedParcel.recipient_carrybee_city_id &&
            savedParcel.recipient_carrybee_zone_id &&
            savedParcel.recipient_carrybee_area_id
          ) {
            this.logger.log(
              `[AUTO-ASSIGN CARRYBEE] Hub Manager - Attempting auto-assignment for parcel ${savedParcel.tracking_number}`,
            );

            // Trigger Carrybee assignment asynchronously
            this.carrybeeService
              .assignParcelToCarrybee(
                savedParcel.id,
                {
                  provider_id: null,
                  notes: 'Auto-assigned by hub manager',
                } as any,
                hubId,
              )
              .then(() => {
                this.logger.log(
                  `[AUTO-ASSIGN SUCCESS] Hub Manager - Parcel ${savedParcel.tracking_number} assigned to Carrybee`,
                );
              })
              .catch((error) => {
                this.logger.error(
                  `[AUTO-ASSIGN FAILED] Hub Manager - Could not auto-assign parcel ${savedParcel.tracking_number}: ${error.message}`,
                  error.stack,
                );
              });
          } else {
            this.logger.warn(
              `[AUTO-ASSIGN SKIPPED] Hub Manager - Parcel ${savedParcel.tracking_number} missing Carrybee location IDs`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `[AUTO-ASSIGN ERROR] Hub Manager - ${error.message}`,
            error.stack,
          );
        }
      }

      return savedParcel;
    } catch (error: any) {
      this.logger.error(`[HUB CREATE ERROR] ${error.message}`, error.stack);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to create and receive parcel',
      );
    }
  }

  async findAllForMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatusFilter,
    storeId?: string,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
    days?: number,
    paymentStatus?: PaymentStatus,
  ): Promise<PaginatedResponse<Parcel>> {
    try {
      if (!merchantId) throw new ForbiddenException('Merchant ID is required');

      // merchant_id references merchants table, so use merchantId
      const where: FindOptionsWhere<Parcel> = { merchant_id: merchantId };

      if (status === 'ACTIVE') {
        where.status = In(this.activeParcelStatuses);
      } else if (status) {
        where.status = status;
      }

      if (storeId) {
        where.store_id = storeId;
      }

      if (paymentStatus) {
        where.payment_status = paymentStatus;
      }

      if (days) {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);
        where.created_at = Between(startDate, endDate) as any;
      }

      const [items, total] = await this.parcelRepository.findAndCount({
        where,
        relations: [
          'merchant',
          'merchant.user',
          'store',
          'store.hub',
          'store.merchant',
          'store.merchant.user',
          'delivery_coverage_area',
          'customer',
          'assignedRider',
          'assignedRider.user',
          'assignedRider.hub',
          'currentHub',
          'originHub',
          'destinationHub',
          'thirdPartyProvider',
        ],
        order: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.log(
        `Retrieved ${items.length} parcels for merchant ${merchantId}`,
      );

      return { items, pagination };
    } catch (error: any) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`[FIND PARCELS ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Failed to retrieve parcels. Please try again.',
      );
    }
  }

  async findOne(
    id: string,
    merchantId: string | null,
    isAdmin: boolean = false,
    riderId: string | null = null,
    hubId: string | null = null,
  ): Promise<Parcel> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({
        where: { id },
        relations: [
          'merchant',
          'merchant.user',
          'store',
          'store.hub',
          'store.merchant',
          'store.merchant.user',
          'delivery_coverage_area',
          'customer',
          'assignedRider',
          'assignedRider.user',
          'assignedRider.hub',
          'currentHub',
          'originHub',
          'destinationHub',
          'thirdPartyProvider',
        ],
      });
      if (!parcel) throw new NotFoundException(`Parcel not found`);
      // Rider can only view parcels assigned to them
      if (riderId) {
        if (parcel.assigned_rider_id !== riderId)
          throw new ForbiddenException(
            'You do not have permission to view this parcel',
          );
        return parcel;
      }
      // Hub manager can only view parcels currently at their hub
      if (hubId) {
        if (parcel.current_hub_id !== hubId)
          throw new ForbiddenException(
            'You do not have permission to view this parcel',
          );
        return parcel;
      }
      // merchant_id references merchants table, so compare with merchantId from JWT
      if (!isAdmin && merchantId && parcel.merchant_id !== merchantId)
        throw new ForbiddenException(
          'You do not have permission to view this parcel',
        );
      return parcel;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `[FIND ONE PARCEL ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcel details. Please try again.',
      );
    }
  }

  async calculatePricing(
    userId: string,
    calculateDto: CalculatePricingDto,
    merchantId?: string,
  ): Promise<{
    delivery_fee: number;
    cod_fee: number;
    weight_charge: number;
    discount: number;
    total_fee: number;
    receivable_amount: number;
  }> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(calculateDto.store_id))
        throw new BadRequestException('Invalid store ID format');
      if (!uuidRegex.test(calculateDto.delivery_coverage_area_id))
        throw new BadRequestException(
          'Invalid delivery coverage area ID format',
        );

      // If merchantId not provided (backward compatibility), fetch it
      if (!merchantId) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user. Please contact support.',
          );
        merchantId = merchant.id;
      }

      // Validate store belongs to merchant
      const store = await this.storeRepository.findOne({
        where: { id: calculateDto.store_id, merchant_id: merchantId },
      });
      if (!store)
        throw new NotFoundException(
          'Store not found or does not belong to this merchant.',
        );

      const deliveryArea = await this.coverageAreaRepository.findOne({
        where: { id: calculateDto.delivery_coverage_area_id },
      });
      if (!deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area not found. Please select a valid delivery area.`,
        );
      const pricingZone = this.determinePricingZone(deliveryArea);
      const pricingConfig = await this.pricingService.getActivePricing(
        calculateDto.store_id,
        pricingZone,
      );

      // Get default/fixed values for this zone
      const defaults = this.pricingService.getDefaultPricingValues(pricingZone);

      // Fixed values (not configurable)
      const freeWeightKg = defaults.free_weight_kg; // Always 0.5 kg
      const chargePerStep = defaults.charge_per_step; // 10 for INSIDE_DHAKA, 20 for others

      // Configurable values
      let deliveryFee = defaults.delivery_charge;
      let codPercentage = defaults.cod_percentage;
      let weightStepKg = defaults.weight_step_kg;
      let discountPercentage: number = 0;

      if (pricingConfig) {
        deliveryFee = Number(pricingConfig.delivery_charge);
        codPercentage = Number(pricingConfig.cod_percentage);
        weightStepKg =
          Number(pricingConfig.weight_step_kg) || defaults.weight_step_kg;
        discountPercentage = pricingConfig.discount_percentage
          ? Number(pricingConfig.discount_percentage)
          : 0;
      }

      // Calculate weight charge
      const billableWeight = Math.max(0, calculateDto.weight_kg - freeWeightKg);
      let weightCharge = 0;
      if (billableWeight > 0) {
        const totalSteps = Math.ceil(billableWeight / weightStepKg);
        weightCharge = totalSteps * chargePerStep;
      }

      // Calculate COD fee
      const codFee =
        Math.round(
          ((calculateDto.amount_to_receive * codPercentage) / 100) * 100,
        ) / 100;

      // Calculate discount (on delivery fee)
      const discount =
        Math.round(((deliveryFee * discountPercentage) / 100) * 100) / 100;

      // Calculate total fee
      const totalFee =
        Math.round((deliveryFee + codFee + weightCharge - discount) * 100) /
        100;

      // Calculate receivable amount
      const receivableAmount =
        Math.round((calculateDto.amount_to_receive - totalFee) * 100) / 100;

      return {
        delivery_fee: deliveryFee,
        cod_fee: codFee,
        weight_charge: weightCharge,
        discount: discount,
        total_fee: totalFee,
        receivable_amount: receivableAmount,
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `[CALCULATE PRICING ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate pricing. Please try again.',
      );
    }
  }

  /**
   * Calculate total delivery cost with detailed breakdown
   * Returns: Delivery Fee, COD Fee, Weight Charge, Discount, Total Fee
   */
  async calculateTotalPricing(
    userId: string,
    calculateDto: CalculateTotalPricingDto,
    merchantId?: string,
  ): Promise<{
    zone: string;
    delivery_fee: number;
    cod_fee: number;
    weight_charge: number;
    discount: number;
    total_fee: number;
    breakdown: {
      base_delivery_charge: number;
      // Zone-based weight charge details
      free_weight_kg: number;
      billable_weight_kg: number;
      weight_step_kg: number;
      charge_per_step: number;
      total_steps: number;
      weight_charge_breakdown: string;
      cod_percentage: number;
      discount_percentage: number | null;
      weight_kg: number;
      quantity: number;
      cod_amount: number;
    };
  }> {
    try {
      if (!userId) throw new ForbiddenException('User ID (userId) is required');

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(calculateDto.store_id))
        throw new BadRequestException('Invalid store ID format');
      if (!uuidRegex.test(calculateDto.delivery_coverage_area_id))
        throw new BadRequestException(
          'Invalid delivery coverage area ID format',
        );

      // Default values
      const weight = calculateDto.weight ?? 0.5;
      const quantity = calculateDto.quantity ?? 1;
      const codAmount = calculateDto.cod_amount ?? 0;

      // If merchantId not provided (backward compatibility), fetch it
      if (!merchantId) {
        const merchant = await this.merchantRepository.findOne({
          where: { user_id: userId },
        });
        if (!merchant)
          throw new NotFoundException(
            'Merchant profile not found for this user. Please contact support.',
          );
        merchantId = merchant.id;
      }

      // Validate store belongs to merchant
      const store = await this.storeRepository.findOne({
        where: { id: calculateDto.store_id, merchant_id: merchantId },
      });
      if (!store)
        throw new NotFoundException(
          'Store not found or does not belong to this merchant.',
        );

      const deliveryArea = await this.coverageAreaRepository.findOne({
        where: { id: calculateDto.delivery_coverage_area_id },
      });
      if (!deliveryArea)
        throw new NotFoundException(
          `Delivery coverage area not found. Please select a valid delivery area.`,
        );

      const pricingZone = this.determinePricingZone(deliveryArea);
      const pricingConfig = await this.pricingService.getActivePricing(
        calculateDto.store_id,
        pricingZone,
      );

      // Default pricing values
      let baseDeliveryCharge = 60;
      let codPercentage = 1.0;
      let discountPercentage: number | null = null;

      if (pricingConfig) {
        baseDeliveryCharge = Number(pricingConfig.delivery_charge);
        codPercentage = Number(pricingConfig.cod_percentage);
        discountPercentage = pricingConfig.discount_percentage
          ? Number(pricingConfig.discount_percentage)
          : null;
      } else {
        // Fallback pricing based on zone
        if (pricingZone === PricingZone.OUTSIDE_DHAKA) {
          baseDeliveryCharge = 120;
          codPercentage = 2.5;
        } else if (pricingZone === PricingZone.SUB_DHAKA) {
          baseDeliveryCharge = 80;
          codPercentage = 2.0;
        }
      }

      // Calculate fees
      const deliveryFee = baseDeliveryCharge;

      // COD fee: percentage of COD amount
      const codFee =
        codAmount > 0
          ? Math.round(((codAmount * codPercentage) / 100) * 100) / 100
          : 0;

      // Weight charge: Use zone-based step calculation
      const weightChargeResult =
        await this.pricingService.calculateWeightCharge(
          calculateDto.store_id,
          pricingZone,
          weight,
        );
      const weightCharge = weightChargeResult.weight_charge;

      // Subtotal before discount
      const subtotal = deliveryFee + codFee + weightCharge;

      // Discount: percentage of subtotal
      const discount = discountPercentage
        ? Math.round(((subtotal * discountPercentage) / 100) * 100) / 100
        : 0;

      // Total fee
      const totalFee = Math.round((subtotal - discount) * 100) / 100;

      this.logger.log(
        `[TOTAL PRICING] Zone: ${pricingZone}, Delivery: ৳${deliveryFee}, ` +
          `COD: ৳${codFee}, Weight: ৳${weightCharge}, Discount: -৳${discount}, Total: ৳${totalFee}`,
      );

      return {
        zone: pricingZone,
        delivery_fee: deliveryFee,
        cod_fee: codFee,
        weight_charge: weightCharge,
        discount: discount,
        total_fee: totalFee,
        breakdown: {
          base_delivery_charge: baseDeliveryCharge,
          // Zone-based weight charge details
          free_weight_kg: weightChargeResult.free_weight_kg,
          billable_weight_kg: weightChargeResult.billable_weight_kg,
          weight_step_kg: weightChargeResult.weight_step_kg,
          charge_per_step: weightChargeResult.charge_per_step,
          total_steps: weightChargeResult.total_steps,
          weight_charge_breakdown: weightChargeResult.breakdown,
          cod_percentage: codPercentage,
          discount_percentage: discountPercentage,
          weight_kg: weight,
          quantity: quantity,
          cod_amount: codAmount,
        },
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      this.logger.error(
        `[CALCULATE TOTAL PRICING ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to calculate total pricing. Please try again.',
      );
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatusFilter,
    merchantId?: string,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
    days?: number,
    paymentStatus?: PaymentStatus,
  ): Promise<PaginatedResponse<Parcel>> {
    try {
      const where: FindOptionsWhere<Parcel> = {};

      if (status === 'ACTIVE') {
        where.status = In(this.activeParcelStatuses);
      } else if (status) {
        where.status = status;
      }

      if (merchantId) {
        where.merchant_id = merchantId;
      }

      if (paymentStatus) {
        where.payment_status = paymentStatus;
      }

      if (days) {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);
        where.created_at = Between(startDate, endDate) as any;
      }

      const [items, total] = await this.parcelRepository.findAndCount({
        where,
        relations: [
          'merchant',
          'merchant.user',
          'store',
          'store.hub',
          'store.merchant',
          'store.merchant.user',
          'delivery_coverage_area',
          'customer',
          'assignedRider',
          'assignedRider.user',
          'assignedRider.hub',
          'currentHub',
          'originHub',
          'destinationHub',
          'thirdPartyProvider',
        ],
        order: { [sortBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      this.logger.log(`Retrieved ${items.length} parcels (Admin view)`);

      return { items, pagination };
    } catch (error: any) {
      this.logger.error(
        `[FIND ALL PARCELS ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcels. Please try again.',
      );
    }
  }

  /**
   * Get all parcels received by a hub (for hub managers)
    * Returns full non-sensitive parcel payloads for hub manager views
   */
  async findAllForHub(
    hubId: string,
    page: number = 1,
    limit: number = 20,
    status?: ParcelStatusFilter,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
    days?: number,
    paymentStatus?: PaymentStatus,
    search?: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      // Get all stores assigned to this hub
      const stores = await this.storeRepository.find({
        where: { hub_id: hubId },
        select: ['id'],
      });

      const storeIds = stores.map((store) => store.id);

      if (storeIds.length === 0) {
        // No stores assigned to this hub
        return {
          items: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      const queryBuilder = this.parcelRepository
        .createQueryBuilder('parcel')
        .leftJoinAndSelect('parcel.merchant', 'merchant')
        .leftJoinAndSelect('merchant.user', 'merchantUser')
        .leftJoinAndSelect('parcel.store', 'store')
        .leftJoinAndSelect('store.hub', 'storeHub')
        .leftJoinAndSelect('store.merchant', 'storeMerchant')
        .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
        .leftJoinAndSelect('parcel.delivery_coverage_area', 'deliveryCoverageArea')
        .leftJoinAndSelect('parcel.customer', 'customer')
        .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
        .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
        .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
        .leftJoinAndSelect('parcel.currentHub', 'currentHub')
        .leftJoinAndSelect('parcel.originHub', 'originHub')
        .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
        .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
        .where('parcel.store_id IN (:...storeIds)', { storeIds });

      if (status === 'ACTIVE') {
        queryBuilder.andWhere('parcel.status IN (:...activeStatuses)', {
          activeStatuses: this.activeParcelStatuses,
        });
      } else if (status) {
        queryBuilder.andWhere('parcel.status = :status', { status });
      } else {
        // Default receipt queue behavior
        queryBuilder.andWhere('parcel.status IN (:...defaultStatuses)', {
          defaultStatuses: [ParcelStatus.PENDING, ParcelStatus.PICKED_UP],
        });
      }

      if (paymentStatus) {
        queryBuilder.andWhere('parcel.payment_status = :paymentStatus', {
          paymentStatus,
        });
      }

      if (days) {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);
        queryBuilder.andWhere('parcel.created_at BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (search?.trim()) {
        const keyword = `%${search.trim()}%`;
        queryBuilder.andWhere(
          `(
            parcel.tracking_number ILIKE :keyword OR
            parcel.parcel_tx_id ILIKE :keyword OR
            parcel.customer_name ILIKE :keyword OR
            parcel.customer_phone ILIKE :keyword OR
            parcel.merchant_order_id ILIKE :keyword
          )`,
          { keyword },
        );
      }

      const allowedSortFields = new Set([
        'created_at',
        'updated_at',
        'tracking_number',
        'parcel_tx_id',
        'customer_name',
        'customer_phone',
        'cod_amount',
        'total_charge',
        'status',
      ]);
      const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'created_at';
      const safeOrder: 'ASC' | 'DESC' = order === 'ASC' ? 'ASC' : 'DESC';

      queryBuilder
        .orderBy(`parcel.${safeSortBy}`, safeOrder)
        .skip((page - 1) * limit)
        .take(limit);

      const [parcels, total] = await queryBuilder.getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      const pagination: PaginationMeta = {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      const items = parcels;

      this.logger.log(`Retrieved ${items.length} parcels for hub ${hubId}`);

      return { items, pagination };
    } catch (error: any) {
      this.logger.error(
        `[FIND PARCELS FOR HUB ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve parcels for hub. Please try again.',
      );
    }
  }

  async findInHubStatusesForHub(
    hubId: string,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'created_at',
    order: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<Parcel>> {
    // Get all stores assigned to this hub
    const stores = await this.storeRepository.find({
      where: { hub_id: hubId },
      select: ['id'],
    });

    const storeIds = stores.map((store) => store.id);

    if (storeIds.length === 0) {
      return {
        items: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const [items, total] = await this.parcelRepository.findAndCount({
      where: {
        store_id: In(storeIds),
        status: In([ParcelStatus.IN_HUB, ParcelStatus.RETURNED_TO_HUB]),
      },
      relations: [
        'merchant',
        'merchant.user',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'delivery_coverage_area',
        'customer',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'currentHub',
        'originHub',
        'destinationHub',
        'thirdPartyProvider',
      ],
      order: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return { items, pagination };
  }

  /**
   * Mark parcel as received by hub (PENDING/PICKED_UP → IN_HUB)
   */
  async markAsReceived(parcelId: string, hubId: string): Promise<Parcel> {
    try {
      const parcel = await this.parcelRepository.findOne({
        where: { id: parcelId },
        relations: ['store'],
      });

      if (!parcel) {
        throw new NotFoundException('Parcel not found');
      }

      // Verify parcel belongs to a store assigned to this hub
      if (!parcel.store || parcel.store.hub_id !== hubId) {
        throw new ForbiddenException('This parcel does not belong to your hub');
      }

      // Only allow marking as received if status is PENDING or PICKED_UP
      if (
        parcel.status !== ParcelStatus.PENDING &&
        parcel.status !== ParcelStatus.PICKED_UP
      ) {
        throw new BadRequestException(
          `Cannot mark parcel as received. Current status: ${parcel.status}`,
        );
      }

      parcel.status = ParcelStatus.IN_HUB;
      parcel.current_hub_id = hubId;

      // Set origin hub if not already set (first time receiving)
      if (!parcel.origin_hub_id) {
        parcel.origin_hub_id = hubId;
      }

      await this.parcelRepository.save(parcel);

      this.logger.log(
        `[PARCEL RECEIVED] Parcel ${parcel.tracking_number} marked as received by hub ${hubId}`,
      );

      return parcel;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `[MARK PARCEL RECEIVED ERROR] ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to mark parcel as received',
      );
    }
  }

  /**
   * Bulk mark parcels as received in hub
   * Returns success/failure for each parcel
   */
  async bulkMarkAsReceived(
    parcelIds: string[],
    hubId: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const parcelId of parcelIds) {
      try {
        const parcel = await this.parcelRepository.findOne({
          where: { id: parcelId },
          relations: ['store'],
        });

        if (!parcel) {
          results.push({
            parcel_id: parcelId,
            success: false,
            error: 'Parcel not found',
          });
          failedCount++;
          continue;
        }

        // Verify parcel belongs to a store assigned to this hub
        if (!parcel.store || parcel.store.hub_id !== hubId) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: 'Parcel does not belong to your hub',
          });
          failedCount++;
          continue;
        }

        // Only allow marking as received if status is PENDING or PICKED_UP
        if (
          parcel.status !== ParcelStatus.PENDING &&
          parcel.status !== ParcelStatus.PICKED_UP
        ) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: `Invalid status: ${parcel.status}. Must be PENDING or PICKED_UP`,
          });
          failedCount++;
          continue;
        }

        // Mark as received
        parcel.status = ParcelStatus.IN_HUB;
        parcel.current_hub_id = hubId;

        // Set origin hub if not already set (first time receiving)
        if (!parcel.origin_hub_id) {
          parcel.origin_hub_id = hubId;
        }

        await this.parcelRepository.save(parcel);

        results.push({
          parcel_id: parcelId,
          parcel_tx_id: parcel.parcel_tx_id,
          tracking_number: parcel.tracking_number,
          success: true,
        });
        successCount++;

        this.logger.log(
          `[PARCEL RECEIVED] Parcel ${parcel.tracking_number} marked as received by hub ${hubId}`,
        );
      } catch (error: any) {
        results.push({
          parcel_id: parcelId,
          success: false,
          error: error.message || 'Failed to mark as received',
        });
        failedCount++;
        this.logger.error(
          `[BULK RECEIVE ERROR] Parcel ${parcelId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `[BULK RECEIVE COMPLETED] Hub ${hubId}: ${successCount} success, ${failedCount} failed`,
    );

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  async update(
    id: string,
    updateParcelDto: UpdateParcelDto,
    actor: {
      role: UserRole;
      merchantId?: string | null;
      hubId?: string | null;
    },
  ): Promise<Parcel> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({ where: { id } });
      if (!parcel)
        throw new NotFoundException(`Parcel with ID ${id} not found`);

      const merchantEditableStatuses = [
        ParcelStatus.PENDING,
        ParcelStatus.PICKED_UP,
        ParcelStatus.OUT_FOR_PICKUP,
        ParcelStatus.IN_TRANSIT,
      ];

      const hubAdminEditableStatuses = [
        ParcelStatus.PENDING,
        ParcelStatus.PICKED_UP,
        ParcelStatus.OUT_FOR_PICKUP,
        ParcelStatus.IN_TRANSIT,
        ParcelStatus.IN_HUB,
        ParcelStatus.ASSIGNED_TO_RIDER,
        ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      ];

      if (actor.role === UserRole.MERCHANT) {
        if (!actor.merchantId || parcel.merchant_id !== actor.merchantId) {
          throw new ForbiddenException(
            'You do not have permission to update this parcel',
          );
        }

        if (!merchantEditableStatuses.includes(parcel.status)) {
          throw new BadRequestException(
            `Merchant can edit only before hub receives parcel. Current status: ${parcel.status}`,
          );
        }
      } else if (actor.role === UserRole.HUB_MANAGER) {
        if (!actor.hubId) {
          throw new ForbiddenException('Hub ID is required');
        }

        const parcelWithStore = await this.parcelRepository.findOne({
          where: { id },
          relations: ['store'],
        });

        if (!parcelWithStore) {
          throw new NotFoundException(`Parcel with ID ${id} not found`);
        }

        const isPhysicallyAtHub = parcelWithStore.current_hub_id === actor.hubId;
        const belongsToHubStore = parcelWithStore.store?.hub_id === actor.hubId;

        if (!isPhysicallyAtHub && !belongsToHubStore) {
          throw new ForbiddenException('This parcel does not belong to your hub');
        }

        if (!hubAdminEditableStatuses.includes(parcelWithStore.status)) {
          throw new BadRequestException(
            `Hub/Admin can edit only before rider starts delivery. Current status: ${parcelWithStore.status}`,
          );
        }
      } else if (actor.role === UserRole.ADMIN) {
        if (!hubAdminEditableStatuses.includes(parcel.status)) {
          throw new BadRequestException(
            `Hub/Admin can edit only before rider starts delivery. Current status: ${parcel.status}`,
          );
        }
      } else {
        throw new ForbiddenException('You do not have permission to update this parcel');
      }

      if (updateParcelDto.customer_phone) {
        const phoneRegex = /^01[0-9]{9}$/;
        if (!phoneRegex.test(updateParcelDto.customer_phone))
          throw new BadRequestException(
            'Invalid customer phone number. Must be in format: 01XXXXXXXXX',
          );
      }

      if (
        updateParcelDto.product_weight !== undefined &&
        updateParcelDto.product_weight < 0
      )
        throw new BadRequestException('Product weight cannot be negative.');
      if (updateParcelDto.store_id) {
        const targetMerchantId = actor.merchantId || parcel.merchant_id;
        // merchantId is the merchant entity ID, use it directly for store lookup
        const store = await this.storeRepository.findOne({
          where: { id: updateParcelDto.store_id, merchant_id: targetMerchantId },
        });
        if (!store)
          throw new NotFoundException(
            'Store not found or does not belong to this merchant.',
          );

        if (actor.role === UserRole.HUB_MANAGER && actor.hubId && store.hub_id !== actor.hubId) {
          throw new ForbiddenException('Store does not belong to your hub');
        }
      }
      if (updateParcelDto.delivery_coverage_area_id) {
        const deliveryArea = await this.coverageAreaRepository.findOne({
          where: { id: updateParcelDto.delivery_coverage_area_id },
        });
        if (!deliveryArea)
          throw new NotFoundException(
            'Delivery coverage area not found. Please select a valid delivery area.',
          );
      }
      Object.assign(parcel, updateParcelDto);

      // Auto-set is_cod and cod_amount based on product_price if it's being updated
      if (updateParcelDto.product_price !== undefined) {
        parcel.cod_amount = updateParcelDto.product_price;
        parcel.is_cod = updateParcelDto.product_price > 0;
      }

      let updatedParcel;
      try {
        updatedParcel = await this.parcelRepository.save(parcel);
      } catch (error: any) {
        this.logger.error(
          `[PARCEL UPDATE ERROR] ${error.message}`,
          error.stack,
        );
        if (error.code === '23503')
          throw new BadRequestException(
            'Invalid reference data. Please check store ID and delivery area.',
          );
        throw new InternalServerErrorException(
          'Failed to update parcel. Please try again or contact support.',
        );
      }
      this.logger.log(
        `[PARCEL UPDATED] ID: ${id}, Role: ${actor.role}, Merchant: ${parcel.merchant_id}`,
      );
      return updatedParcel;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[UPDATE PARCEL ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the parcel. Please try again.',
      );
    }
  }

  async remove(
    id: string,
    merchantId: string,
    isAdmin: boolean = false,
  ): Promise<{ message: string }> {
    try {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id))
        throw new BadRequestException('Invalid parcel ID format');
      const parcel = await this.parcelRepository.findOne({ where: { id } });
      if (!parcel)
        throw new NotFoundException(`Parcel with ID ${id} not found`);
      // merchant_id references merchants table, so compare with merchantId from JWT
      if (!isAdmin && parcel.merchant_id !== merchantId)
        throw new ForbiddenException(
          'You do not have permission to delete this parcel',
        );
      if (
        parcel.status === ParcelStatus.DELIVERED ||
        parcel.status === ParcelStatus.IN_TRANSIT
      )
        throw new BadRequestException(
          `Cannot delete parcel with status: ${parcel.status}. Please contact support.`,
        );
      try {
        await this.parcelRepository.remove(parcel);
      } catch (error: any) {
        this.logger.error(
          `[PARCEL DELETE ERROR] ${error.message}`,
          error.stack,
        );
        throw new InternalServerErrorException(
          'Failed to delete parcel. Please try again or contact support.',
        );
      }
      this.logger.log(
        `[PARCEL DELETED] ID: ${id}, Tracking: ${parcel.tracking_number}, Merchant: ${merchantId}`,
      );
      return {
        message: `Parcel ${parcel.tracking_number} has been successfully deleted`,
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      )
        throw error;
      this.logger.error(`[DELETE PARCEL ERROR] ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the parcel. Please try again.',
      );
    }
  }

  /**
   * Get parcels ready for rider assignment (status: IN_HUB)
   */
  async getParcelsForAssignment(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    // Get parcels that are IN_HUB status and not assigned to any rider.
    // current_hub_id is the source of truth for physical location.
    // Fallback to pickup/store hub only when current_hub_id is NULL (legacy rows).
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.pickupRequest', 'pickupRequest')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .leftJoinAndSelect(
        'parcel.delivery_coverage_area',
        'delivery_coverage_area',
      )
      .where('parcel.status = :status', { status: ParcelStatus.IN_HUB })
      .andWhere('parcel.assigned_rider_id IS NULL')
      .andWhere(
        '((parcel.current_hub_id IS NOT NULL AND parcel.current_hub_id = :hubId) OR (parcel.current_hub_id IS NULL AND (pickupRequest.hub_id = :hubId OR store.hub_id = :hubId)))',
        { hubId },
      )
      .orderBy('parcel.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return { parcels, total };
  }

  /**
   * Assign parcel to rider (Hub Manager only)
   */
  async assignToRider(
    parcelId: string,
    assignDto: AssignParcelToRiderDto,
    hubId: string,
  ) {
    // Find parcel - load all required fields to avoid null constraint issues
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel has merchant_id (required field)
    if (!parcel.merchant_id) {
      throw new BadRequestException('Parcel has invalid merchant data');
    }

    // Verify parcel is in the hub manager's hub (check current_hub_id)
    if (!parcel.current_hub_id || parcel.current_hub_id !== hubId) {
      throw new ForbiddenException('You can only assign parcels from your hub');
    }

    // Verify parcel status is IN_HUB or DELIVERY_RESCHEDULED
    const assignableStatuses = [
      ParcelStatus.IN_HUB,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];
    if (!assignableStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Parcel must be in IN_HUB or DELIVERY_RESCHEDULED status. Current status: ${parcel.status}`,
      );
    }

    // Verify parcel is not already assigned
    if (parcel.assigned_rider_id) {
      throw new ConflictException('Parcel is already assigned to a rider');
    }

    // Find rider
    const rider = await this.riderRepository.findOne({
      where: { id: assignDto.rider_id },
      relations: ['hub', 'user'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // Verify rider is active
    if (!rider.is_active) {
      throw new BadRequestException('Rider is not active');
    }

    // Verify rider belongs to the same hub
    if (rider.hub_id !== hubId) {
      throw new BadRequestException('Rider must belong to your hub');
    }

    // Assign parcel to rider - use update to avoid relation loading issues
    // Increment reschedule_count if parcel was in DELIVERY_RESCHEDULED status
    const updateData: any = {
      assigned_rider_id: rider.id,
      assigned_at: new Date(),
      status: ParcelStatus.ASSIGNED_TO_RIDER,
    };

    if (parcel.status === ParcelStatus.DELIVERY_RESCHEDULED) {
      updateData.reschedule_count = (parcel.reschedule_count || 0) + 1;
    }

    await this.parcelRepository.update(parcelId, updateData);

    // Reload parcel with updated data
    const updatedParcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
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
    });

    if (!updatedParcel) {
      throw new NotFoundException('Parcel not found after update');
    }

    this.logger.log(
      `[PARCEL ASSIGNED] Parcel: ${updatedParcel.tracking_number}, Rider: ${rider.user.full_name}, Hub: ${hubId}`,
    );

    await this.sendAssignForRiderSms(updatedParcel, rider);

    return updatedParcel;
  }

  /**
   * Assign parcels to rider (Hub Manager only)
   * Supports both single parcel and bulk assignment
   *
   * Usage:
   * - Single: { rider_id: "...", parcel_id: "..." }
   * - Bulk:   { rider_id: "...", parcel_ids: ["...", "..."] }
   */
  async bulkAssignToRider(
    bulkAssignDto: BulkAssignParcelsToRiderDto,
    hubId: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const { rider_id, parcel_id, parcel_ids: parcelIdsArray } = bulkAssignDto;

    // Normalize: support both single parcel_id and parcel_ids array
    let parcel_ids: string[];
    if (parcelIdsArray && parcelIdsArray.length > 0) {
      parcel_ids = parcelIdsArray;
    } else if (parcel_id) {
      parcel_ids = [parcel_id];
    } else {
      throw new BadRequestException(
        'Either parcel_id or parcel_ids must be provided',
      );
    }

    // Verify rider exists and is active
    const rider = await this.riderRepository.findOne({
      where: { id: rider_id },
      relations: ['hub', 'user'],
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    if (!rider.is_active) {
      throw new BadRequestException('Rider is not active');
    }

    // Verify rider belongs to the same hub
    if (rider.hub_id !== hubId) {
      throw new BadRequestException('Rider must belong to your hub');
    }

    const results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let failedCount = 0;

    // Process each parcel
    for (const parcelId of parcel_ids) {
      try {
        // Find parcel
        const parcel = await this.parcelRepository.findOne({
          where: { id: parcelId },
          relations: ['merchant', 'customer', 'store'],
        });

        if (!parcel) {
          results.push({
            parcel_id: parcelId,
            success: false,
            error: 'Parcel not found',
          });
          failedCount++;
          continue;
        }

        // Verify parcel has merchant_id (required field)
        if (!parcel.merchant_id) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: 'Parcel has invalid merchant data',
          });
          failedCount++;
          continue;
        }

        // Verify parcel is in the hub manager's hub (check current_hub_id)
        if (!parcel.current_hub_id || parcel.current_hub_id !== hubId) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: 'Parcel is not in your hub',
          });
          failedCount++;
          continue;
        }

        // Verify parcel status is IN_HUB or DELIVERY_RESCHEDULED
        const assignableStatuses = [
          ParcelStatus.IN_HUB,
          ParcelStatus.DELIVERY_RESCHEDULED,
        ];
        if (!assignableStatuses.includes(parcel.status)) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: `Parcel must be in IN_HUB or DELIVERY_RESCHEDULED status. Current status: ${parcel.status}`,
          });
          failedCount++;
          continue;
        }

        // Verify parcel is not already assigned
        if (parcel.assigned_rider_id) {
          results.push({
            parcel_id: parcelId,
            parcel_tx_id: parcel.parcel_tx_id,
            tracking_number: parcel.tracking_number,
            success: false,
            error: 'Parcel is already assigned to a rider',
          });
          failedCount++;
          continue;
        }

        // Assign parcel to rider
        // Increment reschedule_count if parcel was in DELIVERY_RESCHEDULED status
        const updateData: any = {
          assigned_rider_id: rider.id,
          assigned_at: new Date(),
          status: ParcelStatus.ASSIGNED_TO_RIDER,
        };

        if (parcel.status === ParcelStatus.DELIVERY_RESCHEDULED) {
          updateData.reschedule_count = (parcel.reschedule_count || 0) + 1;
        }

        await this.parcelRepository.update(parcelId, updateData);

        results.push({
          parcel_id: parcelId,
          parcel_tx_id: parcel.parcel_tx_id,
          tracking_number: parcel.tracking_number,
          success: true,
        });
        successCount++;

        this.logger.log(
          `[BULK ASSIGN] Parcel: ${parcel.tracking_number}, Rider: ${rider.user.full_name}`,
        );

        await this.sendAssignForRiderSms(parcel, rider);
      } catch (error: any) {
        results.push({
          parcel_id: parcelId,
          success: false,
          error: error.message || 'Unknown error',
        });
        failedCount++;
      }
    }

    this.logger.log(
      `[BULK ASSIGN COMPLETE] Rider: ${rider.user.full_name}, Success: ${successCount}, Failed: ${failedCount}, Hub: ${hubId}`,
    );

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Get rider's assigned parcels (for rider app)
   *
   * Rider App Sections:
   * - DELIVERY: pending (ASSIGNED_TO_RIDER, OUT_FOR_DELIVERY), completed (DELIVERED)
   * - RETURN: pending (FAILED_DELIVERY), completed (RETURNED_TO_HUB)
   *
   * @param riderId - Rider ID
   * @param status - Specific parcel status filter (overrides filter)
   * @param filter - Section filter: delivery_pending, delivery_completed, return_pending, return_completed, all
   */
  async getRiderParcels(
    riderId: string,
    status?: ParcelStatus,
    filter?: string,
  ) {
    const where: any = { assigned_rider_id: riderId };
    const completedDeliveryStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    // If specific status is provided, use it (takes priority)
    if (status) {
      where.status = status;
      // Keep completed-delivery views clean after COD settlement
      if (completedDeliveryStatuses.includes(status)) {
        where.cod_cleared_at = IsNull();
      }
    } else if (filter) {
      switch (filter) {
        case 'pickup_pending':
          // Pickup section - Pending (assigned, needs to pick from hub)
          where.status = ParcelStatus.ASSIGNED_TO_RIDER;
          break;
        case 'delivery_pending':
          // Delivery section - Pending (rider has parcel, actively delivering)
          where.status = ParcelStatus.OUT_FOR_DELIVERY;
          break;
        case 'delivery_completed':
          // Delivery section - Completed
          where.status = ParcelStatus.DELIVERED;
          // Hide parcels after hub has collected COD from rider
          where.cod_cleared_at = IsNull();
          break;
        case 'return_pending':
          // Return section - Pending (failed, needs to return to hub)
          where.status = ParcelStatus.FAILED_DELIVERY;
          break;
        case 'return_completed':
          // Return section - Completed (returned to hub)
          where.status = ParcelStatus.RETURNED_TO_HUB;
          break;
        case 'all':
          // All parcels - no status filter
          break;
        default:
          // Default: show active parcels (pickup + delivery pending)
          where.status = In([
            ParcelStatus.ASSIGNED_TO_RIDER,
            ParcelStatus.OUT_FOR_DELIVERY,
          ]);
      }
    } else {
      // Default: show active parcels (pickup + delivery pending)
      where.status = In([
        ParcelStatus.ASSIGNED_TO_RIDER,
        ParcelStatus.OUT_FOR_DELIVERY,
      ]);
    }

    const parcels = await this.parcelRepository.find({
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
      order: { assigned_at: 'DESC' },
    });

    return parcels;
  }

  /**
   * Get rider's deliveries - organized by tab
   * Pending: ASSIGNED_TO_RIDER (assigned by hub, ready to deliver)
   * Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN
   */
  async getRiderDeliveries(riderId: string, tab: 'pending' | 'completed') {
    const where: any = { assigned_rider_id: riderId };

    if (tab === 'pending') {
      // Parcels assigned to rider, ready to deliver
      where.status = ParcelStatus.ASSIGNED_TO_RIDER;
    } else {
      // Completed includes successful delivery outcomes
      where.status = In([
        ParcelStatus.DELIVERED,
        ParcelStatus.PARTIAL_DELIVERY,
        ParcelStatus.EXCHANGE,
        ParcelStatus.PAID_RETURN,
      ]);
      // Do not show parcels already cleared (COD collected by hub from rider)
      where.cod_cleared_at = IsNull();
    }

    return this.parcelRepository.find({
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
      order: { updated_at: 'DESC' },
    });
  }

  /**
   * Get rider's returns - organized by tab
   * Pending: RETURNED, DELIVERY_RESCHEDULED (need to return to hub or reattempt)
   * Completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
   */
  async getRiderReturns(riderId: string, tab: 'pending' | 'completed') {
    const where: any = { assigned_rider_id: riderId };

    if (tab === 'pending') {
      // Parcels that need to be returned to hub or rescheduled
      where.status = In([
        ParcelStatus.RETURNED,
        ParcelStatus.DELIVERY_RESCHEDULED,
      ]);
    } else {
      // Parcels returned to hub or merchant
      where.status = In([
        ParcelStatus.RETURNED_TO_HUB,
        ParcelStatus.RETURN_TO_MERCHANT,
      ]);
    }

    return this.parcelRepository.find({
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
      order: { updated_at: 'DESC' },
    });
  }

  /**
   * Get finance summary parcel detail for rider (status-agnostic lookup).
   */
  async getFinanceSummaryParcelDetail(parcelId: string, riderId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    return parcel;
  }

  /**
   * Get single delivery details for rider by tab context.
   */
  async getRiderDeliveryDetail(
    parcelId: string,
    riderId: string,
    tab: 'pending' | 'completed' | 'all' = 'all',
  ): Promise<Parcel> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    const pendingStatuses = [ParcelStatus.ASSIGNED_TO_RIDER];
    const completedStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    const allowedStatuses =
      tab === 'pending'
        ? pendingStatuses
        : tab === 'completed'
          ? completedStatuses
          : [...pendingStatuses, ...completedStatuses];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Parcel status ${parcel.status} is not available in ${tab} delivery tab`,
      );
    }

    // Keep this consistent with the completed list endpoint behavior.
    if (tab === 'completed' && parcel.cod_cleared_at) {
      throw new BadRequestException(
        'This parcel is already cleared and is not available in completed deliveries',
      );
    }

    return parcel;
  }

  /**
   * Get single return details for rider by tab context.
   */
  async getRiderReturnDetail(
    parcelId: string,
    riderId: string,
    tab: 'pending' | 'completed' | 'all' = 'all',
  ): Promise<Parcel> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    const pendingStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.DELIVERY_RESCHEDULED,
    ];
    const completedStatuses = [
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
    ];

    const allowedStatuses =
      tab === 'pending'
        ? pendingStatuses
        : tab === 'completed'
          ? completedStatuses
          : [...pendingStatuses, ...completedStatuses];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Parcel status ${parcel.status} is not available in ${tab} return tab`,
      );
    }

    return parcel;
  }

  /**
   * Rider accepts parcel assignment (optional - for tracking when rider picks up from hub)
   * Note: This is optional. Rider can directly initiate delivery without accepting first.
   */
  async riderAcceptParcel(parcelId: string, riderId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.ASSIGNED_TO_RIDER) {
      throw new BadRequestException(
        `Cannot accept parcel with status: ${parcel.status}`,
      );
    }

    if (parcel.rider_accepted_at) {
      throw new BadRequestException('Parcel already accepted');
    }

    // Just mark when rider picked up from hub (no status change)
    parcel.rider_accepted_at = new Date();

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL ACCEPTED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Get parcel info for delivery (shows COD amount to rider)
   */
  async getParcelForDelivery(parcelId: string, riderId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Parcel is not out for delivery. Current status: ${parcel.status}`,
      );
    }

    return parcel;
  }

  /**
   * Rider delivers parcel (DEPRECATED - use delivery-verifications flow)
   */
  async riderDeliverParcel(
    parcelId: string,
    riderId: string,
    deliveryProof?: string,
    signature?: string,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Cannot deliver parcel with status: ${parcel.status}`,
      );
    }

    parcel.status = ParcelStatus.DELIVERED;
    parcel.delivered_at = new Date();
    parcel.payment_status = PaymentStatus.PAID;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL DELIVERED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Rider marks delivery as failed
   */
  async riderFailedDelivery(
    parcelId: string,
    riderId: string,
    reason: string,
    rescheduleDate?: Date,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Cannot mark failed for parcel with status: ${parcel.status}`,
      );
    }

    parcel.status = ParcelStatus.FAILED_DELIVERY;
    parcel.return_reason = reason;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[DELIVERY FAILED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}, Reason: ${reason}`,
    );

    return parcel;
  }

  /**
   * Rider returns parcel to hub
   * Called after OTP verification marks parcel as RETURNED or PAID_RETURN
   */
  async riderReturnParcel(
    parcelId: string,
    riderId: string,
    returnReason: string,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    // Only allow return for OTP-verified return statuses
    const allowedStatuses = [ParcelStatus.RETURNED, ParcelStatus.PAID_RETURN];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot return parcel with status: ${parcel.status}. ` +
          `Use delivery verification to mark as RETURNED or PAID_RETURN first.`,
      );
    }

    parcel.status = ParcelStatus.RETURNED_TO_HUB;
    parcel.return_reason = returnReason;
    parcel.assigned_rider_id = null as any;
    parcel.assigned_at = null as any;
    parcel.rider_accepted_at = null as any;
    parcel.out_for_delivery_at = null as any;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PARCEL RETURNED TO HUB] Parcel: ${parcel.tracking_number}, Rider: ${riderId}`,
    );

    return parcel;
  }

  /**
   * Rider reports delivery issue to hub manager/admin queue
   */
  async riderReportIssue(
    parcelId: string,
    riderId: string,
    issueType: ParcelIssueType,
    note: string,
  ) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
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
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    const blockedStatuses = [
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.RETURN_TO_MERCHANT,
      ParcelStatus.CANCELLED,
    ];

    if (blockedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot report issue for parcel with status: ${parcel.status}`,
      );
    }

    const normalizedNote = note.trim();
    if (!normalizedNote) {
      throw new BadRequestException('Issue note is required');
    }

    parcel.issue_type = issueType;
    parcel.issue_description = normalizedNote;
    parcel.issue_reported_by_id = riderId;
    parcel.issue_reported_at = new Date();
    parcel.is_issue_resolved = false;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[DELIVERY ISSUE REPORTED] Parcel: ${parcel.tracking_number}, Rider: ${riderId}, Type: ${issueType}`,
    );

    return parcel;
  }

  /**
   * Get all hubs (for hub managers to see transfer destinations)
   */
  async getAllHubs(currentHubId?: string) {
    const hubs = await this.hubRepository.find({
      select: [
        'id',
        'hub_code',
        'branch_name',
        'area',
        'address',
        'manager_name',
        'manager_phone',
      ],
      order: { branch_name: 'ASC' },
    });

    // Exclude current hub if provided
    if (currentHubId) {
      return hubs.filter((hub) => hub.id !== currentHubId);
    }

    return hubs;
  }

  /**
   * Transfer parcel to another hub (Hub Manager)
   */
  async transferParcelToHub(
    parcelId: string,
    transferDto: TransferParcelDto,
    currentHubId: string,
  ): Promise<Parcel> {
    // Find parcel
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: ['currentHub', 'store', 'customer'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel is in current hub
    const belongsToHubStore = parcel.store?.hub_id === currentHubId;
    const isPhysicallyAtHub = parcel.current_hub_id === currentHubId;

    if (!isPhysicallyAtHub && !belongsToHubStore) {
      throw new ForbiddenException('This parcel does not belong to your hub');
    }

    // Verify parcel status allows transfer
    const allowedStatuses = [ParcelStatus.IN_HUB, ParcelStatus.RETURNED_TO_HUB];
    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot transfer parcel with status: ${parcel.status}. Parcel must be IN_HUB or RETURNED_TO_HUB`,
      );
    }

    // Verify destination hub exists and is active
    const destinationHub = await this.hubRepository.findOne({
      where: { id: transferDto.destination_hub_id },
    });

    if (!destinationHub) {
      throw new NotFoundException('Destination hub not found');
    }

    // Cannot transfer to same hub
    if (transferDto.destination_hub_id === currentHubId) {
      throw new BadRequestException('Cannot transfer parcel to the same hub');
    }

    // Set origin hub if not already set
    if (!parcel.origin_hub_id) {
      parcel.origin_hub_id = currentHubId;
    }

    // Update parcel for transfer
    parcel.current_hub_id = null as any; // In transit
    parcel.destination_hub_id = transferDto.destination_hub_id;
    parcel.is_inter_hub_transfer = true;
    parcel.transferred_at = new Date();
    parcel.transfer_notes = transferDto.transfer_notes || null;
    parcel.status = ParcelStatus.IN_TRANSIT;

    // Clear rider assignment if any
    parcel.assigned_rider_id = null as any;
    parcel.assigned_at = null as any;
    parcel.rider_accepted_at = null as any;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[HUB TRANSFER] Parcel: ${parcel.tracking_number}, From Hub: ${currentHubId}, To Hub: ${transferDto.destination_hub_id}`,
    );

    return parcel;
  }

  /**
   * Bulk Transfer parcels to another hub
   */
  async transferParcelsBulk(
    dto: BulkTransferDto,
    currentHubId: string,
  ): Promise<{ transferred_count: number; errors: any[] }> {
    const { parcel_ids, destination_hub_id, transfer_notes } = dto;

    // FIX 1: Explicitly type the errors array
    const errors: { id: string; tracking_number?: string; error: string }[] =
      [];

    // FIX 2: Explicitly type the successIds array
    const successIds: string[] = [];

    // 1. Validate Destination Hub
    if (destination_hub_id === currentHubId) {
      throw new BadRequestException('Cannot transfer parcels to the same hub');
    }

    const destinationHub = await this.hubRepository.findOne({
      where: { id: destination_hub_id },
    });

    if (!destinationHub) {
      throw new NotFoundException('Destination hub not found');
    }

    // 2. Fetch all requested parcels
    const parcels = await this.parcelRepository.find({
      where: { id: In(parcel_ids) },
      relations: ['store'],
    });

    // 3. Process each parcel
    const allowedStatuses = [ParcelStatus.IN_HUB, ParcelStatus.RETURNED_TO_HUB];

    // FIX 3: Explicitly type the promises array
    const updatePromises: Promise<Parcel>[] = [];

    for (const id of parcel_ids) {
      const parcel = parcels.find((p) => p.id === id);

      // --- Validation Checks ---
      if (!parcel) {
        errors.push({ id, error: 'Parcel not found' });
        continue;
      }

      const isPhysicallyAtHub = parcel.current_hub_id === currentHubId;
      const belongsToHubStore = parcel.store?.hub_id === currentHubId;

      if (!isPhysicallyAtHub && !belongsToHubStore) {
        errors.push({
          id,
          tracking_number: parcel.tracking_number,
          error: 'Parcel does not belong to your hub',
        });
        continue;
      }

      if (!allowedStatuses.includes(parcel.status)) {
        errors.push({
          id,
          tracking_number: parcel.tracking_number,
          error: `Invalid status: ${parcel.status}. Must be IN_HUB or RETURNED_TO_HUB`,
        });
        continue;
      }

      // --- Prepare Update ---
      // Set origin hub if not already set
      if (!parcel.origin_hub_id) {
        parcel.origin_hub_id = currentHubId;
      }

      parcel.current_hub_id = null; // In transit
      parcel.destination_hub_id = destination_hub_id;
      parcel.is_inter_hub_transfer = true;
      parcel.transferred_at = new Date();
      parcel.transfer_notes = transfer_notes || null;
      parcel.status = ParcelStatus.IN_TRANSIT;

      // Clear rider assignment
      parcel.assigned_rider_id = null;
      parcel.assigned_at = null;
      parcel.rider_accepted_at = null;

      successIds.push(parcel.id);
      updatePromises.push(this.parcelRepository.save(parcel));
    }

    // 4. Execute all valid updates
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    this.logger.log(
      `[BULK TRANSFER] Transferred ${successIds.length} parcels from Hub ${currentHubId} to Hub ${destination_hub_id}`,
    );

    return {
      transferred_count: successIds.length,
      errors,
    };
  }

  /**
   * Get parcels in transit to this hub (Hub Manager)
   */
  async getIncomingParcels(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.destination_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', { status: ParcelStatus.IN_TRANSIT })
      .andWhere('parcel.received_at_destination_hub IS NULL')
      .orderBy('parcel.transferred_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return {
      parcels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Accept incoming parcel at destination hub (Hub Manager)
   */
  async acceptIncomingParcel(parcelId: string, hubId: string): Promise<Parcel> {
    // Find parcel
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: [
        'merchant',
        'merchant.user',
        'originHub',
        'destinationHub',
        'currentHub',
        'store',
        'store.hub',
        'store.merchant',
        'store.merchant.user',
        'customer',
        'assignedRider',
        'assignedRider.user',
        'assignedRider.hub',
        'delivery_coverage_area',
        'thirdPartyProvider',
      ],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found');
    }

    // Verify parcel is destined for this hub
    if (parcel.destination_hub_id !== hubId) {
      throw new ForbiddenException('This parcel is not destined for your hub');
    }

    // Verify parcel is in transit
    if (parcel.status !== ParcelStatus.IN_TRANSIT) {
      throw new BadRequestException(
        `Cannot accept parcel with status: ${parcel.status}. Parcel must be IN_TRANSIT`,
      );
    }

    // Verify not already received
    if (parcel.received_at_destination_hub) {
      throw new ConflictException('Parcel has already been received');
    }

    // Accept parcel
    parcel.current_hub_id = hubId;
    parcel.destination_hub_id = null as any;
    parcel.received_at_destination_hub = new Date();
    parcel.status = ParcelStatus.IN_HUB;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[HUB RECEIVE] Parcel: ${parcel.tracking_number}, Received at Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Bulk Accept incoming parcels at destination hub
   */
  async acceptIncomingParcelsBulk(
    dto: BulkAcceptDto,
    currentHubId: string,
  ): Promise<{ accepted_count: number; errors: any[] }> {
    const { parcel_ids } = dto;

    // Explicit types for arrays
    const errors: { id: string; tracking_number?: string; error: string }[] =
      [];
    const successIds: string[] = [];
    const updatePromises: Promise<Parcel>[] = [];

    // 1. Fetch all requested parcels
    const parcels = await this.parcelRepository.find({
      where: { id: In(parcel_ids) },
    });

    // 2. Process each parcel
    for (const id of parcel_ids) {
      const parcel = parcels.find((p) => p.id === id);

      // --- Validation Checks ---
      if (!parcel) {
        errors.push({ id, error: 'Parcel not found' });
        continue;
      }

      // Verify parcel is destined for this hub
      if (parcel.destination_hub_id !== currentHubId) {
        errors.push({
          id,
          tracking_number: parcel.tracking_number,
          error: 'This parcel is not destined for your hub',
        });
        continue;
      }

      // Verify parcel is in transit
      if (parcel.status !== ParcelStatus.IN_TRANSIT) {
        errors.push({
          id,
          tracking_number: parcel.tracking_number,
          error: `Invalid status: ${parcel.status}. Parcel must be IN_TRANSIT`,
        });
        continue;
      }

      // Verify not already received
      if (parcel.received_at_destination_hub) {
        errors.push({
          id,
          tracking_number: parcel.tracking_number,
          error: 'Parcel has already been received',
        });
        continue;
      }

      // --- Prepare Update ---
      parcel.current_hub_id = currentHubId;
      parcel.destination_hub_id = null; // Clear destination as it arrived
      parcel.received_at_destination_hub = new Date();
      parcel.status = ParcelStatus.IN_HUB;

      // We assume is_inter_hub_transfer stays true to track history,
      // or you can set it to false if the journey ends here.
      // Usually, we keep it true or clear it depending on business logic.
      // For now, leaving it as is.

      successIds.push(parcel.id);
      updatePromises.push(this.parcelRepository.save(parcel));
    }

    // 3. Execute all valid updates
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    this.logger.log(
      `[BULK RECEIVE] Hub ${currentHubId} received ${successIds.length} parcels`,
    );

    return {
      accepted_count: successIds.length,
      errors,
    };
  }

  /**
   * Get parcels transferred from this hub (Hub Manager)
   */
  async getOutgoingParcels(
    hubId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.origin_hub_id = :hubId', { hubId })
      .andWhere('parcel.is_inter_hub_transfer = :isTransfer', {
        isTransfer: true,
      })
      .orderBy('parcel.transferred_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [parcels, total] = await queryBuilder.getManyAndCount();

    return {
      parcels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get delivery outcomes for Hub Manager
   * Shows parcels with: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN, RETURNED
   * AFTER COD has been collected from the rider (cod_cleared_at IS NOT NULL)
   *
   * WHY: Hub managers need to track completed deliveries that have been settled
   * - Track cleared deliveries for record keeping
   * - Monitor completed transactions
   * - View settled parcels that no longer need collection
   */
  async getDeliveryOutcomes(
    hubId: string,
    options: {
      status?: ParcelStatus;
      zone?: string;
      merchantId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, zone, merchantId, page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Define all successful delivery statuses (parcels that have been completed)
    // These are parcels that have gone through the delivery process and COD has been collected
    const completedStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.RETURNED,
    ];

    // Build query
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.cod_cleared_at IS NOT NULL'); // Only show parcels AFTER COD collection

    // Filter by specific status if provided
    if (status && completedStatuses.includes(status)) {
      queryBuilder.andWhere('parcel.status = :status', { status });
    } else {
      queryBuilder.andWhere('parcel.status IN (:...statuses)', {
        statuses: completedStatuses,
      });
    }

    // Filter by zone (using coverage area zone or area field)
    if (zone) {
      queryBuilder.andWhere(
        '(coverageArea.zone ILIKE :zone OR coverageArea.area ILIKE :zone)',
        { zone: `%${zone}%` },
      );
    }

    // Filter by merchant
    if (merchantId) {
      queryBuilder.andWhere('parcel.merchant_id = :merchantId', { merchantId });
    }

    // Order by most recent first
    queryBuilder.orderBy('parcel.updated_at', 'DESC');

    // Get total count for pagination
    const total = await queryBuilder.getCount();

    // Calculate total collectable amount (COD collected from completed deliveries)
    const successfulStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
    ];

    const collectableQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .select('SUM(parcel.cod_collected_amount)', 'total')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.status IN (:...statuses)', {
        statuses: successfulStatuses,
      })
      .andWhere('parcel.cod_cleared_at IS NOT NULL'); // Only already-cleared parcels

    if (merchantId) {
      collectableQuery.andWhere('parcel.merchant_id = :merchantId', {
        merchantId,
      });
    }

    const collectableResult = await collectableQuery.getRawOne();
    const totalCollectableAmount = Number(collectableResult?.total || 0);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const parcels = await queryBuilder.getMany();

    // Transform parcels to response format
    const items = parcels.map((parcel) => this.toDeliveryOutcomeItem(parcel));

    return {
      parcels: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total_collectable_amount: totalCollectableAmount,
      },
    };
  }

  /**
   * Get COD pending parcels for a rider
   * Shows parcels BEFORE rider has cleared COD with hub manager (cod_cleared_at IS NULL)
   * Returns total collectable amount from completed deliveries awaiting collection
   */
  async getRiderClearedParcels(
    hubId: string,
    riderId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Successful delivery statuses (completed deliveries with COD)
    const successfulStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    // Build query for cleared parcels
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.assigned_rider_id = :riderId', { riderId })
      .andWhere('parcel.cod_cleared_at IS NULL') // Only not-yet-cleared parcels
      .andWhere('parcel.status IN (:...statuses)', {
        statuses: successfulStatuses,
      });

    // Order by delivery date (most recent first)
    queryBuilder.orderBy('parcel.delivered_at', 'DESC');

    // Get total count for pagination
    const total = await queryBuilder.getCount();

    // Calculate total collectable amount (all not-yet-cleared parcels for this rider)
    const collectableQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .select('SUM(parcel.cod_collected_amount)', 'total')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.assigned_rider_id = :riderId', { riderId })
      .andWhere('parcel.cod_cleared_at IS NULL')
      .andWhere('parcel.status IN (:...statuses)', {
        statuses: successfulStatuses,
      });

    const collectableResult = await collectableQuery.getRawOne();
    const totalCollectableAmount = Number(collectableResult?.total || 0);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const parcels = await queryBuilder.getMany();

    // Transform parcels to response format
    const items = parcels.map((parcel) => this.toDeliveryOutcomeItem(parcel));

    return {
      parcels: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total_collectable_amount: totalCollectableAmount,
        total_cleared_parcels: total,
      },
    };
  }

  /**
   * Get COD pending parcels for Carrybee (third-party provider)
   * Shows parcels BEFORE hub has cleared COD with Carrybee (cod_cleared_at IS NULL)
   * Returns total collectable amount from completed deliveries awaiting collection
   */
  async getCarrybeeClearedParcels(
    hubId: string,
    providerId: string,
    options: {
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Successful delivery statuses (completed deliveries with COD)
    const successfulStatuses = [
      ParcelStatus.DELIVERED,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.PAID_RETURN,
    ];

    // Build query for cleared parcels from Carrybee
    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'provider')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.delivery_provider = :deliveryProvider', {
        deliveryProvider: 'THIRD_PARTY',
      })
      .andWhere('parcel.third_party_provider_id = :providerId', { providerId })
      .andWhere('parcel.cod_cleared_at IS NULL') // Only not-yet-cleared parcels
      .andWhere('parcel.payment_status = :paymentStatus', {
        paymentStatus: PaymentStatus.COD_COLLECTED,
      })
      .andWhere('parcel.status IN (:...statuses)', {
        statuses: successfulStatuses,
      });

    // Order by delivery date (most recent first)
    queryBuilder.orderBy('parcel.delivered_at', 'DESC');

    // Get total count for pagination
    const total = await queryBuilder.getCount();

    // Calculate total collectable amount
    const collectableQuery = this.parcelRepository
      .createQueryBuilder('parcel')
      .select('SUM(parcel.cod_collected_amount)', 'total')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.delivery_provider = :deliveryProvider', {
        deliveryProvider: 'THIRD_PARTY',
      })
      .andWhere('parcel.third_party_provider_id = :providerId', { providerId })
      .andWhere('parcel.cod_cleared_at IS NULL')
      .andWhere('parcel.payment_status = :paymentStatus', {
        paymentStatus: PaymentStatus.COD_COLLECTED,
      })
      .andWhere('parcel.status IN (:...statuses)', {
        statuses: successfulStatuses,
      });

    const collectableResult = await collectableQuery.getRawOne();
    const totalCollectableAmount = Number(collectableResult?.total || 0);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const parcels = await queryBuilder.getMany();

    // Transform parcels to response format
    const items = parcels.map((parcel) => this.toDeliveryOutcomeItem(parcel));

    return {
      parcels: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        total_collectable_amount: totalCollectableAmount,
        total_cleared_parcels: total,
        provider_name:
          parcels[0]?.thirdPartyProvider?.provider_name || 'Carrybee',
      },
    };
  }

  /**
   * Get rescheduled deliveries for Hub Manager
   * These parcels need to be re-assigned to a rider for redelivery
   */
  async getRescheduledDeliveries(
    hubId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.assignedRider', 'rider')
      .leftJoinAndSelect('rider.user', 'riderUser')
      .leftJoinAndSelect('rider.hub', 'riderHub')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', {
        status: ParcelStatus.DELIVERY_RESCHEDULED,
      })
      .orderBy('parcel.updated_at', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const parcels = await queryBuilder.getMany();

    // Add reschedule_count only for rescheduled deliveries endpoint
    const items = parcels.map((parcel) => ({
      ...this.toDeliveryOutcomeItem(parcel),
      reschedule_count: parcel.reschedule_count || 0,
    }));

    return {
      parcels: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get return to merchant parcels for Hub Manager
   * These are original parcels marked for return to merchant
   * Also includes the linked return parcel information
   */
  async getReturnToMerchantParcels(
    hubId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant')
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store')
      .leftJoinAndSelect('store.hub', 'storeHub')
      .leftJoinAndSelect('store.merchant', 'storeMerchant')
      .leftJoinAndSelect('storeMerchant.user', 'storeMerchantUser')
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'assignedRider')
      .leftJoinAndSelect('assignedRider.user', 'assignedRiderUser')
      .leftJoinAndSelect('assignedRider.hub', 'assignedRiderHub')
      .leftJoinAndSelect('parcel.delivery_coverage_area', 'coverageArea')
      .leftJoinAndSelect('parcel.currentHub', 'currentHub')
      .leftJoinAndSelect('parcel.originHub', 'originHub')
      .leftJoinAndSelect('parcel.destinationHub', 'destinationHub')
      .leftJoinAndSelect('parcel.thirdPartyProvider', 'thirdPartyProvider')
      .where('parcel.current_hub_id = :hubId', { hubId })
      .andWhere('parcel.status = :status', {
        status: ParcelStatus.RETURN_TO_MERCHANT,
      })
      .orderBy('parcel.updated_at', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const parcels = await queryBuilder.getMany();

    // Get the linked return parcels for each original parcel
    const parcelIds = parcels.map((p) => p.id);
    const returnParcels =
      parcelIds.length > 0
        ? await this.parcelRepository.find({
            where: {
              original_parcel_id: In(parcelIds),
              is_return_parcel: true,
            },
            select: [
              'id',
              'parcel_tx_id',
              'tracking_number',
              'status',
              'original_parcel_id',
            ],
          })
        : [];

    // Create a map for quick lookup
    const returnParcelMap = new Map(
      returnParcels.map((rp) => [rp.original_parcel_id, rp]),
    );

    // Transform parcels with return parcel info
    const items = parcels.map((parcel) => {
      const baseItem = this.toDeliveryOutcomeItem(parcel);
      const returnParcel = returnParcelMap.get(parcel.id);

      return {
        ...baseItem,
        return_parcel: returnParcel
          ? {
              id: returnParcel.id,
              parcel_tx_id: returnParcel.parcel_tx_id,
              tracking_number: returnParcel.tracking_number,
              status: returnParcel.status,
            }
          : null,
      };
    });

    return {
      parcels: items,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Hub Manager marks parcel as RETURN_TO_MERCHANT
   * Creates a NEW return parcel to track the return journey back to merchant
   *
   * Used for: RETURNED, PAID_RETURN, PARTIAL_DELIVERY, EXCHANGE outcomes
   */
  async markReturnToMerchant(parcelId: string, hubId: string, notes?: string) {
    const originalParcel = await this.parcelRepository.findOne({
      where: { id: parcelId, current_hub_id: hubId },
      relations: ['store', 'merchant'],
    });

    if (!originalParcel) {
      throw new NotFoundException('Parcel not found in your hub');
    }

    const allowedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.RETURNED_TO_HUB,
    ];

    if (!allowedStatuses.includes(originalParcel.status)) {
      throw new BadRequestException(
        `Cannot mark as return to merchant. Current status: ${originalParcel.status}`,
      );
    }

    // Get merchant_id (User ID) - parcel.merchant_id references User, not Merchant entity
    let merchantId: string | null = originalParcel.merchant_id;

    // Fallback: Get user_id from store's merchant
    if (!merchantId && originalParcel.store?.merchant_id) {
      // Query merchant to get user_id
      const merchant = await this.merchantRepository.findOne({
        where: { id: originalParcel.store.merchant_id },
      });
      merchantId = merchant?.user_id || null;
    }

    if (!merchantId) {
      this.logger.error(
        `[RETURN TO MERCHANT] No merchant found for parcel ${parcelId}. ` +
          `parcel.merchant_id: ${originalParcel.merchant_id}, ` +
          `store.merchant_id: ${originalParcel.store?.merchant_id}`,
      );
      throw new BadRequestException(
        'Cannot create return parcel: No merchant found for this parcel',
      );
    }

    // Update original parcel using QueryBuilder to avoid relationship issues
    const updateData: any = {
      status: ParcelStatus.RETURN_TO_MERCHANT,
    };

    // Fix merchant_id if it was null
    if (!originalParcel.merchant_id) {
      updateData.merchant_id = merchantId;
    }

    if (notes) {
      updateData.admin_notes = notes;
    }

    await this.parcelRepository
      .createQueryBuilder()
      .update()
      .set(updateData)
      .where('id = :id', { id: parcelId })
      .execute();

    // Update local object for return
    originalParcel.status = ParcelStatus.RETURN_TO_MERCHANT;
    if (!originalParcel.merchant_id) {
      originalParcel.merchant_id = merchantId;
    }

    // Create a NEW return parcel to track the return journey
    const returnTrackingNumber = await this.generateReturnTrackingNumber(
      originalParcel.tracking_number,
    );
    const returnParcelTxId = await this.generateParcelTxId(
      this.getParcelIdPrefix({
        isReturnParcel: true,
        status: ParcelStatus.RETURN_TO_MERCHANT,
      }),
    );

    const returnParcel = this.parcelRepository.create({
      // Tracking
      tracking_number: returnTrackingNumber,
      parcel_tx_id: returnParcelTxId, // Display ID like #139679
      merchant_order_id: originalParcel.merchant_order_id,

      // Link to original
      original_parcel_id: originalParcel.id,
      is_return_parcel: true,

      // Merchant info (use resolved merchantId)
      merchant_id: merchantId,
      store_id: originalParcel.store_id,

      // For return: pickup from customer address, deliver to merchant/store
      delivery_area: originalParcel.customer_address,
      customer_address: originalParcel.delivery_area,

      // Customer info (original merchant/store becomes recipient)
      customer_name:
        originalParcel.store?.business_name ||
        originalParcel.merchant?.user?.full_name ||
        'Merchant',
      customer_phone:
        originalParcel.store?.phone_number ||
        originalParcel.merchant?.user?.phone ||
        '',

      // Parcel details
      product_description: `RETURN: ${originalParcel.product_description || 'N/A'}`,
      product_price: originalParcel.product_price,
      product_weight: originalParcel.product_weight,
      parcel_type: originalParcel.parcel_type,

      // No COD for returns (merchant handles refund separately)
      is_cod: false,
      cod_amount: 0,
      delivery_charge: 0, // Return charges handled separately
      weight_charge: 0,
      cod_charge: 0,
      total_charge: 0,

      // Status
      status: ParcelStatus.IN_HUB, // Ready to be assigned for return
      payment_status: PaymentStatus.UNPAID,

      // Hub
      current_hub_id: hubId,

      // Reason
      return_reason:
        originalParcel.return_reason || notes || 'Return to merchant',
    });

    await this.parcelRepository.save(returnParcel);

    this.logger.log(
      `[RETURN TO MERCHANT] Original: ${originalParcel.tracking_number}, ` +
        `Return Parcel: ${returnParcel.tracking_number}, Hub: ${hubId}`,
    );

    return {
      original_parcel: originalParcel,
      return_parcel: returnParcel,
    };
  }

  /**
   * Bulk mark parcels as RETURN_TO_MERCHANT
   * Creates return parcels for each original parcel
   */
  async bulkMarkReturnToMerchant(
    parcelIds: string[],
    hubId: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
      return_parcel?: {
        id: string;
        parcel_tx_id: string | null;
        tracking_number: string;
      };
    }>;
  }> {
    const results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
      return_parcel?: {
        id: string;
        parcel_tx_id: string | null;
        tracking_number: string;
      };
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const parcelId of parcelIds) {
      try {
        const result = await this.markReturnToMerchant(parcelId, hubId);

        results.push({
          parcel_id: parcelId,
          parcel_tx_id: result.original_parcel.parcel_tx_id,
          tracking_number: result.original_parcel.tracking_number,
          success: true,
          return_parcel: {
            id: result.return_parcel.id,
            parcel_tx_id: result.return_parcel.parcel_tx_id,
            tracking_number: result.return_parcel.tracking_number,
          },
        });
        successCount++;
      } catch (error: any) {
        results.push({
          parcel_id: parcelId,
          success: false,
          error: error.message || 'Unknown error',
        });
        failedCount++;
      }
    }

    this.logger.log(
      `[BULK RETURN TO MERCHANT] Hub: ${hubId}, Success: ${successCount}, Failed: ${failedCount}`,
    );

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Hub Manager marks parcel as DELIVERY_RESCHEDULED
   * Used to reschedule delivery from delivery outcomes list
   *
   * Allowed from: RETURNED, PAID_RETURN, PARTIAL_DELIVERY, EXCHANGE, RETURNED_TO_HUB, IN_HUB
   */
  async markAsRescheduled(parcelId: string, hubId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, current_hub_id: hubId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found in your hub');
    }

    const allowedStatuses = [
      ParcelStatus.RETURNED,
      ParcelStatus.PAID_RETURN,
      ParcelStatus.PARTIAL_DELIVERY,
      ParcelStatus.EXCHANGE,
      ParcelStatus.RETURNED_TO_HUB,
      ParcelStatus.IN_HUB,
    ];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Cannot reschedule parcel. Current status: ${parcel.status}`,
      );
    }

    // Update to DELIVERY_RESCHEDULED and clear rider assignment
    // Note: reschedule_count is incremented when assigned to rider, not here
    parcel.status = ParcelStatus.DELIVERY_RESCHEDULED;
    parcel.assigned_rider_id = null;
    parcel.assigned_at = null;
    parcel.rider_accepted_at = null;
    parcel.out_for_delivery_at = null;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[RESCHEDULE DELIVERY] Parcel: ${parcel.tracking_number}, Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Bulk mark parcels as DELIVERY_RESCHEDULED
   */
  async bulkMarkAsRescheduled(
    parcelIds: string[],
    hubId: string,
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{
      parcel_id: string;
      parcel_tx_id?: string | null;
      tracking_number?: string;
      success: boolean;
      error?: string;
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const parcelId of parcelIds) {
      try {
        const parcel = await this.markAsRescheduled(parcelId, hubId);

        results.push({
          parcel_id: parcelId,
          parcel_tx_id: parcel.parcel_tx_id,
          tracking_number: parcel.tracking_number,
          success: true,
        });
        successCount++;
      } catch (error: any) {
        results.push({
          parcel_id: parcelId,
          success: false,
          error: error.message || 'Unknown error',
        });
        failedCount++;
      }
    }

    this.logger.log(
      `[BULK RESCHEDULE DELIVERY] Hub: ${hubId}, Success: ${successCount}, Failed: ${failedCount}`,
    );

    return {
      success: successCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * Generate tracking number for return parcel
   * Format: RTN-{original_tracking}-{sequence}
   */
  private async generateReturnTrackingNumber(
    originalTracking: string,
  ): Promise<string> {
    // Check if this is already a return (has RTN prefix)
    if (originalTracking.startsWith('RTN-')) {
      // Extract base tracking and increment
      const parts = originalTracking.split('-');
      const sequence = parseInt(parts[parts.length - 1]) || 1;
      parts[parts.length - 1] = String(sequence + 1);
      return parts.join('-');
    }

    return `RTN-${originalTracking}`;
  }

  /**
   * Hub Manager prepares rescheduled parcel for redelivery
   * Resets parcel to IN_HUB so it can be assigned to rider again
   */
  async prepareForRedelivery(parcelId: string, hubId: string) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId, current_hub_id: hubId },
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found in your hub');
    }

    if (parcel.status !== ParcelStatus.DELIVERY_RESCHEDULED) {
      throw new BadRequestException(
        `Parcel is not rescheduled. Current status: ${parcel.status}`,
      );
    }

    // Reset to IN_HUB for reassignment
    parcel.status = ParcelStatus.IN_HUB;
    parcel.assigned_rider_id = null;
    parcel.assigned_at = null;
    parcel.rider_accepted_at = null;
    parcel.out_for_delivery_at = null;

    await this.parcelRepository.save(parcel);

    this.logger.log(
      `[PREPARE REDELIVERY] Parcel: ${parcel.tracking_number}, Hub: ${hubId}`,
    );

    return parcel;
  }

  /**
   * Helper: Calculate age display string
   * Converts time difference to human-readable format: "2 days 3h 15m"
   */
  private calculateAge(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(' ');
  }

  /**
   * Helper: Transform parcel to delivery outcome item format
   */
  private toDeliveryOutcomeItem(parcel: Parcel) {
    // Build zone string from coverage area
    const zoneInfo = parcel.delivery_coverage_area
      ? `${parcel.delivery_coverage_area.area}, ${parcel.delivery_coverage_area.zone}`
      : null;

    return {
      ...toParcelListItem(parcel),
      parcel_id: parcel.id,
      parcel_tx_id: parcel.parcel_tx_id || null,
      tracking_number: parcel.tracking_number,
      status: parcel.status,
      reason: parcel.return_reason || null,

      destination: parcel.customer_address,
      zone: zoneInfo,

      store: {
        name:
          parcel.store?.business_name ||
          parcel.merchant?.user?.full_name ||
          'N/A',
        phone:
          parcel.store?.phone_number || parcel.merchant?.user?.phone || 'N/A',
      },

      cod_breakdown: {
        cod_amount: Number(parcel.cod_amount) || 0,
        cod_collected_amount: Number(parcel.cod_collected_amount) || 0,
        delivery_charge: Number(parcel.delivery_charge) || 0,
        cod_charge: Number(parcel.cod_charge) || 0,
        weight_charge: Number(parcel.weight_charge) || 0,
        return_charge: Number(parcel.return_charge) || 0,
        total_charge: Number(parcel.total_charge) || 0,
      },

      age: {
        total_age: this.calculateAge(parcel.created_at),
        created_at: parcel.created_at,
        updated_at: parcel.updated_at,
      },
    };
  }

  async getBulkSuggestions(
    items: BulkOrderItemDto[],
    merchantId: string,
  ): Promise<SuggestionResult[]> {
    const results: SuggestionResult[] = [];

    // Load & normalize coverage areas ONCE for the whole batch
    const rawAreas = await this.coverageAreaRepository.find();
    const coverageAreas: CoverageAreaWithNorms[] = rawAreas.map((c) => ({
      ...c,
      _zone_norm: this.normalizeText(c.zone),
      _city_norm: this.normalizeText(c.city),
      _area_norm: this.normalizeText(c.area),
    }));

    for (const item of items) {
      const result: SuggestionResult = {
        original_row: item,
        status: 'FAILED',
      };

      try {
        // 1. Basic validation
        if (
          !item.customer_phone ||
          !item.customer_name ||
          !item.delivery_area ||
          !item.customer_address
        ) {
          throw new Error(
            'Missing mandatory fields (phone, name, pickup address, delivery address).',
          );
        }

        // 2. Heuristic: choose best coverage area
        const coverageArea = this.findBestCoverageAreaFromAddress(
          item.customer_address,
          coverageAreas,
        );

        if (!coverageArea) {
          throw new NotFoundException(
            'No suitable coverage area found from customer address.',
          );
        }

        // set suggestions immediately (even if numeric fails later)
        result.suggested_area_id = coverageArea.id;
        result.suggested_city = coverageArea.city;
        result.suggested_zone = coverageArea.zone;

        // 3. Numeric parsing (non-fatal for suggestions)
        let numericError: string | null = null;
        let isCod = false;
        let weight = 0;
        let price = 0;
        let codAmount = 0;

        try {
          isCod = item.is_cod_raw?.toUpperCase() === 'TRUE';
          weight = this.parseRawNumeric(item.product_weight_raw);
          price = this.parseRawNumeric(item.product_price_raw);
          codAmount = isCod ? price : 0;
        } catch (e: any) {
          numericError = e?.message || 'Invalid numeric value';
          // keep zeros so we can still return address suggestion
          weight = 0;
          price = 0;
          codAmount = 0;
        }

        // 4. Charge calculation only if numerics are valid
        if (!numericError) {
          const charges = await this.calculateCharges(
            merchantId,
            coverageArea.id,
            weight,
            isCod,
            codAmount,
          );

          result.total_charge = charges.total_charge;
          result.delivery_charge = charges.delivery_charge;
          result.cod_charge = charges.cod_charge;
          result.status = 'SUCCESS';
        } else {
          result.status = 'FAILED'; // or 'RESOLVED' if you want a separate state
          result.error = `Numeric error: ${numericError}`;
        }
      } catch (error: any) {
        if (!result.error) {
          result.error = `Processing Error: ${error.message || 'Unknown error'}`;
        }
        result.status = result.status || 'FAILED';
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Creates parcels from user-confirmed data (called by /bulk-create).
   */
  async bulkCreateConfirmedBatch(
    items: BulkOrderItemDto[],
    userId: string,
    merchantId: string,
  ): Promise<{
    summary: { total: number; success: number; failed: number };
    results: ParcelCreationResult[];
  }> {
    const creationResults: ParcelCreationResult[] = [];
    let successCount = 0;
    const totalRows = items.length;

    for (const item of items) {
      try {
        // 1. Final Validation & Mapping
        if (!item.delivery_coverage_area_id) {
          throw new Error('Missing confirmed delivery_coverage_area_id.');
        }

        const isCod = item.is_cod_raw?.toUpperCase() === 'TRUE';
        const weight = this.parseRawNumeric(item.product_weight_raw);
        const price = this.parseRawNumeric(item.product_price_raw);
        const codAmount = isCod ? price : 0;

        // 2. Map to CreateParcelDto
        const createDto: CreateParcelDto = {
          // Required fields
          delivery_coverage_area_id: item.delivery_coverage_area_id,
          customer_name: item.customer_name,
          customer_phone: item.customer_phone,
          customer_address: item.customer_address,
          delivery_area: item.delivery_area,

          // Numerics
          product_weight: weight,
          product_price: price,
          is_cod: isCod,
          cod_amount: codAmount,

          // Optional fields (Mapping null/empty string to undefined)
          store_id: item.store_id ?? undefined,
          merchant_order_id: item.merchant_order_id ?? undefined,
          product_description: item.product_description || undefined,
          parcel_type: item.parcel_type_raw
            ? parseInt(item.parcel_type_raw, 10)
            : undefined,
          delivery_type: item.delivery_type_raw
            ? parseInt(item.delivery_type_raw, 10)
            : undefined,
          special_instructions: item.special_instructions ?? undefined,
        } as CreateParcelDto;

        // 3. Create the parcel using the existing core logic
        // userId is the user ID from users table, merchantId is the merchant entity ID
        const newParcel = await this.create(createDto, userId, merchantId);
        successCount++;

        creationResults.push({
          success: true,
          tracking: newParcel.tracking_number,
        });
      } catch (error: any) {
        // Failsafe: Catch any validation or DB errors during final creation
        creationResults.push({
          success: false,
          error: `Creation failed: ${error.message}`,
        });
      }
    }

    return {
      summary: {
        total: totalRows,
        success: successCount,
        failed: totalRows - successCount,
      },
      results: creationResults,
    };
  }

  /**
   * Get Parcel Reports with filters
   */
  async getParcelReports(
    hubId: string | null,
    query: ParcelReportQueryDto,
  ): Promise<{ data: any[]; total: number }> {
    const { search, issue_type, page = '1', limit = '10' } = query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const qb = this.parcelRepository
      .createQueryBuilder('parcel')
      .leftJoinAndSelect('parcel.merchant', 'merchant') // merchant is User entity
      .leftJoinAndSelect('merchant.user', 'merchantUser')
      .leftJoinAndSelect('parcel.store', 'store') // Join Store for business_name
      .leftJoinAndSelect('parcel.customer', 'customer')
      .leftJoinAndSelect('parcel.assignedRider', 'rider')
      .leftJoinAndSelect('rider.user', 'riderUser')
      .where('parcel.issue_type IS NOT NULL') // Only fetch parcels with issues
      .andWhere('parcel.is_issue_resolved = :resolved', { resolved: false });

    if (hubId) {
      qb.andWhere('parcel.current_hub_id = :hubId', { hubId });
    }

    // 1. Search by Parcel ID or Customer Name
    if (search) {
      qb.andWhere(
        '(parcel.tracking_number ILIKE :search OR parcel.customer_name ILIKE :search OR merchantUser.full_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // 2. Filter by Report Type
    if (issue_type) {
      qb.andWhere('parcel.issue_type = :issueType', { issueType: issue_type });
    }

    qb.orderBy('parcel.issue_reported_at', 'DESC')
      .skip(skip)
      .take(parseInt(limit));

    const [parcels, total] = await qb.getManyAndCount();

    // Map to the format shown in screenshot
    const data = parcels.map((p) => ({
      id: p.id,
      tracking_number: p.tracking_number,
      customer: {
        name: p.customer_name,
        phone: p.customer_phone,
        address: p.customer_address,
      },
      merchant: {
        name: p.merchant?.user?.full_name,
        company: p.store?.business_name,
        phone: p.merchant?.user?.phone,
      },
      zone: p.delivery_area || 'N/A',
      reported_by: {
        name: p.assignedRider?.user?.full_name || 'Unknown',
        photo: p.assignedRider?.photo || null,
      },
      report: {
        type: p.issue_type,
        reason: p.issue_description,
        reported_at: p.issue_reported_at,
      },
    }));

    return { data, total };
  }

  /**
   * Get Single Parcel Report by ID
   */
  async getParcelReportById(hubId: string | null, parcelId: string) {
    const where: any = { id: parcelId };
    if (hubId) {
      where.current_hub_id = hubId;
    }

    const parcel = await this.parcelRepository.findOne({
      where,
      relations: [
        'merchant', // User entity
        'merchant.user',
        'store', // Store entity (for business name)
        'customer',
        'assignedRider',
        'assignedRider.user',
      ],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel report not found');
    }

    // Return the consistent report structure
    return {
      id: parcel.id,
      tracking_number: parcel.tracking_number,
      status: parcel.status, // Included status
      customer: {
        name: parcel.customer_name,
        phone: parcel.customer_phone,
        address: parcel.customer_address,
      },
      merchant: {
        name: parcel.merchant?.user?.full_name,
        company: parcel.store?.business_name,
        phone: parcel.merchant?.user?.phone,
      },
      zone: parcel.delivery_area || 'N/A',
      reported_by: {
        name: parcel.assignedRider?.user?.full_name || 'Unknown',
        photo: parcel.assignedRider?.photo || null,
      },
      report: {
        type: parcel.issue_type,
        reason: parcel.issue_description,
        reported_at: parcel.issue_reported_at,
        is_resolved: parcel.is_issue_resolved,
      },
    };
  }

  /**
   * Resolve a single report
   */
  async resolveReport(
    parcelId: string,
    dto: ResolveReportDto,
    hubId: string | null,
  ) {
    const where: any = { id: parcelId };
    if (hubId) {
      where.current_hub_id = hubId;
    }

    const parcel = await this.parcelRepository.findOne({
      where,
    });
    if (!parcel) throw new NotFoundException('Parcel not found');

    // Update status based on admin decision
    parcel.status = dto.action_status;
    // Fixed: Handle optional undefined with fallback to null
    parcel.admin_notes = dto.admin_notes || null;
    parcel.is_issue_resolved = true; // Mark as resolved so it leaves the report list

    return await this.parcelRepository.save(parcel);
  }

  /**
   * Bulk Resolve
   */
  async bulkResolveReports(dto: BulkResolveReportDto, hubId: string | null) {
    // 4. Bulk Action Logic
    const where: any = {
      id: In(dto.parcel_ids),
    };

    if (hubId) {
      where.current_hub_id = hubId;
    }

    const parcels = await this.parcelRepository.find({
      where,
    });

    for (const parcel of parcels) {
      parcel.status = dto.action_status;
      // Fixed: Handle optional undefined with fallback to null
      parcel.admin_notes = dto.admin_notes || null;
      parcel.is_issue_resolved = true;
    }

    return await this.parcelRepository.save(parcels);
  }

  /**
   * Hub Manager manually override delivery_charge and/or weight_charge for a received parcel
   * Only allowed when parcel is IN_HUB at the hub manager's hub.
   * Recalculates total_charge and receivable_amount using the existing formula:
   *   total_charge = delivery_charge + weight_charge + cod_charge - discount
   *   receivable_amount = cod_amount - total_charge
   */
  async updateHubCharges(
    parcelId: string,
    dto: UpdateParcelChargesDto,
    role: UserRole,
    hubId: string | null,
  ): Promise<Parcel> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
      relations: ['store'],
    });

    if (!parcel) {
      throw new NotFoundException(`Parcel with ID ${parcelId} not found`);
    }

    // Hub Manager Ownership Check
    if (role !== UserRole.ADMIN) {
      // Allow if:
      // 1. Physically at this hub (current_hub_id)
      // 2. Logically belongs to this hub (store.hub_id)
      const isPhysicallyAtHub = parcel.current_hub_id === hubId;
      const belongsToHubStore = parcel.store?.hub_id === hubId;

      if (!isPhysicallyAtHub && !belongsToHubStore) {
        throw new ForbiddenException(`This parcel does not belong to your hub`);
      }
    }

    // Status rule for both Hub Manager and Admin:
    // editable only until rider starts delivery
    const allowedStatuses = [
      ParcelStatus.PENDING,
      ParcelStatus.PICKED_UP,
      ParcelStatus.OUT_FOR_PICKUP,
      ParcelStatus.IN_TRANSIT,
      ParcelStatus.IN_HUB,
      ParcelStatus.ASSIGNED_TO_RIDER,
      ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
    ];

    if (!allowedStatuses.includes(parcel.status)) {
      throw new BadRequestException(
        `Hub/Admin can edit only before rider starts delivery. Current status: ${parcel.status}`,
      );
    }

    // Apply overrides (only fields provided in the DTO)
    if (dto.product_weight !== undefined) {
      parcel.product_weight = dto.product_weight;
    }
    if (dto.delivery_charge !== undefined) {
      parcel.delivery_charge = dto.delivery_charge;
    }
    if (dto.weight_charge !== undefined) {
      parcel.weight_charge = dto.weight_charge;
    }

    // Recalculate total_charge and receivable_amount using existing formula:
    // total_charge = delivery_charge + weight_charge + cod_charge
    const newTotalCharge =
      Math.round(
        (Number(parcel.delivery_charge) +
          Number(parcel.weight_charge) +
          Number(parcel.cod_charge)) *
          100,
      ) / 100;

    // receivable_amount = cod_amount - total_charge
    const newReceivableAmount =
      Math.round((Number(parcel.cod_amount) - newTotalCharge) * 100) / 100;

    parcel.total_charge = newTotalCharge;
    parcel.receivable_amount = newReceivableAmount;

    const updated = await this.parcelRepository.save(parcel);

    this.logger.log(
      `[HUB CHARGE OVERRIDE] Parcel: ${parcelId}, ` +
        `Delivery: ${updated.delivery_charge}, Weight: ${updated.weight_charge}, ` +
        `COD: ${updated.cod_charge}, Total: ${updated.total_charge}, Receivable: ${updated.receivable_amount}`,
    );

    return updated;
  }
}
