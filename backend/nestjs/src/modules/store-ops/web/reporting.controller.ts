import { Body, Controller, Get, Patch, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ReportingService } from "../application/reporting.service";
import { GetChecklistReportQueryDto } from "./dto/get-checklist-report.query";
import { GetClosedLeaderboardQueryDto } from "./dto/get-closed-leaderboard.query";
import { GetMyPerformanceQueryDto } from "./dto/get-my-performance.query";
import { GetStoreKpiHighlightsQueryDto } from "./dto/get-store-kpi-highlights.query";
import { GetTurnoverReportQueryDto } from "./dto/get-turnover-report.query";
import { GetWorkforceReportQueryDto } from "./dto/get-workforce-report.query";
import { ListSnapshotRunsQueryDto } from "./dto/list-snapshot-runs.query";

@Controller("reports")
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("snapshot-runs")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "STORE_MANAGER", "STORE_PERSONNEL")
  async listSnapshotRuns(@Query() query: ListSnapshotRunsQueryDto) {
    return this.reportingService.listSnapshotRuns({
      runStatus: query.runStatus,
      snapshotType: query.snapshotType,
      snapshotDate: query.snapshotDate,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("summary")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "STORE_MANAGER")
  async getReportingSummary() {
    return this.reportingService.getReportingSummary();
  }

  @Get("kpi-config")
  @RequireScope("authenticated")
  async getKpiConfig() {
    return this.reportingService.getKpiConfig();
  }

  @Get("kpi-config/editor")
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async getKpiConfigEditor() {
    return this.reportingService.getKpiConfigEditor();
  }

  @Get("kpi-config/audit")
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async getKpiConfigAudit() {
    return this.reportingService.getKpiConfigAudit();
  }

  @Patch("kpi-config")
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async saveKpiConfigDraft(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
    @Body()
    body: {
      storeProfile: unknown;
      personnelProfile: unknown;
      ownershipMatrix: unknown;
      gradingBands: unknown;
    },
  ) {
    return this.reportingService.saveKpiConfigDraft({
      actorUserId: request.user.userId,
      ...body,
    });
  }

  @Patch("kpi-config/publish")
  @RequireScope("authenticated")
  @RequireRoles("SUPER_ADMIN")
  async publishKpiConfigDraft(
    @Req()
    request: {
      user: {
        userId: string;
      };
    },
  ) {
    return this.reportingService.publishKpiConfigDraft(request.user.userId);
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
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "STORE_MANAGER")
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
    @Query()
    query: {
      snapshotRunId: string;
      storeId?: string;
      kpiId?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    return this.reportingService.getKpiReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      kpiId: query.kpiId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
  }

  @Get("my-performance")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "STORE_PERSONNEL")
  async getMyPerformance(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetMyPerformanceQueryDto,
  ) {
    return this.reportingService.getMyPerformance({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      mode: query.mode,
      snapshotDate: query.snapshotDate,
      periodType: query.periodType,
      periodStart: query.periodStart,
    });
  }

  @Get("store-kpi-highlights")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER")
  async getStoreKpiHighlights(
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
    @Query() query: GetStoreKpiHighlightsQueryDto,
  ) {
    return this.reportingService.getStoreKpiHighlights({
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      periodType: query.periodType,
      periodStart: query.periodStart,
    });
  }

  @Get("leaderboards/closed")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "STORE_PERSONNEL")
  async getClosedLeaderboard(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
      };
    },
    @Query() query: GetClosedLeaderboardQueryDto,
  ) {
    return this.reportingService.getClosedLeaderboard({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      snapshotDate: query.snapshotDate,
      limit: query.limit,
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
