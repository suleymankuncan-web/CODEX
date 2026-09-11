import { IsDateString, IsIn, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetStoreKpiHighlightsQueryDto {
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

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
