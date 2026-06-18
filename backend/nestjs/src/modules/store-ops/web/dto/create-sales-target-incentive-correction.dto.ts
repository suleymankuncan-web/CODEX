import { IsIn, IsNotEmpty, IsString, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateSalesTargetIncentiveCorrectionDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsPostgresUuid()
  employeeId!: string;

  @IsIn(["store_manager", "personnel"])
  participantType!: "store_manager" | "personnel";

  @Matches(/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,2})$/)
  adjustmentAmount!: string;

  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @IsString()
  @IsNotEmpty()
  reasonNote!: string;
}
