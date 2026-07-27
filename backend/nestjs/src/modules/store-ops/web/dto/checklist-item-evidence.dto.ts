import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class LinkChecklistItemEvidenceDto {
  @IsPostgresUuid()
  mediaAssetId!: string;

  @IsInt()
  @Min(0)
  expectedEvidenceVersion!: number;

  @IsPostgresUuid()
  idempotencyKey!: string;
}

export class UnlinkChecklistItemEvidenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsInt()
  @Min(0)
  expectedEvidenceVersion!: number;

  @IsPostgresUuid()
  idempotencyKey!: string;
}
