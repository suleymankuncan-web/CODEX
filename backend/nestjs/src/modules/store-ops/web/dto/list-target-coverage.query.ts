import { IsDateString, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListTargetCoverageQueryDto {
  @IsDateString()
  requestMonth!: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
