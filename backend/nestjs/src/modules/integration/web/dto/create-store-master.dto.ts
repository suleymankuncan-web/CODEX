import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { StoreContactEmailDto } from "./store-contact-email.dto";

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ApiPropertyOptional({ type: () => [StoreContactEmailDto], maxItems: 10 })
  @ValidateNested({ each: true })
  @Type(() => StoreContactEmailDto)
  contactEmails?: StoreContactEmailDto[];
}
