import { Transform, Type } from "class-transformer";
import { IsDateString, IsDefined, IsIn, IsString, Length, Matches, ValidateNested } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class PersonnelCorrectionValuesDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsString()
  @Matches(/^$|^[0-9+() -]{10,20}$/)
  phoneNumber!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  hireDate!: string;

  @IsIn(["full_time", "part_time", "temporary"])
  employmentType!: "full_time" | "part_time" | "temporary";

  @IsPostgresUuid()
  positionId!: string;
}

export class CreatePersonnelCorrectionDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsPostgresUuid()
  employeeId!: string;

  @IsString()
  @Length(1, 150)
  expectedRevision!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PersonnelCorrectionValuesDto)
  proposed!: PersonnelCorrectionValuesDto;

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 500)
  reason!: string;
}

export class ReviewPersonnelCorrectionDto {
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @Length(1, 500)
  note!: string;
}
