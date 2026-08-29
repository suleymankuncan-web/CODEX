import { IsBoolean, IsIn, IsString, Length } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateStoreMasterDto {
  @IsString()
  @Length(1, 80)
  storeCode!: string;

  @IsString()
  @Length(1, 160)
  storeName!: string;

  @IsIn(["company", "franchise", "operator"])
  storeType!: "company" | "franchise" | "operator";

  @IsPostgresUuid()
  regionId!: string;

  @IsPostgresUuid()
  regionManagerUserId!: string;

  @IsIn(["active", "inactive", "closed"])
  status!: "active" | "inactive" | "closed";

  @IsBoolean()
  kpiImportEnabled!: boolean;
}
