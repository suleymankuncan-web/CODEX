import { IsDateString, IsIn, IsOptional } from "class-validator";

export class GetStoreKpiHighlightsQueryDto {
  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  periodType?: "daily" | "weekly" | "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;
}
