import { IsOptional, IsString } from "class-validator";

export class ApproveTargetDistributionRequestDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}
