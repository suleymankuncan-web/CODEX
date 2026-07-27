import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
