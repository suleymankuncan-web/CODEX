import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import {
  checklistOperationalHistoryRanges,
  type ChecklistOperationalHistoryRange,
} from "../../application/checklist-operational-history.contract";

export class GetChecklistOperationalHistoryQueryDto {
  @IsOptional()
  @IsIn(checklistOperationalHistoryRanges)
  range?: ChecklistOperationalHistoryRange;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(/^[a-z_]+(?:,[a-z_]+)*$/)
  kinds?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^[A-Za-z0-9_-]+$/)
  cursor?: string;
}
