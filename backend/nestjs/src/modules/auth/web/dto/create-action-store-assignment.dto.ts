import { IsDateString, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateActionStoreAssignmentDto {
  @IsPostgresUuid()
  userId!: string;

  @IsPostgresUuid()
  storeId!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
