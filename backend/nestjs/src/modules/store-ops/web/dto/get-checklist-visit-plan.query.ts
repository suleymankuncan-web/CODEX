import { Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetChecklistVisitPlanQueryDto {
  @IsPostgresUuid()
  regionId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  weekStart!: string;
}
