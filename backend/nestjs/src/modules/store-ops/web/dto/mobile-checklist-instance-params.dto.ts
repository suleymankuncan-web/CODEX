import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class MobileChecklistInstanceParamsDto {
  @IsPostgresUuid()
  checklistInstanceId!: string;
}
