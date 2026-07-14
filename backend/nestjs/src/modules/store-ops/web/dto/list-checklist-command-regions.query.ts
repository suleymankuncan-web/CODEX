import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from "class-validator";
import {
  checklistCommandRegionSorts,
  checklistCommandSignals,
  type ChecklistCommandRegionSort,
  type ChecklistCommandSignal,
} from "../../application/checklist-command-read.contract";

export class ListChecklistCommandRegionsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @IsOptional()
  @IsIn(checklistCommandSignals)
  signal?: ChecklistCommandSignal;

  @IsOptional()
  @IsIn(checklistCommandRegionSorts)
  sort?: ChecklistCommandRegionSort;

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
