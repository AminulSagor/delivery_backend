import { ParcelStatus } from './entities/parcel.entity';
import { PARCEL_STATUS_OPTIONS } from './parcel-status-options';

describe('PARCEL_STATUS_OPTIONS', () => {
  it('contains every parcel status exactly once', () => {
    const values = PARCEL_STATUS_OPTIONS.map((option) => option.value);

    expect(values).toEqual(Object.values(ParcelStatus));
    expect(new Set(values).size).toBe(values.length);
  });

  it('provides frontend-friendly labels', () => {
    expect(PARCEL_STATUS_OPTIONS).toContainEqual({
      value: ParcelStatus.ASSIGNED_TO_THIRD_PARTY,
      label: 'Assigned To Third Party',
    });
    expect(PARCEL_STATUS_OPTIONS).toContainEqual({
      value: ParcelStatus.RETURN_TO_MERCHANT,
      label: 'Return To Merchant',
    });
  });
});
