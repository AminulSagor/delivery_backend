import { IsBoolean } from 'class-validator';

export class ToggleHubThirdPartyDto {
  @IsBoolean({ message: 'enabled must be a boolean' })
  enabled: boolean;
}
