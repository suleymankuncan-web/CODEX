import { IsOptional, IsUUID } from "class-validator";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class GetWorkforceReportQueryDto extends ReportPaginationQueryDto {
  @IsUUID()
  snapshotRunId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
