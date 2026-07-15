import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { HubsService } from './hubs.service';
import { ParcelsService } from '../parcels/parcels.service';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { AssignParcelToRiderDto } from '../riders/dto/assign-parcel.dto';
import { BulkAssignParcelsToRiderDto } from '../riders/dto/bulk-assign-parcel.dto';
import {
  BulkTransferDto,
  TransferParcelDto,
} from '../parcels/dto/transfer-parcel.dto';
import { BulkReceiveParcelsDto } from './dto/bulk-receive-parcels.dto';
import { BulkReturnToMerchantDto } from './dto/bulk-return-to-merchant.dto';
import { BulkRescheduleDeliveryDto } from './dto/bulk-reschedule-delivery.dto';
import { RecordSettlementDto } from './dto/record-settlement.dto';
import { CalculateSettlementDto } from './dto/calculate-settlement.dto';
import { SettlementQueryDto } from './dto/settlement-query.dto';
import { CreateTransferRecordDto } from './dto/create-transfer-record.dto';
import { UpdateTransferRecordDto } from './dto/update-transfer-record.dto';
import { TransferRecordQueryDto } from './dto/transfer-record-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ParcelType, ParcelTypeLabel } from '../common/enums/parcel-type.enum';
import {
  DeliveryType,
  DeliveryTypeLabel,
} from '../common/enums/delivery-type.enum';
import { HubParcelQueryDto } from './dto/hub-parcel-query.dto';
import { DeliveryOutcomeQueryDto } from './dto/delivery-outcome-query.dto';
import {
  toHubListItem,
  toHubDetail,
  toParcelListItem,
  toParcelDetail,
  toParcelActionResponse,
} from '../common/interfaces/responses.interface';
import {
  BulkResolveReportDto,
  ResolveReportDto,
} from './dto/resolve-report.dto';
import { ParcelReportQueryDto } from './dto/parcel-report-query.dto';
import { CreateParcelDto } from 'src/parcels/dto/create-parcel.dto';
import { BulkAcceptDto } from './dto/bulk-accept-parcels.dto';
import { FinancialReportQueryDto } from './dto/financial-report-query.dto';
import { CreateHubExpenseDto } from './dto/create-hub-expense.dto';
import { CollectCodDto } from './dto/collect-cod.dto';
import { ReviewFinanceRequestDto } from './dto/review-finance-request.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { RiderPerformanceQueryDto } from './dto/rider-performance-query.dto';
import { BulkTransferFromRidersDto } from './dto/bulk-transfer-from-riders.dto';
import { RiderTransferQueryDto } from './dto/rider-transfer-query.dto';
import { RiderAssignedParcelsQueryDto } from './dto/rider-assigned-parcels-query.dto';
import { TransferSelectedParcelsDto } from './dto/transfer-selected-parcels.dto';
import { HubDashboardService } from './services/hub-dashboard.service';
import {
  HubDashboardFlowQueryDto,
  HubDashboardLifetimeQueryDto,
  HubDashboardOngoingQueryDto,
  HubDashboardOverviewQueryDto,
  HubDashboardRiderQueryDto,
} from './dto/hub-dashboard-query.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

// File storage configuration for transfer proofs
const transferProofStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/transfer-proofs';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `transfer-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException('Only JPG, PNG, and PDF files are allowed'),
      false,
    );
  }
};

@Controller(['api/hubs', 'hubs'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class HubsController {
  constructor(
    private readonly hubsService: HubsService,
    private readonly parcelsService: ParcelsService,
    private readonly hubDashboardService: HubDashboardService,
  ) {}

  private getDashboardHubId(user: JwtPayload): string {
    if (!user.hubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    return user.hubId;
  }

  // ===== HUB MANAGER ENDPOINTS =====
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Get('my-hub')
  async getMyHub(@CurrentUser() user: any) {
    const hub = await this.hubsService.getMyHub(user.userId);
    return {
      hub: toHubDetail(hub),
      message: 'Hub information retrieved successfully',
    };
  }

  // ===== ADMIN ENDPOINTS (non-dynamic routes first) =====
  @Roles(UserRole.ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createHubDto: CreateHubDto) {
    const hub = await this.hubsService.create(createHubDto);
    return {
      id: hub.id,
      hub_code: hub.hub_code,
      message: 'Hub created successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const { hubs, total } = await this.hubsService.findAll(
      pageNum,
      limitNum,
      search,
    );
    return {
      hubs: hubs.map(toHubListItem),
      total,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'Hubs retrieved successfully',
    };
  }

  // ===== HUB MANAGER PARCEL OPERATIONS =====
  // NOTE: These specific routes MUST come before dynamic :id routes

  /**
   * Get delivery outcomes (Hub Manager)
   *
   * PURPOSE: View parcels with delivery outcomes that have been cleared:
   * - DELIVERED: Successfully delivered, COD collected from rider
   * - PARTIAL_DELIVERY: Partial items delivered, COD collected
   * - EXCHANGE: Items exchanged, COD collected
   * - PAID_RETURN: Customer refused but paid return fee, COD collected
   * - RETURNED: Customer refused, parcels returned
   *
   * Shows parcels AFTER COD collection (cod_cleared_at IS NOT NULL)
   * Filters: status, zone, merchantId
   * Pagination: page (default 1), limit (default 10, max 100)
   */
  @Get('parcels/history')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getParcelHistory(
    @CurrentUser() user: any,
    @Query() query: DeliveryOutcomeQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.getParcelHistory(
      hubId,
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.order,
      query.status,
      query.merchantId,
      undefined, // storeId
      query.customerName,
      query.customerPhone,
      query.merchantName,
      query.zone, // area/zone
      query.minAmount,
      query.maxAmount,
      query.deliveryType,
    );

    return {
      success: true,
      data: result,
      message: 'Parcel history retrieved successfully',
    };
  }

  /**
   * Get delivery outcomes (Hub Manager)
   *
   * PURPOSE: View parcels with delivery outcomes that have been cleared:
   * - DELIVERED: Successfully delivered, COD collected from rider
   * - PARTIAL_DELIVERY: Partial items delivered, COD collected
   * - EXCHANGE: Items exchanged, COD collected
   * - PAID_RETURN: Customer refused but paid return fee, COD collected
   * - RETURNED: Customer refused, parcels returned
   *
   * Shows parcels AFTER COD collection (cod_cleared_at IS NOT NULL)
   * Filters: status, zone, merchantId
   * Pagination: page (default 1), limit (default 10, max 100)
   */
  @Get('parcels/delivery-outcomes')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getDeliveryOutcomes(
    @CurrentUser() user: any,
    @Query() query: DeliveryOutcomeQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.getDeliveryOutcomes(hubId, {
      status: query.status,
      zone: query.zone,
      merchantId: query.merchantId,
      page: query.page,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy,
      order: query.order,
      customerName: query.customerName,
      customerPhone: query.customerPhone,
      merchantName: query.merchantName,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      deliveryType: query.deliveryType,
    });

    return {
      success: true,
      data: result,
      message: 'Delivery outcomes retrieved successfully',
    };
  }

  /**
   * Get COD cleared parcels for a rider (Hub Manager)
   *
   * PURPOSE: View parcels ready for COD collection from rider
   * Shows completed deliveries (DELIVERED, PARTIAL_DELIVERY, EXCHANGE)
   * Only shows parcels where cod_cleared_at is NULL (before COD collection)
   * Returns total collectable amount from all pending parcels
   *
   * Query Parameters:
   * - rider_id: UUID of the rider (required)
   * - page: Page number (default 1)
   * - limit: Items per page (default 10, max 100)
   */
  @Get('parcels/cleared-deliveries')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getClearedDeliveries(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const riderId = query.rider_id;
    if (!riderId) {
      throw new BadRequestException('rider_id query parameter is required');
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(riderId.trim())) {
      throw new BadRequestException(
        'Invalid rider_id format. Must be a valid UUID',
      );
    }

    const result = await this.parcelsService.getRiderClearedParcels(
      user.hubId,
      riderId.trim(),
      {
        page: query.page,
        limit: Math.min(query.limit ?? 10, 100),
        search: query.search,
        sortBy: query.sortBy,
        order: query.order,
        merchantId: query.merchantId,
        storeId: query.storeId,
        customerName: query.customerName,
        customerPhone: query.customerPhone,
        merchantName: query.merchantName,
        area: query.area,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        deliveryType: query.deliveryType,
        status: query.status,
      },
    );

    return {
      success: true,
      data: result,
      message: 'Cleared deliveries retrieved successfully',
    };
  }

  /**
   * Get Carrybee cleared deliveries (Hub Manager)
   *
   * PURPOSE: View completed Carrybee deliveries awaiting COD collection
   * Shows parcels where Carrybee collected COD but hub hasn't settled yet
   *
   * Query params:
   * - provider_id: UUID of the third-party provider (required)
   * - page: Page number (default 1)
   * - limit: Items per page (default 10, max 100)
   */
  @Get('parcels/carrybee-cleared-deliveries')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getCarrybeeClearedDeliveries(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const providerId = query.provider_id;
    if (!providerId) {
      throw new BadRequestException('provider_id query parameter is required');
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(providerId.trim())) {
      throw new BadRequestException(
        'Invalid provider_id format. Must be a valid UUID',
      );
    }

    const result = await this.parcelsService.getCarrybeeClearedParcels(
      user.hubId,
      providerId.trim(),
      {
        page: query.page,
        limit: Math.min(query.limit ?? 10, 100),
        search: query.search,
        sortBy: query.sortBy,
        order: query.order,
        merchantId: query.merchantId,
        storeId: query.storeId,
        customerName: query.customerName,
        customerPhone: query.customerPhone,
        merchantName: query.merchantName,
        area: query.area,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        deliveryType: query.deliveryType,
      },
    );

    return {
      success: true,
      data: result,
      message: 'Carrybee cleared deliveries retrieved successfully',
    };
  }

  /**
   * Get rescheduled deliveries (Hub Manager)
   *
   * PURPOSE: View parcels with DELIVERY_RESCHEDULED status
   * These need to be prepared for redelivery (reset to IN_HUB)
   */
  @Get('parcels/rescheduled')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getRescheduledDeliveries(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.getRescheduledDeliveries(
      hubId,
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.order,
      query.merchantId,
      query.storeId,
      query.customerName,
      query.customerPhone,
      query.merchantName,
      query.area,
      query.minAmount,
      query.maxAmount,
      query.deliveryType,
    );

    return {
      success: true,
      data: result,
      message: 'Rescheduled deliveries retrieved successfully',
    };
  }

  /**
   * Get return to merchant parcels (Hub Manager)
   *
   * PURPOSE: View parcels with RETURN_TO_MERCHANT status
   * These are original parcels that have been marked for return
   */
  @Get('parcels/return-to-merchant')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getReturnToMerchantParcels(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.getReturnToMerchantParcels(
      hubId,
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.order,
      query.merchantId,
      query.storeId,
      query.customerName,
      query.customerPhone,
      query.merchantName,
      query.area,
      query.minAmount,
      query.maxAmount,
      query.deliveryType,
    );

    return {
      success: true,
      data: result,
      message: 'Return to merchant parcels retrieved successfully',
    };
  }

  /**
   * Mark parcel as RETURN_TO_MERCHANT (Hub Manager)
   *
   * Creates a NEW return parcel to track the return journey to merchant.
   * Use this for delivery outcomes: RETURNED, PAID_RETURN, PARTIAL_DELIVERY, EXCHANGE
   */
  @Patch('parcels/:id/return-to-merchant')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async markReturnToMerchant(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body('notes') notes?: string,
  ) {
    const result = await this.parcelsService.markReturnToMerchant(
      id,
      user.hubId,
      notes,
    );

    return {
      success: true,
      data: {
        original_parcel: toParcelListItem(result.original_parcel),
        return_parcel: toParcelListItem(result.return_parcel),
      },
      message:
        'Return parcel created. Assign to rider for delivery back to merchant.',
    };
  }

  /**
   * Bulk mark parcels as RETURN_TO_MERCHANT (Hub Manager)
   *
   * Creates return parcels for each original parcel.
   * Request body: { "parcel_ids": ["uuid1", "uuid2", ...] }
   */
  @Post('parcels/bulk-return-to-merchant')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkReturnToMerchant(
    @Body() dto: BulkReturnToMerchantDto,
    @CurrentUser() user: any,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.bulkMarkReturnToMerchant(
      dto.parcel_ids,
      hubId,
    );

    return {
      success: true,
      data: {
        summary: {
          total: dto.parcel_ids.length,
          success: result.success,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        result.failed === 0
          ? `${result.success} parcel${result.success !== 1 ? 's' : ''} marked for return to merchant`
          : `${result.success} parcel${result.success !== 1 ? 's' : ''} marked for return, ${result.failed} failed`,
    };
  }

  /**
   * Mark parcel as DELIVERY_RESCHEDULED (Hub Manager)
   *
   * Used to reschedule delivery from delivery outcomes list.
   * Parcel will appear in /hubs/parcels/rescheduled endpoint.
   */
  @Patch('parcels/:id/reschedule-delivery')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async rescheduleDelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.markAsRescheduled(id, user.hubId);

    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message:
        'Parcel marked for redelivery. It will appear in rescheduled list.',
    };
  }

  /**
   * Bulk mark parcels as DELIVERY_RESCHEDULED (Hub Manager)
   *
   * Request body: { "parcel_ids": ["uuid1", "uuid2", ...] }
   */
  @Post('parcels/bulk-reschedule-delivery')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkRescheduleDelivery(
    @Body() dto: BulkRescheduleDeliveryDto,
    @CurrentUser() user: any,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const result = await this.parcelsService.bulkMarkAsRescheduled(
      dto.parcel_ids,
      hubId,
    );

    return {
      success: true,
      data: {
        summary: {
          total: dto.parcel_ids.length,
          success: result.success,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        result.failed === 0
          ? `${result.success} parcel${result.success !== 1 ? 's' : ''} marked for rescheduled delivery`
          : `${result.success} parcel${result.success !== 1 ? 's' : ''} rescheduled, ${result.failed} failed`,
    };
  }

  /**
   * Prepare rescheduled parcel for redelivery (Hub Manager)
   *
   * Resets DELIVERY_RESCHEDULED → IN_HUB so it can be assigned to rider again
   */
  @Patch('parcels/:id/prepare-redelivery')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async prepareForRedelivery(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.prepareForRedelivery(
      id,
      user.hubId,
    );

    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel ready for redelivery. You can now assign it to a rider.',
    };
  }

  /**
   * Get parcels for this hub (Hub Manager)
   */
  @Get('parcels')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getHubParcels(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const {
      status,
      page,
      limit,
      sortBy,
      order,
      search,
      paymentStatus,
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
    const result = await this.parcelsService.findAllForHub(
      user.hubId,
      page,
      limit,
      status,
      sortBy,
      order,
      undefined,
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
      success: true,
      data: {
        parcels: result.items.map(toParcelListItem),
        pagination: result.pagination,
      },
      message: 'Parcels retrieved successfully',
    };
  }

  /**
   * Load every data section required by the Hub Panel dashboard in one request.
   * This is additive and intentionally does not change dashboard/summary.
   */
  @Get('dashboard/overview')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardOverview(
    @CurrentUser() user: JwtPayload,
    @Query() query: HubDashboardOverviewQueryDto,
  ) {
    const data = await this.hubDashboardService.getOverview(
      this.getDashboardHubId(user),
      query,
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard overview retrieved successfully',
    };
  }

  /**
   * Independently refresh the parcel-flow chart.
   */
  @Get('dashboard/parcel-flow')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardParcelFlow(
    @CurrentUser() user: JwtPayload,
    @Query() query: HubDashboardFlowQueryDto,
  ) {
    const data = await this.hubDashboardService.getParcelFlow(
      this.getDashboardHubId(user),
      query,
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard parcel flow retrieved successfully',
    };
  }

  /**
   * Independently refresh actionable dashboard alerts.
   */
  @Get('dashboard/pending-actions')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardPendingActions(@CurrentUser() user: JwtPayload) {
    const data = await this.hubDashboardService.getPendingActions(
      this.getDashboardHubId(user),
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard pending actions retrieved successfully',
    };
  }

  /**
   * Paginated rider widget with all/on-duty/break/leave filters.
   */
  @Get('dashboard/rider-status')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardRiderStatus(
    @CurrentUser() user: JwtPayload,
    @Query() query: HubDashboardRiderQueryDto,
  ) {
    const data = await this.hubDashboardService.getRiderStatus(
      this.getDashboardHubId(user),
      query,
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard rider status retrieved successfully',
    };
  }

  /**
   * Paginated deliveries table used by the dashboard.
   */
  @Get('dashboard/ongoing-deliveries')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardOngoingDeliveries(
    @CurrentUser() user: JwtPayload,
    @Query() query: HubDashboardOngoingQueryDto,
  ) {
    const data = await this.hubDashboardService.getOngoingDeliveries(
      this.getDashboardHubId(user),
      query,
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard deliveries retrieved successfully',
    };
  }

  /**
   * Independently refresh the lifetime parcel cards.
   */
  @Get('dashboard/lifetime-summary')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardLifetimeSummary(
    @CurrentUser() user: JwtPayload,
    @Query() query: HubDashboardLifetimeQueryDto,
  ) {
    const data = await this.hubDashboardService.getLifetimeSummary(
      this.getDashboardHubId(user),
      query,
    );

    return {
      success: true,
      data,
      message: 'Hub dashboard lifetime summary retrieved successfully',
    };
  }

  /**
   * Get hub dashboard summary cards for Hub Manager dashboard
   */
  @Get('dashboard/summary')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardSummary(@CurrentUser() user: any) {
    if (!user.hubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const summary = await this.hubsService.getHubDashboardSummary(user.hubId);

    return {
      success: true,
      data: summary,
      message: 'Hub dashboard summary retrieved successfully',
    };
  }

  /**
   * Get today's parcels for Hub Manager dashboard (not yet cleared by hub)
   */
  @Get('dashboard/today-parcels')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardTodayParcels(@CurrentUser() user: any) {
    if (!user.hubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const parcels = await this.parcelsService.getTodayDashboardParcelsForHub(
      user.hubId,
    );

    return {
      success: true,
      data: parcels,
      message: 'Today dashboard parcels retrieved successfully',
    };
  }

  /**
   * Get parcel detail for Hub Panel dashboard view (Hub Manager)
   * Provides grouped response for dashboard sections and action controls.
   */
  @Get('dashboard/parcels/:id')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDashboardParcelDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    if (!user.hubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const parcel = await this.parcelsService.findOne(
      id,
      null,
      false,
      null,
      user.hubId,
    );

    const detail = toParcelDetail(parcel);

    const codAmount = Number(detail.cod_amount ?? 0);
    const deliveryCharge = Number(detail.delivery_charge ?? 0);
    const weightCharge = Number(detail.weight_charge ?? 0);
    const codCharge = Number(detail.cod_charge ?? 0);
    const totalCharge = Number(detail.total_charge ?? 0);
    const discount = Number(detail.discount ?? 0);
    const parcelTypeValue =
      typeof detail.parcel_type === 'number' ? detail.parcel_type : null;
    const deliveryTypeValue =
      typeof detail.delivery_type === 'number' ? detail.delivery_type : null;

    const parcelTypeKey = parcelTypeValue
      ? (ParcelType[parcelTypeValue] ?? null)
      : null;
    const parcelTypeLabel = parcelTypeValue
      ? (ParcelTypeLabel[parcelTypeValue as ParcelType] ?? null)
      : null;
    const deliveryTypeKey = deliveryTypeValue
      ? (DeliveryType[deliveryTypeValue] ?? null)
      : null;
    const deliveryTypeLabel = deliveryTypeValue
      ? (DeliveryTypeLabel[deliveryTypeValue as DeliveryType] ?? null)
      : null;

    const assignedRider = detail.assigned_rider
      ? {
          ...detail.assigned_rider,
          rider_id: detail.assigned_rider.id,
          rider_name:
            detail.assigned_rider.user?.full_name ??
            detail.assigned_rider.full_name ??
            null,
          phone:
            detail.assigned_rider.user?.phone ??
            detail.assigned_rider.phone ??
            null,
        }
      : null;

    const customerInfo = {
      ...(detail.customer ?? {}),
      customer_id: detail.customer?.id ?? detail.customer_id ?? null,
      customer_name:
        detail.customer?.customer_name ?? detail.customer_name ?? null,
      phone_number:
        detail.customer?.phone_number ?? detail.customer_phone ?? null,
      secondary_number:
        detail.customer?.secondary_number ??
        detail.customer_secondary_phone ??
        null,
      customer_address:
        detail.customer?.customer_address ?? detail.customer_address ?? null,
      // Backward-compatible aliases for existing clients.
      phone: detail.customer?.phone_number ?? detail.customer_phone ?? null,
      secondary_phone:
        detail.customer?.secondary_number ??
        detail.customer_secondary_phone ??
        null,
      address:
        detail.customer?.customer_address ?? detail.customer_address ?? null,
    };

    return {
      success: true,
      data: {
        parcel_id: detail.id,
        tracking_number: detail.tracking_number,

        merchant_info: {
          merchant_id: detail.merchant?.id ?? null,
          merchant_name: detail.merchant?.user?.full_name ?? null,
          store_name: detail.store?.business_name ?? null,
          phone:
            detail.store?.phone_number ?? detail.merchant?.user?.phone ?? null,
          address:
            detail.store?.business_address ??
            detail.merchant?.full_address ??
            null,
        },

        assigned_rider: assignedRider,

        customer_info: customerInfo,

        live_status_controls: {
          current_status: detail.status,
        },

        package_information: {
          product_description: detail.product_description,
          special_instructions: detail.special_instructions,
          admin_notes: detail.admin_notes,
        },

        financial_summary: {
          cod_amount: codAmount,
          delivery_charge: deliveryCharge,
          weight_charge: weightCharge,
          cod_charge: codCharge,
          discount,
          total_charge: totalCharge,
          total_payable: Number((codAmount - totalCharge).toFixed(2)),
        },

        parcel_details: {
          parcel_weight: detail.product_weight,
          parcel_type: detail.parcel_type,
          parcel_type_key: parcelTypeKey,
          parcel_type_label: parcelTypeLabel,
          delivery_type: detail.delivery_type,
          delivery_type_key: deliveryTypeKey,
          delivery_type_label: deliveryTypeLabel,
          is_cod: !!detail.is_cod,
          is_exchange: !!detail.is_exchange,
        },

        enum_mappings: {
          parcel_type: [
            {
              value: ParcelType.PARCEL,
              key: ParcelType[ParcelType.PARCEL],
              label: ParcelTypeLabel[ParcelType.PARCEL],
            },
            {
              value: ParcelType.BOOK,
              key: ParcelType[ParcelType.BOOK],
              label: ParcelTypeLabel[ParcelType.BOOK],
            },
            {
              value: ParcelType.DOCUMENT,
              key: ParcelType[ParcelType.DOCUMENT],
              label: ParcelTypeLabel[ParcelType.DOCUMENT],
            },
          ],
          delivery_type: [
            {
              value: DeliveryType.NORMAL,
              key: DeliveryType[DeliveryType.NORMAL],
              label: DeliveryTypeLabel[DeliveryType.NORMAL],
            },
            {
              value: DeliveryType.EXPRESS,
              key: DeliveryType[DeliveryType.EXPRESS],
              label: DeliveryTypeLabel[DeliveryType.EXPRESS],
            },
            {
              value: DeliveryType.SAME_DAY,
              key: DeliveryType[DeliveryType.SAME_DAY],
              label: DeliveryTypeLabel[DeliveryType.SAME_DAY],
            },
          ],
        },
      },
      message: 'Hub dashboard parcel detail retrieved successfully',
    };
  }

  // ===== HUB MANAGER: PARCEL CREATION & MERCHANTS =====

  /**
   * Get merchants associated with stores assigned to this Hub
   * Used for the "Select Merchant" dropdown in "Create and Receive"
   */
  @Get('merchants')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getHubMerchants(@CurrentUser() user: any) {
    const merchants = await this.hubsService.getHubMerchants(user.hubId);
    return {
      success: true,
      data: merchants,
      message: 'Hub merchants retrieved successfully',
    };
  }

  /**
   * Create Parcel (Hub Manager)
   * Creates a parcel with PENDING status — must be received from the receive queue
   */
  @Post('parcels/create-and-receive')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async createAndReceiveParcel(
    @Body() createParcelDto: CreateParcelDto,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.createByHubManager(
      createParcelDto,
      user.userId,
      user.hubId,
    );

    return {
      success: true,
      data: {
        parcel: toParcelListItem(parcel),
      },
      message:
        'Parcel created successfully. Please receive it from the receive queue.',
    };
  }

  /**
   * Get parcels awaiting receipt (PENDING/PICKED_UP)
   */
  @Get('parcels/received')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getParcelsForReceipt(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const {
      status,
      page,
      limit,
      sortBy,
      order,
      search,
      paymentStatus,
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
    const result = await this.parcelsService.findAllForHub(
      user.hubId,
      page,
      limit,
      status,
      sortBy,
      order,
      undefined,
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
      true,
    );
    return {
      success: true,
      data: {
        parcels: result.items.map(toParcelListItem),
        pagination: result.pagination,
      },
      message: 'Parcels awaiting receipt retrieved successfully',
    };
  }

  /**
   * Bulk mark parcels as received (PENDING/PICKED_UP → IN_HUB)
   *
   * Accepts array of parcel IDs and returns result for each.
   * Request body: { "parcel_ids": ["uuid1", "uuid2", ...] }
   */
  @Post('parcels/receive')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async bulkReceiveParcels(
    @Body() dto: BulkReceiveParcelsDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.parcelsService.bulkMarkAsReceived(
      dto.parcel_ids,
      user.hubId,
    );

    return {
      success: true,
      data: {
        summary: {
          total: dto.parcel_ids.length,
          success: result.success,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        result.failed === 0
          ? `${result.success} parcel${result.success !== 1 ? 's' : ''} marked as received successfully`
          : `${result.success} parcel${result.success !== 1 ? 's' : ''} received, ${result.failed} failed`,
    };
  }

  /**
   * Get parcels ready for rider assignment (IN_HUB)
   */
  @Get('parcels/for-assignment')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getParcelsForAssignment(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const { parcels, total } =
      await this.parcelsService.getParcelsForAssignment(
        user.hubId,
        query.page,
        query.limit,
        query.search,
        query.sortBy,
        query.order,
        query.merchantId,
        query.storeId,
        query.customerName,
        query.customerPhone,
        query.merchantName,
        query.area,
        query.minAmount,
        query.maxAmount,
        query.deliveryType,
      );

    return {
      success: true,
      data: {
        parcels: parcels.map(toParcelListItem),
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / (query.limit || 20)),
        },
      },
      message: 'Parcels for assignment retrieved successfully',
    };
  }

  /**
   * System-wide parcels ready for assignment (Admin)
   */
  @Get('parcels/for-assignment/admin')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getParcelsForAssignmentAdmin(@Query() query: HubParcelQueryDto) {
    const { parcels, total } =
      await this.parcelsService.getParcelsForAssignment(
        undefined,
        query.page,
        query.limit,
        query.search,
        query.sortBy,
        query.order,
        query.merchantId,
        query.storeId,
        query.customerName,
        query.customerPhone,
        query.merchantName,
        query.area,
        query.minAmount,
        query.maxAmount,
        query.deliveryType,
      );

    return {
      success: true,
      data: {
        parcels: parcels.map(toParcelListItem),
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / (query.limit || 20)),
        },
      },
      message: 'Parcels for assignment (system-wide) retrieved successfully',
    };
  }

  /**
   * Assign parcel to rider (Legacy - single parcel)
   * @deprecated Use POST /hubs/parcels/assign-rider instead
   */
  @Patch('parcels/:id/assign-rider')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignParcelToRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignDto: AssignParcelToRiderDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const parcel = await this.parcelsService.assignToRider(
      id,
      assignDto,
      isAdmin ? undefined : user.hubId,
      isAdmin,
    );
    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel assigned to rider successfully',
    };
  }

  /**
   * Assign parcels to rider (Unified endpoint)
   *
   * Supports both single and bulk parcel assignment:
   * - Single: { rider_id: "...", parcel_id: "..." }
   * - Bulk:   { rider_id: "...", parcel_ids: ["...", "..."] }
   */
  @Post('parcels/assign-rider')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async assignParcelsToRider(
    @Body() assignDto: BulkAssignParcelsToRiderDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const result = await this.parcelsService.bulkAssignToRider(
      assignDto,
      isAdmin ? undefined : user.hubId,
      isAdmin,
    );

    // Calculate total from what was actually processed
    const total = result.success + result.failed;

    return {
      success: true,
      data: {
        summary: {
          total,
          success: result.success,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        total === 1
          ? result.success === 1
            ? 'Parcel assigned to rider successfully'
            : 'Failed to assign parcel'
          : `${result.success} parcel${result.success !== 1 ? 's' : ''} assigned to rider successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
    };
  }

  /**
   * Bulk transfer all assigned parcels from one or more source riders to a target rider
   * Useful when reassigning workload between riders in the same hub
   */
  @Post('parcels/transfer-from-riders')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async transferParcelsFromRiders(
    @Body() dto: BulkTransferFromRidersDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === UserRole.ADMIN;
    const result = await this.parcelsService.bulkTransferFromRiders(
      dto,
      isAdmin ? undefined : user.hubId,
      isAdmin,
    );

    return {
      success: true,
      data: {
        summary: {
          total: result.total,
          transferred: result.transferred,
          failed: result.failed,
        },
        results: result.results,
      },
      message: `${result.transferred} parcels transferred, ${result.failed} failed`,
    };
  }

  /**
   * Get all hubs for transfer
   */
  @Get('list')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getHubsList(@CurrentUser() user: any) {
    const hubs = await this.parcelsService.getAllHubs(user.hubId);
    return {
      success: true,
      data: hubs.map(toHubListItem),
      message: 'Hubs retrieved successfully',
    };
  }

  /**
   * Bulk Transfer parcels to another hub
   */
  @Patch('parcels/bulk-transfer')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async bulkTransferParcels(
    @Body() bulkTransferDto: BulkTransferDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.parcelsService.transferParcelsBulk(
      bulkTransferDto,
      user.hubId,
    );

    // Partial success handling
    if (result.transferred_count === 0 && result.errors.length > 0) {
      throw new BadRequestException({
        message: 'Failed to transfer any parcels',
        errors: result.errors,
      });
    }

    return {
      success: true,
      data: result,
      message: `Successfully transferred ${result.transferred_count} parcels.`,
    };
  }

  /**
   * Transfer parcel to another hub
   */
  @Patch('parcels/:id/transfer')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async transferParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() transferDto: TransferParcelDto,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.transferParcelToHub(
      id,
      transferDto,
      user.hubId,
    );
    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel transferred successfully',
    };
  }

  /**
   * Get incoming parcels (IN_TRANSIT to this hub)
   */
  @Get('parcels/incoming')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getIncomingParcels(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const result = await this.parcelsService.getIncomingParcels(
      user.hubId,
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.order,
      query.merchantId,
      query.storeId,
      query.customerName,
      query.customerPhone,
      query.merchantName,
      query.area,
      query.minAmount,
      query.maxAmount,
      query.deliveryType,
    );
    return {
      success: true,
      data: {
        parcels: result.parcels.map(toParcelListItem),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      message: 'Incoming parcels retrieved successfully',
    };
  }

  /**
   * Bulk Accept incoming parcels (Hub Manager)
   */
  @Patch('parcels/bulk-accept')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async acceptIncomingParcelsBulk(
    @Body() bulkAcceptDto: BulkAcceptDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.parcelsService.acceptIncomingParcelsBulk(
      bulkAcceptDto,
      user.hubId,
    );

    // Partial success handling
    if (result.accepted_count === 0 && result.errors.length > 0) {
      throw new BadRequestException({
        message: 'Failed to accept any parcels',
        errors: result.errors,
      });
    }

    return {
      success: true,
      data: result,
      message: `Successfully accepted ${result.accepted_count} parcels.`,
    };
  }

  /**
   * Accept incoming parcel from transfer
   */
  @Patch('parcels/:id/accept')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async acceptIncomingParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.acceptIncomingParcel(
      id,
      user.hubId,
    );
    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel accepted successfully',
    };
  }

  /**
   * Get outgoing parcels (transferred from this hub)
   */
  @Get('parcels/outgoing')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getOutgoingParcels(
    @CurrentUser() user: any,
    @Query() query: HubParcelQueryDto,
  ) {
    const result = await this.parcelsService.getOutgoingParcels(
      user.hubId,
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.order,
      query.merchantId,
      query.storeId,
      query.customerName,
      query.customerPhone,
      query.merchantName,
      query.area,
      query.minAmount,
      query.maxAmount,
      query.deliveryType,
    );
    return {
      success: true,
      data: {
        parcels: result.parcels.map(toParcelListItem),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      message: 'Outgoing parcels retrieved successfully',
    };
  }

  /**
   * 1, 2, 5. Get List of Parcel Reports (Search, Filter, Pagination)
   */
  @Get('parcels/reports')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getParcelReports(
    @CurrentUser() user: any,
    @Query() query: ParcelReportQueryDto,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? query.hub_id || null : user.hubId || null;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const { data, total } = await this.parcelsService.getParcelReports(
      effectiveHubId,
      query,
    );

    return {
      success: true,
      data: data,
      pagination: {
        total,
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '10'),
        totalPages: Math.ceil(total / parseInt(query.limit || '10')),
      },
      message: 'Parcel reports retrieved successfully',
    };
  }

  /**
   * Get Single Parcel Report Details
   */
  @Get('parcels/reports/:id')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getSingleParcelReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? null : user.hubId || null;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const report = await this.parcelsService.getParcelReportById(
      effectiveHubId,
      id,
    );

    return {
      success: true,
      data: report,
      message: 'Parcel report details retrieved successfully',
    };
  }

  /**
   * 3. Update Status (Resolve Single Report)
   */
  @Patch('parcels/reports/:id/resolve')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resolveParcelReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? null : user.hubId || null;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    await this.parcelsService.resolveReport(id, dto, effectiveHubId);
    return {
      success: true,
      message: 'Parcel report resolved successfully',
    };
  }

  /**
   * 4. Bulk Action (Resolve Multiple)
   */
  @Post('parcels/reports/bulk-resolve')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async bulkResolveParcelReports(
    @Body() dto: BulkResolveReportDto,
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? null : user.hubId || null;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const result = await this.parcelsService.bulkResolveReports(
      dto,
      effectiveHubId,
    );
    return {
      success: true,
      data: result,
      message: `${result.success_count} parcel reports resolved, ${result.failed_count} failed`,
    };
  }

  /**
   * Delete (Clear) a Resolved Parcel Report
   */
  @Delete('parcels/reports/:id')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteResolvedReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? null : user.hubId || null;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    await this.parcelsService.deleteResolvedReport(id, effectiveHubId);
    return {
      success: true,
      message: 'Resolved parcel report deleted successfully',
    };
  }

  // ===== RIDER TRANSFER ENDPOINTS =====

  /**
   * Get riders list for the Rider Transfer page
   *
   * Hub Manager sees riders from their hub with:
   * - rider ID, name, photo, phone, status (On Duty / Break / Leave)
   * - license no, total assigned parcels count
   */
  @Get('rider-transfer/riders')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getRidersForTransfer(
    @CurrentUser() user: any,
    @Query() query: RiderTransferQueryDto,
  ) {
    const result = await this.hubsService.getRidersForTransfer(user.hubId, {
      search: query.search,
      status: query.status,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      order: query.order,
    });

    return {
      success: true,
      data: {
        riders: result.riders,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
      message: 'Riders retrieved successfully',
    };
  }

  /**
   * Get available target riders for transfer (excludes source rider)
   *
   * When a hub manager has selected parcels from rider A and wants to transfer,
   * this endpoint returns all active riders in the hub EXCLUDING rider A.
   *
   * Query: exclude_rider_ids (comma-separated UUIDs) — rider(s) to exclude
   */
  @Get('rider-transfer/riders/available')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getAvailableRidersForTransfer(
    @CurrentUser() user: any,
    @Query('exclude_rider_ids') excludeRiderIdsStr?: string,
    @Query('search') search?: string,
  ) {
    // Parse comma-separated exclude IDs
    const excludeRiderIds = excludeRiderIdsStr
      ? excludeRiderIdsStr
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];

    const riders = await this.hubsService.getAvailableRidersForTransfer(
      user.hubId,
      excludeRiderIds,
      search,
    );

    return {
      success: true,
      data: { riders },
      message: 'Available riders retrieved successfully',
    };
  }

  /**
   * Get assigned parcels of a specific rider (for Rider Transfer page)
   *
   * Returns parcels with: parcel_id, parcel_tx_id, customer_info (name, phone, full_address),
   * additional_notes, area, merchant (name, phone, photo), amount breakdown
   * (total_amount, delivery_charge, cod_charge, weight_charge, discount),
   * parcel_age, created_at, last_updated
   *
   * Supports: search, area, merchant, amount range, delivery type filters
   */
  @Get('rider-transfer/riders/:riderId/parcels')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getRiderAssignedParcelsForTransfer(
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @CurrentUser() user: any,
    @Query() query: RiderAssignedParcelsQueryDto,
  ) {
    const result = await this.parcelsService.getRiderAssignedParcelsForTransfer(
      riderId,
      user.hubId,
      {
        page: query.page,
        limit: query.limit,
        search: query.search,
        sortBy: query.sortBy,
        order: query.order,
        area: query.area,
        merchantId: query.merchantId,
        merchantName: query.merchantName,
        deliveryType: query.deliveryType,
        minAmount: query.minAmount,
        maxAmount: query.maxAmount,
        status: query.status,
      },
    );

    return {
      success: true,
      data: {
        rider: result.rider,
        parcels: result.parcels,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      },
      message: 'Rider assigned parcels retrieved successfully',
    };
  }

  /**
   * Transfer selected parcels from one rider to another
   *
   * Hub Manager selects specific parcels from a rider's list and transfers
   * them to a target rider. The source rider is determined from the parcels
   * themselves (they're already assigned to someone).
   *
   * Body: { target_rider_id, parcel_ids[], notes? }
   */
  @Post('rider-transfer/transfer')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async transferSelectedParcels(
    @Body() dto: TransferSelectedParcelsDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.parcelsService.transferSelectedParcels(
      dto,
      user.hubId,
    );

    return {
      success: true,
      data: {
        summary: {
          total: result.total,
          transferred: result.transferred,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        result.failed === 0
          ? `${result.transferred} parcel${result.transferred !== 1 ? 's' : ''} transferred successfully`
          : `${result.transferred} parcel${result.transferred !== 1 ? 's' : ''} transferred, ${result.failed} failed`,
    };
  }

  // ===== RIDER SETTLEMENT ENDPOINTS =====

  /**
   * Get riders list for settlement selection
   */
  @Get('riders')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getHubRiders(@CurrentUser() user: any) {
    const riders = await this.hubsService.getHubRiders(user.hubId);
    return {
      success: true,
      data: { riders },
      message: 'Riders retrieved successfully',
    };
  }

  /**
   * Get rider performance statistics (Hub Manager)
   *
   * Returns overall metrics (success rate, total rescheduled, total returned)
   * and per-rider breakdown: Delivered, Rescheduled, Returned, Assigned, Commission, Success Rate
   *
   * Query params:
   * - search: Search by rider name or phone
   * - riderId: Filter by specific rider UUID
   * - period: Preset filter (today, this_week, last_week, this_month, last_month, last_3_months, last_6_months, this_year, all_time)
   * - startDate / endDate: Custom date range (ISO format, overridden by period if set)
   * - page / limit: Pagination
   */
  @Get('riders/performance')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getRiderPerformance(
    @CurrentUser() user: any,
    @Query() query: RiderPerformanceQueryDto,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? query.hub_id : user.hubId;

    const result = await this.hubsService.getRiderPerformance(effectiveHubId, {
      search: query.search,
      riderId: query.riderId,
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page,
      limit: query.limit,
    });

    return {
      success: true,
      data: result,
      message: 'Rider performance retrieved successfully',
    };
  }

  /**
   * Get rider settlement details
   */
  @Get('riders/:riderId/settlement')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getRiderSettlementDetails(
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @CurrentUser() user: any,
  ) {
    const details = await this.hubsService.getRiderSettlementDetails(
      riderId,
      user.hubId,
    );
    return {
      success: true,
      data: details,
      message: 'Settlement details retrieved successfully',
    };
  }

  /**
   * Calculate settlement discrepancy (real-time preview)
   */
  @Post('riders/:riderId/settlement/calculate')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async calculateSettlementDiscrepancy(
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @Body() dto: CalculateSettlementDto,
    @CurrentUser() user: any,
  ) {
    const calculation = await this.hubsService.calculateSettlementDiscrepancy(
      riderId,
      user.hubId,
      dto.cash_received,
    );
    return {
      success: true,
      data: calculation,
      message: 'Settlement calculation completed',
    };
  }

  /**
   * Record settlement transaction
   */
  @Post('riders/:riderId/settlement/record')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async recordSettlement(
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @Body() dto: RecordSettlementDto,
    @CurrentUser() user: any,
  ) {
    const settlement = await this.hubsService.recordSettlement(
      riderId,
      user.hubId,
      user.hubManagerId,
      dto.cash_received,
    );
    return {
      success: true,
      data: {
        settlement_id: settlement.id,
        rider_id: settlement.rider_id,
        total_collected_amount: Number(settlement.total_collected_amount),
        cash_received: Number(settlement.cash_received),
        discrepancy_amount: Number(settlement.discrepancy_amount),
        previous_due_amount: Number(settlement.previous_due_amount),
        new_due_amount: Number(settlement.new_due_amount),
        settlement_status: settlement.settlement_status,
        settled_at: settlement.settled_at,
      },
      message: 'Settlement recorded successfully',
    };
  }

  /**
   * Get settlement history for a rider
   */
  @Get('riders/:riderId/settlement/history')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getRiderSettlementHistory(
    @Param('riderId', ParseUUIDPipe) riderId: string,
    @Query() query: SettlementQueryDto,
    @CurrentUser() user: any,
  ) {
    const history = await this.hubsService.getRiderSettlementHistory(
      riderId,
      user.hubId,
      query,
    );
    return {
      success: true,
      data: history,
      message: 'Settlement history retrieved successfully',
    };
  }

  // ===== MERCHANT PERFORMANCE STATISTICS (HUB MANAGER & ADMIN) =====

  /**
   * Get detailed merchant performance statistics (Hub Manager & Admin)
   * Includes total counts, top merchant info, and a list of all merchants with their performance metrics
   */
  @Get('merchants/performance')
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantPerformance(
    @CurrentUser() user: any,
    @Query('hub_id') queryHubId?: string,
  ) {
    const effectiveHubId =
      user.role === UserRole.ADMIN ? queryHubId : user.hubId;

    if (!effectiveHubId && user.role !== UserRole.ADMIN) {
      throw new BadRequestException('Hub ID is required');
    }

    const result =
      await this.hubsService.getHubMerchantPerformance(effectiveHubId);

    return {
      success: true,
      data: result,
      message: 'Merchant performance statistics retrieved successfully',
    };
  }

  // ===== TOP MERCHANT STATISTICS (HUB MANAGER) =====

  /**
   * Get top merchant and successful parcels count (Hub Manager)
   *
   * Returns the #1 merchant with most successful parcels in this hub
   * along with total successful parcels count for the hub
   */
  @Get('top-merchant')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getTopMerchant(@CurrentUser() user: any) {
    const result = await this.hubsService.getTopMerchantStatistics(user.hubId);

    return {
      success: true,
      data: result,
      message: 'Top merchant statistics retrieved successfully',
    };
  }

  // ===== HUB TRANSFER RECORDS =====

  /**
   * Create transfer record
   */
  @Post('transfer-records')
  @Roles(UserRole.HUB_MANAGER)
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: transferProofStorage,
      fileFilter: fileFilter,
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createTransferRecord(
    @Body() dto: CreateTransferRecordDto,
    @Req() req: any,
  ) {
    const hubManagerId = req.user.hubManagerId;
    const record = await this.hubsService.createTransferRecord(
      hubManagerId,
      dto,
    );

    return {
      success: true,
      data: { transfer_record: record },
      message: 'Transfer record created successfully',
    };
  }

  /**
   * Get hub manager's transfer records
   */
  @Get('transfer-records')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getMyTransferRecords(
    @Query() query: TransferRecordQueryDto,
    @Req() req: any,
  ) {
    const hubManagerId = req.user.hubManagerId;
    const { records, total } =
      await this.hubsService.getHubManagerTransferRecords(hubManagerId, query);

    return {
      success: true,
      data: {
        records,
        pagination: {
          total,
          page: query.page || 1,
          limit: query.limit || 10,
          totalPages: Math.ceil(total / (query.limit || 10)),
        },
      },
      message: 'Transfer records retrieved successfully',
    };
  }

  /**
   * Get single transfer record
   */
  @Get('transfer-records/:id')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getTransferRecordById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const hubManagerId = req.user.hubManagerId;
    const record = await this.hubsService.getTransferRecordById(
      id,
      hubManagerId,
    );

    return {
      success: true,
      data: { transfer_record: record },
      message: 'Transfer record retrieved successfully',
    };
  }

  /**
   * Update transfer record
   */
  @Patch('transfer-records/:id')
  @Roles(UserRole.HUB_MANAGER)
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: transferProofStorage,
      fileFilter: fileFilter,
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateTransferRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransferRecordDto,
    @Req() req: any,
  ) {
    const hubManagerId = req.user.hubManagerId;
    const record = await this.hubsService.updateTransferRecord(
      id,
      hubManagerId,
      dto,
    );

    return {
      success: true,
      data: { transfer_record: record },
      message: 'Transfer record updated successfully',
    };
  }

  /**
   * Delete transfer record
   */
  @Delete('transfer-records/:id')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async deleteTransferRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const hubManagerId = req.user.hubManagerId;
    await this.hubsService.deleteTransferRecord(id, hubManagerId);

    return {
      success: true,
      message: 'Transfer record deleted successfully',
    };
  }

  // 1. Dashboard Stats
  @Get('finance/dashboard')
  @Roles(UserRole.HUB_MANAGER)
  async getFinanceDashboard(@CurrentUser() user: any) {
    const data = await this.hubsService.getFinanceDashboard(user.hubManagerId);
    return { success: true, data };
  }

  // 2. Collect Cash (Manual COD) - Per Rider
  @Post('finance/collect-cod/:rider_id')
  @Roles(UserRole.HUB_MANAGER)
  async collectCod(
    @CurrentUser() user: any,
    @Param('rider_id', ParseUUIDPipe) riderId: string,
    @Body() dto: CollectCodDto,
  ) {
    const settlement = await this.hubsService.collectCashFromRider(
      user.hubManagerId,
      riderId,
      dto,
    );
    return {
      success: true,
      message: 'Cash collected successfully',
      data: settlement,
    };
  }

  // 2B. Collect Cash from Carrybee (Third-Party Provider)
  @Post('finance/collect-cod-carrybee/:provider_id')
  @Roles(UserRole.HUB_MANAGER)
  async collectCodFromCarrybee(
    @CurrentUser() user: any,
    @Param('provider_id', ParseUUIDPipe) providerId: string,
    @Body() dto: CollectCodDto,
  ) {
    const settlement = await this.hubsService.collectCashFromCarrybee(
      user.hubManagerId,
      providerId,
      dto,
    );
    return {
      success: true,
      message: settlement.message,
      data: settlement,
    };
  }

  // 3. Log Expense
  @Post('finance/expense')
  @Roles(UserRole.HUB_MANAGER)
  async createExpense(
    @CurrentUser() user: any,
    @Body() dto: CreateHubExpenseDto,
  ) {
    const expense = await this.hubsService.createHubExpense(
      user.hubManagerId,
      dto,
    );
    return {
      success: true,
      message: 'Expense recorded successfully',
      data: expense,
    };
  }

  // 4. Transfer to Admin
  @Post('finance/transfer')
  @Roles(UserRole.HUB_MANAGER)
  async createTransfer(
    @CurrentUser() user: any,
    @Body() dto: CreateTransferRecordDto,
  ) {
    const transfer = await this.hubsService.createTransfer(
      user.hubManagerId,
      dto,
    );
    return {
      success: true,
      message: 'Transfer submitted successfully',
      data: transfer,
    };
  }

  // 5. Get Transfers List
  @Get('finance/transfers')
  @Roles(UserRole.HUB_MANAGER)
  async getTransfers(@CurrentUser() user: any, @Query() query: PaginationDto) {
    const data = await this.hubsService.getTransfers(user.hubManagerId, query);
    return { success: true, data };
  }

  // 6. Get Transfer By ID
  @Get('finance/transfers/:id')
  @Roles(UserRole.HUB_MANAGER)
  async getTransferById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.hubsService.getTransferById(id, user.hubManagerId);
    return { success: true, data };
  }

  // 6.5 Get Hub Manager Finance Overview
  @Get('finance/overview')
  @Roles(UserRole.HUB_MANAGER)
  async getFinanceOverview(@Req() req: any) {
    // Hub managers access via userId (their hub manager record is linked to user_id)
    const userId = req.user.userId;
    const data = await this.hubsService.getHubManagerFinanceOverview(userId);
    return { success: true, data };
  }

  // 7. Get Expenses List
  @Get('finance/expenses')
  @Roles(UserRole.HUB_MANAGER)
  async getExpenses(@CurrentUser() user: any, @Query() query: PaginationDto) {
    const data = await this.hubsService.getExpenses(user.hubManagerId, query);
    return { success: true, data };
  }

  // 8. Get Expense By ID
  @Get('finance/expenses/:id')
  @Roles(UserRole.HUB_MANAGER)
  async getExpenseById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.hubsService.getExpenseById(id, user.hubManagerId);
    return { success: true, data };
  }

  // 9. History Report
  @Get('finance/history')
  @Roles(UserRole.HUB_MANAGER)
  async getHistory(
    @CurrentUser() user: any,
    @Query() query: FinancialReportQueryDto,
  ) {
    const history = await this.hubsService.getFinancialHistory(
      user.hubManagerId,
      query,
    );
    return { success: true, data: history };
  }

  // ==========================================
  // ADMIN ENDPOINTS (Approvals)
  // ==========================================

  @Get('admin/finance/transfers')
  @Roles(UserRole.ADMIN)
  async getAllTransfersAdmin(@Query() query: PaginationDto) {
    const result = await this.hubsService.getAllTransfersForAdmin(query);
    return { success: true, ...result };
  }

  @Get('admin/finance/transfers/:id')
  @Roles(UserRole.ADMIN)
  async getTransferByIdAdmin(@Param('id') id: string) {
    const data = await this.hubsService.getTransferDetailForAdmin(id);
    return { success: true, data };
  }

  @Get('admin/finance/expenses')
  @Roles(UserRole.ADMIN)
  async getAllExpensesAdmin(@Query() query: PaginationDto) {
    const result = await this.hubsService.getAllExpensesForAdmin(query);
    return { success: true, ...result };
  }

  @Get('admin/finance/expenses/:id')
  @Roles(UserRole.ADMIN)
  async getExpenseByIdAdmin(@Param('id') id: string) {
    const data = await this.hubsService.getExpenseDetailForAdmin(id);
    return { success: true, data };
  }

  // 10. Admin Review Transfer
  @Patch('finance/transfer/:id/review')
  @Roles(UserRole.ADMIN)
  async reviewTransfer(
    @Param('id') id: string,
    @Body() dto: ReviewFinanceRequestDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.hubsService.reviewTransfer(id, dto, user);
    return {
      success: true,
      message: `Transfer request ${dto.status.toLowerCase()}`,
      data: result,
    };
  }

  // 11. Admin Review Expense
  @Patch('finance/expense/:id/review')
  @Roles(UserRole.ADMIN)
  async reviewExpense(
    @Param('id') id: string,
    @Body() dto: ReviewFinanceRequestDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.hubsService.reviewExpense(id, dto, user);
    return {
      success: true,
      message: `Expense request ${dto.status.toLowerCase()}`,
      data: result,
    };
  }

  // ===== ADMIN DYNAMIC :id ROUTES (must be last to avoid matching specific routes) =====
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const hub = await this.hubsService.findOne(id);
    return {
      hub: toHubDetail(hub),
      message: 'Hub retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateHubDto: UpdateHubDto,
  ) {
    const hub = await this.hubsService.update(id, updateHubDto);
    return {
      id: hub.id,
      hub_code: hub.hub_code,
      message: 'Hub updated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.hubsService.remove(id);
    return {
      message: 'Hub deleted successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const hub = await this.hubsService.deactivate(id);
    return {
      id: hub.id,
      hub_code: hub.hub_code,
      status: hub.status,
      is_active: hub.is_active,
      message: 'Hub deactivated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    const hub = await this.hubsService.activate(id);
    return {
      id: hub.id,
      hub_code: hub.hub_code,
      status: hub.status,
      is_active: hub.is_active,
      message: 'Hub activated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/decline')
  @HttpCode(HttpStatus.OK)
  async decline(@Param('id', ParseUUIDPipe) id: string) {
    const hub = await this.hubsService.decline(id);
    return {
      id: hub.id,
      hub_code: hub.hub_code,
      status: hub.status,
      is_active: hub.is_active,
      message: 'Hub declined permanently',
    };
  }
}
