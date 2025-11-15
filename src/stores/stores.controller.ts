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
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateStoreDto) {
    const store = await this.storesService.create(user.userId, dto);
    return {
      ...store,
      message: 'Store created successfully',
    };
  }

  @Get()
  async findAll(@CurrentUser() user: any) {
    return await this.storesService.findAllByMerchant(user.userId);
  }

  @Get('default')
  async getDefaultStore(@CurrentUser() user: any) {
    const defaultStore = await this.storesService.findDefaultStore(user.userId);
    if (!defaultStore) {
      return {
        message: 'No default store set',
        store: null,
      };
    }
    return defaultStore;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return await this.storesService.findOne(id, user.userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateStoreDto,
  ) {
    const store = await this.storesService.update(id, user.userId, dto);
    return {
      ...store,
      message: 'Store updated successfully',
    };
  }

  @Patch(':id/set-default')
  async setAsDefault(@Param('id') id: string, @CurrentUser() user: any) {
    const store = await this.storesService.setAsDefault(id, user.userId);
    return {
      ...store,
      message: 'Store set as default successfully',
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    await this.storesService.remove(id, user.userId);
    return {
      deleted: true,
      message: 'Store deleted successfully',
    };
  }
}
