import { IsDateString, IsIn, IsOptional } from "class-validator";

export class GetMyPerformanceQueryDto {
  @IsOptional()
  @IsIn(["live", "closed"])
  mode?: "live" | "closed";

  @IsOptional()
  @IsDateString()
  snapshotDate?: string;

  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  periodType?: "daily" | "weekly" | "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;
}
