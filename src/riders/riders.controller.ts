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
  BadRequestException,
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
import { RiderApprovalStatus } from '../common/enums/rider-approval-status.enum';
// import { ResolveEmergencyDto } from './dto/resolve-emergency.dto';
import { EmergencyStatus } from 'src/common/enums/emergency-type.enum';
import { CreateEmergencyDto } from './dto/create-emergency.dto';

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
    // Validate Hub Manager has a hub assigned
    if (!user.hubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin to link your account to a hub.',
      );
    }

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
      message: 'Rider created successfully. Pending admin approval.',
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
    @Query('approval_status') approvalStatus: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.HUB_MANAGER ? user.hubId : hubId;

    const validApprovalStatus = Object.values(RiderApprovalStatus).includes(
      approvalStatus as RiderApprovalStatus,
    )
      ? (approvalStatus as RiderApprovalStatus)
      : undefined;

    // Default to showing only active riders unless explicitly set to 'false' or 'all'
    const parsedIsActive =
      isActive === 'false' ? false : isActive === 'all' ? undefined : true;

    const { riders, total } = await this.ridersService.findAll(
      effectiveHubId,
      parsedIsActive,
      parseInt(page),
      parseInt(limit),
      validApprovalStatus,
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

  // ===== ADMIN APPROVAL ROUTES (must be before :id routes) =====

  /**
   * Approve rider (Admin only)
   */
  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const rider = await this.ridersService.approveRider(id, user.userId);

    return {
      success: true,
      data: {
        id: rider.id,
        approval_status: rider.approval_status,
      },
      message: 'Rider approved successfully',
    };
  }

  /**
   * Reject rider (Admin only)
   */
  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const rider = await this.ridersService.rejectRider(id, user.userId);

    return {
      success: true,
      data: {
        id: rider.id,
        approval_status: rider.approval_status,
      },
      message: 'Rider rejected',
    };
  }

  // ===== RIDER APP SECTIONS (must be before :id routes) =====

  /**
   * PICKUP SECTION - Pending & Completed tabs
   *
   * Groups by store+date - same store on same day shows combined pickup_count
   *
   * ?tab=pending   → CONFIRMED (assigned to rider, needs to pickup from merchant)
   * ?tab=completed → PICKED_UP (completed by this rider)
   * ?tab=confirmed → alias for completed
   */
  @Get('pickups')
  @Roles(UserRole.RIDER)
  async getPickups(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' | 'confirmed' = 'pending',
  ) {
    // Map tab to filter: 'confirmed' is alias for 'completed'
    let filter: string;
    if (tab === 'pending') {
      filter = 'pending';
    } else if (tab === 'completed' || tab === 'confirmed') {
      filter = 'completed';
    } else {
      filter = 'pending';
    }

    // Returns grouped pickups (same store+date combined)
    const groupedPickups = await this.pickupRequestsService.getRiderPickups(
      user.riderId,
      undefined,
      filter,
    );

    // Format response
    const data = groupedPickups.map((pickup: any) => ({
      id: pickup.id,
      request_code: pickup.request_code,
      request_codes: pickup.request_codes, // All request codes in this group
      pickup_count: pickup.pickup_count,
      status: pickup.status,
      comment: pickup.comment,
      created_at: pickup.created_at,
      completed_at: pickup.completed_at,
      store: pickup.store
        ? {
            id: pickup.store.id,
            business_name: pickup.store.business_name,
            phone_number: pickup.store.phone_number,
            business_address: pickup.store.business_address,
          }
        : null,
    }));

    return {
      success: true,
      data,
      count: data.length,
      tab: filter === 'pending' ? 'pending' : 'completed',
    };
  }

  /**
   * DELIVERY SECTION - Pending & Completed tabs
   * Pending: ASSIGNED_TO_RIDER (assigned by hub, ready to deliver)
   * Completed: DELIVERED, PARTIAL_DELIVERY, EXCHANGE, PAID_RETURN
   *
   * Flow: Hub assigns parcel → Rider initiates delivery → OTP verification → Done
   */
  @Get('deliveries')
  @Roles(UserRole.RIDER)
  async getDeliveries(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' = 'pending',
  ) {
    const parcels = await this.parcelsService.getRiderDeliveries(
      user.riderId,
      tab,
    );

    return {
      success: true,
      data: parcels.map(toParcelListItem),
      count: parcels.length,
      tab,
    };
  }

  /**
   * RETURN SECTION - Pending & Completed tabs
   * Pending: RETURNED, DELIVERY_RESCHEDULED (need to return to hub or reattempt)
   * Completed: RETURNED_TO_HUB, RETURN_TO_MERCHANT
   */
  @Get('returns')
  @Roles(UserRole.RIDER)
  async getReturns(
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' = 'pending',
  ) {
    const parcels = await this.parcelsService.getRiderReturns(
      user.riderId,
      tab,
    );

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
    const parcels = await this.parcelsService.getRiderParcels(
      user.riderId,
      query.status,
      query.filter,
    );

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
  async update(
    @Param('id') id: string,
    @Body() updateRiderDto: UpdateRiderDto,
  ) {
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
   * Activate rider (Admin only)
   */
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  async activate(@Param('id') id: string) {
    const rider = await this.ridersService.activate(id);

    return {
      success: true,
      data: toRiderActionResponse(rider),
      message: 'Rider activated successfully',
    };
  }

  /**
   * Decline rider (Admin only) - Permanent deactivation
   */
  @Patch(':id/decline')
  @Roles(UserRole.ADMIN)
  async decline(@Param('id') id: string) {
    const rider = await this.ridersService.decline(id);

    return {
      success: true,
      data: toRiderActionResponse(rider),
      message: 'Rider declined permanently',
    };
  }

  // ===== RIDER PARCEL ACTIONS =====

  /**
   * Rider accepts parcel (optional - marks when rider picks up from hub)
   * Note: This is optional. Rider can directly initiate delivery without accepting first.
   */
  @Patch('parcels/:id/accept')
  @Roles(UserRole.RIDER)
  async acceptParcel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.riderAcceptParcel(
      id,
      user.riderId,
    );

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
    const parcel = await this.parcelsService.getParcelForDelivery(
      id,
      user.riderId,
    );

    return {
      success: true,
      data: {
        parcel_id: parcel.id,
        parcel_tx_id: parcel.parcel_tx_id,
        tracking_number: parcel.tracking_number,
        customer_name: parcel.customer_name,
        customer_phone: parcel.customer_phone,
        customer_address: parcel.customer_address,
        is_cod: parcel.is_cod,
        cod_amount: parcel.cod_amount,
        total_charge: parcel.total_charge,
      },
      message:
        'Delivery info retrieved. Use /delivery-verifications/parcels/:id/initiate to complete delivery.',
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

  // ===== RIDER SUPPORT ENDPOINTS =====

  @Post('rider-support/emergency')
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.CREATED)
  async triggerEmergency(
    @Body() dto: CreateEmergencyDto,
    @CurrentUser() user: any,
  ) {
    const alert = await this.ridersService.createAlert(user.riderId, dto);
    return {
      success: true,
      data: alert,
      message: 'Emergency alert sent! Support team has been notified.',
    };
  }
}
