import { IsDateString, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
export class ApproveFinalIncentivePackageDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;
  @IsPostgresUuid()
  regionId!: string;
  @IsPostgresUuid()
  regionPackageId!: string;
  @IsDateString()
  submittedAt!: string;
}
