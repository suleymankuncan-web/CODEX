import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class ChecklistVisitPlanItemDto {
  @IsPostgresUuid()
  storeId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  plannedDate!: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  displayOrder!: number;
}

export class SaveChecklistVisitPlanDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsPostgresUuid()
  idempotencyKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistVisitPlanItemDto)
  items!: ChecklistVisitPlanItemDto[];
}
