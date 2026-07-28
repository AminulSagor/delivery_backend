import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/enums/user-role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateSmsPreferencesDto } from '../dto/update-sms-preferences.dto';
import { SmsPreferencesService } from '../services/sms-preferences.service';

@Controller('admin/sms/preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminSmsPreferencesController {
  constructor(private readonly smsPreferencesService: SmsPreferencesService) {}

  @Get()
  getPreferences() {
    return this.smsPreferencesService.getPreferences();
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  updatePreferences(@Body() dto: UpdateSmsPreferencesDto) {
    return this.smsPreferencesService.updatePreferences(dto);
  }
}
