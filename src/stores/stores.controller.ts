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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { UpdateStoreAvailabilityDto } from './dto/update-store-availability.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  toStoreListItem,
  toStoreDetail,
} from '../common/interfaces/responses.interface';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Admin endpoints

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch('admin/:id/approve')
  async approveStore(@Param('id') id: string) {
    const store = await this.storesService.approveStore(id);

    return {
      store: toStoreDetail(store),
      message: 'Store approved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch('admin/:id/decline')
  async rejectStore(@Param('id') id: string) {
    const store = await this.storesService.rejectStore(id);

    return {
      store: toStoreDetail(store),
      message: 'Store declined successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get('admin/all')
  async findAllStores(
    @Query('merchant_id') merchantId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const { data: stores, total } = await this.storesService.findAllStores(
      merchantId,
      pageNum,
      limitNum,
      search,
      status,
    );
    return {
      stores: stores.map(toStoreDetail),
      total,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      message: 'All stores retrieved successfully',
    };
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch('admin/:storeId/assign-hub/:hubId')
  async assignHub(
    @Param('storeId') storeId: string,
    @Param('hubId') hubId: string,
  ) {
    const store = await this.storesService.assignHubToStore(storeId, hubId);
    return {
      store: toStoreDetail(store),
      message: 'Hub assigned to store successfully',
    };
  }

  // Hub Manager endpoints
  @Roles(UserRole.HUB_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Get('hub-manager/my-stores')
  async getMyAssignedStores(@CurrentUser() user: any) {
    const stores = await this.storesService.findStoresByHubManager(user.userId);
    return {
      stores: stores.map(toStoreListItem),
      message: 'Assigned stores retrieved successfully',
    };
  }

  // Merchant endpoints
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateStoreDto) {
    const store = await this.storesService.create(user.userId, dto);
    return {
      store: toStoreDetail(store),
      message: 'Store created successfully',
    };
  }

  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@CurrentUser() user: any, @Query('status') status?: string) {
    const stores = await this.storesService.findAllByMerchant(
      user.userId,
      status,
    );
    return {
      stores: stores.map(toStoreDetail),
      message: 'Stores retrieved successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Get('default')
  async getDefaultStore(@CurrentUser() user: any) {
    const defaultStore = await this.storesService.findDefaultStore(user.userId);
    if (!defaultStore) {
      return {
        store: null,
        message: 'No default store set',
      };
    }
    return {
      store: toStoreDetail(defaultStore),
      message: 'Default store retrieved successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const store = await this.storesService.findOne(id, user.userId);
    return {
      store: toStoreDetail(store),
      message: 'Store retrieved successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateStoreDto,
  ) {
    const store = await this.storesService.update(id, user.userId, dto);
    return {
      store: toStoreDetail(store),
      message: 'Store updated successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-default')
  async setAsDefault(@Param('id') id: string, @CurrentUser() user: any) {
    const store = await this.storesService.setAsDefault(id, user.userId);
    return {
      store: toStoreDetail(store),
      message: 'Store set as default successfully',
    };
  }

  /** Merchant store-availability toggle used by the store card switch. */
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/availability')
  async setAvailability(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateStoreAvailabilityDto,
  ) {
    const store = await this.storesService.setAvailability(
      id,
      user.userId,
      dto.is_active,
    );
    return {
      store: toStoreDetail(store),
      message: dto.is_active
        ? 'Store activated successfully'
        : 'Store deactivated successfully',
    };
  }

  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/disable')
  async disableStore(@Param('id') id: string, @CurrentUser() user: any) {
    const store = await this.storesService.disableStore(id, user.userId, {
      isAdmin: user.role === UserRole.ADMIN,
    });
    return {
      store: toStoreDetail(store),
      message: 'Store disabled successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.storesService.remove(id, user.userId);
    return {
      message: 'Store deleted successfully',
    };
  }
}
