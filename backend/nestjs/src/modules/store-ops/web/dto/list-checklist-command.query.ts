import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import {
  checklistCommandSorts,
  checklistCommandSignals,
  checklistCommandStatuses,
  type ChecklistCommandSignal,
  type ChecklistCommandSort,
  type ChecklistCommandStatus,
} from "../../application/checklist-command-read.contract";

export class ListChecklistCommandQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsIn(checklistCommandStatuses)
  status?: ChecklistCommandStatus;

  @IsOptional()
  @IsIn(checklistCommandSignals)
  signal?: ChecklistCommandSignal;

  @IsOptional()
  @IsIn(checklistCommandSorts)
  sort?: ChecklistCommandSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
