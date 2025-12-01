import { Controller, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ThirdPartyProvidersService } from './third-party-providers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('third-party-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThirdPartyProvidersController {
  constructor(
    private readonly providersService: ThirdPartyProvidersService,
  ) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async findAllActive() {
    const providers = await this.providersService.findAllActive();
    return {
      providers,
      message: 'Active providers retrieved successfully',
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async findAll() {
    const providers = await this.providersService.findAll();
    return {
      providers,
      message: 'All providers retrieved successfully',
    };
  }
}
