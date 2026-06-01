import { Type } from "class-transformer";
import {
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
  ])
  sortKey?:
    | "score"
    | "UPT"
    | "ATV"
    | "CR"
    | "TARGET_ACHIEVEMENT"
    | "BM_CHECKLIST"
    | "VM_CHECKLIST";

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
}
