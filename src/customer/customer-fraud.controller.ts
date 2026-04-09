import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerFraudService } from './customer-fraud.service';
import { CustomerFraudCustomerListQueryDto } from './dto/customer-fraud-customer-list-query.dto';
import { CreateCustomerFraudDto } from './dto/create-customer-fraud.dto';
import { CustomerFraudRequestListQueryDto } from './dto/customer-fraud-request-list-query.dto';
import { ReviewCustomerFraudDto } from './dto/review-customer-fraud.dto';

@Controller('customers/fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerFraudController {
  constructor(private readonly fraudService: CustomerFraudService) {}

  @Get('customers')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async getRegisteredCustomers(
    @Query() query: CustomerFraudCustomerListQueryDto,
  ) {
    const result = await this.fraudService.getRegisteredCustomers(query);
    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'Registered customers retrieved successfully',
    };
  }

  @Get('customers/phone/:phone')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async getFraudDetailsByPhone(@Param('phone') phone: string) {
    const data = await this.fraudService.getCustomerFraudDetailsByPhone(phone);
    return {
      success: true,
      data,
      message: 'Customer fraud details retrieved successfully',
    };
  }

  @Get('customers/:customerId')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async getFraudDetailsByCustomerId(@Param('customerId') customerId: string) {
    const data = await this.fraudService.getCustomerFraudDetailsById(customerId);
    return {
      success: true,
      data,
      message: 'Customer fraud details retrieved successfully',
    };
  }

  @Post('requests')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  async createFraudRequest(
    @Body() dto: CreateCustomerFraudDto,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    const request = await this.fraudService.createFraudRequest(dto, merchantId);
    return {
      success: true,
      data: request,
      message: 'Fraud list request submitted successfully',
    };
  }

  @Delete('customers/:customerId')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async removeFromFraudListByCustomerId(
    @Param('customerId') customerId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    const result = await this.fraudService.removeCustomerFromFraudList(
      customerId,
      merchantId,
    );
    return {
      success: true,
      data: result,
      message: 'Customer removed from fraud list successfully',
    };
  }

  @Delete('customers/phone/:phone')
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  async removeFromFraudListByPhone(
    @Param('phone') phone: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    const result = await this.fraudService.removeCustomerFromFraudListByPhone(
      phone,
      merchantId,
    );
    return {
      success: true,
      data: result,
      message: 'Customer removed from fraud list successfully',
    };
  }

  @Get('admin/requests')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async listFraudRequestsForAdmin(
    @Query() query: CustomerFraudRequestListQueryDto,
  ) {
    const result = await this.fraudService.listFraudRequestsForAdmin(query);
    return {
      success: true,
      data: result.items,
      pagination: result.pagination,
      message: 'Fraud requests retrieved successfully',
    };
  }

  @Patch('admin/requests/:requestId/review')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async reviewFraudRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ReviewCustomerFraudDto,
    @CurrentUser('userId') userId: string,
  ) {
    const result = await this.fraudService.reviewFraudRequest(
      requestId,
      dto,
      userId,
    );

    return {
      success: true,
      data: result,
      message: 'Fraud request reviewed successfully',
    };
  }
}
