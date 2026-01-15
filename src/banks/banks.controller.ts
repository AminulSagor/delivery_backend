import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { Public } from '../auth/decorators/public.decorator';

@Controller('banks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  /**
   * Create a new bank (Admin only)
   * POST /banks
   */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() createBankDto: CreateBankDto) {
    return this.banksService.create(createBankDto);
  }

  /**
   * Get all banks - Admin gets all including inactive
   * GET /banks
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.banksService.findAll();
  }

  /**
   * Get all active banks - Public endpoint for merchants
   * GET /banks/active
   */
  @Get('active')
  @Public()
  findAllActive() {
    return this.banksService.findAllActive();
  }

  /**
   * Seed default Bangladeshi banks (Admin only)
   * POST /banks/seed
   */
  @Post('seed')
  @Roles(UserRole.ADMIN)
  seedBanks() {
    return this.banksService.seedDefaultBanks();
  }

  /**
   * Get a single bank by ID
   * GET /banks/:id
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.banksService.findOne(id);
  }

  /**
   * Update a bank (Admin only)
   * PATCH /banks/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBankDto: UpdateBankDto,
  ) {
    return this.banksService.update(id, updateBankDto);
  }

  /**
   * Toggle bank active status (Admin only)
   * PATCH /banks/:id/toggle-active
   */
  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN)
  toggleActive(@Param('id', ParseUUIDPipe) id: string) {
    return this.banksService.toggleActive(id);
  }

  /**
   * Delete a bank (Admin only)
   * DELETE /banks/:id
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.banksService.remove(id);
  }
}

