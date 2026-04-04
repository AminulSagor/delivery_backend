import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryVerification,
  DeliveryVerificationStatus,
  OtpBypassRequestStatus,
  OtpRecipientType,
} from './entities/delivery-verification.entity';
import {
  Parcel,
  ParcelStatus,
  PaymentStatus,
  REASON_REQUIRED_STATUSES,
} from '../parcels/entities/parcel.entity';
import {
  ReturnChargeConfiguration,
  ReturnStatus,
} from '../pricing/entities/return-charge-configuration.entity';
import { PricingZone } from '../common/enums/pricing-zone.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { SmsService } from '../utils/sms.service';

const OTP_BYPASS_STATUS = {
  NONE: 'NONE' as OtpBypassRequestStatus,
  PENDING: 'PENDING' as OtpBypassRequestStatus,
  APPROVED: 'APPROVED' as OtpBypassRequestStatus,
  REJECTED: 'REJECTED' as OtpBypassRequestStatus,
};

@Injectable()
export class DeliveryVerificationsService {
  private readonly logger = new Logger(DeliveryVerificationsService.name);

  constructor(
    @InjectRepository(DeliveryVerification)
    private readonly deliveryVerificationRepo: Repository<DeliveryVerification>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(ReturnChargeConfiguration)
    private readonly returnChargeConfigRepo: Repository<ReturnChargeConfiguration>,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  private isVerificationFinalized(
    verification: DeliveryVerification,
  ): boolean {
    return (
      verification.verification_status === DeliveryVerificationStatus.OTP_VERIFIED ||
      verification.verification_status === DeliveryVerificationStatus.COMPLETED
    );
  }

  private resetOtpBypassRequestState(verification: DeliveryVerification): void {
    verification.otp_bypass_request_status = OTP_BYPASS_STATUS.NONE;
    verification.otp_bypass_request_reason = null;
    verification.otp_bypass_requested_at = null;
    verification.otp_bypass_reviewed_at = null;
    verification.otp_bypass_reviewed_by_hub_manager_id = null;
    verification.otp_bypass_rejection_reason = null;
  }

  private resolveVerificationHubId(
    verification: DeliveryVerification,
  ): string | null {
    return (
      verification.parcel?.current_hub_id ||
      verification.parcel?.assignedRider?.hub_id ||
      verification.rider?.hub_id ||
      null
    );
  }

  private getParcelTxPrefixForCompletedStatus(
    status: ParcelStatus,
  ): 'MF' | 'ME' | 'MR' | null {
    switch (status) {
      case ParcelStatus.DELIVERED:
        return 'MF';
      case ParcelStatus.EXCHANGE:
        return 'ME';
      case ParcelStatus.RETURNED:
      case ParcelStatus.PAID_RETURN:
        return 'MR';
      default:
        return null;
    }
  }

  private async generateParcelTxIdForCompletion(
    prefix: 'MF' | 'ME' | 'MR',
    date: Date,
    currentParcelId: string,
    retryCount = 0,
  ): Promise<string> {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const datePart = `${day}${month}${year}`;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const txId = `${prefix}${datePart}${randomPart}`;

    const existing = await this.parcelRepo.findOne({
      where: { parcel_tx_id: txId },
      select: ['id'],
    });

    if (existing && existing.id !== currentParcelId) {
      if (retryCount >= 20) {
        throw new InternalServerErrorException(
          'Unable to generate unique parcel display ID',
        );
      }

      return this.generateParcelTxIdForCompletion(
        prefix,
        date,
        currentParcelId,
        retryCount + 1,
      );
    }

    return txId;
  }

  /**
   * Initiate delivery status update - Step 1
   *
   * Rider selects a status and provides collected amount.
   *
   * Flow:
   * 1. Rider selects status (DELIVERED, PARTIAL_DELIVERY, EXCHANGE, DELIVERY_RESCHEDULED, PAID_RETURN, RETURNED)
   * 2. Rider enters collected amount
   * 3. System determines if reason is required:
   *    - Amount differs from expected → reason required
   *    - Status is DELIVERY_RESCHEDULED, PAID_RETURN, or RETURNED → reason always required
  * 4. System determines if OTP can be skipped:
  *    - If DELIVERED and collected amount matches expected amount → no OTP required
  * 5. If OTP required, determine recipient:
  *    - If DELIVERED and expected amount = 0 (already paid) → OTP to Customer
  *    - All other cases → OTP to Merchant
   */
  async initiateDelivery(
    parcelId: string,
    riderId: string,
    selectedStatus: ParcelStatus,
    collectedAmount: number,
    reason?: string,
  ) {
    // 1. Get parcel with all relations
    const parcel = await this.parcelRepo.findOne({
      where: { id: parcelId, assigned_rider_id: riderId },
      relations: ['store', 'store.merchant', 'store.merchant.user', 'customer'],
    });

    if (!parcel) {
      throw new NotFoundException('Parcel not found or not assigned to you');
    }

    // Check if parcel is in correct status (ASSIGNED_TO_RIDER - ready for delivery)
    if (parcel.status !== ParcelStatus.ASSIGNED_TO_RIDER) {
      throw new BadRequestException(
        `Parcel must be ASSIGNED_TO_RIDER to initiate delivery. Current status: ${parcel.status}`,
      );
    }

    // 2. Determine amounts
    const expectedAmount = Number(parcel.cod_amount) || 0;
    const hasDifference = Math.abs(collectedAmount - expectedAmount) > 0.01;
    const amountDifference = collectedAmount - expectedAmount;
    const skipOtpVerification =
      selectedStatus === ParcelStatus.DELIVERED && !hasDifference;

    // 3. Validate: Check if collected amount exceeds expected (potential over-collection)
    if (collectedAmount > expectedAmount) {
      // Allow over-collection but require reason
      if (!reason) {
        throw new BadRequestException(
          'Collected amount exceeds expected amount. Please provide a reason for over-collection.',
        );
      }
    }

    // 4. Check if reason is required
    const statusRequiresReason = (
      REASON_REQUIRED_STATUSES as readonly ParcelStatus[]
    ).includes(selectedStatus);
    const reasonRequired = hasDifference || statusRequiresReason;

    if (reasonRequired && !reason) {
      const reasonMessage = statusRequiresReason
        ? `Reason is required for status: ${selectedStatus}`
        : 'Amount differs from expected. Please provide a reason.';

      throw new BadRequestException(reasonMessage);
    }

    // 5. Determine OTP recipient
    // Special case: If DELIVERED and expected = 0 (already paid), OTP goes to customer
    const isAlreadyPaid =
      selectedStatus === ParcelStatus.DELIVERED && expectedAmount === 0;
    const otpRecipientType = isAlreadyPaid
      ? OtpRecipientType.CUSTOMER
      : OtpRecipientType.MERCHANT;

    // Get phone number for OTP recipient
    let otpPhone: string | null = null;
    if (otpRecipientType === OtpRecipientType.CUSTOMER) {
      otpPhone = parcel.customer_phone;
    } else {
      // Use merchant owner's phone, not store's phone
      otpPhone = parcel.store?.merchant?.user?.phone || null;
    }

    if (!otpPhone) {
      throw new BadRequestException(
        `Cannot send OTP: ${otpRecipientType} phone number not found`,
      );
    }

    // 6. Check if a verification already exists for this parcel
    const existingVerification = await this.deliveryVerificationRepo.findOne({
      where: { parcel_id: parcelId },
    });

    if (existingVerification) {
      // Block re-initiation only if delivery is already completed
      if (
        existingVerification.verification_status ===
          DeliveryVerificationStatus.OTP_VERIFIED ||
        existingVerification.verification_status ===
          DeliveryVerificationStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Delivery has already been completed for this parcel',
        );
      }

      // Retry scenario: rider could not obtain the OTP — update existing record and resend
      existingVerification.selected_status = selectedStatus;
      existingVerification.expected_cod_amount = expectedAmount;
      existingVerification.collected_amount = collectedAmount;
      existingVerification.has_amount_difference = hasDifference;
      existingVerification.difference_reason = reason || null;
      existingVerification.otp_recipient_type = otpRecipientType;
      existingVerification.otp_sent_to_phone = otpPhone;
      existingVerification.merchant_phone_used =
        parcel.store?.merchant?.user?.phone || null;
      existingVerification.customer_phone_used = parcel.customer_phone || null;
      existingVerification.requires_otp_verification = !skipOtpVerification;
      existingVerification.otp_attempts = 0;
      existingVerification.delivery_attempted_at = new Date();
      this.resetOtpBypassRequestState(existingVerification);

      if (skipOtpVerification) {
        existingVerification.otp_code = null;
        existingVerification.otp_sent_at = null;
        existingVerification.otp_expires_at = null;
        existingVerification.otp_verified_at = null;
        existingVerification.otp_verified_by = null;
        existingVerification.merchant_approved = false;
        existingVerification.merchant_approved_at = null;
        existingVerification.verification_status =
          DeliveryVerificationStatus.PENDING;

        await this.deliveryVerificationRepo.save(existingVerification);
        await this.completeDelivery(existingVerification.id);

        this.logger.log(
          `[DELIVERY DIRECT COMPLETE] Parcel: ${parcel.tracking_number}, Status: ${selectedStatus}, ` +
            `Expected: ${expectedAmount}, Collected: ${collectedAmount}`,
        );

        return {
          success: true,
          verification_id: existingVerification.id,
          selected_status: selectedStatus,
          expected_amount: expectedAmount,
          collected_amount: collectedAmount,
          has_difference: hasDifference,
          difference: amountDifference,
          reason: reason || null,
          otp_required: false,
          message:
            'Delivery completed successfully. OTP verification was not required.',
        };
      }

      const retryOtp = this.generateOtp();
      const retryHashedOtp = await bcrypt.hash(retryOtp, 10);
      existingVerification.otp_code = retryHashedOtp;
      existingVerification.otp_sent_at = new Date();
      existingVerification.otp_expires_at = new Date(
        Date.now() + 5 * 60 * 1000,
      );
      existingVerification.verification_status =
        DeliveryVerificationStatus.OTP_SENT;

      await this.deliveryVerificationRepo.save(existingVerification);

      await this.sendOtpSms(
        otpPhone,
        retryOtp,
        parcel.tracking_number,
        selectedStatus,
        expectedAmount,
        collectedAmount,
        reason,
        otpRecipientType,
      );

      const retryRecipientLabel =
        otpRecipientType === OtpRecipientType.CUSTOMER
          ? 'customer'
          : 'merchant';
      this.logger.log(
        `[DELIVERY RETRY] Parcel: ${parcel.tracking_number}, re-initiated by rider. OTP resent to: ${retryRecipientLabel}`,
      );

      return {
        success: true,
        verification_id: existingVerification.id,
        selected_status: selectedStatus,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        has_difference: hasDifference,
        difference: amountDifference,
        reason: reason || null,
        otp_sent_to: otpRecipientType,
        otp_phone: this.maskPhone(otpPhone),
        otp_expires_at: existingVerification.otp_expires_at,
        message: `OTP resent to ${retryRecipientLabel}. Please enter the 4-digit code to complete.`,
      };
    }

    // 7. Create new verification record
    // Note: amount_difference is a GENERATED column (auto-calculated by DB)
    const verification = this.deliveryVerificationRepo.create({
      parcel_id: parcelId,
      rider_id: riderId,
      selected_status: selectedStatus,
      expected_cod_amount: expectedAmount,
      collected_amount: collectedAmount,
      // amount_difference is auto-calculated: collected_amount - expected_cod_amount
      has_amount_difference: hasDifference,
      difference_reason: reason || null,
      requires_otp_verification: !skipOtpVerification,
      otp_recipient_type: otpRecipientType,
      otp_sent_to_phone: otpPhone,
      merchant_phone_used: parcel.store?.merchant?.user?.phone || null,
      customer_phone_used: parcel.customer_phone || null,
      verification_status: DeliveryVerificationStatus.PENDING,
      delivery_attempted_at: new Date(),
    });

    await this.deliveryVerificationRepo.save(verification);

    if (skipOtpVerification) {
      await this.completeDelivery(verification.id);

      this.logger.log(
        `[DELIVERY DIRECT COMPLETE] Parcel: ${parcel.tracking_number}, Status: ${selectedStatus}, ` +
          `Expected: ${expectedAmount}, Collected: ${collectedAmount}`,
      );

      return {
        success: true,
        verification_id: verification.id,
        selected_status: selectedStatus,
        expected_amount: expectedAmount,
        collected_amount: collectedAmount,
        has_difference: hasDifference,
        difference: amountDifference,
        reason: reason || null,
        otp_required: false,
        message:
          'Delivery completed successfully. OTP verification was not required.',
      };
    }

    // 7. Generate and send OTP
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    verification.otp_code = hashedOtp;
    verification.otp_sent_at = new Date();
    verification.otp_expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    verification.otp_attempts = 0;
    verification.verification_status = DeliveryVerificationStatus.OTP_SENT;

    await this.deliveryVerificationRepo.save(verification);

    // 8. Send OTP SMS
    await this.sendOtpSms(
      otpPhone,
      otp,
      parcel.tracking_number,
      selectedStatus,
      expectedAmount,
      collectedAmount,
      reason,
      otpRecipientType,
    );

    const recipientLabel =
      otpRecipientType === OtpRecipientType.CUSTOMER ? 'customer' : 'merchant';
    this.logger.log(
      `[DELIVERY INIT] Parcel: ${parcel.tracking_number}, Status: ${selectedStatus}, ` +
        `Expected: ${expectedAmount}, Collected: ${collectedAmount}, OTP sent to: ${recipientLabel}`,
    );

    return {
      success: true,
      verification_id: verification.id,
      selected_status: selectedStatus,
      expected_amount: expectedAmount,
      collected_amount: collectedAmount,
      has_difference: hasDifference,
      difference: amountDifference,
      reason: reason || null,
      otp_sent_to: otpRecipientType,
      otp_phone: this.maskPhone(otpPhone),
      otp_expires_at: verification.otp_expires_at,
      message: `OTP sent to ${recipientLabel}. Please enter the 4-digit code to complete.`,
    };
  }

  /**
   * Request OTP - Step 2
   * Rider provides reason for amount difference
   */
  async requestOtp(
    verificationId: string,
    riderId: string,
    differenceReason: string,
  ) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.store', 'parcel.assignedRider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Verify rider owns this verification
    if (verification.parcel.assigned_rider_id !== riderId) {
      throw new ForbiddenException(
        'You are not authorized to request OTP for this delivery',
      );
    }

    // Check if already verified
    if (
      verification.verification_status ===
        DeliveryVerificationStatus.OTP_VERIFIED ||
      verification.verification_status === DeliveryVerificationStatus.COMPLETED
    ) {
      throw new BadRequestException('Delivery already verified');
    }

    // Check if OTP failed
    if (
      verification.verification_status === DeliveryVerificationStatus.OTP_FAILED
    ) {
      throw new BadRequestException(
        'OTP verification failed. Please contact support.',
      );
    }

    // Generate 4-digit OTP
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Update verification
    verification.difference_reason = differenceReason;
    verification.otp_code = hashedOtp;
    verification.otp_sent_at = new Date();
    verification.otp_expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    verification.otp_attempts = 0; // Reset attempts
    verification.verification_status = DeliveryVerificationStatus.OTP_SENT;

    await this.deliveryVerificationRepo.save(verification);

    // Send SMS to the appropriate recipient
    const otpPhone =
      verification.otp_sent_to_phone || verification.merchant_phone_used;
    if (otpPhone) {
      await this.sendOtpSms(
        otpPhone,
        otp,
        verification.parcel.tracking_number,
        verification.selected_status,
        verification.expected_cod_amount,
        verification.collected_amount,
        differenceReason,
        verification.otp_recipient_type,
      );
    }

    const recipientLabel =
      verification.otp_recipient_type === OtpRecipientType.CUSTOMER
        ? 'customer'
        : 'merchant';
    this.logger.log(
      `OTP sent to ${recipientLabel} for parcel ${verification.parcel.tracking_number}`,
    );

    return {
      success: true,
      otp_sent: true,
      merchant_phone: verification.merchant_phone_used,
      otp_expires_at: verification.otp_expires_at,
      message:
        'OTP sent to merchant. Please ask merchant for the 4-digit code.',
    };
  }

  /**
   * Verify OTP - Step 3
   * Rider enters OTP received from merchant
   */
  async verifyOtp(verificationId: string, riderId: string, otpCode: string) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Verify rider owns this verification
    if (verification.parcel.assigned_rider_id !== riderId) {
      throw new ForbiddenException(
        'You are not authorized to verify OTP for this delivery',
      );
    }

    // Check if OTP was sent
    if (
      verification.verification_status !== DeliveryVerificationStatus.OTP_SENT
    ) {
      throw new BadRequestException(
        'OTP not sent yet. Please request OTP first.',
      );
    }

    // Check expiry
    if (
      !verification.otp_expires_at ||
      new Date() > verification.otp_expires_at
    ) {
      throw new BadRequestException('OTP expired. Please request a new OTP.');
    }

    // Check attempts
    if (verification.otp_attempts >= 3) {
      verification.verification_status = DeliveryVerificationStatus.OTP_FAILED;
      await this.deliveryVerificationRepo.save(verification);
      throw new BadRequestException(
        'Maximum OTP attempts exceeded. Please contact support.',
      );
    }

    // Verify OTP
    if (!verification.otp_code) {
      throw new BadRequestException('OTP not found. Please request a new OTP.');
    }
    const isValid = await bcrypt.compare(otpCode, verification.otp_code);

    if (!isValid) {
      verification.otp_attempts += 1;
      await this.deliveryVerificationRepo.save(verification);

      const remainingAttempts = 3 - verification.otp_attempts;
      throw new BadRequestException(
        `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
      );
    }

    // OTP verified - complete delivery
    verification.otp_verified_at = new Date();
    verification.otp_verified_by = verification.otp_recipient_type;
    verification.merchant_approved = true;
    verification.merchant_approved_at = new Date();
    verification.verification_status = DeliveryVerificationStatus.OTP_VERIFIED;

    if (verification.otp_bypass_request_status === OTP_BYPASS_STATUS.PENDING) {
      verification.otp_bypass_request_status = OTP_BYPASS_STATUS.REJECTED;
      verification.otp_bypass_reviewed_at = new Date();
      verification.otp_bypass_rejection_reason =
        'Closed automatically because OTP was verified successfully.';
      verification.otp_bypass_reviewed_by_hub_manager_id = null;
    }

    await this.deliveryVerificationRepo.save(verification);

    await this.completeDelivery(verificationId);

    const verifiedBy =
      verification.otp_recipient_type === OtpRecipientType.CUSTOMER
        ? 'customer'
        : 'merchant';
    this.logger.log(
      `[OTP VERIFIED] Parcel: ${verification.parcel.tracking_number}, ` +
        `Status: ${verification.selected_status}, Verified by: ${verifiedBy}`,
    );

    return {
      success: true,
      verified: true,
      message: 'OTP verified successfully. Delivery completed.',
    };
  }

  /**
   * Resend OTP
   */
  async resendOtp(verificationId: string, riderId: string) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.store'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Verify rider owns this verification
    if (verification.parcel.assigned_rider_id !== riderId) {
      throw new ForbiddenException(
        'You are not authorized to resend OTP for this delivery',
      );
    }

    // Check if can resend (1 minute cooldown)
    if (verification.otp_sent_at) {
      const timeSinceLastSend = Date.now() - verification.otp_sent_at.getTime();
      const cooldownMs = 60 * 1000; // 1 minute

      if (timeSinceLastSend < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        throw new BadRequestException(
          `Please wait ${waitSeconds} seconds before resending OTP`,
        );
      }
    }

    // Generate new OTP
    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Update verification
    verification.otp_code = hashedOtp;
    verification.otp_sent_at = new Date();
    verification.otp_expires_at = new Date(Date.now() + 5 * 60 * 1000);
    verification.otp_attempts = 0; // Reset attempts
    verification.verification_status = DeliveryVerificationStatus.OTP_SENT;

    await this.deliveryVerificationRepo.save(verification);

    // Resend SMS to the appropriate recipient
    const otpPhone =
      verification.otp_sent_to_phone || verification.merchant_phone_used;
    if (otpPhone) {
      await this.sendOtpSms(
        otpPhone,
        otp,
        verification.parcel.tracking_number,
        verification.selected_status,
        verification.expected_cod_amount,
        verification.collected_amount,
        verification.difference_reason || undefined,
        verification.otp_recipient_type,
      );
    }

    const recipientLabel =
      verification.otp_recipient_type === OtpRecipientType.CUSTOMER
        ? 'customer'
        : 'merchant';
    return {
      success: true,
      otp_sent: true,
      otp_sent_to: recipientLabel,
      message: `OTP resent to ${recipientLabel}`,
      otp_expires_at: verification.otp_expires_at,
    };
  }

  /**
   * Rider requests hub manager approval to complete without OTP.
   */
  async requestHubApproval(
    verificationId: string,
    riderId: string,
    requestReason: string,
  ) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.assignedRider', 'rider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.parcel.assigned_rider_id !== riderId) {
      throw new ForbiddenException(
        'You are not authorized to request hub approval for this delivery',
      );
    }

    if (!verification.requires_otp_verification) {
      throw new BadRequestException(
        'This delivery does not require OTP verification',
      );
    }

    if (this.isVerificationFinalized(verification)) {
      throw new BadRequestException('Delivery already verified');
    }

    if (
      verification.verification_status !== DeliveryVerificationStatus.OTP_SENT
    ) {
      throw new BadRequestException(
        'OTP must be sent first. Please request or resend OTP before asking for hub approval.',
      );
    }

    if (verification.otp_bypass_request_status === OTP_BYPASS_STATUS.PENDING) {
      throw new BadRequestException('Hub approval request is already pending');
    }

    verification.otp_bypass_request_status = OTP_BYPASS_STATUS.PENDING;
    verification.otp_bypass_request_reason = requestReason;
    verification.otp_bypass_requested_at = new Date();
    verification.otp_bypass_reviewed_at = null;
    verification.otp_bypass_reviewed_by_hub_manager_id = null;
    verification.otp_bypass_rejection_reason = null;

    await this.deliveryVerificationRepo.save(verification);

    this.logger.log(
      `[OTP BYPASS REQUESTED] Verification: ${verification.id}, Parcel: ${verification.parcel.tracking_number}`,
    );

    return {
      success: true,
      request_submitted: true,
      verification_id: verification.id,
      otp_bypass_status: verification.otp_bypass_request_status,
      requested_at: verification.otp_bypass_requested_at,
      message:
        'Request sent to hub manager. You can complete delivery without OTP after approval.',
    };
  }

  /**
   * Hub Manager: Get pending OTP bypass requests for current hub.
   */
  async getPendingHubApprovalRequests(hubId: string | null) {
    if (!hubId) {
      throw new ForbiddenException(
        'Hub Manager is not assigned to any hub. Please contact admin.',
      );
    }

    const pending = await this.deliveryVerificationRepo
      .createQueryBuilder('verification')
      .leftJoinAndSelect('verification.parcel', 'parcel')
      .leftJoinAndSelect('verification.rider', 'rider')
      .leftJoinAndSelect('rider.user', 'riderUser')
      .where('verification.otp_bypass_request_status = :status', {
        status: OTP_BYPASS_STATUS.PENDING,
      })
      .andWhere('(parcel.current_hub_id = :hubId OR rider.hub_id = :hubId)', {
        hubId,
      })
      .orderBy('verification.otp_bypass_requested_at', 'DESC')
      .getMany();

    return {
      success: true,
      total: pending.length,
      data: pending.map((item) => ({
        verification_id: item.id,
        parcel_id: item.parcel_id,
        tracking_number: item.parcel?.tracking_number,
        rider_id: item.rider_id,
        rider_name: item.rider?.user?.full_name || null,
        rider_phone: item.rider?.user?.phone || null,
        selected_status: item.selected_status,
        expected_amount: Number(item.expected_cod_amount),
        collected_amount: Number(item.collected_amount),
        difference: Number(item.amount_difference || 0),
        request_reason: item.otp_bypass_request_reason,
        requested_at: item.otp_bypass_requested_at,
        otp_sent_to: item.otp_recipient_type,
        otp_phone: item.otp_sent_to_phone
          ? this.maskPhone(item.otp_sent_to_phone)
          : null,
        otp_expires_at: item.otp_expires_at,
      })),
    };
  }

  /**
   * Hub Manager: Approve OTP bypass request and complete delivery.
   */
  async approveHubApprovalRequest(
    verificationId: string,
    hubId: string | null,
    hubManagerId: string | null,
  ) {
    if (!hubId) {
      throw new ForbiddenException(
        'Hub Manager is not assigned to any hub. Please contact admin.',
      );
    }

    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.assignedRider', 'rider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const verificationHubId = this.resolveVerificationHubId(verification);
    if (!verificationHubId || verificationHubId !== hubId) {
      throw new ForbiddenException(
        'You are not authorized to review this verification',
      );
    }

    if (!verification.requires_otp_verification) {
      throw new BadRequestException(
        'This delivery does not require OTP verification',
      );
    }

    if (this.isVerificationFinalized(verification)) {
      throw new BadRequestException('Delivery already verified');
    }

    if (verification.otp_bypass_request_status !== OTP_BYPASS_STATUS.PENDING) {
      throw new BadRequestException('No pending hub approval request found');
    }

    const approvedAt = new Date();
    verification.otp_bypass_request_status = OTP_BYPASS_STATUS.APPROVED;
    verification.otp_bypass_reviewed_at = approvedAt;
    verification.otp_bypass_reviewed_by_hub_manager_id = hubManagerId || null;
    verification.otp_bypass_rejection_reason = null;

    verification.otp_code = null;
    verification.otp_sent_at = null;
    verification.otp_expires_at = null;
    verification.otp_attempts = 0;
    verification.otp_verified_at = approvedAt;
    verification.otp_verified_by = null;
    verification.merchant_approved = true;
    verification.merchant_approved_at = approvedAt;
    verification.verification_status = DeliveryVerificationStatus.OTP_VERIFIED;

    await this.deliveryVerificationRepo.save(verification);
    await this.completeDelivery(verification.id);

    this.logger.log(
      `[OTP BYPASS APPROVED] Verification: ${verification.id}, Parcel: ${verification.parcel.tracking_number}, HubManager: ${hubManagerId || 'N/A'}`,
    );

    return {
      success: true,
      approved: true,
      verification_id: verification.id,
      message:
        'Hub manager approved the request. Delivery completed without OTP.',
    };
  }

  /**
   * Hub Manager: Reject OTP bypass request.
   */
  async rejectHubApprovalRequest(
    verificationId: string,
    hubId: string | null,
    hubManagerId: string | null,
    rejectionReason: string,
  ) {
    if (!hubId) {
      throw new ForbiddenException(
        'Hub Manager is not assigned to any hub. Please contact admin.',
      );
    }

    const reason = rejectionReason?.trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.assignedRider', 'rider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const verificationHubId = this.resolveVerificationHubId(verification);
    if (!verificationHubId || verificationHubId !== hubId) {
      throw new ForbiddenException(
        'You are not authorized to review this verification',
      );
    }

    if (this.isVerificationFinalized(verification)) {
      throw new BadRequestException('Delivery already verified');
    }

    if (verification.otp_bypass_request_status !== OTP_BYPASS_STATUS.PENDING) {
      throw new BadRequestException('No pending hub approval request found');
    }

    verification.otp_bypass_request_status = OTP_BYPASS_STATUS.REJECTED;
    verification.otp_bypass_reviewed_at = new Date();
    verification.otp_bypass_reviewed_by_hub_manager_id = hubManagerId || null;
    verification.otp_bypass_rejection_reason = reason;

    await this.deliveryVerificationRepo.save(verification);

    this.logger.log(
      `[OTP BYPASS REJECTED] Verification: ${verification.id}, Parcel: ${verification.parcel.tracking_number}, HubManager: ${hubManagerId || 'N/A'}`,
    );

    return {
      success: true,
      approved: false,
      verification_id: verification.id,
      message: 'Hub manager rejected the OTP bypass request.',
    };
  }

  /**
   * Get verification details
   */
  async getVerification(
    verificationId: string,
    userId: string,
    userRole: string,
    hubId?: string | null,
  ) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: [
        'parcel',
        'parcel.store',
        'parcel.store.merchant',
        'parcel.store.merchant.user',
        'parcel.assignedRider',
        'parcel.assignedRider.user',
        'rider',
        'rider.user',
      ],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Authorization check - compare against USER IDs not entity IDs
    const isRider =
      verification.rider?.user_id === userId ||
      verification.parcel?.assignedRider?.user_id === userId;
    const isMerchant = verification.parcel?.store?.merchant?.user_id === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    const isHubManager =
      userRole === UserRole.HUB_MANAGER &&
      !!hubId &&
      this.resolveVerificationHubId(verification) === hubId;

    if (!isRider && !isMerchant && !isAdmin && !isHubManager) {
      throw new ForbiddenException(
        'You are not authorized to view this verification',
      );
    }

    // Return different data based on role
    const baseData = {
      id: verification.id,
      parcel_tx_id: verification.parcel.parcel_tx_id,
      tracking_number: verification.parcel.tracking_number,
      status: verification.selected_status,
      verification_status: verification.verification_status,
      collected_amount: Number(verification.collected_amount),
      otp_bypass_status: verification.otp_bypass_request_status,
      otp_bypass_request_reason: verification.otp_bypass_request_reason,
      otp_bypass_requested_at: verification.otp_bypass_requested_at,
      otp_bypass_reviewed_at: verification.otp_bypass_reviewed_at,
      otp_bypass_rejection_reason: verification.otp_bypass_rejection_reason,
    };

    // For Rider: Show relevant data based on verification state
    if (isRider) {
      const isCompleted =
        verification.verification_status ===
        DeliveryVerificationStatus.COMPLETED;

      // If completed, just show the result
      if (isCompleted) {
        return {
          success: true,
          data: {
            ...baseData,
            difference: Number(verification.amount_difference),
            reason: verification.difference_reason,
            completed_at: verification.delivery_completed_at,
          },
        };
      }

      // If pending/OTP_SENT, show OTP info
      return {
        success: true,
        data: {
          ...baseData,
          difference: Number(verification.amount_difference),
          reason: verification.difference_reason,
          otp_sent_to: verification.otp_recipient_type,
          otp_phone: verification.otp_sent_to_phone
            ? this.maskPhone(verification.otp_sent_to_phone)
            : null,
          otp_expires_at: verification.otp_expires_at,
        },
      };
    }

    // For Merchant: Show delivery outcome details
    if (isMerchant) {
      return {
        success: true,
        data: {
          ...baseData,
          expected_amount: Number(verification.expected_cod_amount),
          difference: Number(verification.amount_difference),
          reason: verification.difference_reason,
          verified_at: verification.otp_verified_at,
          completed_at: verification.delivery_completed_at,
        },
      };
    }

    if (isHubManager) {
      return {
        success: true,
        data: {
          ...baseData,
          expected_amount: Number(verification.expected_cod_amount),
          difference: Number(verification.amount_difference),
          reason: verification.difference_reason,
          rider_id: verification.rider_id,
          otp_sent_to: verification.otp_recipient_type,
          otp_phone: verification.otp_sent_to_phone
            ? this.maskPhone(verification.otp_sent_to_phone)
            : null,
          otp_expires_at: verification.otp_expires_at,
          otp_bypass_reviewed_by_hub_manager_id:
            verification.otp_bypass_reviewed_by_hub_manager_id,
          completed_at: verification.delivery_completed_at,
        },
      };
    }

    // For Admin: Full audit data
    return {
      success: true,
      data: {
        id: verification.id,
        parcel_id: verification.parcel.id,
        parcel_tx_id: verification.parcel.parcel_tx_id,
        tracking_number: verification.parcel.tracking_number,
        rider_id: verification.rider_id,
        status: verification.selected_status,
        expected_amount: Number(verification.expected_cod_amount),
        collected_amount: Number(verification.collected_amount),
        difference: Number(verification.amount_difference),
        reason: verification.difference_reason,
        verification_status: verification.verification_status,
        otp_recipient: verification.otp_recipient_type,
        otp_verified_by: verification.otp_verified_by,
        otp_attempts: verification.otp_attempts,
        otp_bypass_status: verification.otp_bypass_request_status,
        otp_bypass_request_reason: verification.otp_bypass_request_reason,
        otp_bypass_requested_at: verification.otp_bypass_requested_at,
        otp_bypass_reviewed_at: verification.otp_bypass_reviewed_at,
        otp_bypass_reviewed_by_hub_manager_id:
          verification.otp_bypass_reviewed_by_hub_manager_id,
        otp_bypass_rejection_reason: verification.otp_bypass_rejection_reason,
        attempted_at: verification.delivery_attempted_at,
        completed_at: verification.delivery_completed_at,
      },
    };
  }

  /**
   * Complete delivery - Update parcel status and financial fields
   */
  private async completeDelivery(verificationId: string) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.store', 'parcel.delivery_coverage_area'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const parcel = verification.parcel;
    const selectedStatus = verification.selected_status;
    const collectedAmount = Number(verification.collected_amount) || 0;

    // Update parcel status
    parcel.status = selectedStatus;
    parcel.delivered_at = new Date();

    // Regenerate parcel display ID for delivery/exchange/return outcomes.
    // Uses original parcel create date in DDMMYY format.
    const txPrefix = this.getParcelTxPrefixForCompletedStatus(selectedStatus);
    if (txPrefix) {
      const idDate = parcel.created_at ? new Date(parcel.created_at) : new Date();
      parcel.parcel_tx_id = await this.generateParcelTxIdForCompletion(
        txPrefix,
        idDate,
        parcel.id,
      );
    }

    // ✅ Copy delivery reason from verification to parcel
    if (verification.difference_reason) {
      parcel.return_reason = verification.difference_reason;
    }

    // ✅ FLAG: Mark parcel as UNPAID to merchant (will appear in clearance list)
    parcel.paid_to_merchant = false;

    // ✅ UPDATE FINANCIAL FIELDS based on delivery outcome
    switch (selectedStatus) {
      case ParcelStatus.DELIVERED:
        // Full delivery - COD collected, delivery charge applies, no return charge
        parcel.cod_collected_amount = collectedAmount;
        parcel.delivery_charge_applicable = true;
        parcel.return_charge_applicable = false;
        parcel.return_charge = 0;
        parcel.payment_status = PaymentStatus.COD_COLLECTED;
        break;

      case ParcelStatus.PARTIAL_DELIVERY:
        // Partial delivery - partial COD, both delivery and return charges apply
        parcel.cod_collected_amount = collectedAmount;
        parcel.delivery_charge_applicable = true;
        parcel.return_charge_applicable = true;
        parcel.return_charge = await this.calculateReturnCharge(
          parcel,
          ReturnStatus.PARTIAL_DELIVERY,
        );
        parcel.payment_status = PaymentStatus.COD_COLLECTED;
        break;

      case ParcelStatus.EXCHANGE:
        // Exchange - may have partial COD, both charges apply
        parcel.cod_collected_amount = collectedAmount;
        parcel.delivery_charge_applicable = true;
        parcel.return_charge_applicable = true;
        parcel.return_charge = await this.calculateReturnCharge(
          parcel,
          ReturnStatus.EXCHANGE,
        );
        parcel.payment_status = PaymentStatus.COD_COLLECTED;
        break;

      case ParcelStatus.PAID_RETURN:
        // Paid return - return fee collected, no delivery charge, return charge applies
        parcel.cod_collected_amount = collectedAmount; // Return fee collected
        parcel.delivery_charge_applicable = false;
        parcel.return_charge_applicable = true;
        parcel.return_charge = await this.calculateReturnCharge(
          parcel,
          ReturnStatus.PAID_RETURN,
        );
        parcel.payment_status = PaymentStatus.COD_COLLECTED;
        break;

      case ParcelStatus.RETURNED:
        // Full return - no COD, no delivery charge, return charge applies
        parcel.cod_collected_amount = 0;
        parcel.delivery_charge_applicable = false;
        parcel.return_charge_applicable = true;
        parcel.return_charge = await this.calculateReturnCharge(
          parcel,
          ReturnStatus.RETURNED,
        );
        parcel.payment_status = PaymentStatus.UNPAID; // No payment collected
        break;

      case ParcelStatus.DELIVERY_RESCHEDULED:
        // Rescheduled - no financial changes yet
        // Note: reschedule_count is incremented when assigned to rider, not here
        parcel.cod_collected_amount = 0;
        parcel.delivery_charge_applicable = false;
        parcel.return_charge_applicable = false;
        parcel.return_charge = 0;
        parcel.payment_status = PaymentStatus.UNPAID; // Pending delivery
        break;

      default:
        // For any other status, just update basic fields
        parcel.cod_collected_amount = collectedAmount;
        break;
    }

    await this.parcelRepo.save(parcel);

    // Update verification
    verification.delivery_completed_at = new Date();
    verification.verification_status = DeliveryVerificationStatus.COMPLETED;
    await this.deliveryVerificationRepo.save(verification);

    this.logger.log(
      `[DELIVERY COMPLETED] Parcel: ${parcel.tracking_number}, ` +
        `Status: ${selectedStatus}, Collected: ${collectedAmount}, ` +
        `DeliveryCharge: ${parcel.delivery_charge_applicable}, ` +
        `ReturnCharge: ${parcel.return_charge_applicable} (${parcel.return_charge})`,
    );
  }

  /**
   * Calculate return charge based on store configuration and parcel zone
   */
  private async calculateReturnCharge(
    parcel: Parcel,
    returnStatus: ReturnStatus,
  ): Promise<number> {
    if (!parcel.store_id) {
      return 0;
    }

    // Determine pricing zone based on delivery area
    const zone = this.determinePricingZone(parcel);

    // Look up return charge configuration for this store, status, and zone
    const config = await this.returnChargeConfigRepo.findOne({
      where: {
        store_id: parcel.store_id,
        return_status: returnStatus,
        zone: zone,
      },
    });

    if (!config) {
      // No specific config found, try to find a default or return 0
      this.logger.warn(
        `No return charge config found for store ${parcel.store_id}, status ${returnStatus}, zone ${zone}`,
      );
      return 0;
    }

    // Respect validity window
    const now = new Date();
    if (config.start_date && config.start_date > now) {
      this.logger.warn(
        `Return charge config not active yet for store ${parcel.store_id}, status ${returnStatus}, zone ${zone} (starts ${config.start_date.toISOString()})`,
      );
      return 0;
    }
    if (config.end_date && config.end_date < now) {
      this.logger.warn(
        `Return charge config expired for store ${parcel.store_id}, status ${returnStatus}, zone ${zone} (ended ${config.end_date.toISOString()})`,
      );
      return 0;
    }

    // Calculate return charge
    const baseCharge = Number(config.return_delivery_charge) || 0;
    const weightCharge =
      (Number(config.return_weight_charge_per_kg) || 0) *
      (Number(parcel.product_weight) || 0);
    const codPercentage = Number(config.return_cod_percentage) || 0;
    const codCharge = (codPercentage / 100) * (Number(parcel.cod_amount) || 0);

    let totalCharge = baseCharge + weightCharge + codCharge;

    // Apply discount if applicable
    if (config.discount_percentage) {
      const discount = (Number(config.discount_percentage) / 100) * totalCharge;
      totalCharge -= discount;
    }

    return Math.round(totalCharge * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Determine pricing zone based on parcel's delivery area
   */
  private determinePricingZone(parcel: Parcel): PricingZone {
    const area = parcel.delivery_coverage_area;
    if (!area) return PricingZone.OUTSIDE_DHAKA;

    if (String(area.division || '').toLowerCase() === 'dhaka') {
      // Prefer explicit flag if present
      if (typeof (area as any).inside_dhaka_flag === 'boolean') {
        return (area as any).inside_dhaka_flag
          ? PricingZone.INSIDE_DHAKA
          : PricingZone.SUB_DHAKA;
      }
      // Fallback: treat Dhaka as inside
      return PricingZone.INSIDE_DHAKA;
    }

    return PricingZone.OUTSIDE_DHAKA;
  }

  /**
   * Generate 4-digit OTP.
   * If OTP_DEFAULT_ENABLED=true, returns OTP_DEFAULT_VALUE for all requests (testing/dev only).
   */
  private generateOtp(): string {
    const defaultEnabled =
      this.configService
        .get<string>('OTP_DEFAULT_ENABLED', 'false')
        .toLowerCase() === 'true';
    if (defaultEnabled) {
      const defaultOtp = this.configService.get<string>(
        'OTP_DEFAULT_VALUE',
        '1234',
      );
      this.logger.warn(
        `[DEFAULT OTP] Using default OTP: ${defaultOtp}. Disable OTP_DEFAULT_ENABLED in production!`,
      );
      return defaultOtp;
    }
    return crypto.randomInt(1000, 9999).toString();
  }

  /**
   * Mask phone number for display (e.g., 01712****78)
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return phone;
    const start = phone.slice(0, 5);
    const end = phone.slice(-2);
    return `${start}****${end}`;
  }

  /**
   * Send OTP SMS to recipient
   */
  private async sendOtpSms(
    phone: string,
    otp: string,
    trackingNumber: string,
    selectedStatus: ParcelStatus,
    expectedAmount: number,
    collectedAmount: number,
    reason: string | undefined,
    recipientType: OtpRecipientType,
  ) {
    const difference = collectedAmount - expectedAmount;
    const hasDifference = Math.abs(difference) > 0.01;

    let message: string;

    if (recipientType === OtpRecipientType.CUSTOMER) {
      // Customer receives OTP (already paid parcel)
      message = `Delivery Confirmation
Parcel: ${trackingNumber}
Status: ${this.formatStatus(selectedStatus)}

Your OTP: ${otp}
Valid for 5 minutes.

Share this code with the delivery rider to confirm receipt.

- Courier Delivery`;
    } else if (hasDifference && reason) {
      // Merchant receives OTP with amount difference
      const differenceText =
        difference > 0 ? `+৳${difference}` : `৳${difference}`;
      message = `Delivery Verification Required!
Parcel: ${trackingNumber}
Status: ${this.formatStatus(selectedStatus)}
Expected: ৳${expectedAmount}
Collected: ৳${collectedAmount}
Difference: ${differenceText}
Reason: ${reason}

Your OTP: ${otp}
Valid for 5 minutes.

- Courier Delivery`;
    } else {
      // Merchant receives OTP (amounts match)
      message = `Delivery Confirmation
Parcel: ${trackingNumber}
Status: ${this.formatStatus(selectedStatus)}
Amount Collected: ৳${collectedAmount}

Your OTP: ${otp}
Valid for 5 minutes.

- Courier Delivery`;
    }

    try {
      const sendSmsMethod = this.smsService['sendSms'] as (
        to: string,
        message: string,
      ) => Promise<any>;
      await sendSmsMethod.call(this.smsService, phone, message);
      this.logger.log(
        `OTP SMS sent to ${this.maskPhone(phone)} (${recipientType})`,
      );
    } catch (error) {
      this.logger.error(`Failed to send OTP SMS: ${error.message}`);
    }
  }

  /**
   * Format status for display in SMS
   */
  private formatStatus(status: ParcelStatus): string {
    const statusMap: Record<string, string> = {
      [ParcelStatus.DELIVERED]: 'Delivered',
      [ParcelStatus.PARTIAL_DELIVERY]: 'Partial Delivery',
      [ParcelStatus.EXCHANGE]: 'Exchange',
      [ParcelStatus.DELIVERY_RESCHEDULED]: 'Rescheduled',
      [ParcelStatus.PAID_RETURN]: 'Paid Return',
      [ParcelStatus.RETURNED]: 'Return',
    };
    return statusMap[status] || status;
  }
}
