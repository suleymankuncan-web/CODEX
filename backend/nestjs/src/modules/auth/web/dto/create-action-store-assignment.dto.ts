import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class CreateActionStoreAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  storeId!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
