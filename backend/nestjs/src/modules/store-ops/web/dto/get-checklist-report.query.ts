import { IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class GetChecklistReportQueryDto extends ReportPaginationQueryDto {
  @IsPostgresUuid()
  snapshotRunId!: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsPostgresUuid()
  checklistTemplateId?: string;
}
