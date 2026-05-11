import {
  Controller,
  Post,
  Get,
  Patch,
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
import { RequestHubApprovalDto } from './dto/request-hub-approval.dto';
import { RejectHubApprovalDto } from './dto/reject-hub-approval.dto';
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
   * Rider requests hub manager approval to complete delivery without OTP.
   * POST /delivery-verifications/:id/request-hub-approval
   */
  @Post(':id/request-hub-approval')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.RIDER)
  async requestHubApproval(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @Body() dto: RequestHubApprovalDto,
    @CurrentUser() user: any,
  ) {
    const riderId = user.riderId;

    if (!riderId) {
      return {
        success: false,
        message: 'Rider ID not found in user context',
      };
    }

    return await this.deliveryVerificationsService.requestHubApproval(
      verificationId,
      riderId,
      dto.request_reason,
    );
  }

  /**
   * Hub Manager: pending OTP bypass requests in current hub.
   * GET /delivery-verifications/hub-approval/pending
   */
  @Get('hub-approval/pending')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async getPendingHubApprovalRequests(@CurrentUser() user: any) {
    return await this.deliveryVerificationsService.getPendingHubApprovalRequests(
      user.hubId || null,
      user.role,
    );
  }

  /**
   * Hub Manager: approve OTP bypass request and complete delivery.
   * PATCH /delivery-verifications/:id/hub-approval/approve
   */
  @Patch(':id/hub-approval/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async approveHubApprovalRequest(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: any,
  ) {
    return await this.deliveryVerificationsService.approveHubApprovalRequest(
      verificationId,
      user.hubId || null,
      user.hubManagerId || user.userId || null,
      user.role,
    );
  }

  /**
   * Hub Manager: reject OTP bypass request.
   * PATCH /delivery-verifications/:id/hub-approval/reject
   */
  @Patch(':id/hub-approval/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.HUB_MANAGER, UserRole.ADMIN)
  async rejectHubApprovalRequest(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @Body() dto: RejectHubApprovalDto,
    @CurrentUser() user: any,
  ) {
    return await this.deliveryVerificationsService.rejectHubApprovalRequest(
      verificationId,
      user.hubId || null,
      user.hubManagerId || user.userId || null,
      user.role,
      dto.rejection_reason,
    );
  }

  /**
   * Get verification details
   * GET /delivery-verifications/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.RIDER,
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.HUB_MANAGER,
  )
  async getVerification(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @CurrentUser() user: any,
  ) {
    return await this.deliveryVerificationsService.getVerification(
      verificationId,
      user.userId,
      user.role,
      user.hubId,
    );
  }
}
