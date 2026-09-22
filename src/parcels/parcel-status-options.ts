import { ParcelStatus } from './entities/parcel.entity';

export interface ParcelStatusOption {
  value: ParcelStatus;
  label: string;
}

function toStatusLabel(status: ParcelStatus): string {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Canonical list for parcel-status dropdowns. Keeping this derived from the
 * enum prevents the metadata endpoint from drifting when a status is added.
 */
export const PARCEL_STATUS_OPTIONS: ReadonlyArray<ParcelStatusOption> =
  Object.freeze(
    Object.values(ParcelStatus).map((value) =>
      Object.freeze({
        value,
        label: toStatusLabel(value),
      }),
    ),
  );
