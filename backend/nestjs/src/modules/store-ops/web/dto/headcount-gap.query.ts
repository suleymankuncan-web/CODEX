import { IsDateString, IsUUID } from "class-validator";

export class HeadcountGapQueryDto {
  @IsUUID()
  storeId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
