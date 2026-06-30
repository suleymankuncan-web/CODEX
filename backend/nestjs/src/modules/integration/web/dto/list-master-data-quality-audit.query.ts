import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListMasterDataQualityAuditQueryDto {
  @IsOptional()
  @IsIn(["store", "personnel", "import"])
  entityType?: "store" | "personnel" | "import";

  @IsOptional()
  @IsPostgresUuid()
  entityId?: string;

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
