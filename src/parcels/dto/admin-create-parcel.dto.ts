import { IsUUID, IsNotEmpty } from 'class-validator';
import { CreateParcelDto } from './create-parcel.dto';

export class AdminCreateParcelDto extends CreateParcelDto {
  @IsNotEmpty()
  @IsUUID()
  declare merchant_id: string;

  @IsNotEmpty()
  @IsUUID()
  declare store_id: string;
}
