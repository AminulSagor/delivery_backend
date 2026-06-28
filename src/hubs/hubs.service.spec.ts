import { HubsService } from './hubs.service';

describe('HubsService.getHubDashboardSummary', () => {
  it('returns hub dashboard summary metrics for the current hub', async () => {
    const storeRepository = {
      find: jest.fn().mockResolvedValue([{ id: 'store-1' }]),
    };
    const parcelRepository = {
      count: jest.fn()
        .mockResolvedValueOnce(30) // parcels to process
        .mockResolvedValueOnce(18) // today's parcels
        .mockResolvedValueOnce(8), // last 3h change
    };
    const riderRepository = {
      count: jest.fn().mockResolvedValue(14),
    };

    const service = new HubsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      storeRepository as any,
      parcelRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      riderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getHubDashboardSummary('hub-1');

    expect(result.summary_cards[0]).toMatchObject({
      title: 'Parcels to Process',
      value: 30,
    });
    expect(result.summary_cards[1]).toMatchObject({
      title: 'Riders Active',
      value: 14,
    });
    expect(result.today_summary).toMatchObject({
      total_parcels: 18,
      parcels_to_process: 30,
      riders_active: 14,
    });
  });
});
