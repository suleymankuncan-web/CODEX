import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetRankingQueryDto {
  @IsOptional()
  @IsIn(["daily", "monthly"])
  periodType?: "daily" | "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionManagerUserId?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    "score",
    "UPT",
    "ATV",
    "CR",
    "TARGET_ACHIEVEMENT",
    "BM_CHECKLIST",
    "VM_CHECKLIST",
    "gsm_approval",
  ])
  sortKey?:
    | "score"
    | "UPT"
    | "ATV"
    | "CR"
    | "TARGET_ACHIEVEMENT"
    | "BM_CHECKLIST"
    | "VM_CHECKLIST"
    | "gsm_approval";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  regionManagerLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  regionManagerOffset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  regionManagerRiskOffset?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  regionManagerUnassigned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  managedPersonnelLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  managedPersonnelOffset?: number;
}
