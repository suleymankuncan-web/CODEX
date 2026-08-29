import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreatePersonnelMasterDto {
  @IsString()
  @Length(1, 120)
  firstName!: string;

  @IsString()
  @Length(1, 120)
  lastName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  externalEmployeeRef?: string;

  @IsString()
  @Matches(/^[0-9]{11}$/)
  nationalId!: string;

  @IsString()
  @Matches(/^[0-9+() -]{10,20}$/)
  phoneNumber!: string;

  @IsIn(["full_time", "part_time", "temporary"])
  employmentType!: "full_time" | "part_time" | "temporary";

  @IsISO8601({ strict: true })
  hireDate!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsPostgresUuid()
  positionId!: string;
}
