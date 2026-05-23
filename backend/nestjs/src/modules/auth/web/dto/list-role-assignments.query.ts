import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListRoleAssignmentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsPostgresUuid()
  userId?: string;

  @IsOptional()
  @IsIn([
    "SUPER_ADMIN",
    "HR_ADMIN",
    "INTEGRATION_ADMIN",
    "SNAPSHOT_OPERATOR",
    "REPORT_VIEWER",
    "AUDITOR",
    "REGION_MANAGER",
    "STORE_MANAGER",
    "STORE_PERSONNEL",
  ])
  roleCode?: string;

  @IsOptional()
  @IsIn(["company", "region", "store"])
  scopeType?: "company" | "region" | "store";

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}
