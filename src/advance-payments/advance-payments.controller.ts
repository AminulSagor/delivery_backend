import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AdvancePaymentsService } from './advance-payments.service';
import { CreateAdvancePaymentDto } from './dto/create-advance.dto';
import { MerchantActionDto } from './dto/merchant-action.dto';
import { ReviewAdvancePaymentDto } from './dto/review-advance.dto';
import { UpdateAdvancePaymentDto } from './dto/update-advance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GetAdvancePaymentsQueryDto } from './dto/get-advance-payments.dto';

@Controller('advance-payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvancePaymentsController {
  constructor(private readonly service: AdvancePaymentsService) {}

  @Post('admin/create/invoice')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAdvancePaymentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Get('admin/invoice/list')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async findAllAdmin(@Query() query: GetAdvancePaymentsQueryDto) {
    // Admin passes no 2nd arg, so they can see all (or filter via query.merchant_id)
    const result = await this.service.findAll(query);
    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'Advance payments retrieved successfully',
    };
  }

  @Get('admin/invoice/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async findOneAdmin(@Param('id') id: string) {
    const data = await this.service.findOne(id); // No merchant ID restriction for admin
    return {
      success: true,
      data,
      message: 'Advance payment details retrieved successfully',
    };
  }

  @Patch('admin/invoice/:id/update')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  update(@Param('id') id: string, @Body() dto: UpdateAdvancePaymentDto) {
    return this.service.update(id, dto);
  }

  @Patch('admin/invoice/:id/review')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  review(
    @Param('id') id: string,
    @Body() dto: ReviewAdvancePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.review(id, dto, user);
  }

  @Patch('admin/invoice/:id/pay')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  pay(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.pay(id, user);
  }

  @Get('merchant/invoice/list')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async findAllMerchant(
    @CurrentUser('merchantId') merchantId: string,
    @Query() query: GetAdvancePaymentsQueryDto,
  ) {
    if (this.shouldUseMerchantMockData()) {
      const result = this.buildMockAdvancePaymentsList(query, merchantId);
      return {
        success: true,
        data: result.items,
        pagination: result.pagination,
        message: 'My advance payments retrieved successfully',
      };
    }

    // Force merchantId filter
    const result = await this.service.findAll(query, merchantId);
    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'My advance payments retrieved successfully',
    };
  }

  @Get('merchant/invoice/:id')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async findOneMerchant(
    @Param('id') id: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (this.shouldUseMerchantMockData()) {
      const data = this.buildMockAdvancePaymentDetails(id, merchantId);
      return {
        success: true,
        data,
        message: 'Advance payment details retrieved successfully',
      };
    }

    // Pass merchantId to service to ensure ownership
    const data = await this.service.findOne(id, merchantId);
    return {
      success: true,
      data,
      message: 'Advance payment details retrieved successfully',
    };
  }

  @Patch('merchant/invoice/:id/action')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  action(
    @Param('id') id: string,
    @Body() dto: MerchantActionDto,
    @CurrentUser('merchantId') mid: string,
    @CurrentUser('userId') uid: string,
  ) {
    return this.service.merchantAction(id, dto, mid, uid);
  }

  private shouldUseMerchantMockData(): boolean {
    return process.env.MOCK_MERCHANT_DATA === 'true';
  }

  private buildMockAdvancePaymentsList(
    query: GetAdvancePaymentsQueryDto,
    merchantId: string,
  ) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const merchantName = merchantId
      ? `Demo Merchant ${merchantId.slice(0, 6)}`
      : 'Demo Merchant';
    const merchantPhone = '01700000000';
    const invoiceId1 = '1f8e4d3b-1b4e-4d0e-8b88-2fb7e3d5341b';
    const invoiceId2 = '2aa2b8a5-0b9f-4b3d-9a61-7d2f2f7b2a21';

    const items = [
      {
        id: invoiceId1,
        invoice_id: 'ADV-260506-001',
        created_at: new Date('2026-05-03T09:15:00.000Z'),
        merchant_name: merchantName,
        merchant_phone: merchantPhone,
        total_parcels: 24,
        net_amount: 12500,
        status: 'PENDING_MERCHANT_APPROVAL',
        is_paid: false,
        paid_at: null,
      },
      {
        id: invoiceId2,
        invoice_id: 'ADV-260506-002',
        created_at: new Date('2026-05-04T11:20:00.000Z'),
        merchant_name: merchantName,
        merchant_phone: merchantPhone,
        total_parcels: 18,
        net_amount: 9800,
        status: 'PAID',
        is_paid: true,
        paid_at: new Date('2026-05-05T12:00:00.000Z'),
      },
    ];

    let filtered = items;

    if (query.status) {
      filtered = filtered.filter((item) => item.status === query.status);
    }

    if (query.start_date) {
      const startDate = new Date(query.start_date);
      filtered = filtered.filter((item) => item.created_at >= startDate);
    }

    if (query.end_date) {
      const endDate = new Date(query.end_date);
      filtered = filtered.filter((item) => item.created_at <= endDate);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const paged = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: paged,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  private buildMockAdvancePaymentDetails(id: string, merchantId: string) {
    const merchantName = 'Demo Merchant';
    const merchantPhone = '01700000000';

    const details = {
      '1f8e4d3b-1b4e-4d0e-8b88-2fb7e3d5341b': {
        id,
        invoice_id: 'ADV-260506-001',
        status: 'PENDING_MERCHANT_APPROVAL',
        created_at: new Date('2026-05-03T09:15:00.000Z'),
        paid_at: null,
        is_paid: false,
        merchant: {
          id: merchantId,
          name: merchantName,
          phone: merchantPhone,
        },
        breakdown: {
          total_parcels: 24,
          total_collectable: 15000,
          deductions: {
            delivery_fee: 1000,
            cod_charge: 400,
            weight_charge: 600,
            return_charge: 500,
          },
          net_payable: 12500,
        },
        payment_method: 'BKASH',
        admin_note: 'Advance payment for May shipments',
        merchant_review_note: null,
        created_by: 'Admin',
      },
      '2aa2b8a5-0b9f-4b3d-9a61-7d2f2f7b2a21': {
        id,
        invoice_id: 'ADV-260506-002',
        status: 'PAID',
        created_at: new Date('2026-05-04T11:20:00.000Z'),
        paid_at: new Date('2026-05-05T12:00:00.000Z'),
        is_paid: true,
        merchant: {
          id: merchantId,
          name: merchantName,
          phone: merchantPhone,
        },
        breakdown: {
          total_parcels: 18,
          total_collectable: 12000,
          deductions: {
            delivery_fee: 800,
            cod_charge: 300,
            weight_charge: 500,
            return_charge: 600,
          },
          net_payable: 9800,
        },
        payment_method: 'BANK_ACCOUNT',
        admin_note: 'Settled advance invoice',
        merchant_review_note: 'Approved by merchant',
        created_by: 'Admin',
      },
    };

    return (
      details[id] ||
      ({
        id,
        invoice_id: 'ADV-260506-001',
        status: 'PENDING_MERCHANT_APPROVAL',
        created_at: new Date('2026-05-03T09:15:00.000Z'),
        paid_at: null,
        is_paid: false,
        merchant: {
          id: merchantId,
          name: merchantName,
          phone: merchantPhone,
        },
        breakdown: {
          total_parcels: 24,
          total_collectable: 15000,
          deductions: {
            delivery_fee: 1000,
            cod_charge: 400,
            weight_charge: 600,
            return_charge: 500,
          },
          net_payable: 12500,
        },
        payment_method: 'BKASH',
        admin_note: 'Advance payment for May shipments',
        merchant_review_note: null,
        created_by: 'Admin',
      } as const)
    );
  }
}
