import { IsOptional, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SubmitSalesTargetIncentiveRegionPackageDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsOptional()
  @IsPostgresUuid()
  companyId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  submissionNote?: string;
}
