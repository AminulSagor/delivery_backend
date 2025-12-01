import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParcelsService } from './parcels.service';
import { CreateParcelDto } from './dto/create-parcel.dto';
import { UpdateParcelDto } from './dto/update-parcel.dto';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { ParcelQueryDto } from './dto/parcel-query.dto';

@Controller('parcels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Post('calculate-pricing')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT)
  calculatePricing(
    @Body() calculatePricingDto: CalculatePricingDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    return this.parcelsService.calculatePricing(userId, calculatePricingDto, merchantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.MERCHANT)
  async create(
    @Body() createParcelDto: CreateParcelDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('merchantId') merchantId: string,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('merchantId missing in auth token');
    }

    const parcel = await this.parcelsService.create(createParcelDto, userId, merchantId);
    return {
      id: parcel.id,
      tracking_number: parcel.tracking_number,
      total_charge: parcel.total_charge,
      message: 'Parcel created successfully',
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.HUB_MANAGER)
  async findAll(
    @CurrentUser() user: any,
    @Query() query: ParcelQueryDto,
  ) {
    const { status, storeId, merchantId, page, limit, sortBy, order } = query;
    // Merchant view - only their parcels
    if (user.role === UserRole.MERCHANT) {
      if (!user.userId) {
        throw new ForbiddenException('userId missing in auth token');
      }
      const result = await this.parcelsService.findAllForMerchant(
        user.userId,
        page,
        limit,
        status,
        storeId,
        sortBy,
        order,
      );
      return {
        parcels: result.items,
        pagination: result.pagination,
        message: 'Parcels retrieved successfully',
      };
    }

    // Hub Manager view - only their hub's parcels
    if (user.role === UserRole.HUB_MANAGER) {
      if (!user.hubId) {
        throw new ForbiddenException('hubId missing in auth token');
      }
      const result = await this.parcelsService.findAllForHub(
        user.hubId,
        page,
        limit,
        status,
        sortBy,
        order,
      );
      return {
        parcels: result.items,
        pagination: result.pagination,
        message: 'Parcels retrieved successfully',
      };
    }

    // Admin view - all parcels
    const result = await this.parcelsService.findAll(
      page,
      limit,
      status,
      merchantId,
      sortBy,
      order,
    );
    return {
      parcels: result.items,
      pagination: result.pagination,
      message: 'Parcels retrieved successfully',
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('userId') userId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !userId) {
      throw new ForbiddenException('userId missing in auth token');
    }

    const parcel = await this.parcelsService.findOne(id, userId, isAdmin);
    return {
      parcel,
      message: 'Parcel retrieved successfully',
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateParcelDto: UpdateParcelDto,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('userId') userId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !userId) {
      throw new ForbiddenException('userId missing in auth token');
    }

    const parcel = await this.parcelsService.update(id, updateParcelDto, userId, isAdmin);
    return {
      id: parcel.id,
      tracking_number: parcel.tracking_number,
      message: 'Parcel updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') role: UserRole,
    @CurrentUser('userId') userId: string,
  ) {
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !userId) {
      throw new ForbiddenException('userId missing in auth token');
    }

    const result = await this.parcelsService.remove(id, userId, isAdmin);
    return result;
  }
}
