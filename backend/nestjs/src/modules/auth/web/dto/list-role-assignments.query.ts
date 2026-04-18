import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

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
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(["SUPER_ADMIN", "INTEGRATION_ADMIN", "SNAPSHOT_OPERATOR", "REPORT_VIEWER", "AUDITOR"])
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
