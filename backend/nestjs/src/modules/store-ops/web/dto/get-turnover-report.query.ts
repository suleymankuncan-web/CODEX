import { IsIn, IsOptional } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";
import { ReportPaginationQueryDto } from "./report-pagination.query";

export class GetTurnoverReportQueryDto extends ReportPaginationQueryDto {
  @IsPostgresUuid()
  snapshotRunId!: string;

  @IsOptional()
  @IsIn(["company", "region", "store"])
  scopeType?: string;

  @IsOptional()
  @IsPostgresUuid()
  companyId?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;
}
