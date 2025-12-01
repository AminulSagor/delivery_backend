import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantSignupDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
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
}
