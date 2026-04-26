import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CompleteChecklistInstanceDto {
  @IsPostgresUuid()
  auditorEmployeeId!: string;
}
