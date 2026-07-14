import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import {
  checklistVisitPlanPeriodSorts,
  checklistVisitPlanPeriodStatuses,
  checklistVisitPlanReasons,
  checklistVisitPlanRisks,
  type ChecklistVisitPlanPeriodSort,
  type ChecklistVisitPlanPeriodStatus,
  type ChecklistVisitPlanReason,
  type ChecklistVisitPlanRisk,
} from "../../application/checklist-visit-plan.contract";

export class ListChecklistVisitPlanPeriodQueryDto {
  @IsPostgresUuid()
  regionId!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsIn(checklistVisitPlanRisks)
  risk?: ChecklistVisitPlanRisk | "all";

  @IsOptional()
  @IsIn(checklistVisitPlanReasons)
  reason?: ChecklistVisitPlanReason | "all";

  @IsOptional()
  @IsIn(checklistVisitPlanPeriodStatuses)
  planStatus?: ChecklistVisitPlanPeriodStatus | "all";

  @IsOptional()
  @IsIn(checklistVisitPlanPeriodSorts)
  sort?: ChecklistVisitPlanPeriodSort;

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
