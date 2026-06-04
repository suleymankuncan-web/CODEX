import { IsDateString, IsIn, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetStoreKpiHighlightsQueryDto {
  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  periodType?: "daily" | "weekly" | "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
