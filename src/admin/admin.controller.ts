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
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  async create(@Body() createAdminDto: CreateAdminDto) {
    const admin = await this.adminService.create(createAdminDto);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user created successfully',
    };
  }

  @Get()
  async findAll() {
    return await this.adminService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.adminService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    const admin = await this.adminService.update(id, updateAdminDto);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return adminWithoutSensitive;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.adminService.remove(id);
    return { 
      deleted: true,
      message: 'Admin user deleted successfully'
    };
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    const admin = await this.adminService.deactivate(id);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user deactivated successfully'
    };
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    const admin = await this.adminService.activate(id);
    const { password_hash, refresh_token, ...adminWithoutSensitive } = admin;
    return {
      ...adminWithoutSensitive,
      message: 'Admin user activated successfully'
    };
  }
}
