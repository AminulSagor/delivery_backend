import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AdminAccountsService } from '../services/admin-accounts.service';
import {
  CreateAdminAccountDto,
  UpdateAdminAccountDto,
} from '../dto/create-admin-account.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ManualTransactionDto } from '../dto/manual-transaction.dto';
import { TransferFundsDto } from '../dto/transfer-funds.dto';
import { UpdateStatementDto } from '../dto/update-statement.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AdminFinanceAnalyticsQueryDto } from '../dto/admin-finance-analytics-query.dto';

@Controller('admin/accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Restricted to Admin
export class AdminAccountsController {
  constructor(private readonly service: AdminAccountsService) {}

  @Post()
  async create(@Body() dto: CreateAdminAccountDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('list/active')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAllActive(@Query() query: PaginationDto) {
    return this.service.findAllActive(query);
  }

  @Get('list/active/:id')
  @Roles(UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findActiveOne(@Param('id') id: string) {
    const data = await this.service.findActiveOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAdminAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('transaction')
  @HttpCode(HttpStatus.OK)
  async createTransaction(
    @Body() dto: ManualTransactionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createManualTransaction(dto, user.userId);
  }

  // Finance Overview
  @Get('finance/overview')
  async getFinanceOverview(@CurrentUser() user: any) {
    return this.service.getAdminFinanceOverview(user.userId);
  }

  // Finance & Analytics Overview
  @Get('finance/analytics')
  async getFinanceAnalytics(
    @CurrentUser() user: any,
    @Query() query: AdminFinanceAnalyticsQueryDto,
  ) {
    return this.service.getAdminFinanceAnalytics(user.userId, query);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  async transferFunds(@Body() dto: TransferFundsDto, @CurrentUser() user: any) {
    return this.service.transferFunds(dto, user.userId);
  }

  @Get(':id/statements')
  async getStatements(@Param('id') id: string, @Query() query: PaginationDto) {
    return this.service.getStatements(id, query);
  }

  // 1. Get All Statements (Global)
  @Get('statements/list') // Specific path to avoid collision with :id
  async findAllStatements(@Query() query: any) {
    return this.service.findAllStatements(query);
  }

  // 2. Get All Transfers
  @Get('transfers/list')
  async findAllTransfers(@Query('page') page: number) {
    return this.service.findAllTransfers(page);
  }

  // 3. Get Transfer By ID
  @Get('transfers/:id')
  async findTransferById(@Param('id') id: string) {
    return this.service.findTransferById(id);
  }

  // 4. Get Statement By ID
  @Get('statements/:id')
  async findStatementById(@Param('id') id: string) {
    return this.service.findStatementById(id);
  }

  // 5. Edit Statement
  @Patch('statements/:id')
  async updateStatement(
    @Param('id') id: string,
    @Body() dto: UpdateStatementDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateStatement(id, dto, user.userId);
  }

  // 6. Delete Statement
  @Delete('statements/:id')
  async removeStatement(@Param('id') id: string) {
    return this.service.removeStatement(id);
  }
}
