import { IsDateString } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetTargetRevisionBasisQueryDto {
  @IsPostgresUuid()
  storeId!: string;

  @IsDateString()
  requestMonth!: string;
}
