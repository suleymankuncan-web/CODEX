import { IsIn, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateSalesTargetIncentiveRegionCorrectionDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsPostgresUuid()
  employeeId!: string;

  @IsIn(["store_manager", "personnel"])
  participantType!: "store_manager" | "personnel";

  @Matches(/^\d+(\.\d{1,2})?$/)
  finalAmount!: string;

  @IsString()
  @Matches(/\S/)
  @Length(3, 1000)
  reasonNote!: string;
}
