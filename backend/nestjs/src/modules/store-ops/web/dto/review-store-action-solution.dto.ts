import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ReviewStoreActionSolutionDto {
  @IsPostgresUuid()
  solutionAttemptId!: string;

  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsPostgresUuid()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
