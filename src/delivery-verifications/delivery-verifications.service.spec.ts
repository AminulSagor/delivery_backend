import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeliveryVerificationsService } from './delivery-verifications.service';
import {
  DeliveryVerification,
  DeliveryVerificationStatus,
  OtpRecipientType,
} from './entities/delivery-verification.entity';
import { Parcel, ParcelStatus } from '../parcels/entities/parcel.entity';
import { ReturnChargeConfiguration } from '../pricing/entities/return-charge-configuration.entity';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../utils/sms.service';
import { ForbiddenException } from '@nestjs/common';

const mockDeliveryVerificationRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockParcelRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockReturnChargeConfigRepo = {
  findOne: jest.fn(),
};

const mockSmsService = {
  sendSms: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    if (key === 'OTP_DEFAULT_ENABLED') return 'false';
    return fallback;
  }),
};

describe('DeliveryVerificationsService - Hub Approval Flow', () => {
  let service: DeliveryVerificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryVerificationsService,
        {
          provide: getRepositoryToken(DeliveryVerification),
          useValue: mockDeliveryVerificationRepo,
        },
        { provide: getRepositoryToken(Parcel), useValue: mockParcelRepo },
        {
          provide: getRepositoryToken(ReturnChargeConfiguration),
          useValue: mockReturnChargeConfigRepo,
        },
        { provide: SmsService, useValue: mockSmsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DeliveryVerificationsService>(
      DeliveryVerificationsService,
    );
  });

  const buildVerification = () => ({
    id: 'verification-1',
    rider_id: 'rider-1',
    selected_status: ParcelStatus.DELIVERED,
    expected_cod_amount: 1500,
    collected_amount: 1200,
    amount_difference: -300,
    difference_reason: 'Customer discount',
    requires_otp_verification: true,
    otp_recipient_type: OtpRecipientType.MERCHANT,
    otp_sent_to_phone: '01710000000',
    otp_expires_at: new Date('2026-04-04T10:05:00.000Z'),
    verification_status: DeliveryVerificationStatus.OTP_SENT,
    otp_bypass_request_status: 'NONE',
    otp_bypass_request_reason: null,
    otp_bypass_requested_at: null,
    otp_bypass_reviewed_at: null,
    otp_bypass_reviewed_by_hub_manager_id: null,
    otp_bypass_rejection_reason: null,
    parcel: {
      id: 'parcel-1',
      tracking_number: 'TRK-1001',
      assigned_rider_id: 'rider-1',
      current_hub_id: 'hub-1',
      assignedRider: { hub_id: 'hub-1' },
    },
    rider: {
      hub_id: 'hub-1',
      user: {
        full_name: 'Rider One',
        phone: '01712223344',
      },
    },
  });

  it('should request hub approval successfully', async () => {
    const verification = buildVerification();
    mockDeliveryVerificationRepo.findOne.mockResolvedValue(verification);
    mockDeliveryVerificationRepo.save.mockImplementation(async (v) => v);

    const result = await service.requestHubApproval(
      'verification-1',
      'rider-1',
      'OTP not received after resend attempts',
    );

    expect(result.success).toBe(true);
    expect(result.otp_bypass_status).toBe('PENDING');
    expect(mockDeliveryVerificationRepo.save).toHaveBeenCalledTimes(1);
    expect(verification.otp_bypass_request_reason).toContain('OTP not received');
  });

  it('should approve hub request and complete delivery', async () => {
    const verification = {
      ...buildVerification(),
      otp_bypass_request_status: 'PENDING',
    };

    mockDeliveryVerificationRepo.findOne.mockResolvedValue(verification);
    mockDeliveryVerificationRepo.save.mockImplementation(async (v) => v);

    const completeSpy = jest
      .spyOn(service as any, 'completeDelivery')
      .mockResolvedValue(undefined);

    const result = await service.approveHubApprovalRequest(
      'verification-1',
      'hub-1',
      'hub-manager-1',
    );

    expect(result.success).toBe(true);
    expect(result.approved).toBe(true);
    expect(verification.otp_bypass_request_status).toBe('APPROVED');
    expect(verification.verification_status).toBe(
      DeliveryVerificationStatus.OTP_VERIFIED,
    );
    expect(completeSpy).toHaveBeenCalledWith('verification-1');
  });

  it('should reject hub request with reason', async () => {
    const verification = {
      ...buildVerification(),
      otp_bypass_request_status: 'PENDING',
    };

    mockDeliveryVerificationRepo.findOne.mockResolvedValue(verification);
    mockDeliveryVerificationRepo.save.mockImplementation(async (v) => v);

    const result = await service.rejectHubApprovalRequest(
      'verification-1',
      'hub-1',
      'hub-manager-1',
      'Rider must retry OTP with merchant',
    );

    expect(result.success).toBe(true);
    expect(result.approved).toBe(false);
    expect(verification.otp_bypass_request_status).toBe('REJECTED');
    expect(verification.otp_bypass_rejection_reason).toContain('retry OTP');
  });

  it('should block approval from different hub manager', async () => {
    const verification = {
      ...buildVerification(),
      otp_bypass_request_status: 'PENDING',
      parcel: {
        ...buildVerification().parcel,
        current_hub_id: 'hub-2',
      },
    };

    mockDeliveryVerificationRepo.findOne.mockResolvedValue(verification);

    await expect(
      service.approveHubApprovalRequest('verification-1', 'hub-1', 'hm-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should list pending requests for hub manager', async () => {
    const verification = {
      ...buildVerification(),
      otp_bypass_request_status: 'PENDING',
      otp_bypass_request_reason: 'OTP not received',
      otp_bypass_requested_at: new Date('2026-04-04T10:00:00.000Z'),
    };

    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([verification]),
    };

    mockDeliveryVerificationRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getPendingHubApprovalRequests('hub-1');

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    expect(result.data[0].verification_id).toBe('verification-1');
    expect(result.data[0].request_reason).toBe('OTP not received');
  });
});
