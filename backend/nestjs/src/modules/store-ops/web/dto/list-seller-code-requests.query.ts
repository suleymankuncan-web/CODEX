import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListSellerCodeRequestsQueryDto {
  @IsOptional()
  @IsIn(["pending_hr_approval", "approved", "rejected"])
  status?: "pending_hr_approval" | "approved" | "rejected";

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

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
