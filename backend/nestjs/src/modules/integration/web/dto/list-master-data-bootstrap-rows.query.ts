import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMasterDataBootstrapRowsQueryDto {
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
  @IsIn(["pending", "valid", "needs_review", "invalid", "promoted"])
  validationStatus?: "pending" | "valid" | "needs_review" | "invalid" | "promoted";

  @IsOptional()
  @IsString()
  issueCode?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
