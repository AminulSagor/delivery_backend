import { Test, TestingModule } from '@nestjs/testing';
import { RiderFinanceService } from './riders-finance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Rider } from '../entities/rider.entity';
import { Parcel, ParcelStatus } from '../../parcels/entities/parcel.entity';
import { PickupRequest } from '../../pickup-requests/entities/pickup-request.entity';
import { Repository } from 'typeorm';
import { endOfDay, startOfDay } from 'date-fns';

const mockRider = {
  id: 'rider-1',
  commission_per_delivery: 20,
  created_at: new Date('2025-01-15T08:00:00.000Z'),
};

const mockRiderRepo = {
  findOne: jest.fn().mockResolvedValue(mockRider),
};

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
};

const mockParcelRepo = {
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

const mockPickupRepo = {
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

describe('RiderFinanceService', () => {
  let service: RiderFinanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-07T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiderFinanceService,
        { provide: getRepositoryToken(Rider), useValue: mockRiderRepo },
        { provide: getRepositoryToken(Parcel), useValue: mockParcelRepo },
        {
          provide: getRepositoryToken(PickupRequest),
          useValue: mockPickupRepo,
        },
      ],
    }).compile();

    service = module.get<RiderFinanceService>(RiderFinanceService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFinanceSummary', () => {
    it('should calculate summary correctly', async () => {
      // Mock Earnings count (Today)
      mockParcelRepo.count.mockResolvedValueOnce(5); // 5 delivered today

      // Mock Earnings count (Month)
      mockParcelRepo.count.mockResolvedValueOnce(100); // 100 delivered this month

      // Mock Lifetime Cash Collection
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ total: 5000 });

      // Mock COD Summary (Collected)
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ total: 1000 });
      // Mock COD Summary (Pending)
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ pending: 2000 });

      // Mock Tasks for Today
      mockPickupRepo.count.mockResolvedValueOnce(5); // pending pickups today
      mockParcelRepo.count.mockResolvedValueOnce(12); // pending deliveries today
      mockParcelRepo.count.mockResolvedValueOnce(2); // today's returned parcels

      // Mock Detailed Counts
      // order: delivered, partially, exchanged, paidReturn, returned, returnToMerchant
      mockParcelRepo.count.mockResolvedValueOnce(10); // delivered
      mockParcelRepo.count.mockResolvedValueOnce(2); // partially
      mockParcelRepo.count.mockResolvedValueOnce(1); // exchanged
      mockParcelRepo.count.mockResolvedValueOnce(0); // paidReturn
      mockParcelRepo.count.mockResolvedValueOnce(3); // returned
      mockParcelRepo.count.mockResolvedValueOnce(0); // returnToMerchant

      // Mock Pickup Count
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ pickupCount: 15 });

      const result = await service.getFinanceSummary('rider-1');

      expect(result.earnings.today).toBe(5 * 20); // 100
      expect(result.earnings.this_month).toBe(100 * 20); // 2000
      expect(result.tasks_for_today.total).toBe(19);
      expect(result.tasks_for_today.pickups).toBe(5);
      expect(result.tasks_for_today.deliveries).toBe(12);
      expect(result.tasks_for_today.returned).toBe(2);
      expect(result.cards.tasks_for_today.total).toBe(19);
      expect(result.cards.tasks_for_today.pickups).toBe(5);
      expect(result.cards.tasks_for_today.deliveries).toBe(12);
      expect(result.cards.tasks_for_today.returned).toBe(2);
      expect(result.cards.cod_collected.total).toBe(1000);
      expect(result.cards.earning_today.total).toBe(100);
      expect(result.lifetime_cash_collection_30_days).toBe(5000);
      expect(result.cod_summary_today.total_collected_amount).toBe(1000);
      expect(result.cod_summary_today.total_pending).toBe(2000);
      expect(result.summary.delivered).toBe(10);
      expect(result.summary.pickup).toBe(15);
      expect(result.summary.total_parcel).toBe(10 + 2 + 1 + 0 + 3 + 0 + 15); // 31

      const expectedSummaryStart = startOfDay(new Date(mockRider.created_at));
      const expectedSummaryEnd = endOfDay(new Date());
      expect(result.summary.date_range.start).toEqual(expectedSummaryStart);
      expect(result.summary.date_range.end).toEqual(expectedSummaryEnd);
    });
  });
});
