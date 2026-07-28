import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, Matches, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import { ApiProperty } from "@nestjs/swagger";

export class InitiateSyntheticPhotoMediaUploadDto {
  @IsPostgresUuid()
  storeId!: string;

  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  syntheticFixtureAttestation!: boolean;
}

export class DisposeSyntheticPhotoMediaQuarantineDto {
  @IsBoolean()
  confirmed!: boolean;
}

export class PhotoMediaReadDto {
  @IsIn(["canonical", "thumbnail"])
  variant!: "canonical" | "thumbnail";
}

export class PhotoMediaMaintenanceBatchDto {
  @ApiProperty({ default: 25, maximum: 100, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class PhotoMediaRetentionPreviewDto extends PhotoMediaMaintenanceBatchDto {
  @ApiProperty({ enum: ["manual_retention_cleanup"] })
  @IsIn(["manual_retention_cleanup"])
  reason!: "manual_retention_cleanup";
}

export class PhotoMediaRetentionExecuteDto {
  @ApiProperty({ format: "uuid", type: String })
  @IsPostgresUuid()
  manifestId!: string;

  @ApiProperty({ pattern: "^[a-f0-9]{64}$", type: String })
  @Matches(/^[a-f0-9]{64}$/)
  manifestDigest!: string;
}
