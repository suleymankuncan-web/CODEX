import { IsDateString, IsIn, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateRoleAssignmentDto {
  @IsPostgresUuid()
  userId!: string;

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
    "VISUAL_MERCHANDISER",
  ])
  roleCode!: string;

  @IsIn(["company", "region", "store"])
  scopeType!: "company" | "region" | "store";

  @IsOptional()
  @IsPostgresUuid()
  companyId?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
