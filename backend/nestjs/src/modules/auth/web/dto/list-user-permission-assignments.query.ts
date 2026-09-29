import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListUserPermissionAssignmentsQueryDto {
  @IsOptional()
  @IsPostgresUuid()
  userId?: string;

  @IsOptional()
  @IsPostgresUuid()
  roleAssignmentId?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" ? true : value === "false" ? false : value)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number;
}
