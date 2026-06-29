import { IsDateString, IsOptional, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListTargetCoverageQueryDto {
  @IsDateString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-01$/)
  requestMonth!: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
