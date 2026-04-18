import { Controller, Get, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ReportingService } from "../application/reporting.service";
import { GetChecklistReportQueryDto } from "./dto/get-checklist-report.query";
import { GetKpiReportQueryDto } from "./dto/get-kpi-report.query";
import { GetTurnoverReportQueryDto } from "./dto/get-turnover-report.query";
import { GetWorkforceReportQueryDto } from "./dto/get-workforce-report.query";
import { ListSnapshotRunsQueryDto } from "./dto/list-snapshot-runs.query";

@Controller("reports")
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("snapshot-runs")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async listSnapshotRuns(@Query() query: ListSnapshotRunsQueryDto) {
    return this.reportingService.listSnapshotRuns({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("summary")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async getReportingSummary() {
    return this.reportingService.getReportingSummary();
  }

  @Get("workforce")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async getWorkforceReport(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetWorkforceReportQueryDto,
  ) {
    return this.reportingService.getWorkforceReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("kpis")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async getKpiReport(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetKpiReportQueryDto,
  ) {
    return this.reportingService.getKpiReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      kpiId: query.kpiId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("checklists")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async getChecklistReport(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetChecklistReportQueryDto,
  ) {
    return this.reportingService.getChecklistReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      checklistTemplateId: query.checklistTemplateId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("turnover")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR")
  async getTurnoverReport(
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetTurnoverReportQueryDto,
  ) {
    return this.reportingService.getTurnoverReport({
      snapshotRunId: query.snapshotRunId,
      scopeType: query.scopeType,
      companyId: query.companyId,
      regionId: query.regionId,
      storeId: query.storeId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
