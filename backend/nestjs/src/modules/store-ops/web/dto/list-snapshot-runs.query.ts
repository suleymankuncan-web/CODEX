import { IsDateString, IsIn, IsOptional } from "class-validator";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class ListSnapshotRunsQueryDto extends ReportPaginationQueryDto {
  @IsOptional()
  @IsIn(["queued", "running", "completed", "completed_with_errors", "failed"])
  runStatus?: string;

  @IsOptional()
  @IsIn(["daily", "weekly", "monthly", "custom"])
  snapshotType?: string;

  @IsOptional()
  @IsDateString()
  snapshotDate?: string;
}
