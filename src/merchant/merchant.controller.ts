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
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantSignupDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { AddPayoutMethodDto } from './dto/add-payout-method.dto';
import { UpdatePayoutMethodDto } from './dto/update-payout-method.dto';
import { MerchantStatus } from '../common/enums/merchant-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  toMerchantListItem,
  toMerchantDetail,
  toMerchantDetailFull,
} from '../common/interfaces/responses.interface';
import { GetUploadUrlDto } from 'src/upload/dto/get-upload-url.dto';
import { S3Service } from 'src/upload/s3-upload.service';
import {
  UpdateBinDto,
  UpdateNidDto,
  UpdateProfileDetailsDto,
  UpdateTinDto,
  UpdateTradeLicenseDto,
} from './dto/update-profile-details.dto';
import { UpdateMerchantPasswordDto } from './dto/update-merchant-password.dto';
import { MerchantOverviewQueryDto } from './dto/merchant-overview.dto';
import { MerchantDashboardQueryDto } from './dto/merchant-dashboard-query.dto';
import { MerchantDeliveryPerformanceQueryDto } from './dto/merchant-delivery-performance-query.dto';
import { UpdateAdvancePaymentToggleDto } from './dto/update-advance-payment-toggle.dto';

@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly s3Service: S3Service,
  ) {}

  @Public()
  @Post('signup')
  async signup(@Body() signupDto: MerchantSignupDto) {
    const merchant = await this.merchantService.signup(signupDto);
    return {
      id: merchant.id,
      status: merchant.status,
      message: 'Signup successful. Please wait for admin approval.',
    };
  }

  @Roles(UserRole.ADMIN)
  @Get('pending-documents')
  async getPendingDocuments() {
    const merchants =
      await this.merchantService.findMerchantsWithPendingDocuments();
    return {
      merchants,
      message: 'Merchants with pending documents retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(
    @Query('status') status?: MerchantStatus,
    @Query('district') district?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.merchantService.findAll({
      status,
      district,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return {
      merchants: result.data.map(toMerchantListItem),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
      message: 'Merchants retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  @Get(':id/overview')
  async getOverview(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query() query: MerchantOverviewQueryDto,
  ) {
    const data = await this.merchantService.getMerchantOverview(id, {
      hubId: user.role === UserRole.HUB_MANAGER ? user.hubId : null,
      range: query.range,
      month: query.month,
    });

    return {
      success: true,
      data,
      message: 'Merchant overview retrieved successfully',
    };
  }

  @Get('dashboard/summary')
  @Roles(UserRole.MERCHANT)
  async getDashboardSummary(
    @Request() req,
    @Query() query: MerchantDashboardQueryDto,
  ) {
    const data = await this.merchantService.getMerchantDashboard(
      req.user.merchantId,
      query,
    );

    return {
      success: true,
      data,
      message: 'Merchant dashboard summary retrieved successfully',
    };
  }

  @Get('dashboard/cash-on-delivery-details')
  @Roles(UserRole.MERCHANT)
  async getDashboardCashOnDeliveryDetails(@Request() req) {
    const cashOnDeliveryDetails =
      await this.merchantService.getMerchantCashOnDeliveryDetails(
        req.user.merchantId,
      );

    return {
      success: true,
      data: {
        cash_on_delivery_details: cashOnDeliveryDetails,
      },
      message: 'Merchant cash on delivery details retrieved successfully',
    };
  }

  @Get('dashboard/delivery-performance')
  @Roles(UserRole.MERCHANT)
  async getDashboardDeliveryPerformance(
    @Request() req,
    @Query() query: MerchantDeliveryPerformanceQueryDto,
  ) {
    const data = await this.merchantService.getMerchantDeliveryPerformance(
      req.user.merchantId,
      query,
    );

    return {
      success: true,
      data,
      message: 'Merchant delivery performance retrieved successfully',
    };
  }

  /**
   * Toggle advance payment feature per merchant (Admin / Hub Manager)
   * If enabled (flag=true), all advance payment actions are blocked for that merchant.
   */
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  @Patch(':id/advance-payments/toggle')
  async toggleAdvancePayments(
    @Param('id') id: string,
    @Body() dto: UpdateAdvancePaymentToggleDto,
    @CurrentUser() user: any,
  ) {
    const updated = await this.merchantService.setAdvancePaymentDisabled(
      id,
      dto.is_advance_payment_disabled,
      { hubId: user.role === UserRole.HUB_MANAGER ? user.hubId : null },
    );

    return {
      success: true,
      merchant_id: updated.id,
      is_advance_payment_disabled: updated.is_advance_payment_disabled,
      message: 'Advance payment toggle updated successfully',
    };
  }

  @Roles(UserRole.HUB_MANAGER)
  @Get('hub/assigned')
  async getMerchantsAssignedToHub(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!user.hubId) {
      throw new ForbiddenException('hubId missing in auth token');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const { data: merchants, total } = await this.merchantService.findMerchantsAssignedToHub(
      user.hubId,
      search,
      pageNum,
      limitNum
    );

    return {
      success: true,
      data: merchants.map(toMerchantListItem),
      count: merchants.length,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      message: 'Merchants assigned to your hub retrieved successfully',
    };
  }

  @Roles(UserRole.HUB_MANAGER)
  @Get(':id/hub-parcels')
  async getHubParcelsInHubStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    if (!user.hubId) {
      throw new ForbiddenException('hubId missing in auth token');
    }

    const parcels = await this.merchantService.getHubParcelsInHubStatus(
      id,
      user.hubId,
    );

    return {
      success: true,
      data: parcels,
      count: parcels.length,
      message: 'Parcels in hub retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.merchantService.findOneDetailed(id);
    return {
      merchant: toMerchantDetailFull(data),
      message: 'Merchant retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateMerchantDto) {
    const merchant = await this.merchantService.update(id, updateDto);
    return {
      id: merchant.id,
      message: 'Merchant updated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    const merchant = await this.merchantService.approveMerchant(
      id,
      user.userId,
    );
    return {
      id: merchant.id,
      status: merchant.status,
      message: 'Merchant approved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/documents/nid/approve')
  async approveNid(@Param('id') id: string) {
    const result = await this.merchantService.approveDocument(id, 'nid');
    return { ...result, message: 'NID document approved successfully' };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/documents/trade-license/approve')
  async approveTradeLicense(@Param('id') id: string) {
    const result = await this.merchantService.approveDocument(
      id,
      'trade_license',
    );
    return {
      ...result,
      message: 'Trade license document approved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/documents/tin/approve')
  async approveTin(@Param('id') id: string) {
    const result = await this.merchantService.approveDocument(id, 'tin');
    return { ...result, message: 'TIN document approved successfully' };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/documents/bin/approve')
  async approveBin(@Param('id') id: string) {
    const result = await this.merchantService.approveDocument(id, 'bin');
    return { ...result, message: 'BIN document approved successfully' };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const merchant = await this.merchantService.deactivate(id);
    return {
      id: merchant.id,
      status: merchant.status,
      is_active: merchant.user?.is_active,
      message: 'Merchant deactivated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    const merchant = await this.merchantService.activate(id);
    return {
      id: merchant.id,
      status: merchant.status,
      is_active: merchant.user?.is_active,
      message: 'Merchant activated successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/decline')
  async decline(@Param('id') id: string) {
    const merchant = await this.merchantService.decline(id);
    return {
      id: merchant.id,
      status: merchant.status,
      is_active: merchant.user?.is_active,
      message: 'Merchant declined permanently',
    };
  }

  // ===== PAYOUT METHOD ENDPOINTS (Merchant) =====

  /**
   * Get available payout methods
   */
  @Get('my/payout-methods/available')
  @Roles(UserRole.MERCHANT)
  async getAvailablePayoutMethods(@CurrentUser() user: any) {
    const available = await this.merchantService.getAvailablePayoutMethods(
      user.merchantId,
    );

    return {
      success: true,
      data: { available_methods: available },
      message: 'Available payout methods retrieved successfully',
    };
  }

  /**
   * Get current payout methods
   */
  @Get('my/payout-methods')
  @Roles(UserRole.MERCHANT)
  async getMyPayoutMethods(@CurrentUser() user: any) {
    const methods = await this.merchantService.getMerchantPayoutMethods(
      user.merchantId,
    );

    return {
      success: true,
      data: { current_methods: methods },
      message: 'Payout methods retrieved successfully',
    };
  }

  /**
   * Add payout method
   */
  @Post('my/payout-methods')
  @Roles(UserRole.MERCHANT)
  async addPayoutMethod(
    @CurrentUser() user: any,
    @Body() dto: AddPayoutMethodDto,
  ) {
    const method = await this.merchantService.addPayoutMethod(
      user.merchantId,
      dto,
    );

    return {
      success: true,
      data: { method },
      message: 'Payout method added successfully',
    };
  }

  /**
   * Update payout method
   */
  @Patch('my/payout-methods/:id')
  @Roles(UserRole.MERCHANT)
  async updatePayoutMethod(
    @CurrentUser() user: any,
    @Param('id') methodId: string,
    @Body() dto: UpdatePayoutMethodDto,
  ) {
    const method = await this.merchantService.updatePayoutMethod(
      user.merchantId,
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
   * Delete payout method
   */
  @Delete('my/payout-methods/:id')
  @Roles(UserRole.MERCHANT)
  async deletePayoutMethod(
    @CurrentUser() user: any,
    @Param('id') methodId: string,
  ) {
    await this.merchantService.deletePayoutMethod(user.merchantId, methodId);

    return {
      success: true,
      message: 'Payout method deleted successfully',
    };
  }

  /**
   * Set default payout method
   */
  @Patch('my/payout-methods/:id/set-default')
  @Roles(UserRole.MERCHANT)
  async setDefaultPayoutMethod(
    @CurrentUser() user: any,
    @Param('id') methodId: string,
  ) {
    const method = await this.merchantService.setDefaultPayoutMethod(
      user.merchantId,
      methodId,
    );

    return {
      success: true,
      data: { method },
      message: 'Default payout method set successfully',
    };
  }

  /**
   * Get payout transactions
   */
  @Get('my/payout-transactions')
  @Roles(UserRole.MERCHANT)
  async getMyPayoutTransactions(
    @CurrentUser() user: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const result = await this.merchantService.getPayoutTransactions(
      user.merchantId,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      data: result,
      message: 'Payout transactions retrieved successfully',
    };
  }

  // ===== ADMIN PAYOUT ENDPOINTS =====

  /**
   * Verify payout method (Admin only)
   */
  @Patch('payout-methods/:id/verify')
  @Roles(UserRole.ADMIN)
  async verifyPayoutMethod(
    @Param('id') methodId: string,
    @CurrentUser() user: any,
  ) {
    const method = await this.merchantService.verifyPayoutMethod(
      methodId,
      user.userId,
    );

    return {
      success: true,
      data: { method },
      message: 'Payout method verified successfully',
    };
  }

  @Get('settings')
  @Roles(UserRole.MERCHANT)
  getSettings(@Request() req) {
    return this.merchantService.getSettings(req.user.merchantId);
  }

  @Patch('profile-details')
  @Roles(UserRole.MERCHANT)
  updateProfileDetails(@Request() req, @Body() dto: UpdateProfileDetailsDto) {
    return this.merchantService.updateProfileDetails(req.user.merchantId, dto);
  }

  @Patch('profile/password')
  @Roles(UserRole.MERCHANT)
  async updateMyPassword(
    @Request() req,
    @Body() dto: UpdateMerchantPasswordDto,
  ) {
    await this.merchantService.updateMyPassword(req.user.merchantId, dto);
    return {
      success: true,
      message: 'Password updated successfully',
    };
  }

  @Patch('documents/nid')
  @Roles(UserRole.MERCHANT)
  updateNid(@Request() req, @Body() dto: UpdateNidDto) {
    return this.merchantService.updateNid(req.user.merchantId, dto);
  }

  @Patch('documents/trade-license')
  @Roles(UserRole.MERCHANT)
  updateTradeLicense(@Request() req, @Body() dto: UpdateTradeLicenseDto) {
    return this.merchantService.updateTradeLicense(req.user.merchantId, dto);
  }

  @Patch('documents/tin')
  @Roles(UserRole.MERCHANT)
  updateTin(@Request() req, @Body() dto: UpdateTinDto) {
    return this.merchantService.updateTin(req.user.merchantId, dto);
  }

  @Patch('documents/bin')
  @Roles(UserRole.MERCHANT)
  updateBin(@Request() req, @Body() dto: UpdateBinDto) {
    return this.merchantService.updateBin(req.user.merchantId, dto);
  }

  @Get('parcel-summary/lifetime')
  @Roles(UserRole.MERCHANT)
  async getLifetimeParcelSummary(@Request() req) {
    const summary = await this.merchantService.getLifetimeParcelSummary(
      req.user.merchantId,
    );
    return {
      success: true,
      data: summary,
    };
  }
}
