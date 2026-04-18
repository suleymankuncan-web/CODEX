import { IsOptional, IsUUID } from "class-validator";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class GetChecklistReportQueryDto extends ReportPaginationQueryDto {
  @IsUUID()
  snapshotRunId!: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  checklistTemplateId?: string;
}
