import { IsIn, IsNotEmpty, IsString, Matches } from "class-validator";

export class CreateSalesTargetIncentiveCorrectionDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  storeId!: string;

  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
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
