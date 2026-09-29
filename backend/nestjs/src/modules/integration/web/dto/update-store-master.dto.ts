import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, Matches, ValidateNested } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { StoreContactEmailDto } from "./store-contact-email.dto";

export class UpdateStoreMasterDto {
  @IsOptional()
  @Matches(/^[A-Z][A-Z0-9_-]{1,79}$/)
  storeCode?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  storeTypeEffectiveOn?: string;

  @IsIn(["company", "franchise", "operator"])
  storeType!: "company" | "franchise" | "operator";

  @IsPostgresUuid()
  regionId!: string;

  @IsOptional()
  @IsPostgresUuid()
  regionManagerUserId?: string;

  @IsIn(["active", "inactive", "closed"])
  status!: "active" | "inactive" | "closed";

  @IsBoolean()
  kpiImportEnabled!: boolean;

  @IsOptional()
  @IsISO8601({ strict: true })
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ApiPropertyOptional({ type: () => [StoreContactEmailDto], maxItems: 10 })
  @ValidateNested({ each: true })
  @Type(() => StoreContactEmailDto)
  contactEmails?: StoreContactEmailDto[];
}
