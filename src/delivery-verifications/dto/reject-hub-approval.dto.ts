import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class RejectHubApprovalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters' })
  @MaxLength(500, {
    message: 'Rejection reason must not exceed 500 characters',
  })
  rejection_reason: string;
}
