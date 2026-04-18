import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";

export class CreateRoleAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsIn([
    "SUPER_ADMIN",
    "INTEGRATION_ADMIN",
    "SNAPSHOT_OPERATOR",
    "REPORT_VIEWER",
    "AUDITOR",
    "REGION_MANAGER",
    "STORE_MANAGER",
  ])
  roleCode!: string;

  @IsIn(["company", "region", "store"])
  scopeType!: "company" | "region" | "store";

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
