import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class StartMobileChecklistInstanceDto {
  @IsPostgresUuid()
  checklistTemplateId!: string;

  @IsPostgresUuid()
  storeId!: string;
}
