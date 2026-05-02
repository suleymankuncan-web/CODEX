import { IsDateString } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class HeadcountGapQueryDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
