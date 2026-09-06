import { CoverageAreasService } from './coverage-areas.service';
import { CoverageArea } from './entities/coverage-area.entity';

describe('CoverageAreasService bulk address suggestions', () => {
  it('loads coverage data once and applies the single-address algorithm to every row', async () => {
    const coverageArea = {
      id: '91b49d21-5fa2-4140-9d9f-4efefdef3ba1',
      division: 'Dhaka',
      city: 'Dhaka',
      city_id: 1,
      zone: 'Uttara Sector 7',
      zone_id: 10,
      area: 'Road 7',
      area_id: 100,
      inside_dhaka_flag: true,
    } as CoverageArea;
    const repository = {
      find: jest.fn().mockResolvedValue([coverageArea]),
    };
    const service = new CoverageAreasService(repository as any, {} as any);

    const predictions = await service.suggestAreas([
      {
        address: 'Road 7, Uttara Sector 7, Dhaka',
        fixedAddress: 'Road 7, Uttara Sector 7, Dhaka',
        addressStatus: 'complete',
        confidence: 90,
        barikoiScore: 1,
        city: 'Dhaka',
        area: 'Uttara',
        subArea: 'Sector 7',
        thana: 'Uttara',
      },
      {
        address: 'Road 7, Uttara Sector 7, Dhaka',
        fixedAddress: 'Unknown address',
        addressStatus: 'incomplete',
        confidence: 10,
        barikoiScore: 0,
      },
    ]);

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(predictions).toHaveLength(2);
    expect(predictions[0]).toEqual(
      expect.objectContaining({
        coverage_area_uuid: coverageArea.id,
        match_level: 'AREA',
      }),
    );
    expect(predictions[1]).toEqual(
      expect.objectContaining({
        coverage_area_uuid: coverageArea.id,
        match_level: 'AREA',
      }),
    );
  });
});
