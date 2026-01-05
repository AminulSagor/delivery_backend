import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { MerchantFinanceService } from './merchant-finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { GetTransactionsQueryDto, GetAllMerchantsFinanceQueryDto } from './dto/get-transactions.dto';
import { AdjustBalanceDto, HoldBalanceDto, ReleaseHoldDto } from './dto/adjust-balance.dto';

@Controller('merchant-finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantFinanceController {
  constructor(private readonly financeService: MerchantFinanceService) {}

  // ===== MERCHANT ENDPOINTS =====

  /**
   * Get current merchant's finance overview
   * GET /merchant-finance/my
   */
  @Get('my')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async getMyFinance(@Req() req: any) {
    try {
      const overview = await this.financeService.getMerchantFinanceOverview(
        req.user.userId,
      );

      return {
        success: true,
        data: overview,
        message: 'Finance overview retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get finance overview',
        error: error.name,
      };
    }
  }

  /**
   * Get current merchant's transaction history
   * GET /merchant-finance/my/transactions
   */
  @Get('my/transactions')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async getMyTransactions(
    @Query() query: GetTransactionsQueryDto,
    @Req() req: any,
  ) {
    try {
      const result = await this.financeService.getTransactionHistory(
        req.user.userId,
        query,
      );

      return {
        success: true,
        data: result,
        message: 'Transactions retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get transactions',
        error: error.name,
      };
    }
  }

  // ===== ADMIN ENDPOINTS =====
  // IMPORTANT: Static routes MUST come BEFORE parameterized routes

  /**
   * Get all merchants finance summary
   * GET /merchant-finance/admin/all
   */
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getAllMerchantsFinance(@Query() query: GetAllMerchantsFinanceQueryDto) {
    try {
      const result = await this.financeService.getAllMerchantsFinance(query);

      return {
        success: true,
        data: result,
        message: 'All merchants finance retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get merchants finance',
        error: error.name,
      };
    }
  }

  /**
   * Sync all merchants finance from parcels (Admin)
   * POST /merchant-finance/admin/sync-all
   * NOTE: This MUST be before :merchantId routes
   */
  @Post('admin/sync-all')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncAllMerchantsFinance() {
    try {
      const result = await this.financeService.syncAllMerchantsFinance();

      return {
        success: true,
        data: result,
        message: `Synced ${result.synced} merchants, ${result.errors} errors`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to sync all merchants finance',
        error: error.name,
      };
    }
  }

  /**
   * Get specific merchant's finance overview (Admin)
   * GET /merchant-finance/admin/:merchantId
   */
  @Get('admin/:merchantId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantFinance(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
  ) {
    try {
      const overview = await this.financeService.getMerchantFinanceOverview(merchantId);

      return {
        success: true,
        data: overview,
        message: 'Merchant finance retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get merchant finance',
        error: error.name,
      };
    }
  }

  /**
   * Get specific merchant's transaction history (Admin)
   * GET /merchant-finance/admin/:merchantId/transactions
   */
  @Get('admin/:merchantId/transactions')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getMerchantTransactions(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
    @Query() query: GetTransactionsQueryDto,
  ) {
    try {
      const result = await this.financeService.getTransactionHistory(merchantId, query);

      return {
        success: true,
        data: result,
        message: 'Merchant transactions retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to get merchant transactions',
        error: error.name,
      };
    }
  }

  /**
   * Adjust merchant balance (Admin)
   * POST /merchant-finance/admin/:merchantId/adjust
   */
  @Post('admin/:merchantId/adjust')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adjustBalance(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
    @Body() dto: AdjustBalanceDto,
    @Req() req: any,
  ) {
    try {
      const transaction = await this.financeService.adjustBalance(
        merchantId,
        dto,
        req.user.userId,
      );

      return {
        success: true,
        data: {
          transaction_id: transaction.id,
          type: transaction.transaction_type,
          amount: Number(transaction.amount),
          balance_after: Number(transaction.balance_after),
        },
        message: `Balance ${dto.type.toLowerCase()}ed successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to adjust balance',
        error: error.name,
      };
    }
  }

  /**
   * Hold merchant balance (Admin)
   * POST /merchant-finance/admin/:merchantId/hold
   */
  @Post('admin/:merchantId/hold')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async holdBalance(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
    @Body() dto: HoldBalanceDto,
    @Req() req: any,
  ) {
    try {
      const finance = await this.financeService.holdBalance(
        merchantId,
        dto,
        req.user.userId,
      );

      return {
        success: true,
        data: {
          hold_amount: Number(finance.hold_amount),
          available_balance: Math.max(
            0,
            Number(finance.current_balance) - Number(finance.hold_amount),
          ),
        },
        message: 'Balance held successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to hold balance',
        error: error.name,
      };
    }
  }

  /**
   * Release held balance (Admin)
   * POST /merchant-finance/admin/:merchantId/release-hold
   */
  @Post('admin/:merchantId/release-hold')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async releaseHold(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
    @Body() dto: ReleaseHoldDto,
    @Req() req: any,
  ) {
    try {
      const finance = await this.financeService.releaseHold(
        merchantId,
        dto,
        req.user.userId,
      );

      return {
        success: true,
        data: {
          hold_amount: Number(finance.hold_amount),
          available_balance: Math.max(
            0,
            Number(finance.current_balance) - Number(finance.hold_amount),
          ),
        },
        message: 'Hold released successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to release hold',
        error: error.name,
      };
    }
  }

  /**
   * Sync merchant finance from parcels (Admin)
   * POST /merchant-finance/admin/:merchantId/sync
   */
  @Post('admin/:merchantId/sync')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncMerchantFinance(
    @Param('merchantId', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('Invalid merchant ID format. Must be a valid UUID.') })) 
    merchantId: string,
  ) {
    try {
      const finance = await this.financeService.syncMerchantFinance(merchantId);

      return {
        success: true,
        data: {
          pending_balance: Number(finance.pending_balance),
          invoiced_balance: Number(finance.invoiced_balance),
          total_cod_collected: Number(finance.total_cod_collected),
          total_delivery_charges: Number(finance.total_delivery_charges),
          total_return_charges: Number(finance.total_return_charges),
          total_parcels_delivered: finance.total_parcels_delivered,
          total_parcels_returned: finance.total_parcels_returned,
        },
        message: 'Merchant finance synced successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to sync merchant finance',
        error: error.name,
      };
    }
  }
}
