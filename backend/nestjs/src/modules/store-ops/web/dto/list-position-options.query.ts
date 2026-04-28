import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListPositionOptionsQueryDto {
  @IsPostgresUuid()
  storeId!: string;
}
