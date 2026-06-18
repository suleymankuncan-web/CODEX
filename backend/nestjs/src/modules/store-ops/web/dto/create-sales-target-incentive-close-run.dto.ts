import { IsISO8601, IsOptional, Matches } from "class-validator";

export class CreateSalesTargetIncentiveCloseRunDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsOptional()
  @IsISO8601()
  closeCutoffAt?: string;
}
