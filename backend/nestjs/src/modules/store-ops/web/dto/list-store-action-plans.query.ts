import { Transform, Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

const storeActionPlanStatuses = ["open", "in_progress", "blocked", "closed", "cancelled"] as const;
type StoreActionPlanStatusQuery = (typeof storeActionPlanStatuses)[number];

function normalizeStatusList(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  return values.map((item) => String(item).trim()).filter(Boolean);
}

export class ListStoreActionPlansQueryDto {
  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsIn(storeActionPlanStatuses)
  status?: StoreActionPlanStatusQuery;

  @IsOptional()
  @Transform(({ value }) => normalizeStatusList(value))
  @IsIn(storeActionPlanStatuses, { each: true })
  statuses?: StoreActionPlanStatusQuery[];

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
