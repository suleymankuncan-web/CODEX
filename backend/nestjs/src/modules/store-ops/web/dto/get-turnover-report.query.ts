import { IsIn, IsOptional, IsUUID } from "class-validator";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class GetTurnoverReportQueryDto extends ReportPaginationQueryDto {
  @IsUUID()
  snapshotRunId!: string;

  @IsOptional()
  @IsIn(["company", "region", "store"])
  scopeType?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;
}
