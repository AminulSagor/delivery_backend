import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  userId: string;
  phone: string;
  role: UserRole;
  merchantId: string | null;
  hubId: string | null;
  riderId: string | null;
}
