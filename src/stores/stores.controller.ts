import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { toStoreListItem, toStoreDetail } from '../common/interfaces/responses.interface';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Admin endpoints
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Get('admin/all')
  async findAllStores() {
    const stores = await this.storesService.findAllStores();
    return {
      stores: stores.map(toStoreListItem),
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
      store_id: store.id,
      hub_id: store.hub_id,
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
      store_id: store.id,
      business_name: store.business_name,
      message: 'Store created successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Get()
  async findAll(@CurrentUser() user: any) {
    const stores = await this.storesService.findAllByMerchant(user.userId);
    return {
      stores: stores.map(toStoreListItem),
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
      store_id: store.id,
      business_name: store.business_name,
      message: 'Store updated successfully',
    };
  }

  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.OK)
  @Patch(':id/set-default')
  async setAsDefault(@Param('id') id: string, @CurrentUser() user: any) {
    const store = await this.storesService.setAsDefault(id, user.userId);
    return {
      store_id: store.id,
      is_default: store.is_default,
      message: 'Store set as default successfully',
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
