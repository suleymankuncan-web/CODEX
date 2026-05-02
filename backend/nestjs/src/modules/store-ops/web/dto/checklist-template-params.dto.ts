import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ChecklistTemplateParamsDto {
  @IsPostgresUuid()
  checklistTemplateId!: string;
}
