import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PickupRequestsService } from './pickup-requests.service';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { AssignPickupToRiderDto } from '../riders/dto/assign-pickup.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PickupQueryDto, RiderPickupQueryDto } from './dto/pickup-query.dto';
import {
  toPickupRequestListItem,
  toPickupRequestActionResponse,
} from '../common/interfaces/responses.interface';

@Controller('pickup-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PickupRequestsController {
  constructor(
    private readonly pickupRequestsService: PickupRequestsService,
  ) {}

  /**
   * Create pickup request manually (Merchant)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.MERCHANT)
  async create(
    @CurrentUser('merchantId') merchantId: string,
    @Body() createDto: CreatePickupRequestDto,
  ) {
    const pickupRequest = await this.pickupRequestsService.create(
      merchantId,
      createDto,
    );
    return {
      id: pickupRequest.id,
      estimated_parcels: pickupRequest.estimated_parcels,
      message: 'Pickup request created successfully',
    };
  }

  /**
   * Get all pickup requests for merchant (with pagination)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  async findAllForMerchant(
    @CurrentUser('merchantId') merchantId: string,
    @Query() query: PickupQueryDto,
  ) {
    const { status, page, limit, sortBy, order } = query;
    const result = await this.pickupRequestsService.findAllForMerchant(
      merchantId,
      page,
      limit,
      status,
      sortBy,
      order,
    );
    return {
      pickupRequests: result.items,
      pagination: result.pagination,
      message: 'Pickup requests retrieved successfully',
    };
  }

  /**
   * Get all pickup requests for hub manager's hub (with pagination)
   * READ-ONLY: Hub managers can only view pickup requests, not manage them
   */
  @Get('hub/my-requests')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER)
  async findAllForHub(
    @CurrentUser('hubId') hubId: string,
    @Query() query: PickupQueryDto,
  ) {
    const { status, page, limit, sortBy, order } = query;
    const result = await this.pickupRequestsService.findAllForHub(
      hubId,
      page,
      limit,
      status,
      sortBy,
      order,
    );
    return {
      pickupRequests: result.items,
      pagination: result.pagination,
      message: 'Pickup requests retrieved successfully',
    };
  }

  /**
   * Get single pickup request (Merchant only)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    const pickupRequest = await this.pickupRequestsService.findOne(id, userId, role);
    return {
      pickupRequest,
      message: 'Pickup request retrieved successfully',
    };
  }

  /**
   * Update pickup request (Merchant only)
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('merchantId') merchantId: string,
    @Body() updateDto: UpdatePickupRequestDto,
  ) {
    const pickupRequest = await this.pickupRequestsService.update(
      id,
      merchantId,
      updateDto,
    );
    return {
      id: pickupRequest.id,
      estimated_parcels: pickupRequest.estimated_parcels,
      message: 'Pickup request updated successfully',
    };
  }

  /**
   * Get pickup requests for rider assignment (Hub Manager)
   */
  @Get('hub/for-assignment')
  @Roles(UserRole.HUB_MANAGER)
  async getPickupsForAssignment(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const hubId = user.hubId;

    if (!hubId) {
      return {
        success: false,
        message: 'Hub ID not found in user context',
      };
    }

    const result = await this.pickupRequestsService.getPickupsForAssignment(
      hubId,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      data: result,
      message: 'Pickups for assignment retrieved successfully',
    };
  }

  /**
   * Assign pickup request to rider (Hub Manager)
   */
  @Patch(':id/assign-rider')
  @Roles(UserRole.HUB_MANAGER)
  async assignToRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignDto: AssignPickupToRiderDto,
    @CurrentUser() user: any,
  ) {
    const hubId = user.hubId;

    if (!hubId) {
      return {
        success: false,
        message: 'Hub ID not found in user context',
      };
    }

    const pickup = await this.pickupRequestsService.assignPickupToRider(
      id,
      assignDto.rider_id,
      hubId,
    );

    return {
      success: true,
      data: toPickupRequestActionResponse(pickup),
      message: 'Pickup assigned to rider successfully',
    };
  }

  /**
   * Get rider's assigned pickups (Rider)
   */
  @Get('rider/my-pickups')
  @Roles(UserRole.RIDER)
  async getMyPickups(
    @CurrentUser() user: any,
    @Query() query: RiderPickupQueryDto,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    const pickups = await this.pickupRequestsService.getRiderPickups(
      riderId,
      query.status,
      query.filter,
    );

    return {
      success: true,
      data: pickups.map(toPickupRequestListItem),
      message: 'Rider pickups retrieved successfully',
    };
  }

  /**
   * Rider completes pickup (Rider)
   */
  @Patch(':id/rider/complete')
  @Roles(UserRole.RIDER)
  async riderCompletePickup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    const pickup = await this.pickupRequestsService.riderCompletePickup(
      id,
      riderId,
    );

    return {
      success: true,
      data: toPickupRequestActionResponse(pickup),
      message: 'Pickup completed successfully',
    };
  }
}
