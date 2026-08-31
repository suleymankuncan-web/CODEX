import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListMasterDataBootstrapBatchesQueryDto {
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
  @IsIn(["store", "personnel"])
  bootstrapEntity?: "store" | "personnel";

  @IsOptional()
  @IsIn(["uploaded", "validated", "ready_to_promote", "promoted", "rejected"])
  batchStatus?: string;

  @IsOptional()
  @IsIn(["needs_validation", "needs_review", "ready_to_promote", "closed"])
  readiness?: "needs_validation" | "needs_review" | "ready_to_promote" | "closed";

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @MaxLength(128)
  q?: string;
}
