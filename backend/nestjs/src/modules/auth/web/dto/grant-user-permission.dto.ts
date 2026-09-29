import { Transform } from "class-transformer";
import { IsIn, IsISO8601, IsOptional, IsString, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GrantUserPermissionDto {
  @IsPostgresUuid()
  roleAssignmentId!: string;

  @IsString()
  @Length(1, 120)
  permissionCode!: string;

  @IsIn(["company", "region", "store"])
  scopeType!: "company" | "region" | "store";

  @IsPostgresUuid()
  companyId!: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @ApiPropertyOptional({ format: "date-time" })
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @ApiPropertyOptional({ format: "date-time" })
  @IsISO8601()
  endsAt?: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(3, 500)
  reason!: string;
}
