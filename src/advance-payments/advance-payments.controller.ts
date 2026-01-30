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
  update(@Param('id') id: string, @Body() dto: CreateAdvancePaymentDto) {
    return this.service.update(id, dto);
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
  ) {
    return this.service.merchantAction(id, dto, mid);
  }
}
