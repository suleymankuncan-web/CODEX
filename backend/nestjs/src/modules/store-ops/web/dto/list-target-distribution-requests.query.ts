import { IsOptional, IsString } from "class-validator";

export class ListTargetDistributionRequestsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
