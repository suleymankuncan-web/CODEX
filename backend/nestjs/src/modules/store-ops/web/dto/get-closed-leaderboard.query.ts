import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class GetClosedLeaderboardQueryDto {
  @IsOptional()
  @IsDateString()
  snapshotDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
