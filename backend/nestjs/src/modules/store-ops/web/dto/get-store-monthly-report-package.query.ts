import { Matches } from "class-validator";

export class GetStoreMonthlyReportPackageQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;
}
