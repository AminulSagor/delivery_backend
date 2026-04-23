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
import { CompletePickupDto } from './dto/complete-pickup.dto';
import { BulkAssignPickupToRiderDto } from './dto/bulk-assign-pickup.dto';
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
  constructor(private readonly pickupRequestsService: PickupRequestsService) {}

  // ===== MERCHANT ENDPOINTS =====

  /**
   * Create pickup request (Merchant)
   *
   * - If same store + same day PENDING exists → increments pickup count
   * - Otherwise creates new pickup request
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
      success: true,
      data: {
        id: pickupRequest.id,
        request_code: pickupRequest.request_code,
        pickup_count: pickupRequest.estimated_parcels,
      },
      message: 'Pickup request created successfully',
    };
  }

  /**
   * Get all pickup requests (Merchant)
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
      success: true,
      data: {
        pickupRequests: result.items,
        pagination: result.pagination,
      },
      message: 'Pickup requests retrieved successfully',
    };
  }

  // ===== HUB MANAGER ENDPOINTS =====

  /**
   * Get PENDING pickup requests for hub (Hub Manager)
   *
   * Shows only PENDING status pickups (ready for assignment to rider)
   */
  @Get('hub/my-requests')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async findAllForHub(
    @CurrentUser() user: any,
    @Query() query: PickupQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
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
      success: true,
      data: {
        pickupRequests: result.items,
        pagination: result.pagination,
      },
      message: 'Pickup requests retrieved successfully',
    };
  }

  /**
   * Get confirmed pickups assigned to riders (Hub Manager)
   *
   * Shows pickups with status CONFIRMED (rider assigned, in progress)
   * Includes rider info (name, phone)
   */
  @Get('hub/confirmed-pickups')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER)
  async getConfirmedPickups(
    @CurrentUser('hubId') hubId: string,
    @Query() query: PickupQueryDto,
  ) {
    const { page, limit } = query;
    const result = await this.pickupRequestsService.getConfirmedPickupsForHub(
      hubId,
      page,
      limit,
    );
    return {
      success: true,
      data: {
        pickupRequests: result.items,
        pagination: result.pagination,
      },
      message: 'Confirmed pickups retrieved successfully',
    };
  }

  /**
   * Get pickup requests accepted by riders (Hub Manager)
   *
   * Shows pickups with status CONFIRMED that riders are currently picking up
   */
  @Get('hub/accepted-pickups')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async getAcceptedPickups(
    @CurrentUser() user: any,
    @Query() query: PickupQueryDto,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;
    const { page, limit } = query;
    const result = await this.pickupRequestsService.getAcceptedPickupsForHub(
      hubId,
      page,
      limit,
    );
    return {
      success: true,
      data: {
        pickupRequests: result.items,
        pagination: result.pagination,
      },
      message: 'Accepted pickups retrieved successfully',
    };
  }

  /**
   * Assign pickup to rider - Single (Hub Manager)
   */
  @Patch(':id/assign-rider')
  @HttpCode(HttpStatus.OK)
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
      data: {
        id: pickup.id,
        request_code: pickup.request_code,
        status: pickup.status,
        pickup_count: pickup.estimated_parcels,
        assigned_rider_id: pickup.assigned_rider_id,
      },
      message: 'Pickup assigned to rider successfully',
    };
  }

  /**
   * Assign pickups to rider - Bulk (Hub Manager)
   */
  @Post('hub/bulk-assign-rider')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async bulkAssignToRider(
    @Body() assignDto: BulkAssignPickupToRiderDto,
    @CurrentUser() user: any,
  ) {
    const hubId = user.role === UserRole.ADMIN ? null : user.hubId;

    if (!hubId && user.role !== UserRole.ADMIN) {
      return {
        success: false,
        message: 'Hub ID not found in user context',
      };
    }

    const result = await this.pickupRequestsService.bulkAssignPickupsToRider(
      assignDto.pickup_ids,
      assignDto.rider_id,
      hubId,
      assignDto.notes,
    );

    return {
      success: true,
      data: {
        summary: {
          total: assignDto.pickup_ids.length,
          success: result.success,
          failed: result.failed,
        },
        results: result.results,
      },
      message:
        result.success === assignDto.pickup_ids.length
          ? 'All pickups assigned to rider successfully'
          : `${result.success} pickup(s) assigned, ${result.failed} failed`,
    };
  }

  // ===== RIDER ENDPOINTS =====

  /**
   * Get assigned pickups (Rider)
   *
   * ?filter=pending  → CONFIRMED (need to pick up)
   * ?filter=completed → PICKED_UP (done)
   */
  @Get('rider/my-pickups')
  @HttpCode(HttpStatus.OK)
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
   * Complete pickup with count (Rider)
   *
   * Flow:
   * - Rider specifies how many parcels picked up
   * - Pickup count decrements automatically
   * - If count = 0 → PICKED_UP (completed)
   * - If count > 0 → PENDING (Hub Manager can reassign)
   */
  @Patch(':id/rider/complete')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async riderCompletePickup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() completeDto: CompletePickupDto,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    const { pickup, remaining, pickedUp } =
      await this.pickupRequestsService.riderCompletePickup(
        id,
        riderId,
        completeDto.picked_up_count,
        completeDto.notes,
      );

    return {
      success: true,
      data: {
        id: pickup.id,
        request_code: pickup.request_code,
        status: pickup.status,
        picked_up: pickedUp,
        remaining_count: remaining,
        pickup_count: pickup.estimated_parcels,
      },
      message:
        remaining > 0
          ? `Picked ${pickedUp} parcel(s). ${remaining} remaining.`
          : `Pickup completed. All ${pickedUp} parcel(s) picked up.`,
    };
  }
}
