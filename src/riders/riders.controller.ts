import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { ParcelsService } from '../parcels/parcels.service';
import { PickupRequestsService } from '../pickup-requests/pickup-requests.service';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { FailedDeliveryDto, ReturnParcelDto } from './dto/delivery-action.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RiderParcelQueryDto } from './dto/rider-parcel-query.dto';
import {
  toRiderListItem,
  toRiderDetail,
  toRiderActionResponse,
  toParcelListItem,
  toParcelActionResponse,
  toPickupRequestListItem,
} from '../common/interfaces/responses.interface';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly parcelsService: ParcelsService,
    private readonly pickupRequestsService: PickupRequestsService,
  ) {}

  /**
   * Create rider by Hub Manager (auto-assigns current hub)
   */
  @Post()
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createRiderDto: CreateRiderDto,
    @CurrentUser() user: any,
  ) {
    const rider = await this.ridersService.createByHubManager(
      createRiderDto,
      user.hubId,
    );

    return {
      success: true,
      data: {
        id: rider.id,
        full_name: rider.user?.full_name,
        phone: rider.user?.phone,
      },
      message: 'Rider created successfully',
    };
  }

  /**
   * Create rider by Admin (manual hub assignment)
   */
  @Post('admin/create')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createByAdmin(@Body() createRiderDto: CreateRiderDto) {
    const rider = await this.ridersService.createByAdmin(createRiderDto);

    return {
      success: true,
      data: {
        id: rider.id,
        full_name: rider.user?.full_name,
        phone: rider.user?.phone,
      },
      message: 'Rider created successfully',
    };
  }

  /**
   * Get rider dashboard (Rider only)
   * IMPORTANT: Must be before @Get() to avoid route conflict
   */
  @Get('dashboard')
  @Roles(UserRole.RIDER)
  async getDashboard(@CurrentUser() user: any) {
    const dashboard = await this.ridersService.getRiderDashboard(user.riderId);

    return {
      success: true,
      data: dashboard,
      message: 'Dashboard retrieved successfully',
    };
  }

  /**
   * Get all riders (filtered by hub for hub managers)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAll(
    @Query('hubId') hubId: string,
    @Query('isActive') isActive: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.HUB_MANAGER ? user.hubId : hubId;

    const { riders, total } = await this.ridersService.findAll(
      effectiveHubId,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      data: {
        riders: riders.map(toRiderListItem),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
      message: 'Riders retrieved successfully',
    };
  }

  // ===== RIDER APP SECTIONS (must be before :id routes) =====

  /**
   * PICKUP SECTION - Pending & Completed tabs
   * Pending: CONFIRMED (assigned, needs to pickup from merchant)
   * Completed: PICKED_UP
   */
  @Get('pickups')
  @Roles(UserRole.RIDER)
  async getPickups(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' = 'pending',
  ) {
    const filter = tab === 'pending' ? 'pending' : 'completed';
    const pickups = await this.pickupRequestsService.getRiderPickups(user.riderId, undefined, filter);

    return {
      success: true,
      data: pickups.map(toPickupRequestListItem),
      count: pickups.length,
    };
  }

  /**
   * DELIVERY SECTION - Pending & Completed tabs
   * Pending: OUT_FOR_DELIVERY
   * Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED
   */
  @Get('deliveries')
  @Roles(UserRole.RIDER)
  async getDeliveries(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' = 'pending',
  ) {
    const parcels = await this.parcelsService.getRiderDeliveries(user.riderId, tab);

    return {
      success: true,
      data: parcels.map(toParcelListItem),
      count: parcels.length,
    };
  }

  /**
   * RETURN SECTION - Pending & Completed tabs
   * Pending: RETURNED, PAID_RETURN (need to return to hub)
   * Completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
   */
  @Get('returns')
  @Roles(UserRole.RIDER)
  async getReturns(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' = 'pending',
  ) {
    const parcels = await this.parcelsService.getRiderReturns(user.riderId, tab);

    return {
      success: true,
      data: parcels.map(toParcelListItem),
      count: parcels.length,
    };
  }

  /**
   * Legacy endpoint - kept for backward compatibility
   */
  @Get('parcels/my-deliveries')
  @Roles(UserRole.RIDER)
  async getMyDeliveries(
    @CurrentUser() user: any,
    @Query() query: RiderParcelQueryDto,
  ) {
    const parcels = await this.parcelsService.getRiderParcels(user.riderId, query.status, query.filter);

    return {
      success: true,
      data: parcels.map(toParcelListItem),
      message: 'Deliveries retrieved successfully',
    };
  }

  // ===== ADMIN/HUB_MANAGER ROUTES (dynamic :id must be LAST) =====

  /**
   * Get rider by ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findOne(@Param('id') id: string) {
    const rider = await this.ridersService.findOne(id);

    return {
      success: true,
      data: toRiderDetail(rider),
      message: 'Rider retrieved successfully',
    };
  }

  /**
   * Update rider
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async update(@Param('id') id: string, @Body() updateRiderDto: UpdateRiderDto) {
    const rider = await this.ridersService.update(id, updateRiderDto);

    return {
      success: true,
      data: toRiderActionResponse(rider),
      message: 'Rider updated successfully',
    };
  }

  /**
   * Deactivate rider
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async deactivate(@Param('id') id: string) {
    const rider = await this.ridersService.deactivate(id);

    return {
      success: true,
      data: toRiderActionResponse(rider),
      message: 'Rider deactivated successfully',
    };
  }

  /**
   * Activate rider
   */
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async activate(@Param('id') id: string) {
    const rider = await this.ridersService.activate(id);

    return {
      success: true,
      data: toRiderActionResponse(rider),
      message: 'Rider activated successfully',
    };
  }

  // ===== RIDER PARCEL ACTIONS =====

  /**
   * Rider accepts parcel (picks up from hub)
   */
  @Patch('parcels/:id/accept')
  @Roles(UserRole.RIDER)
  async acceptParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.riderAcceptParcel(id, user.riderId);

    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel accepted successfully',
    };
  }

  /**
   * Get parcel delivery info (COD amount, etc.)
   * Use this before initiating delivery to show rider the collectable amount
   */
  @Get('parcels/:id/delivery-info')
  @Roles(UserRole.RIDER)
  async getDeliveryInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.getParcelForDelivery(id, user.riderId);

    return {
      success: true,
      data: {
        parcel_id: parcel.id,
        tracking_number: parcel.tracking_number,
        customer_name: parcel.customer_name,
        customer_phone: parcel.customer_phone,
        delivery_address: parcel.delivery_address,
        is_cod: parcel.is_cod,
        cod_amount: parcel.cod_amount,
        total_charge: parcel.total_charge,
      },
      message: 'Delivery info retrieved. Use /delivery-verifications/parcels/:id/initiate to complete delivery.',
    };
  }

  /**
   * Rider returns parcel to hub
   * Use this after delivery verification marks parcel as RETURNED/PAID_RETURN
   */
  @Patch('parcels/:id/return')
  @Roles(UserRole.RIDER)
  async returnParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() returnDto: ReturnParcelDto,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.riderReturnParcel(
      id,
      user.riderId,
      returnDto.return_reason,
    );

    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message: 'Parcel returned to hub successfully',
    };
  }
}
