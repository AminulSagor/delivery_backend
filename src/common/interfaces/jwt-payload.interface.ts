import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  userId: string;
  phone: string;
  role: UserRole;
  merchantId: string | null;
  hubId: string | null;
  hubManagerId: string | null; // HubManager entity ID
  riderId: string | null;
}
