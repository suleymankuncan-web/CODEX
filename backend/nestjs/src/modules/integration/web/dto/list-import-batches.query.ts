import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListImportBatchesQueryDto {
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
  @IsDateString()
  startedFrom?: string;

  @IsOptional()
  @IsDateString()
  startedTo?: string;
}
