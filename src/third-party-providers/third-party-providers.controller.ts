import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ThirdPartyProvidersService } from './third-party-providers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CreateThirdPartyProviderDto,
  UpdateThirdPartyProviderDto,
} from './dto/third-party-provider-crud.dto';

@Controller('third-party-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThirdPartyProvidersController {
  constructor(private readonly providersService: ThirdPartyProvidersService) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async findAllActive() {
    const providers = await this.providersService.findAllWithStats(true);
    return {
      providers,
      message: 'Active providers retrieved successfully',
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async findAll(@Query('isActive') isActive: string) {
    let parsedIsActive: boolean | undefined;
    if (isActive === 'true') parsedIsActive = true;
    else if (isActive === 'false') parsedIsActive = false;
    else parsedIsActive = undefined;

    const providers =
      await this.providersService.findAllWithStats(parsedIsActive);

    return {
      providers,
      message: 'All providers retrieved successfully',
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const provider = await this.providersService.findOneWithStats(id);
    return {
      success: true,
      data: provider,
      message: 'Provider retrieved successfully',
    };
  }

  // --- CREATE ---
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateThirdPartyProviderDto) {
    const provider = await this.providersService.create(createDto);
    return {
      success: true,
      data: provider,
      message: 'Third-party provider created successfully',
    };
  }

  // --- UPDATE ---
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateThirdPartyProviderDto,
  ) {
    const provider = await this.providersService.update(id, updateDto);
    return {
      success: true,
      data: provider,
      message: 'Third-party provider updated successfully',
    };
  }

  // --- DELETE ---
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.providersService.remove(id);
    return {
      success: true,
      message: 'Third-party provider deleted successfully',
    };
  }
}
