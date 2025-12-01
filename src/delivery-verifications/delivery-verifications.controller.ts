import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DeliveryVerificationsService } from './delivery-verifications.service';
import { InitiateDeliveryDto } from './dto/initiate-delivery.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('delivery-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryVerificationsController {
  constructor(
    private readonly deliveryVerificationsService: DeliveryVerificationsService,
  ) {}

  /**
   * Step 1: Initiate delivery status update
   * 
   * Rider selects a status and provides collected amount.
   * 
   * Request body:
   * - selected_status: DELIVERED | PARTIAL_DELIVERY | EXCHANGE | DELIVERY_RESCHEDULED | PAID_RETURN | RETURNED
   * - collected_amount: number (amount collected from customer)
   * - reason?: string (required when amount differs or for specific statuses)
   * 
   * POST /delivery-verifications/parcels/:parcelId/initiate
   */
  @Post('parcels/:parcelId/initiate')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async initiateDelivery(
    @Param('parcelId', ParseUUIDPipe) parcelId: string,
    @Body() initiateDto: InitiateDeliveryDto,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    return await this.deliveryVerificationsService.initiateDelivery(
      parcelId,
      riderId,
      initiateDto.selected_status,
      initiateDto.collected_amount,
      initiateDto.reason,
    );
  }

  /**
   * Step 2: Request OTP
   * Rider provides reason for amount difference
   * POST /delivery-verifications/:id/request-otp
   */
  @Post(':id/request-otp')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async requestOtp(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @Body() requestOtpDto: RequestOtpDto,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    return await this.deliveryVerificationsService.requestOtp(
      verificationId,
      riderId,
      requestOtpDto.difference_reason,
    );
  }

  /**
   * Step 3: Verify OTP
   * Rider enters OTP received from merchant
   * POST /delivery-verifications/:id/verify-otp
   */
  @Post(':id/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async verifyOtp(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @Body() verifyOtpDto: VerifyOtpDto,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    return await this.deliveryVerificationsService.verifyOtp(
      verificationId,
      riderId,
      verifyOtpDto.otp_code,
    );
  }

  /**
   * Resend OTP
   * POST /delivery-verifications/:id/resend-otp
   */
  @Post(':id/resend-otp')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async resendOtp(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    return await this.deliveryVerificationsService.resendOtp(
      verificationId,
      riderId,
    );
  }

  /**
   * Get verification details
   * GET /delivery-verifications/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER, UserRole.MERCHANT, UserRole.ADMIN)
  async getVerification(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: any,
  ) {
    return await this.deliveryVerificationsService.getVerification(
      verificationId,
      user.userId,
      user.role,
    );
  }
}
