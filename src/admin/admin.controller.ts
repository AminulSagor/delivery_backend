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
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminCreateMerchantDto } from './dto/admin-create-merchant.dto';
import { AdminParcelQueryDto } from './dto/admin-parcel-query.dto';
import { TransferRecordQueryDto } from '../hubs/dto/transfer-record-query.dto';
import {
  ApproveTransferRecordDto,
  RejectTransferRecordDto,
} from './dto/review-transfer-record.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { Public } from '../common/decorators/public.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public() // ⚠️ WARNING: Public admin creation - remove in production
  @Post()
  async create(@Body() createAdminDto: CreateAdminDto) {
    const admin = await this.adminService.create(createAdminDto);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user created successfully',
    };
  }

  @Get()
  async findAll() {
    return await this.adminService.findAll();
  }

  // ===== ALL PARCELS =====

  /**
   * Get all parcels in the system with rich data
   * GET /admin/parcels
   *
   * Query params:
   * - page, limit: pagination
   * - search: search by tracking number, parcel_tx_id, customer name/phone
   * - status: filter by ParcelStatus enum or 'ACTIVE'
   * - hubId: optional hub filter
   * - merchantId, storeId: optional filters
   * - sortBy, order: sorting
   */
  @Get('parcels')
  @HttpCode(HttpStatus.OK)
  async getAllParcels(@Query() query: AdminParcelQueryDto) {
    const result = await this.adminService.getAllParcels(query);

    return {
      success: true,
      data: result,
      message: 'All parcels retrieved successfully',
    };
  }

  // ===== HUB TRANSFER RECORDS =====

  /**
   * Get all hub transfer records
   */
  @Get('hub-transfer-records')
  async getAllHubTransferRecords(@Query() query: TransferRecordQueryDto) {
    const { records, total } =
      await this.adminService.getAllHubTransferRecords(query);

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
      message: 'Hub transfer records retrieved successfully',
    };
  }

  /**
   * Approve transfer record
   */
  @Patch('hub-transfer-records/:id/approve')
  async approveTransferRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTransferRecordDto,
    @Req() req: any,
  ) {
    const adminUserId = req.user.userId;
    const record = await this.adminService.approveTransferRecord(
      id,
      adminUserId,
      dto.admin_notes,
    );

    return {
      success: true,
      data: { transfer_record: record },
      message: 'Transfer record approved successfully',
    };
  }

  /**
   * Reject transfer record
   */
  @Patch('hub-transfer-records/:id/reject')
  async rejectTransferRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferRecordDto,
    @Req() req: any,
  ) {
    const adminUserId = req.user.userId;
    const record = await this.adminService.rejectTransferRecord(
      id,
      adminUserId,
      dto.rejection_reason,
      dto.admin_notes,
    );

    return {
      success: true,
      data: { transfer_record: record },
      message: 'Transfer record rejected successfully',
    };
  }

  // ===== MERCHANT MANAGEMENT =====

  /**
   * Admin creates a merchant (auto-approved, no PENDING required)
   * POST /admin/merchants
   *
   * Body: full_name, phone, password, business_name, business_address,
   *       district, thana, carrybee_city_id, carrybee_zone_id, carrybee_area_id
   *       (+ optional: email, secondary_number, area, full_address)
   */
  @Post('merchants')
  async createMerchant(
    @Body() dto: AdminCreateMerchantDto,
    @Req() req: any,
  ) {
    const adminId = req.user.userId;
    const merchant = await this.adminService.adminCreateMerchant(dto, adminId);

    return {
      success: true,
      data: {
        merchant_id: merchant.id,
        user_id: merchant.user_id,
        full_name: merchant.user?.full_name,
        phone: merchant.user?.phone,
        email: merchant.user?.email || null,
        status: merchant.status,
        approved_at: merchant.approved_at,
      },
      message: 'Merchant created and approved successfully',
    };
  }

  // ===== MERCHANT CLEARANCE =====

  /**
   * Get merchant clearance list
   * Shows merchants with unpaid DELIVERED or RETURN_TO_MERCHANT parcels
   * GET /admin/merchants/clearance-list
   */
  @Get('merchants/clearance-list')
  async getMerchantClearanceList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('merchant_id') merchantId?: string,
    @Query('search') search?: string,
  ) {
    const { merchants, total, summary } =
      await this.adminService.getMerchantClearanceList({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        merchantId,
        search,
      });

    return {
      success: true,
      data: {
        merchants,
        pagination: {
          total,
          page: page ? parseInt(page, 10) : 1,
          limit: limit ? parseInt(limit, 10) : 10,
          totalPages: Math.ceil(total / (limit ? parseInt(limit, 10) : 10)),
        },
        summary,
      },
      message: 'Merchant clearance list retrieved successfully',
    };
  }

  // ===== ADMIN USER MANAGEMENT (DYNAMIC ROUTES) =====

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.adminService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    const admin = await this.adminService.update(id, updateAdminDto);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return adminWithoutSensitive;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.adminService.remove(id);
    return {
      deleted: true,
      message: 'Admin user deleted successfully',
    };
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const admin = await this.adminService.deactivate(id);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user deactivated successfully',
    };
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    const admin = await this.adminService.activate(id);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user activated successfully',
    };
  }
}
