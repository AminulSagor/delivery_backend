import { IsUUID, IsNotEmpty } from 'class-validator';
import { CreateParcelDto } from './create-parcel.dto';

export class AdminCreateParcelDto extends CreateParcelDto {
  @IsNotEmpty()
  @IsUUID()
  merchant_id: string;

  @IsNotEmpty()
  @IsUUID()
  store_id: string;
}
