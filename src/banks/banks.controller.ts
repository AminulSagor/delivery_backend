import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('banks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  // ===== ADMIN CRUD ENDPOINTS =====

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
   * Get all active banks - for all authenticated users
   * GET /banks/active
   */
  @Get('active')
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

  // ===== CASCADING SELECTION ENDPOINTS (all authenticated users) =====

  /**
   * Step 1: Get distinct bank names
   * GET /banks/names
   *
   * Returns: { names: ["Dutch Bangla Bank Limited", "BRAC Bank Limited", ...] }
   */
  @Get('names')
  async getBankNames() {
    const result = await this.banksService.getDistinctBankNames();
    return {
      success: true,
      data: result,
      message: 'Bank names retrieved successfully',
    };
  }

  /**
   * Step 2: Get districts for a bank name
   * GET /banks/districts?name=Dutch Bangla Bank Limited
   *
   * Returns: { districts: ["Dhaka", "Chittagong", ...] }
   */
  @Get('districts')
  async getDistricts(@Query('name') name: string) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Bank name is required');
    }
    const result = await this.banksService.getDistrictsByBankName(name.trim());
    return {
      success: true,
      data: result,
      message: 'Districts retrieved successfully',
    };
  }

  /**
   * Step 3: Get branches for a bank name + district
   * GET /banks/branches?name=Dutch Bangla Bank Limited&district=Dhaka
   *
   * Returns: { branches: ["Gulshan Branch", "Dhanmondi Branch", ...] }
   */
  @Get('branches')
  async getBranches(
    @Query('name') name: string,
    @Query('district') district: string,
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Bank name is required');
    }
    if (!district || !district.trim()) {
      throw new BadRequestException('District is required');
    }
    const result = await this.banksService.getBranchesByBankAndDistrict(
      name.trim(),
      district.trim(),
    );
    return {
      success: true,
      data: result,
      message: 'Branches retrieved successfully',
    };
  }

  /**
   * Step 4: Get routing number for a specific bank + district + branch
   * GET /banks/routing?name=Dutch Bangla Bank Limited&district=Dhaka&branch=Gulshan Branch
   *
   * Returns: { routing: "090261234", bank_id: "uuid" }
   */
  @Get('routing')
  async getRouting(
    @Query('name') name: string,
    @Query('district') district: string,
    @Query('branch') branch: string,
  ) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Bank name is required');
    }
    if (!district || !district.trim()) {
      throw new BadRequestException('District is required');
    }
    if (!branch || !branch.trim()) {
      throw new BadRequestException('Branch name is required');
    }
    const result = await this.banksService.getRoutingByBranch(
      name.trim(),
      district.trim(),
      branch.trim(),
    );
    return {
      success: true,
      data: result,
      message: 'Routing number retrieved successfully',
    };
  }

  // ===== ADMIN SINGLE ITEM ENDPOINTS =====

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
