import { IsOptional, IsString, Length } from "class-validator";

export class ApproveOffboardingRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reviewNote?: string;
}
