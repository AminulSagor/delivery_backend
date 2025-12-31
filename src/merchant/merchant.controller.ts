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
import { toMerchantListItem, toMerchantDetail } from '../common/interfaces/responses.interface';

@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

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
  @Get()
  async findAll(
    @Query('status') status?: MerchantStatus,
    @Query('district') district?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.merchantService.findAll({
      status,
      district,
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

  @Roles(UserRole.ADMIN)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const merchant = await this.merchantService.findOne(id);
    return {
      merchant: toMerchantDetail(merchant),
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
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const merchant = await this.merchantService.approveMerchant(id, user.userId);
    return {
      id: merchant.id,
      status: merchant.status,
      message: 'Merchant approved successfully',
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
}
