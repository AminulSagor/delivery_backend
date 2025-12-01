import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CheckCustomerPhoneDto } from './dto/check-customer-phone.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // 🔹 Frontend: first step → give only phone, check if exists
  @Post('check')
  async checkCustomer(
    @Body() dto: CheckCustomerPhoneDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.customerService.checkByPhone(dto.phone_number);
    return {
      ...result,
      phone_number: dto.phone_number,
    };
  }

  // 🔹 Create full customer (called if check says exists === false)
  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateCustomerDto,
  ) {
    const customer = await this.customerService.create(dto);
    return {
      customer,
      message: 'Customer created successfully',
    };
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return await this.customerService.findAll();
  }

  // Get customer by phone number instead of id
  @Get(':phone')
  async findOne(@Param('phone') phone: string, @CurrentUser() user: any) {
    return await this.customerService.findOneByPhone(phone);
  }

  // Update customer by phone number
  @Patch(':phone')
  async update(
    @Param('phone') phone: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCustomerDto,
  ) {
    const customer = await this.customerService.update(phone, dto);
    return {
      customer,
      message: 'Customer updated successfully',
    };
  }

  // Delete customer by phone number
  @Delete(':phone')
  async remove(@Param('phone') phone: string, @CurrentUser() user: any) {
    await this.customerService.remove(phone);
    return {
      deleted: true,
      message: 'Customer deleted successfully',
    };
  }
}
