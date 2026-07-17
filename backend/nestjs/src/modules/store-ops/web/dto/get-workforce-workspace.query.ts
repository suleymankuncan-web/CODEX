import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetWorkforceWorkspaceQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(["all", "shortage", "balanced", "surplus", "unconfigured"])
  status?: "all" | "shortage" | "balanced" | "surplus" | "unconfigured";

  @IsOptional()
  @IsIn(["store", "active", "norm", "status", "shortage", "tenure"])
  sort?: "store" | "active" | "norm" | "status" | "shortage" | "tenure";

  @IsOptional()
  @IsIn(["ascending", "descending"])
  direction?: "ascending" | "descending";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
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
  historyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  historyOffset?: number;

  @IsOptional()
  @IsPostgresUuid()
  historyStoreId?: string;

  @IsOptional()
  @IsPostgresUuid()
  personnelStoreId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  personnelLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  personnelOffset?: number;
}
