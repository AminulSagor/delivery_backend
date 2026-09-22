import {
  toHubDetail,
  toHubListItem,
} from '../common/interfaces/responses.interface';
import { HubsService } from './hubs.service';

describe('Hub third-party access', () => {
  it('persists the requested third-party setting', async () => {
    const hub = {
      id: 'hub-1',
      hub_code: 'HUB-DHK-001',
      third_party_enabled: false,
    };
    const service = Object.create(HubsService.prototype) as HubsService;
    (service as any).hubRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };
    (service as any).logger = { log: jest.fn() };
    jest.spyOn(service, 'findOne').mockResolvedValue(hub as any);

    const result = await service.setThirdPartyEnabled('hub-1', true);

    expect(result.third_party_enabled).toBe(true);
    expect((service as any).hubRepository.save).toHaveBeenCalledWith(hub);
  });

  it('includes the setting in hub list and primary hub detail responses', () => {
    const hub = {
      id: 'hub-1',
      hub_code: 'HUB-DHK-001',
      branch_name: 'Dhaka Hub',
      area: 'Dhaka',
      address: 'Dhaka',
      manager_name: 'Manager',
      manager_phone: '01700000000',
      manager_email: null,
      third_party_enabled: true,
      created_at: new Date('2026-09-22T00:00:00.000Z'),
      updated_at: new Date('2026-09-22T00:00:00.000Z'),
    };

    expect(toHubListItem(hub).third_party_enabled).toBe(true);
    expect(toHubDetail(hub).third_party_enabled).toBe(true);
  });
});
