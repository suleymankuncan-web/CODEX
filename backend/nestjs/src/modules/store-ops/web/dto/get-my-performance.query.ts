import { IsDateString, IsIn, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

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

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ format: "date" })
  periodEnd?: string;
}
