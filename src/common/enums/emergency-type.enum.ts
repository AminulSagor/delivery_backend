export enum EmergencyType {
  ACCIDENT = 'ACCIDENT', // Road Accident / Medical Help
  ROBBERY_THEFT = 'ROBBERY_THEFT', // Robbery or Theft (Parcel/COD)
  VEHICLE_BREAKDOWN = 'VEHICLE_BREAKDOWN', // Critical Vehicle Breakdown
  UNSAFE_THREAT = 'UNSAFE_THREAT', // I Feel Unsafe / Threatened
  LOST_DEVICE = 'LOST_DEVICE', // Lost Phone / Delivery Device
  OTHER = 'OTHER',
}

export enum EmergencyStatus {
  PENDING = 'PENDING', // Red Alert (Action Required)
  IN_PROGRESS = 'IN_PROGRESS', // Manager is handling it
  RESOLVED = 'RESOLVED', // Case closed
}
