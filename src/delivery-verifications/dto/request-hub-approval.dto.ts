import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class RequestHubApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Request reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Request reason must not exceed 500 characters' })
  request_reason: string;
}
