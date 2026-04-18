import { IsOptional, IsUUID } from "class-validator";

export class ListStoresQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
