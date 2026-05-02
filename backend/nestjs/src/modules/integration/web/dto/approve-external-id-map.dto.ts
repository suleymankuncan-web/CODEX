import { IsIn, IsOptional, IsString, Length } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ApproveExternalIdMapDto {
  @IsPostgresUuid()
  integrationSourceId!: string;

  @IsIn(["employee", "store"])
  entityType!: "employee" | "store";

  @IsString()
  @Length(1, 256)
  externalId!: string;

  @IsPostgresUuid()
  internalId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  internalTableName?: string;
}
