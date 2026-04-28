import { IsBoolean, IsIn } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class UpdateKpiImportStoreScopeDto {
  @IsIn(["company", "franchise", "operator"])
  storeType!: "company" | "franchise" | "operator";

  @IsPostgresUuid()
  regionId!: string;

  @IsIn(["active", "inactive", "closed"])
  status!: "active" | "inactive" | "closed";

  @IsBoolean()
  kpiImportEnabled!: boolean;
}
