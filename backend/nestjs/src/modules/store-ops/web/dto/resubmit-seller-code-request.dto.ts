import { IsDateString, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ResubmitSellerCodeRequestDto {
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsString()
  @Matches(/^[0-9]{11}$/)
  nationalId!: string;

  @IsString()
  @Matches(/^[0-9+() -]{10,20}$/)
  phoneNumber!: string;

  @IsDateString()
  hireDate!: string;

  @IsPostgresUuid()
  requestedPositionId!: string;

  @IsIn(["full_time", "part_time", "temporary"])
  employmentType!: "full_time" | "part_time" | "temporary";

  @IsOptional()
  @IsString()
  @Length(1, 500)
  requestReason?: string;
}
