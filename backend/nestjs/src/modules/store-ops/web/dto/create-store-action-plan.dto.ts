import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateStoreActionPlanDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsIn(["kpi_exception"])
  sourceType!: "kpi_exception";

  @IsString()
  sourceId!: string;

  @IsOptional()
  @IsString()
  sourceDeepLink?: string;

  @IsOptional()
  @IsPostgresUuid()
  sourceSnapshotRunId?: string;

  @IsOptional()
  @IsPostgresUuid()
  sourceKpiId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsIn(["high", "medium", "low"])
  priority!: "high" | "medium" | "low";

  @IsDateString()
  dueOn!: string;
}
