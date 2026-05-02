import { IsDateString, IsString, Length } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ResubmitOffboardingRequestDto {
  @IsPostgresUuid()
  employeeId!: string;

  @IsDateString()
  terminationDate!: string;

  @IsString()
  @Length(1, 80)
  terminationReason!: string;

  @IsString()
  @Length(1, 500)
  requestReason!: string;
}
