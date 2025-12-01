import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DeliveryVerification, DeliveryVerificationStatus, OtpRecipientType } from './entities/delivery-verification.entity';
import { Parcel, ParcelStatus, PaymentStatus, REASON_REQUIRED_STATUSES } from '../parcels/entities/parcel.entity';
import { SmsService } from '../utils/sms.service';

@Injectable()
export class DeliveryVerificationsService {
  private readonly logger = new Logger(DeliveryVerificationsService.name);

  constructor(
    @InjectRepository(DeliveryVerification)
    private readonly deliveryVerificationRepo: Repository<DeliveryVerification>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    private readonly smsService: SmsService,
  ) {}

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
   * 4. System determines OTP recipient:
   *    - If DELIVERED and expected amount = 0 (already paid) → OTP to Customer
   *    - All other cases → OTP to Merchant
   * 5. OTP is sent and must be verified to complete
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

    // Check if parcel is in correct status
    if (parcel.status !== ParcelStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        `Parcel must be OUT_FOR_DELIVERY to update status. Current status: ${parcel.status}`,
      );
    }

    // Check if verification already exists
    const existingVerification = await this.deliveryVerificationRepo.findOne({
      where: { parcel_id: parcelId },
    });

    if (existingVerification) {
      throw new BadRequestException('Delivery verification already exists for this parcel');
    }

    // 2. Determine amounts
    const expectedAmount = Number(parcel.cod_amount) || 0;
    const hasDifference = Math.abs(collectedAmount - expectedAmount) > 0.01;
    const amountDifference = collectedAmount - expectedAmount;

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
    const statusRequiresReason = (REASON_REQUIRED_STATUSES as readonly ParcelStatus[]).includes(selectedStatus);
    const reasonRequired = hasDifference || statusRequiresReason;

    if (reasonRequired && !reason) {
      const reasonMessage = statusRequiresReason
        ? `Reason is required for status: ${selectedStatus}`
        : 'Amount differs from expected. Please provide a reason.';
      
      throw new BadRequestException(reasonMessage);
    }

    // 5. Determine OTP recipient
    // Special case: If DELIVERED and expected = 0 (already paid), OTP goes to customer
    const isAlreadyPaid = selectedStatus === ParcelStatus.DELIVERED && expectedAmount === 0;
    const otpRecipientType = isAlreadyPaid ? OtpRecipientType.CUSTOMER : OtpRecipientType.MERCHANT;

    // Get phone number for OTP recipient
    let otpPhone: string | null = null;
    if (otpRecipientType === OtpRecipientType.CUSTOMER) {
      otpPhone = parcel.customer_phone;
    } else {
      otpPhone = parcel.store?.phone_number || null;
    }

    if (!otpPhone) {
      throw new BadRequestException(
        `Cannot send OTP: ${otpRecipientType} phone number not found`,
      );
    }

    // 6. Create verification record
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
      requires_otp_verification: true,
      otp_recipient_type: otpRecipientType,
      otp_sent_to_phone: otpPhone,
      merchant_phone_used: parcel.store?.phone_number || null,
      customer_phone_used: parcel.customer_phone || null,
      verification_status: DeliveryVerificationStatus.PENDING,
      delivery_attempted_at: new Date(),
    });

    await this.deliveryVerificationRepo.save(verification);

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

    const recipientLabel = otpRecipientType === OtpRecipientType.CUSTOMER ? 'customer' : 'merchant';
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
  async requestOtp(verificationId: string, riderId: string, differenceReason: string) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel', 'parcel.store', 'parcel.assignedRider'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Verify rider owns this verification
    if (verification.parcel.assigned_rider_id !== riderId) {
      throw new ForbiddenException('You are not authorized to request OTP for this delivery');
    }

    // Check if already verified
    if (verification.verification_status === DeliveryVerificationStatus.OTP_VERIFIED ||
        verification.verification_status === DeliveryVerificationStatus.COMPLETED) {
      throw new BadRequestException('Delivery already verified');
    }

    // Check if OTP failed
    if (verification.verification_status === DeliveryVerificationStatus.OTP_FAILED) {
      throw new BadRequestException('OTP verification failed. Please contact support.');
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
    const otpPhone = verification.otp_sent_to_phone || verification.merchant_phone_used;
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

    const recipientLabel = verification.otp_recipient_type === OtpRecipientType.CUSTOMER ? 'customer' : 'merchant';
    this.logger.log(`OTP sent to ${recipientLabel} for parcel ${verification.parcel.tracking_number}`);

    return {
      success: true,
      otp_sent: true,
      merchant_phone: verification.merchant_phone_used,
      otp_expires_at: verification.otp_expires_at,
      message: 'OTP sent to merchant. Please ask merchant for the 4-digit code.',
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
      throw new ForbiddenException('You are not authorized to verify OTP for this delivery');
    }

    // Check if OTP was sent
    if (verification.verification_status !== DeliveryVerificationStatus.OTP_SENT) {
      throw new BadRequestException('OTP not sent yet. Please request OTP first.');
    }

    // Check expiry
    if (!verification.otp_expires_at || new Date() > verification.otp_expires_at) {
      throw new BadRequestException('OTP expired. Please request a new OTP.');
    }

    // Check attempts
    if (verification.otp_attempts >= 3) {
      verification.verification_status = DeliveryVerificationStatus.OTP_FAILED;
      await this.deliveryVerificationRepo.save(verification);
      throw new BadRequestException('Maximum OTP attempts exceeded. Please contact support.');
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
    await this.deliveryVerificationRepo.save(verification);

    await this.completeDelivery(verificationId);

    const verifiedBy = verification.otp_recipient_type === OtpRecipientType.CUSTOMER ? 'customer' : 'merchant';
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
      throw new ForbiddenException('You are not authorized to resend OTP for this delivery');
    }

    // Check if can resend (1 minute cooldown)
    if (verification.otp_sent_at) {
      const timeSinceLastSend = Date.now() - verification.otp_sent_at.getTime();
      const cooldownMs = 60 * 1000; // 1 minute
      
      if (timeSinceLastSend < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        throw new BadRequestException(`Please wait ${waitSeconds} seconds before resending OTP`);
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
    const otpPhone = verification.otp_sent_to_phone || verification.merchant_phone_used;
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

    const recipientLabel = verification.otp_recipient_type === OtpRecipientType.CUSTOMER ? 'customer' : 'merchant';
    return {
      success: true,
      otp_sent: true,
      otp_sent_to: recipientLabel,
      message: `OTP resent to ${recipientLabel}`,
      otp_expires_at: verification.otp_expires_at,
    };
  }

  /**
   * Get verification details
   */
  async getVerification(verificationId: string, userId: string, userRole: string) {
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
    const isRider = verification.rider?.user_id === userId || 
                    verification.parcel?.assignedRider?.user_id === userId;
    const isMerchant = verification.parcel?.store?.merchant?.user_id === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isRider && !isMerchant && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this verification');
    }

    // Return different data based on role
    const baseData = {
      id: verification.id,
      tracking_number: verification.parcel.tracking_number,
      status: verification.selected_status,
      verification_status: verification.verification_status,
      collected_amount: Number(verification.collected_amount),
    };

    // For Rider: Show relevant data based on verification state
    if (isRider) {
      const isCompleted = verification.verification_status === DeliveryVerificationStatus.COMPLETED;
      
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
          otp_phone: verification.otp_sent_to_phone ? this.maskPhone(verification.otp_sent_to_phone) : null,
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

    // For Admin: Full audit data
    return {
      success: true,
      data: {
        id: verification.id,
        parcel_id: verification.parcel.id,
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
        attempted_at: verification.delivery_attempted_at,
        completed_at: verification.delivery_completed_at,
      },
    };
  }

  /**
   * Complete delivery - Update parcel status to selected status
   */
  private async completeDelivery(verificationId: string) {
    const verification = await this.deliveryVerificationRepo.findOne({
      where: { id: verificationId },
      relations: ['parcel'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    // Update parcel status to the selected status
    verification.parcel.status = verification.selected_status;
    verification.parcel.delivered_at = new Date();

    // Update payment status based on selected status
    if (verification.selected_status === ParcelStatus.DELIVERED ||
        verification.selected_status === ParcelStatus.PARTIAL_DELIVERY ||
        verification.selected_status === ParcelStatus.EXCHANGE) {
      verification.parcel.payment_status = PaymentStatus.COD_COLLECTED;
    } else if (verification.selected_status === ParcelStatus.PAID_RETURN) {
      verification.parcel.payment_status = PaymentStatus.COD_COLLECTED;
    }

    await this.parcelRepo.save(verification.parcel);

    // Update verification
    verification.delivery_completed_at = new Date();
    verification.verification_status = DeliveryVerificationStatus.COMPLETED;
    await this.deliveryVerificationRepo.save(verification);

    this.logger.log(
      `[DELIVERY COMPLETED] Parcel: ${verification.parcel.tracking_number}, ` +
      `Status: ${verification.selected_status}, Collected: ${verification.collected_amount}`,
    );
  }

  /**
   * Generate 4-digit OTP
   */
  private generateOtp(): string {
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
      const differenceText = difference > 0 ? `+৳${difference}` : `৳${difference}`;
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
      const sendSmsMethod = this.smsService['sendSms'] as (to: string, message: string) => Promise<any>;
      await sendSmsMethod.call(this.smsService, phone, message);
      this.logger.log(`OTP SMS sent to ${this.maskPhone(phone)} (${recipientType})`);
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
