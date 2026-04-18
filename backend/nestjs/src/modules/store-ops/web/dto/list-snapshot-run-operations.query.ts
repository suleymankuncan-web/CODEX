import { IsIn, IsOptional } from "class-validator";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class ListSnapshotRunOperationsQueryDto extends ReportPaginationQueryDto {
  @IsOptional()
  @IsIn(["queued", "running", "completed", "failed"])
  runStatus?: string;

  @IsOptional()
  @IsIn(["daily", "weekly", "monthly", "custom"])
  snapshotType?: string;
}
