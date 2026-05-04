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
  ForbiddenException,
} from '@nestjs/common';
import { RidersService } from './riders.service';
import { ParcelsService } from '../parcels/parcels.service';
import { PickupRequestsService } from '../pickup-requests/pickup-requests.service';
import { RiderFinanceService } from './services/riders-finance.service';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { UpdateRiderProfileDto } from './dto/update-rider-profile.dto';
import { UpdateRiderDocumentsDto } from './dto/update-rider-documents.dto';
import { UpdateRiderPasswordDto } from './dto/update-rider-password.dto';
import { AddRiderPayoutMethodDto } from './dto/add-rider-payout-method.dto';
import { UpdateRiderPayoutMethodDto } from './dto/update-rider-payout-method.dto';
import { FailedDeliveryDto, ReturnParcelDto } from './dto/delivery-action.dto';
import { ReportDeliveryIssueDto } from './dto/report-delivery-issue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RiderParcelQueryDto } from './dto/rider-parcel-query.dto';
import { ParcelStatus } from '../parcels/entities/parcel.entity';
import {
  toRiderListItem,
  toRiderDetail,
  toRiderActionResponse,
  toParcelListItem,
  toParcelDetail,
  toParcelActionResponse,
  toPickupRequestDetail,
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
    private readonly riderFinanceService: RiderFinanceService,
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
      data: toRiderDetail(rider),
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
      data: toRiderDetail(rider),
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
   * Rider finance summary (Totals: collected/pending/cash + today/month earnings)
   * NOTE: This is an alias for backward compatibility with clients calling /riders/summary
   */
  @Get('summary')
  @Roles(UserRole.RIDER)
  async getRiderFinanceSummary(
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

  /**
   * Get rider own profile details
   */
  @Get('profile')
  @Roles(UserRole.RIDER)
  async getMyProfile(@CurrentUser() user: any) {
    const rider = await this.ridersService.findByUserId(user.userId);

    return {
      success: true,
      data: toRiderDetail(rider),
      message: 'Profile retrieved successfully',
    };
  }

  /**
   * Rider updates own profile details
   */
  @Patch('profile')
  @Roles(UserRole.RIDER)
  async updateMyProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    const rider = await this.ridersService.updateMyProfile(
      user.userId,
      user.riderId,
      dto,
    );

    return {
      success: true,
      data: toRiderDetail(rider),
      message: 'Profile updated successfully',
    };
  }

  /**
   * Get rider NID and driving license documents
   */
  @Get('profile/documents')
  @Roles(UserRole.RIDER)
  async getMyDocuments(@CurrentUser() user: any) {
    const rider = await this.ridersService.findByUserId(user.userId);

    return {
      success: true,
      data: {
        nid_number: rider.nid_number,
        nid_front_photo: rider.nid_front_photo,
        nid_back_photo: rider.nid_back_photo,
        license_no: rider.license_no,
        license_front_photo: rider.license_front_photo,
        license_back_photo: rider.license_back_photo,
      },
      message: 'Documents retrieved successfully',
    };
  }

  /**
   * Rider updates NID and driving license documents
   */
  @Patch('profile/documents')
  @Roles(UserRole.RIDER)
  async updateMyDocuments(
    @CurrentUser() user: any,
    @Body() dto: UpdateRiderDocumentsDto,
  ) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const rider = await this.ridersService.updateMyDocuments(
      user.userId,
      user.riderId,
      dto,
    );

    return {
      success: true,
      data: toRiderDetail(rider),
      message: 'Documents updated successfully',
    };
  }

  /**
   * Rider updates own password
   */
  @Patch('profile/password')
  @Roles(UserRole.RIDER)
  async updateMyPassword(
    @CurrentUser() user: any,
    @Body() dto: UpdateRiderPasswordDto,
  ) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    await this.ridersService.updateMyPassword(user.userId, user.riderId, dto);

    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  /**
   * Get available payout methods for rider
   */
  @Get('profile/payout-methods/available')
  @Roles(UserRole.RIDER)
  async getAvailablePayoutMethods(@CurrentUser() user: any) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const available = await this.ridersService.getAvailablePayoutMethods(
      user.userId,
      user.riderId,
    );

    return {
      success: true,
      data: { available_methods: available },
      message: 'Available payout methods retrieved successfully',
    };
  }

  /**
   * Get rider payout methods (account numbers are masked)
   */
  @Get('profile/payout-methods')
  @Roles(UserRole.RIDER)
  async getMyPayoutMethods(@CurrentUser() user: any) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const methods = await this.ridersService.getMyPayoutMethods(
      user.userId,
      user.riderId,
    );

    return {
      success: true,
      data: { methods },
      message: 'Payout methods retrieved successfully',
    };
  }

  /**
   * Add rider payout method
   */
  @Post('profile/payout-methods')
  @Roles(UserRole.RIDER)
  async addMyPayoutMethod(
    @CurrentUser() user: any,
    @Body() dto: AddRiderPayoutMethodDto,
  ) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const method = await this.ridersService.addMyPayoutMethod(
      user.userId,
      user.riderId,
      dto,
    );

    return {
      success: true,
      data: { method },
      message: 'Payout method added successfully',
    };
  }

  /**
   * Update rider payout method details
   */
  @Patch('profile/payout-methods/:id')
  @Roles(UserRole.RIDER)
  async updateMyPayoutMethod(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) methodId: string,
    @Body() dto: UpdateRiderPayoutMethodDto,
  ) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const method = await this.ridersService.updateMyPayoutMethod(
      user.userId,
      user.riderId,
      methodId,
      dto,
    );

    return {
      success: true,
      data: { method },
      message: 'Payout method updated successfully',
    };
  }

  /**
   * Set default rider payout method
   */
  @Patch('profile/payout-methods/:id/set-default')
  @Roles(UserRole.RIDER)
  async setDefaultPayoutMethod(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) methodId: string,
  ) {
    if (!user.riderId) {
      throw new BadRequestException('Rider ID not found in user context');
    }

    const method = await this.ridersService.setMyPayoutMethodDefault(
      user.userId,
      user.riderId,
      methodId,
    );

    return {
      success: true,
      data: { method },
      message: 'Default payout method set successfully',
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
    @Query('search') search: string,
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
      search,
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

  /**
   * Get system riders (Admin / Hub Manager)
   * Returns riders with `rider_status` field computed server-side.
   */
  @Get('system')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getSystemRiders(
    @Query('hubId') hubId: string,
    @Query('isActive') isActive: string,
    @CurrentUser() user: any,
  ) {
    const effectiveHubId =
      user.role === UserRole.HUB_MANAGER ? user.hubId : hubId;

    const parsedIsActive =
      isActive === 'false' ? false : isActive === 'all' ? undefined : true;

    const riders = await this.ridersService.getSystemRiders(
      effectiveHubId,
      parsedIsActive,
    );

    return {
      success: true,
      data: { riders: riders.map(toRiderListItem) },
      message: 'System riders retrieved successfully',
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
      data: toRiderDetail(rider),
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
      data: toRiderDetail(rider),
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
   * PICKUP DETAIL - Rider opens a pickup item to see full request details
   */
  @Get('pickups/:id')
  @Roles(UserRole.RIDER)
  async getPickupDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' | 'all' = 'all',
  ) {
    const pickup = await this.pickupRequestsService.getRiderPickupDetail(
      id,
      user.riderId,
      tab,
    );

    return {
      success: true,
      data: toPickupRequestDetail(pickup),
      message: 'Pickup request details retrieved successfully',
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
   * DELIVERY DETAIL - Rider opens a delivery item to see full parcel details
   */
  @Get('deliveries/:id')
  @Roles(UserRole.RIDER)
  async getDeliveryDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' | 'all' = 'all',
  ) {
    const parcel = await this.parcelsService.getRiderDeliveryDetail(
      id,
      user.riderId,
      tab,
    );

    return {
      success: true,
      data: toParcelDetail(parcel),
      message: 'Delivery details retrieved successfully',
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
   * RETURN DETAIL - Rider opens a return item to see full parcel details
   */
  @Get('returns/:id')
  @Roles(UserRole.RIDER)
  async getReturnDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Query('tab') tab: 'pending' | 'completed' | 'all' = 'all',
  ) {
    const parcel = await this.parcelsService.getRiderReturnDetail(
      id,
      user.riderId,
      tab,
    );

    return {
      success: true,
      data: toParcelDetail(parcel),
      message: 'Return details retrieved successfully',
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
  @Get(':id/parcels')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getAssignedParcelsForRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('status') status: ParcelStatus,
    @Query('filter') filter: string,
    @CurrentUser() user: any,
  ) {
    // Ensure rider exists and (for hub managers) belongs to their hub
    const rider = await this.ridersService.findOne(id);
    if (user.role === UserRole.HUB_MANAGER && rider.hub_id !== user.hubId) {
      throw new ForbiddenException('Rider does not belong to your hub');
    }

    const parcels = await this.parcelsService.getRiderParcels(
      id,
      status,
      filter,
    );

    return {
      success: true,
      data: parcels.map(toParcelListItem),
      count: parcels.length,
      message: 'Assigned parcels retrieved successfully',
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
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
    @Param('id', ParseUUIDPipe) id: string,
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
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
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
  async activate(@Param('id', ParseUUIDPipe) id: string) {
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
  async decline(@Param('id', ParseUUIDPipe) id: string) {
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
      data: toParcelListItem(parcel),
      message:
        'Delivery info retrieved. Use /delivery-verifications/parcels/:id/initiate to complete delivery.',
    };
  }

  /**
   * Rider reports a delivery issue for a parcel
   * Submits the report to hub manager and admin review queue
   */
  @Post('parcels/:id/report')
  @Roles(UserRole.RIDER)
  @HttpCode(HttpStatus.OK)
  async reportDeliveryIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportDeliveryIssueDto,
    @CurrentUser() user: any,
  ) {
    const parcel = await this.parcelsService.riderReportIssue(
      id,
      user.riderId,
      dto.issue_type,
      dto.note,
    );

    return {
      success: true,
      data: toParcelActionResponse(parcel),
      message:
        'Delivery issue submitted to hub manager and admin successfully',
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
