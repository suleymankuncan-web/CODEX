import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetChecklistOperationalHistoryParamsDto {
  @IsPostgresUuid()
  storeId!: string;
}
