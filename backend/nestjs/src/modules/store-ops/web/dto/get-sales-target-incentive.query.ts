import { IsISO8601, IsOptional, Matches } from "class-validator";

export class GetSalesTargetIncentiveQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  throughDate?: string;

  @IsOptional()
  @IsISO8601()
  closeCutoffAt?: string;
}
