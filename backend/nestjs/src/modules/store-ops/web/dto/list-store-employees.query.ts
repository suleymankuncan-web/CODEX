import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListStoreEmployeesQueryDto {
  @IsPostgresUuid()
  storeId!: string;
}
