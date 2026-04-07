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
  ParseBoolPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  toStaffListItem,
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
      data: {
        id: staff.id,
        full_name: staff.user?.full_name,
        phone: staff.user?.phone,
        hub_name: staff.hub?.branch_name,
      },
      message: 'Staff created successfully',
    };
  }

  /**
   * Get all staff with optional filters
   * GET /staff?hubId=xxx&isActive=true
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAll(
    @CurrentUser() user: any,
    @Query('hubId') hubId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const effectiveHubId =
      user.role === UserRole.HUB_MANAGER ? user.hubId || null : hubId;

    if (user.role === UserRole.HUB_MANAGER && !effectiveHubId) {
      throw new BadRequestException(
        'Your account is not assigned to any hub. Please contact admin.',
      );
    }

    const isActiveBoolean =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const staff = await this.staffService.findAll(
      effectiveHubId || undefined,
      isActiveBoolean,
    );

    return {
      success: true,
      data: staff.map((s) => ({
        id: s.id,
        full_name: s.user?.full_name,
        phone: s.user?.phone,
        email: s.user?.email,
        position: s.position,
        hub_id: s.hub_id,
        hub_name: s.hub?.branch_name,
        hub_code: s.hub?.hub_code,
        photo: s.photo,
        secondary_phone: s.secondary_phone,
        guardian_mobile_no: s.guardian_mobile_no,
        bike_type: s.bike_type,
        nid_number: s.nid_number,
        license_no: s.license_no,
        present_address: s.present_address,
        permanent_address: s.permanent_address,
        fixed_salary: s.fixed_salary,
        bank_name: s.bank_name,
        bank_account_number: s.bank_account_number,
        bank_branch: s.bank_branch,
        is_active: s.is_active,
        created_at: s.created_at,
      })),
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
      data: {
        id: staff.id,
        user_id: staff.user_id,
        full_name: staff.user?.full_name,
        phone: staff.user?.phone,
        email: staff.user?.email,
        position: staff.position,
        hub_id: staff.hub_id,
        hub_name: staff.hub?.branch_name,
        hub_code: staff.hub?.hub_code,
        photo: staff.photo,
        secondary_phone: staff.secondary_phone,
        guardian_mobile_no: staff.guardian_mobile_no,
        bike_type: staff.bike_type,
        nid_number: staff.nid_number,
        license_no: staff.license_no,
        present_address: staff.present_address,
        permanent_address: staff.permanent_address,
        fixed_salary: staff.fixed_salary,
        bank_name: staff.bank_name,
        bank_account_number: staff.bank_account_number,
        bank_branch: staff.bank_branch,
        nid_front_photo: staff.nid_front_photo,
        nid_back_photo: staff.nid_back_photo,
        license_front_photo: staff.license_front_photo,
        license_back_photo: staff.license_back_photo,
        parent_nid_front_photo: staff.parent_nid_front_photo,
        parent_nid_back_photo: staff.parent_nid_back_photo,
        is_active: staff.is_active,
        created_at: staff.created_at,
        updated_at: staff.updated_at,
      },
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
      data: toStaffActionResponse(staff),
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

    const staff = await this.staffService.deactivate(id, scopeHubId || undefined);

    return {
      success: true,
      data: toStaffActionResponse(staff),
      message: 'Staff deactivated successfully',
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
