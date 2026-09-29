import { Transform } from "class-transformer";
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class GrantUserPermissionDto {
  @IsUUID()
  roleAssignmentId!: string;

  @IsString()
  @Length(1, 120)
  permissionCode!: string;

  @IsIn(["company", "region", "store"])
  scopeType!: "company" | "region" | "store";

  @IsUUID()
  companyId!: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
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
