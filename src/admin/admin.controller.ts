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
import { AddPayoutMethodDto } from '../merchant/dto/add-payout-method.dto';
import { UpdatePayoutMethodDto } from '../merchant/dto/update-payout-method.dto';
import { TransferRecordQueryDto } from '../hubs/dto/transfer-record-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ApproveTransferRecordDto,
  RejectTransferRecordDto,
} from './dto/review-transfer-record.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { Public } from '../common/decorators/public.decorator';
import { AdminCreateParcelDto } from '../parcels/dto/admin-create-parcel.dto';
import { toParcelListItem } from '../common/interfaces/responses.interface';
import { BulkReceiveParcelsDto } from '../hubs/dto/bulk-receive-parcels.dto';

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

  /**
   * Create and Receive Parcel (Admin)
   * Creates a parcel and sets status to IN_HUB immediately at the specified hub
   */
  @Post('parcels/create-and-receive')
  @HttpCode(HttpStatus.CREATED)
  async createAndReceiveParcel(
    @Body() dto: AdminCreateParcelDto,
    @Req() req: any,
  ) {
    const adminId = req.user.userId;
    const parcel = await this.adminService.createAndReceiveParcel(dto, adminId);

    return {
      success: true,
      data: {
        parcel: toParcelListItem(parcel),
      },
      message: 'Parcel created and received successfully at the specified hub.',
    };
  }

  /**
   * Get parcels eligible for receive across all hubs (Admin)
   * Eligible statuses: PENDING, PICKED_UP
   */
  @Get('parcels/received')
  @HttpCode(HttpStatus.OK)
  async getParcelsForReceipt(@Query() query: AdminParcelQueryDto) {
    const result = await this.adminService.getParcelsForReceipt(query);

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
   * Bulk mark parcels as received (Admin)
   * Each parcel is received at its own assigned store hub.
   */
  @Post('parcels/receive')
  @HttpCode(HttpStatus.OK)
  async bulkReceiveParcels(@Body() dto: BulkReceiveParcelsDto) {
    const result = await this.adminService.bulkReceiveParcels(dto.parcel_ids);

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
   * Admin: Hub Collections list (for HUB Cash Collection UI)
   */
  @Get('hub-collections')
  async getHubCollections(
    @Query()
    query: PaginationDto & {
      search?: string;
      area?: string;
      sortBy?: string;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const result = await this.adminService.getHubCollections(query);
    return {
      success: true,
      data: {
        items: result.items,
        pagination: result.pagination,
      },
      message: 'Hub collections retrieved successfully',
    };
  }

  /**
   * Admin: Export hub collections to CSV
   */
  @Get('hub-collections/export')
  async exportHubCollections(
    @Query() query: PaginationDto & { search?: string; area?: string },
  ) {
    // Get all hubs (no pagination) by setting a large limit
    const result = await this.adminService.getHubCollections({
      ...(query as any),
      page: 1,
      limit: 10000,
    });

    // Build CSV
    const rows = result.items.map((h) => ({
      id: h.id,
      hub_code: h.hub_code,
      branch_name: h.branch_name,
      area: h.area,
      manager_name: h.manager?.name || null,
      manager_phone: h.manager?.phone || null,
      lifetime_collection: h.lifetime_collection,
      hub_expenses: h.hub_expenses,
      pending_amount: h.pending_amount,
      last_received_at: h.last_received_at
        ? new Date(h.last_received_at).toISOString()
        : '',
    }));

    const header = Object.keys(rows[0] || {}).join(',') + '\n';
    const csv =
      header +
      rows
        .map((r) =>
          Object.values(r)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n');

    return { success: true, data: { csv }, message: 'CSV exported' };
  }

  /**
   * Admin: Send notification to hub (placeholder)
   */
  @Post('hub-collections/:id/notify')
  async notifyHub(@Param('id') id: string, @Body() body: { message?: string }) {
    const result = await this.adminService.notifyHub(id, body?.message);
    return { success: true, data: result, message: 'Hub notified' };
  }

  /**
   * Admin: Get hub detail with financial summary and related parcels
   */
  @Get('hub-collections/:id')
  async getHubDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Query()
    query: PaginationDto & {
      search?: string;
      status?: string;
      merchantId?: string;
      riderId?: string;
      sortBy?: string;
      order?: 'ASC' | 'DESC';
    },
  ) {
    const data = await this.adminService.getHubDetail(id, query);
    return {
      success: true,
      data,
      message: 'Hub details with parcels retrieved successfully',
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
  async createMerchant(@Body() dto: AdminCreateMerchantDto, @Req() req: any) {
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

  // ===== DROPDOWN DATA ENDPOINTS =====

  /**
   * Get all stores for a specific merchant
   * GET /admin/merchants/:id/stores
   */
  @Get('merchants/:id/stores')
  async getMerchantStores(@Param('id', ParseUUIDPipe) id: string) {
    const stores = await this.adminService.getMerchantStoresForDropdown(id);
    return {
      success: true,
      data: { stores },
      message: 'Merchant stores retrieved successfully',
    };
  }

  // ===== MERCHANT PAYOUT METHODS =====

  // ===== MERCHANT PAYOUT METHODS =====

  /**
   * Get all payout methods for a merchant
   * GET /admin/merchants/:merchantId/payout-methods
   */
  @Get('merchants/:merchantId/payout-methods')
  async getMerchantPayoutMethods(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
  ) {
    const methods =
      await this.adminService.getMerchantPayoutMethods(merchantId);
    return {
      success: true,
      data: { methods },
      message: 'Payout methods retrieved successfully',
    };
  }

  /**
   * Get all system-supported payout method types
   * GET /admin/payout-methods/available
   */
  @Get('payout-methods/available')
  async getAvailablePayoutMethods() {
    const available = this.adminService.getSystemPayoutMethodTypes();
    return {
      success: true,
      data: { available_methods: available },
      message: 'System-supported payout method types retrieved successfully',
    };
  }

  /**
   * Get payout transaction history for a merchant
   * GET /admin/merchants/:merchantId/payout-transactions
   */
  @Get('merchants/:merchantId/payout-transactions')
  async getMerchantPayoutTransactions(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const result = await this.adminService.getMerchantPayoutTransactions(
      merchantId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
    return {
      success: true,
      data: result,
      message: 'Payout transactions retrieved successfully',
    };
  }

  /**
   * Admin adds a payout method for a merchant (auto-verified)
   * POST /admin/merchants/:merchantId/payout-methods
   *
   * Body examples:
   *  { "method_type": "BANK_ACCOUNT", "bank_name": "...", "branch_name": "...",
   *    "account_holder_name": "...", "account_number": "...", "routing_number": "..." }
   *  { "method_type": "BKASH", "bkash_number": "01XXXXXXXXX",
   *    "bkash_account_holder_name": "...", "bkash_account_type": "PERSONAL" }
   *  { "method_type": "NAGAD", "nagad_number": "01XXXXXXXXX",
   *    "nagad_account_holder_name": "...", "nagad_account_type": "PERSONAL" }
   */
  @Post('merchants/:merchantId/payout-methods')
  async addMerchantPayoutMethod(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Body() dto: AddPayoutMethodDto,
    @Req() req: any,
  ) {
    const adminId = req.user.userId;
    const method = await this.adminService.adminAddPayoutMethod(
      merchantId,
      dto,
      adminId,
    );
    return {
      success: true,
      data: { method },
      message: 'Payout method added and verified successfully',
    };
  }

  /**
   * Admin updates a payout method for a merchant
   * PATCH /admin/merchants/:merchantId/payout-methods/:methodId
   *
   * Can update any field (bank details, bkash/nagad number, etc.)
   * Note: method_type cannot be changed — create a new one instead.
   */
  @Patch('merchants/:merchantId/payout-methods/:methodId')
  async updateMerchantPayoutMethod(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Body() dto: UpdatePayoutMethodDto,
  ) {
    const method = await this.adminService.adminUpdatePayoutMethod(
      merchantId,
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
   * Set a payout method as default for a merchant (Admin)
   * PATCH /admin/merchants/:merchantId/payout-methods/:methodId/set-default
   */
  @Patch('merchants/:merchantId/payout-methods/:methodId/set-default')
  async setMerchantPayoutMethodDefault(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    const method = await this.adminService.adminSetDefaultPayoutMethod(
      merchantId,
      methodId,
    );
    return {
      success: true,
      data: { method },
      message: 'Default payout method updated successfully',
    };
  }

  /**
   * Delete a payout method for a merchant (Admin)
   * DELETE /admin/merchants/:merchantId/payout-methods/:methodId
   */
  @Delete('merchants/:merchantId/payout-methods/:methodId')
  @HttpCode(HttpStatus.OK)
  async deleteMerchantPayoutMethod(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    await this.adminService.adminDeletePayoutMethod(merchantId, methodId);
    return {
      success: true,
      message: 'Payout method deleted successfully',
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
