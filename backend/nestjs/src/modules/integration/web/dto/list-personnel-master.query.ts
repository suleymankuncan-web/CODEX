import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListPersonnelMasterQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  q?: string;

  @IsOptional()
  @IsIn(["active", "inactive", "terminated"])
  status?: "active" | "inactive" | "terminated";

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

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
}
