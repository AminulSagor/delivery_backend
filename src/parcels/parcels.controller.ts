import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ParcelCreationResult,
  ParcelsService,
  SuggestionResult,
} from './parcels.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto } from './dto/update-parcel.dto';
import { UpdateParcelChargesDto } from './dto/update-parcel-charges.dto';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { CalculateTotalPricingDto } from './dto/calculate-total-pricing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ParcelQueryDto } from './dto/parcel-query.dto';
import { BulkSuggestDto } from './dto/bulk-suggest.dto';
import { TodaySummaryQueryDto } from './dto/todays-summary-query-dto';
import { LifetimeSummaryQueryDto } from './dto/lifetime-summary-query.dto';
import {
  toParcelListItem,
  toParcelDetail,
} from '../common/interfaces/responses.interface';

@Controller('parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post('calculate-pricing')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  calculatePricing(
    @Body() calculatePricingDto: CalculatePricingDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    return this.parcelsService.calculatePricing(
      userId,
      calculatePricingDto,
      merchantId,
    );
  }

  /**
   * Calculate total delivery cost with full breakdown
   * Returns: Delivery Fee, COD Fee, Weight Charge, Discount, Total Fee
   */
  @Post('calculate-total-pricing')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  calculateTotalPricing(
    @Body() calculateTotalPricingDto: CalculateTotalPricingDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    return this.parcelsService.calculateTotalPricing(
      userId,
      calculateTotalPricingDto,
      merchantId,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.MERCHANT)
  async create(
    @Body() createParcelDto: CreateParcelDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const parcel = await this.parcelsService.create(
      createParcelDto,
      userId,
      merchantId,
    );

    const detailedParcel = await this.parcelsService.findOne(
      parcel.id,
      merchantId,
      false,
      null,
      null,
    );

    return {
      parcel: toParcelDetail(detailedParcel),
      message: 'Parcel created successfully',
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAll(@CurrentUser() user: any, @Query() query: ParcelQueryDto) {
    const {
      status,
      storeId,
      merchantId,
      page,
      limit,
      sortBy,
      order,
      days,
      paymentStatus,
      search,
      customerName,
      customerPhone,
      merchantName,
      area,
      minAmount,
      maxAmount,
      deliveryType,
      hubId,
    } = query;
    // Merchant view - only their parcels
    if (user.role === UserRole.MERCHANT) {
      if (!user.merchantId) {
        throw new ForbiddenException('merchantId missing in auth token');
      }
      const result = await this.parcelsService.findAllForMerchant(
        user.merchantId,
        page,
        limit,
        status,
        storeId,
        sortBy,
        order,
        days,
        paymentStatus,
        search,
        customerName,
        customerPhone,
        merchantName,
        area,
        minAmount,
        maxAmount,
        deliveryType,
      );
      return {
        parcels: result.items.map(toParcelListItem),
        pagination: result.pagination,
        message: 'Parcels retrieved successfully',
      };
    }

    // Hub Manager view - only their hub's parcels
    if (user.role === UserRole.HUB_MANAGER) {
      if (!user.hubId) {
        throw new ForbiddenException('hubId missing in auth token');
      }
      const result = await this.parcelsService.findAllForHub(
        user.hubId,
        page,
        limit,
        status,
        sortBy,
        order,
        days,
        paymentStatus,
        search,
        merchantId,
        storeId,
        customerName,
        customerPhone,
        merchantName,
        area,
        minAmount,
        maxAmount,
        deliveryType,
      );
      return {
        parcels: result.items.map(toParcelListItem),
        pagination: result.pagination,
        message: 'Parcels retrieved successfully',
      };
    }

    // Admin view - all parcels
    const result = await this.parcelsService.findAll(
      page,
      limit,
      status,
      merchantId,
      sortBy,
      order,
      days,
      paymentStatus,
      search,
      customerName,
      customerPhone,
      merchantName,
      area,
      minAmount,
      maxAmount,
      deliveryType,
      storeId,
      hubId,
    );
    return {
      parcels: result.items.map(toParcelListItem),
      pagination: result.pagination,
      message: 'Parcels retrieved successfully',
    };
  }

  @Get('hub/in-hub')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER)
  async getHubParcelsInHubStatuses(
    @CurrentUser('hubId') hubId: string,
    @Query() query: ParcelQueryDto,
  ) {
    if (!hubId) {
      throw new ForbiddenException('hubId missing in auth token');
    }

    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      order = 'DESC',
      search,
      merchantId,
      storeId,
      customerName,
      customerPhone,
      merchantName,
      area,
      minAmount,
      maxAmount,
      deliveryType,
    } = query;

    const result = await this.parcelsService.findInHubStatusesForHub(
      hubId,
      page,
      limit,
      sortBy,
      order,
      search,
      merchantId,
      storeId,
      customerName,
      customerPhone,
      merchantName,
      area,
      minAmount,
      maxAmount,
      deliveryType,
    );

    return {
      success: true,
      data: result.items.map(toParcelListItem),
      pagination: result.pagination,
      message: 'Hub parcels in IN_HUB/RETURNED_TO_HUB retrieved successfully',
    };
  }

  /**
   * Get today's parcel summary for merchant
   * Shows count and total COD amount for each status category
   * GET /parcels/today-summary
   */
  @Get('today-summary')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  async getTodaySummary(
    @CurrentUser('merchantId') merchantId: string,
    @Query() query: TodaySummaryQueryDto,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const summary = await this.parcelsService.getTodaySummary(
      merchantId,
      query.date,
    );

    return {
      success: true,
      data: summary,
      message: "Today's parcel summary retrieved successfully",
    };
  }

  /**
   * Get lifetime parcel summary for merchant
   * Shows count and total COD amount for each status category (all time)
   * GET /parcels/lifetime-summary
   */
  @Get('lifetime-summary')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  async getLifetimeSummary(
    @CurrentUser('merchantId') merchantId: string,
    @Query() query: LifetimeSummaryQueryDto,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const summary = await this.parcelsService.getLifetimeSummary(
      merchantId,
      query.startDate,
      query.endDate,
    );

    return {
      success: true,
      data: summary,
      message: 'Lifetime parcel summary retrieved successfully',
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.RIDER,
    UserRole.HUB_MANAGER,
  )
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('merchantId') merchantId: string,
    @CurrentUser('riderId') riderId: string,
    @CurrentUser('hubId') hubId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;
    const isRider = role === UserRole.RIDER;
    const isHubManager = role === UserRole.HUB_MANAGER;

    if (!isAdmin && !isRider && !isHubManager && !merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const parcel = await this.parcelsService.findOne(
      id,
      merchantId,
      isAdmin,
      isRider ? riderId : null,
      isHubManager ? hubId : null,
    );
    return {
      parcel: toParcelDetail(parcel),
      message: 'Parcel retrieved successfully',
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateParcelDto: UpdateParcelDto,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('merchantId') merchantId: string,
    @CurrentUser('hubId') hubId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;
    const isHubManager = role === UserRole.HUB_MANAGER;

    if (!isAdmin && !isHubManager && !merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    if (isHubManager && !hubId) {
      throw new ForbiddenException('hubId missing in auth token');
    }

    const parcel = await this.parcelsService.update(id, updateParcelDto, {
      role,
      merchantId: merchantId || null,
      hubId: hubId || null,
    });

    const detailedParcel = await this.parcelsService.findOne(
      parcel.id,
      isAdmin || isHubManager ? null : merchantId,
      isAdmin,
      null,
      isHubManager ? hubId : null,
    );

    return {
      parcel: toParcelDetail(detailedParcel),
      message: 'Parcel updated successfully',
    };
  }

  @Patch(':id/hub-charges')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async updateHubCharges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateChargesDto: UpdateParcelChargesDto,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('hubId') hubId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !hubId) {
      throw new ForbiddenException('hubId missing in auth token');
    }

    const parcel = await this.parcelsService.updateHubCharges(
      id,
      updateChargesDto,
      role,
      isAdmin ? null : hubId,
    );

    const detailedParcel = await this.parcelsService.findOne(
      parcel.id,
      null,
      isAdmin,
      null,
      isAdmin ? null : hubId,
    );

    return {
      parcel: toParcelDetail(detailedParcel),
      message: 'Parcel charges updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const result = await this.parcelsService.remove(id, merchantId, isAdmin);
    return result;
  }

  /**
   * NEW ENDPOINT: Receives raw/noisy bulk data from frontend for heuristic suggestions.
   * This API performs address resolution and preliminary pricing calculation.
   */
  @Post('bulk-suggest')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  async bulkSuggest(
    @Body() bulkSuggestDto: BulkSuggestDto,
    @CurrentUser('merchantId') merchantId: string,
  ): Promise<{ message: string; results: SuggestionResult[] }> {
    if (!merchantId)
      throw new ForbiddenException('Merchant ID missing in auth token');

    const suggestions = await this.parcelsService.getBulkSuggestions(
      bulkSuggestDto.items,
      merchantId,
    );

    return {
      message: 'Address and pricing suggestions generated successfully.',
      results: suggestions,
    };
  }

  /**
   * FINAL ENDPOINT: Receives user-confirmed, validated data (with area ID and calculated charge) for final parcel creation.
   */
  @Post('bulk-create')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.MERCHANT)
  async bulkCreateConfirmedBatch(
    @Body() bulkConfirmedDto: BulkSuggestDto, // Expects the confirmed batch data
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ): Promise<{
    message: string;
    summary: { total: number; success: number; failed: number };
    results: ParcelCreationResult[];
  }> {
    if (!merchantId)
      throw new ForbiddenException('Merchant ID missing in auth token');

    const confirmationResult =
      await this.parcelsService.bulkCreateConfirmedBatch(
        bulkConfirmedDto.items,
        userId,
        merchantId,
      );

    return {
      message: 'Batch parcels created successfully.',
      summary: confirmationResult.summary,
      results: confirmationResult.results,
    };
  }
}
