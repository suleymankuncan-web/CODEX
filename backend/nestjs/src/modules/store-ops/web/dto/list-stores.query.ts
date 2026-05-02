import { IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ListStoresQueryDto {
  @IsOptional()
  @IsPostgresUuid()
  companyId?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
