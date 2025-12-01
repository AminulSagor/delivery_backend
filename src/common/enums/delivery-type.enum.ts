/**
 * Delivery Type Enum
 * Defines the delivery service level/speed
 * FIXED: Only 3 types allowed
 */
export enum DeliveryType {
  NORMAL = 1,
  EXPRESS = 2,
  SAME_DAY = 3,
}

/**
 * Reverse mapping: Integer to DeliveryType
 */
export const DeliveryTypeFromValue: Record<number, DeliveryType> = {
  1: DeliveryType.NORMAL,
  2: DeliveryType.EXPRESS,
  3: DeliveryType.SAME_DAY,
};

/**
 * Human-readable labels for UI display
 */
export const DeliveryTypeLabel: Record<DeliveryType, string> = {
  [DeliveryType.NORMAL]: 'Normal Delivery',
  [DeliveryType.EXPRESS]: 'Express Delivery',
  [DeliveryType.SAME_DAY]: 'Same Day',
};

/**
 * Delivery time estimates in hours
 */
export const DeliveryTypeEstimate: Record<DeliveryType, { min: number; max: number }> = {
  [DeliveryType.NORMAL]: { min: 48, max: 72 },      // 2-3 days
  [DeliveryType.EXPRESS]: { min: 12, max: 24 },     // 12-24 hours
  [DeliveryType.SAME_DAY]: { min: 4, max: 12 },     // 4-12 hours
};

/**
 * Priority level for sorting/processing (lower number = higher priority)
 */
export const DeliveryTypePriority: Record<DeliveryType, number> = {
  [DeliveryType.SAME_DAY]: 1,    // Highest priority
  [DeliveryType.EXPRESS]: 2,
  [DeliveryType.NORMAL]: 3,      // Lowest priority
};

/**
 * Helper function to get all delivery types with their values and labels
 * Use this in frontend for dropdown/select options
 */
export function getAllDeliveryTypes() {
  return [
    { 
      id: DeliveryType.NORMAL, 
      value: DeliveryType.NORMAL, 
      label: DeliveryTypeLabel[DeliveryType.NORMAL],
      estimate: DeliveryTypeEstimate[DeliveryType.NORMAL],
      priority: DeliveryTypePriority[DeliveryType.NORMAL],
    },
    { 
      id: DeliveryType.EXPRESS, 
      value: DeliveryType.EXPRESS, 
      label: DeliveryTypeLabel[DeliveryType.EXPRESS],
      estimate: DeliveryTypeEstimate[DeliveryType.EXPRESS],
      priority: DeliveryTypePriority[DeliveryType.EXPRESS],
    },
    { 
      id: DeliveryType.SAME_DAY, 
      value: DeliveryType.SAME_DAY, 
      label: DeliveryTypeLabel[DeliveryType.SAME_DAY],
      estimate: DeliveryTypeEstimate[DeliveryType.SAME_DAY],
      priority: DeliveryTypePriority[DeliveryType.SAME_DAY],
    },
  ];
}

/**
 * Validate if a number is a valid DeliveryType
 */
export function isValidDeliveryType(value: number): value is DeliveryType {
  return value === 1 || value === 2 || value === 3;
}
