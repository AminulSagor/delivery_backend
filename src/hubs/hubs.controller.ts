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
} from '@nestjs/common';
import { HubsService } from './hubs.service';
import { ParcelsService } from '../parcels/parcels.service';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { AssignParcelToRiderDto } from '../riders/dto/assign-parcel.dto';
import { TransferParcelDto } from '../parcels/dto/transfer-parcel.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { HubParcelQueryDto } from './dto/hub-parcel-query.dto';
import { DeliveryOutcomeQueryDto } from './dto/delivery-outcome-query.dto';
import {
  toHubListItem,
  toHubDetail,
  toParcelListItem,
  toParcelActionResponse,
} from '../common/interfaces/responses.interface';

@Controller('hubs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HubsController {
  constructor(
    private readonly hubsService: HubsService,
    private readonly parcelsService: ParcelsService,
  ) {}

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
  async findAll() {
    const hubs = await this.hubsService.findAll();
    return {
      hubs: hubs.map(toHubListItem),
      total: hubs.length,
      message: 'Hubs retrieved successfully',
    };
  }

  // ===== HUB MANAGER PARCEL OPERATIONS =====
  // NOTE: These specific routes MUST come before dynamic :id routes

  /**
   * Get delivery outcomes (Hub Manager)
   * 
   * PURPOSE: View parcels with delivery outcomes that need attention:
   * - PARTIAL_DELIVERY: Partial items delivered, may need follow-up
   * - EXCHANGE: Items exchanged, need processing
   * - DELIVERY_RESCHEDULED: Customer requested later delivery
   * - PAID_RETURN: Customer refused but paid return fee
   * - RETURNED: Customer refused, parcel coming back
   * 
   * Filters: status, zone, merchantId
   * Pagination: page (default 1), limit (default 10, max 100)
   */
  @Get('parcels/delivery-outcomes')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getDeliveryOutcomes(
    @CurrentUser() user: any,
    @Query() query: DeliveryOutcomeQueryDto,
  ) {
    const result = await this.parcelsService.getDeliveryOutcomes(user.hubId, {
      status: query.status,
      zone: query.zone,
      merchantId: query.merchantId,
      page: query.page,
      limit: query.limit,
    });

    return {
      success: true,
      data: result,
      message: 'Delivery outcomes retrieved successfully',
    };
  }

  /**
   * Get rescheduled deliveries (Hub Manager)
   * 
   * PURPOSE: View parcels with DELIVERY_RESCHEDULED status
   * These need to be prepared for redelivery (reset to IN_HUB)
   */
  @Get('parcels/rescheduled')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async getRescheduledDeliveries(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const result = await this.parcelsService.getRescheduledDeliveries(
      user.hubId,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      data: result,
      message: 'Rescheduled deliveries retrieved successfully',
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
    const result = await this.parcelsService.markReturnToMerchant(id, user.hubId, notes);

    return {
      success: true,
      data: {
        original_parcel: {
          id: result.original_parcel.id,
          tracking_number: result.original_parcel.tracking_number,
          status: result.original_parcel.status,
        },
        return_parcel: {
          id: result.return_parcel.id,
          tracking_number: result.return_parcel.tracking_number,
          original_parcel_id: result.return_parcel.original_parcel_id,
          status: result.return_parcel.status,
          delivery_address: result.return_parcel.delivery_address,
        },
      },
      message: 'Return parcel created. Assign to rider for delivery back to merchant.',
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
    const parcel = await this.parcelsService.prepareForRedelivery(id, user.hubId);

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
    const { status, page, limit, sortBy, order } = query;
    const result = await this.parcelsService.findAllForHub(
      user.hubId,
      page,
      limit,
      status,
      sortBy,
      order,
    );
    return {
      success: true,
      data: {
        parcels: result.items,
        pagination: result.pagination,
      },
      message: 'Parcels retrieved successfully',
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
    const { status, page, limit, sortBy, order } = query;
    const result = await this.parcelsService.findAllForHub(
      user.hubId,
      page,
      limit,
      status,
      sortBy,
      order,
    );
    return {
      success: true,
      data: {
        parcels: result.items,
        pagination: result.pagination,
      },
      message: 'Parcels awaiting receipt retrieved successfully',
    };
  }

  /**
   * Mark parcel as received (PENDING/PICKED_UP → IN_HUB)
   */
  @Patch('parcels/:id/receive')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async markParcelReceived(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.markAsReceived(id, user.hubId);
    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel marked as received successfully',
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const { parcels, total } = await this.parcelsService.getParcelsForAssignment(
      user.hubId,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      data: {
        parcels: parcels.map(toParcelListItem),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Parcels for assignment retrieved successfully',
    };
  }

  /**
   * Assign parcel to rider
   */
  @Patch('parcels/:id/assign-rider')
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async assignParcelToRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignDto: AssignParcelToRiderDto,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.assignToRider(id, assignDto, user.hubId);
    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel assigned to rider successfully',
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
    const parcel = await this.parcelsService.transferParcelToHub(id, transferDto, user.hubId);
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const result = await this.parcelsService.getIncomingParcels(
      user.hubId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      success: true,
      data: result,
      message: 'Incoming parcels retrieved successfully',
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
    const parcel = await this.parcelsService.acceptIncomingParcel(id, user.hubId);
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
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const result = await this.parcelsService.getOutgoingParcels(
      user.hubId,
      parseInt(page),
      parseInt(limit),
    );
    return {
      success: true,
      data: result,
      message: 'Outgoing parcels retrieved successfully',
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
}
