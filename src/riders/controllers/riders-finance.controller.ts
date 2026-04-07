import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RiderFinanceService } from '../services/riders-finance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  toParcelDetail,
  toParcelListItem,
  toPickupRequestDetail,
  toPickupRequestListItem,
} from '../../common/interfaces/responses.interface';
import {
  RiderFinanceSummaryBreakdownQueryDto,
  RiderFinanceSummaryMetric,
} from '../dto/rider-finance-summary-breakdown-query.dto';
import { ParcelsService } from '../../parcels/parcels.service';
import { ParcelStatus } from '../../parcels/entities/parcel.entity';
import { PickupRequestsService } from '../../pickup-requests/pickup-requests.service';
import { PickupRequestStatus } from '../../common/enums/pickup-request-status.enum';
import { RiderFinanceSummaryDetailQueryDto } from 'src/riders/dto/rider-finance-summary-detail-query.dto';

@Controller('riders/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.RIDER)
export class RiderFinanceController {
  constructor(
    private readonly riderFinanceService: RiderFinanceService,
    private readonly parcelsService: ParcelsService,
    private readonly pickupRequestsService: PickupRequestsService,
  ) {}

  @Get('summary/breakdown')
  @Roles(UserRole.RIDER)
  async getFinanceSummaryBreakdown(
    @CurrentUser() user: any,
    @Query() query: RiderFinanceSummaryBreakdownQueryDto,
  ) {
    const breakdown =
      await this.riderFinanceService.getFinanceSummaryBreakdownByUserId(
        user.userId,
        query.metric,
        query.startDate ? new Date(query.startDate) : undefined,
        query.endDate ? new Date(query.endDate) : undefined,
        query.page,
        query.limit,
      );

    const dataItems =
      breakdown.item_type === 'parcel'
        ? breakdown.items.map(toParcelListItem)
        : breakdown.items.map((pickup: any) => ({
            ...toPickupRequestListItem(pickup),
            picked_up_count: pickup.picked_up_count ?? 0,
            picked_up_at: pickup.picked_up_at ?? null,
          }));

    return {
      success: true,
      data: {
        metric: breakdown.metric,
        item_type: breakdown.item_type,
        date_range: breakdown.date_range,
        total: breakdown.total,
        list_count: breakdown.list_count,
        items: dataItems,
        pagination: breakdown.pagination,
      },
      message:
        breakdown.metric === RiderFinanceSummaryMetric.PICKUP
          ? 'Finance summary pickup breakdown retrieved successfully'
          : 'Finance summary parcel breakdown retrieved successfully',
    };
  }

  @Get('summary')
  @Roles(UserRole.RIDER)
  async getFinanceSummary(
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.riderFinanceService.getFinanceSummaryByUserId(
      user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      success: true,
      data,
      message: 'Finance summary retrieved successfully',
    };
  }

  @Get('summary/detail/:id')
  @Roles(UserRole.RIDER)
  async getFinanceSummaryDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query() query: RiderFinanceSummaryDetailQueryDto,
  ) {
    const metric = query.metric;

    const metricByParcelStatus: Partial<Record<ParcelStatus, RiderFinanceSummaryMetric>> = {
      [ParcelStatus.DELIVERED]: RiderFinanceSummaryMetric.DELIVERED,
      [ParcelStatus.PARTIAL_DELIVERY]:
        RiderFinanceSummaryMetric.PARTIALLY_DELIVERED,
      [ParcelStatus.PAID_RETURN]: RiderFinanceSummaryMetric.PAID_RETURN,
      [ParcelStatus.EXCHANGE]: RiderFinanceSummaryMetric.EXCHANGED,
      [ParcelStatus.RETURNED]: RiderFinanceSummaryMetric.RETURN,
      [ParcelStatus.RETURN_TO_MERCHANT]:
        RiderFinanceSummaryMetric.RETURN_TO_MERCHANT,
    };

    if (!metric) {
      try {
        const parcel = await this.parcelsService.getFinanceSummaryParcelDetail(
          id,
          user.riderId,
        );

        const detectedMetric = metricByParcelStatus[parcel.status];

        if (!detectedMetric) {
          throw new BadRequestException(
            `Parcel status ${parcel.status} is not available in finance summary detail`,
          );
        }

        return {
          success: true,
          data: {
            metric: detectedMetric,
            item_type: 'parcel',
            detail: toParcelDetail(parcel),
          },
          message: 'Finance summary detail retrieved successfully',
        };
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }

      try {
        const pickup =
          await this.pickupRequestsService.getFinanceSummaryPickupDetail(
            id,
            user.riderId,
          );

        return {
          success: true,
          data: {
            metric: RiderFinanceSummaryMetric.PICKUP,
            item_type: 'pickup_request',
            detail: toPickupRequestDetail(pickup),
          },
          message: 'Finance summary detail retrieved successfully',
        };
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }

      throw new NotFoundException(
        'Finance summary detail not found for this rider',
      );
    }

    if (metric === RiderFinanceSummaryMetric.PICKUP) {
      const pickup = await this.pickupRequestsService.getRiderPickupDetail(
        id,
        user.riderId,
        'completed',
      );

      if (pickup.status !== PickupRequestStatus.PICKED_UP) {
        throw new BadRequestException(
          `Pickup status ${pickup.status} does not match metric ${metric}`,
        );
      }

      return {
        success: true,
        data: {
          metric,
          item_type: 'pickup_request',
          detail: toPickupRequestDetail(pickup),
        },
        message: 'Finance summary detail retrieved successfully',
      };
    }

    const deliveryMetricStatusMap: Partial<
      Record<RiderFinanceSummaryMetric, ParcelStatus>
    > = {
      [RiderFinanceSummaryMetric.DELIVERED]: ParcelStatus.DELIVERED,
      [RiderFinanceSummaryMetric.PARTIALLY_DELIVERED]:
        ParcelStatus.PARTIAL_DELIVERY,
      [RiderFinanceSummaryMetric.PAID_RETURN]: ParcelStatus.PAID_RETURN,
      [RiderFinanceSummaryMetric.EXCHANGED]: ParcelStatus.EXCHANGE,
    };

    if (metric in deliveryMetricStatusMap) {
      const parcel = await this.parcelsService.getRiderDeliveryDetail(
        id,
        user.riderId,
        'completed',
      );

      const expectedStatus = deliveryMetricStatusMap[metric]!;
      if (parcel.status !== expectedStatus) {
        throw new BadRequestException(
          `Parcel status ${parcel.status} does not match metric ${metric}`,
        );
      }

      return {
        success: true,
        data: {
          metric,
          item_type: 'parcel',
          detail: toParcelDetail(parcel),
        },
        message: 'Finance summary detail retrieved successfully',
      };
    }

    const returnMetricStatusMap: Partial<
      Record<RiderFinanceSummaryMetric, ParcelStatus>
    > = {
      [RiderFinanceSummaryMetric.RETURN]: ParcelStatus.RETURNED,
      [RiderFinanceSummaryMetric.RETURN_TO_MERCHANT]:
        ParcelStatus.RETURN_TO_MERCHANT,
    };

    if (metric in returnMetricStatusMap) {
      const tab =
        metric === RiderFinanceSummaryMetric.RETURN ? 'pending' : 'completed';
      const parcel = await this.parcelsService.getRiderReturnDetail(
        id,
        user.riderId,
        tab,
      );

      const expectedStatus = returnMetricStatusMap[metric]!;
      if (parcel.status !== expectedStatus) {
        throw new BadRequestException(
          `Parcel status ${parcel.status} does not match metric ${metric}`,
        );
      }

      return {
        success: true,
        data: {
          metric,
          item_type: 'parcel',
          detail: toParcelDetail(parcel),
        },
        message: 'Finance summary detail retrieved successfully',
      };
    }

    throw new BadRequestException(
      `Metric ${metric} is not supported for detail endpoint`,
    );
  }
}
