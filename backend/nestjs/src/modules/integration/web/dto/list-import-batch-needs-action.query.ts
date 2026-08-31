import { Transform, Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Query contract for the server-filtered import action queue. */
export class ListImportBatchNeedsActionQueryDto {
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

  @IsOptional()
  @IsIn([
    "pending",
    "queued",
    "processing",
    "completed",
    "completed_with_errors",
    "failed",
  ])
  status?: string;

  @IsOptional()
  @IsIn(["employee", "store", "kpi", "assignment", "position", "company", "region"])
  entityType?: string;

  @IsOptional()
  @IsString()
  sourceCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @MaxLength(128)
  q?: string;

  @IsOptional()
  @IsDateString()
  startedFrom?: string;

  @IsOptional()
  @IsDateString()
  startedTo?: string;
}
