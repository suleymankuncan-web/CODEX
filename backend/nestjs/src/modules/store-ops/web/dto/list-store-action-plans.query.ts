import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListStoreActionPlansQueryDto {
  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsIn(["open", "in_progress", "blocked", "closed", "cancelled"])
  status?: "open" | "in_progress" | "blocked" | "closed" | "cancelled";

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
}
