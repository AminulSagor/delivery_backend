/**
 * Parcel Type Enum
 * Defines the category/type of items in a parcel
 * FIXED: Only 3 types allowed
 */
export enum ParcelType {
  PARCEL = 1,
  BOOK = 2,
  DOCUMENT = 3,
}

/**
 * Reverse mapping: Integer to ParcelType
 */
export const ParcelTypeFromValue: Record<number, ParcelType> = {
  1: ParcelType.PARCEL,
  2: ParcelType.BOOK,
  3: ParcelType.DOCUMENT,
};

/**
 * Human-readable labels for UI display
 */
export const ParcelTypeLabel: Record<ParcelType, string> = {
  [ParcelType.PARCEL]: 'Parcel',
  [ParcelType.BOOK]: 'Book',
  [ParcelType.DOCUMENT]: 'Document',
};

/**
 * Helper function to get all parcel types with their values and labels
 * Use this in frontend for dropdown/select options
 */
export function getAllParcelTypes() {
  return [
    { id: ParcelType.PARCEL, value: ParcelType.PARCEL, label: ParcelTypeLabel[ParcelType.PARCEL] },
    { id: ParcelType.BOOK, value: ParcelType.BOOK, label: ParcelTypeLabel[ParcelType.BOOK] },
    { id: ParcelType.DOCUMENT, value: ParcelType.DOCUMENT, label: ParcelTypeLabel[ParcelType.DOCUMENT] },
  ];
}

/**
 * Validate if a number is a valid ParcelType
 */
export function isValidParcelType(value: number): value is ParcelType {
  return value === 1 || value === 2 || value === 3;
}
