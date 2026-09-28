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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffQueryDto } from './dto/staff-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  toStaffDetail,
  toStaffActionResponse,
} from '../common/interfaces/responses.interface';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * Create staff by Admin
   * POST /staff
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createStaffDto: CreateStaffDto) {
    const staff = await this.staffService.createByAdmin(createStaffDto);

    return {
      success: true,
      data: toStaffDetail(staff),
      message: 'Staff created successfully',
    };
  }

  /**
   * Get all staff with optional filters
   * GET /staff?hub_id=xxx&is_active=true&position=RIDER
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAll(@CurrentUser() user: any, @Query() query: StaffQueryDto) {
    const hubId = query.hub_id ?? query.hubId;
    const isActive = query.is_active ?? query.isActive;
    const effectiveHubId =
      user.role === UserRole.HUB_MANAGER ? user.hubId || null : hubId;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const { data: staff, total } = await this.staffService.findAll(
      effectiveHubId || undefined,
      isActive,
      query.search,
      query.page,
      query.limit,
      query.position,
    );

    const summary = await this.staffService.getSummary(
      effectiveHubId || undefined,
      query.search,
    );

    return {
      success: true,
      data: staff.map(toStaffDetail),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
      summary,
      message: 'Staff retrieved successfully',
    };
  }

  /**
   * Get formatted staff list for admin
   * GET /staff/admin/list
   */
  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  async getStaffList() {
    const staffList = await this.staffService.getFormattedStaffList();

    return {
      success: true,
      data: {
        staff: staffList,
        total: staffList.length,
      },
      message: 'Staff list retrieved successfully',
    };
  }

  /**
   * Get staff count by hub
   * GET /staff/hub/:hubId/count
   */
  @Get('hub/:hubId/count')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getStaffCountByHub(
    @Param('hubId', ParseUUIDPipe) hubId: string,
    @CurrentUser() user: any,
  ) {
    let effectiveHubId = hubId;

    if (user.role === UserRole.HUB_MANAGER) {
      if (!user.hubId) {
        throw new BadRequestException(
          'Your account is not assigned to any hub. Please contact admin.',
        );
      }

      if (hubId !== user.hubId) {
        throw new ForbiddenException(
          'You do not have permission to access another hub',
        );
      }

      effectiveHubId = user.hubId;
    }

    const count = await this.staffService.getStaffCountByHub(effectiveHubId);

    return {
      success: true,
      data: { count },
      message: 'Staff count retrieved successfully',
    };
  }

  /**
   * Get staff by ID with detailed information
   * GET /staff/details/:id
   */
  @Get('details/:id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async getStaffDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const scopeHubId = user.role === UserRole.HUB_MANAGER ? user.hubId : null;

    if (user.role === UserRole.HUB_MANAGER && !scopeHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const staff = await this.staffService.findOne(id, scopeHubId || undefined);

    return {
      success: true,
      data: toStaffDetail(staff),
      message: 'Staff details retrieved successfully',
    };
  }

  /**
   * Get single staff by ID
   * GET /staff/:id
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const scopeHubId = user.role === UserRole.HUB_MANAGER ? user.hubId : null;

    if (user.role === UserRole.HUB_MANAGER && !scopeHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const staff = await this.staffService.findOne(id, scopeHubId || undefined);

    return {
      success: true,
      data: toStaffDetail(staff),
      message: 'Staff retrieved successfully',
    };
  }

  /**
   * Update staff
   * PATCH /staff/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @CurrentUser() user: any,
  ) {
    const scopeHubId = user.role === UserRole.HUB_MANAGER ? user.hubId : null;

    if (user.role === UserRole.HUB_MANAGER && !scopeHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const staff = await this.staffService.update(
      id,
      updateStaffDto,
      scopeHubId || undefined,
    );

    return {
      success: true,
      data: toStaffDetail(staff),
      message: 'Staff updated successfully',
    };
  }

  /**
   * Deactivate staff
   * PATCH /staff/:id/deactivate
   */
  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const scopeHubId = user.role === UserRole.HUB_MANAGER ? user.hubId : null;

    if (user.role === UserRole.HUB_MANAGER && !scopeHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const staff = await this.staffService.deactivate(
      id,
      scopeHubId || undefined,
    );

    return {
      success: true,
      data: toStaffActionResponse(staff),
      message: 'Staff deactivated successfully',
    };
  }

  /**
   * Initiate a payout for a staff member (Admin only)
   * POST /staff/:id/pay
   */
  @Post(':id/pay')
  @Roles(UserRole.ADMIN)
  async payStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
    @CurrentUser() user: any,
  ) {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    const tx = await this.staffService.payStaff(
      id,
      Number(amount),
      user.userId,
    );

    return {
      success: true,
      data: tx,
      message: 'Staff payout initiated',
    };
  }

  /**
   * Activate staff (Admin only)
   * PATCH /staff/:id/activate
   */
  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    const staff = await this.staffService.activate(id);

    return {
      success: true,
      data: toStaffActionResponse(staff),
      message: 'Staff activated successfully',
    };
  }

  /**
   * Delete staff (soft delete)
   * DELETE /staff/:id
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const scopeHubId = user.role === UserRole.HUB_MANAGER ? user.hubId : null;

    if (user.role === UserRole.HUB_MANAGER && !scopeHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    await this.staffService.remove(id, scopeHubId || undefined);

    return {
      success: true,
      message: 'Staff deactivated successfully',
    };
  }
}
