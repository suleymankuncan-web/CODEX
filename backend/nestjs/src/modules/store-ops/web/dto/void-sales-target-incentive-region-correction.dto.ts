import { Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class VoidSalesTargetIncentiveRegionCorrectionDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsPostgresUuid()
  correctionId!: string;
}
