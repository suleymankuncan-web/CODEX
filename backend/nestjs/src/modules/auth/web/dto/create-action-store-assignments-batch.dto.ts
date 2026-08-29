import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class CreateActionStoreAssignmentsBatchDto {
  @IsPostgresUuid()
  userId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsPostgresUuid({ each: true })
  storeIds!: string[];

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
