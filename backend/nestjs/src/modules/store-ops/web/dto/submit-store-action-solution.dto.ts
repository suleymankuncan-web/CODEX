import { Type } from "class-transformer";
import { IsInt, IsString, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SubmitStoreActionSolutionDto {
  @IsString()
  @MaxLength(500)
  resolutionNote!: string;

  @IsPostgresUuid()
  mediaAssetId!: string;

  @IsPostgresUuid()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
