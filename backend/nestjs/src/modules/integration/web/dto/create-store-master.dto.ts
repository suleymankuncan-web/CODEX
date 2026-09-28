import { IsBoolean, IsIn, IsString, Length, Matches } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateStoreMasterDto {
  @IsString()
  @Length(1, 80)
  @Matches(/^[A-Z][A-Z0-9_-]{1,79}$/)
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
