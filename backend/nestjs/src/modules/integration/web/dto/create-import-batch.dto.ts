import { IsArray, IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class CreateImportBatchDto {
  @IsString()
  @MinLength(2)
  sourceCode!: string;

  @IsIn(["employee", "store", "kpi", "assignment", "position", "company", "region"])
  entityType!: "employee" | "store" | "kpi" | "assignment" | "position" | "company" | "region";

  @IsString()
  @MinLength(3)
  fileReference!: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  sourceBatchId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  sourcePayloadHash?: string;

  @IsOptional()
  @IsDateString()
  sourceCapturedAt?: string;

  @IsOptional()
  @IsDateString()
  sourceWindowStartedAt?: string;

  @IsOptional()
  @IsDateString()
  sourceWindowEndedAt?: string;

  @IsOptional()
  @IsArray()
  rows?: Record<string, unknown>[];
}
