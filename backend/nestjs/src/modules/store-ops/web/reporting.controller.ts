import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { RankingService } from "../application/ranking.service";
import { ReportingService } from "../application/reporting.service";
import { GetChecklistReportQueryDto } from "./dto/get-checklist-report.query";
import { GetClosedLeaderboardQueryDto } from "./dto/get-closed-leaderboard.query";
import { GetMyPerformanceQueryDto } from "./dto/get-my-performance.query";
import { GetRankingQueryDto } from "./dto/get-ranking.query";
import { GetStoreKpiHighlightsQueryDto } from "./dto/get-store-kpi-highlights.query";
import { GetTurnoverReportQueryDto } from "./dto/get-turnover-report.query";
import { GetWorkforceReportQueryDto } from "./dto/get-workforce-report.query";
import { ListSnapshotRunsQueryDto } from "./dto/list-snapshot-runs.query";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";
import { resolveRegionManagerAssignedStoreIds, resolveReportingReadScope } from "../application/region-manager-assigned-stores";

type StoreReadScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

type ReportViewerRoleScopes = Record<string, StoreReadScope>;

@Controller("reports")
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly rankingService: RankingService,
  ) {}

  @Get("snapshot-runs")
  @RequireScope("authenticated")
  @RequireRoles(
    "REPORT_VIEWER",
    "AUDITOR",
    "STORE_MANAGER",
    "STORE_PERSONNEL",
    "REGION_MANAGER",
    "SUPER_ADMIN",
  )
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
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetWorkforceReportQueryDto,
  ) {
    return this.reportingService.getWorkforceReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      ...this.resolveReadScope(request.user),
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
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
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
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      roleScopes: request.user.roleScopes,
      broadReadRoles: ["AUDITOR", "REPORT_VIEWER", "SUPER_ADMIN"],
    });

    return this.reportingService.getKpiReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      kpiId: query.kpiId,
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
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
        scope: StoreReadScope;
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
      periodStart: query.periodStart, periodEnd: query.periodEnd,
    });
  }

  @Get("personnel-performance/:employeeId")
  @RequireScope("authenticated")
  @RequireRoles("STORE_PERSONNEL", "STORE_MANAGER", "REGION_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER")
  async getPersonnelPerformance(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Param("employeeId") employeeId: string,
    @Query() query: GetMyPerformanceQueryDto,
  ) {
    const personnelProfileReadScope = this.resolvePersonnelProfileReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      roleScopes: request.user.roleScopes,
    });

    return this.reportingService.getPersonnelPerformance({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      targetEmployeeId: employeeId,
      roleCodes: request.user.roleCodes,
      identityCompanyIds: this.resolveReadScope(request.user).companyIds,
      companyIds: personnelProfileReadScope.companyIds,
      regionIds: personnelProfileReadScope.regionIds,
      storeIds: personnelProfileReadScope.storeIds,
      assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [] }),
      mode: query.mode,
      snapshotDate: query.snapshotDate,
      periodType: query.periodType,
      periodStart: query.periodStart, periodEnd: query.periodEnd,
    });
  }

  @Get("store-kpi-highlights")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER", "REPORT_VIEWER")
  async getStoreKpiHighlights(
    @Req()
    request: {
      user: {
        userId?: string;
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetStoreKpiHighlightsQueryDto,
  ) {
    const reportViewerScope = this.resolveReadScope(request.user);
    const isReportViewer = request.user.roleCodes.includes("REPORT_VIEWER");
    const assignedStoreIds = resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope?.assignedStoreIds.length ? request.user.actionScope.assignedStoreIds : request.user.scope.storeIds });
    const isRegionManagerRead =
      request.user.roleCodes.includes("REGION_MANAGER") &&
      !request.user.roleCodes.includes("SUPER_ADMIN");
    const storeReadScope =
      isReportViewer
        ? reportViewerScope
        : isRegionManagerRead
        ? {
            companyIds: [],
            regionIds: [],
            storeIds: request.user.roleCodes.includes("STORE_MANAGER") ? assignedStoreIds : [],
          }
        : this.resolveStoreReadScope({
            actorRoleCodes: request.user.roleCodes,
            actorScope: request.user.scope,
            actorActionScope: request.user.actionScope,
            broadReadRoles: ["SUPER_ADMIN"],
          });

    return this.reportingService.getStoreKpiHighlights({
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
      periodType: query.periodType,
      periodStart: query.periodStart, periodEnd: query.periodEnd,
      storeId: query.storeId,
      regionManagerUserId:
        isRegionManagerRead && !isReportViewer ? request.user.userId : undefined,
    });
  }

  @Get("store-score-breakdown")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REPORT_VIEWER")
  async getStoreScoreBreakdown(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query()
    query: {
      snapshotRunId: string;
      storeId: string;
    },
  ) {
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      roleScopes: request.user.roleScopes,
      broadReadRoles: ["SUPER_ADMIN"],
    });

    return this.reportingService.getStoreMonthlyScoreBreakdown({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      ...(request.user.roleCodes.includes("REPORT_VIEWER")
        ? { companyIds: storeReadScope.companyIds }
        : {}),
      storeIds: storeReadScope.storeIds,
    });
  }

  @Get("rankings")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "STORE_PERSONNEL", "REGION_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER")
  async getRankings(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetRankingQueryDto,
  ) {
    return this.rankingService.getRankings({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      roleCodes: request.user.roleCodes,
      ...this.resolveReadScope(request.user),
      assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [] }),
      periodType: query.periodType ?? "monthly",
      periodStart: query.periodStart, periodEnd: query.periodEnd,
      regionManagerUserId: query.regionManagerUserId,
      regionId: query.regionId,
      storeId: query.storeId,
      search: query.search, regionManagerSearch: query.regionManagerSearch,
      sortKey: query.sortKey,
      sortDirection: query.sortDirection,
      limit: query.limit,
      offset: query.offset,
      regionManagerLimit: query.regionManagerLimit, regionManagerOffset: query.regionManagerOffset,
      regionManagerRiskOffset: query.regionManagerRiskOffset, regionManagerUnassigned: query.regionManagerUnassigned,
      managedPersonnelLimit: query.managedPersonnelLimit, managedPersonnelOffset: query.managedPersonnelOffset,
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
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetClosedLeaderboardQueryDto,
  ) {
    return this.reportingService.getClosedLeaderboard({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      ...this.resolveReadScope(request.user),
      roleCodes: request.user.roleCodes,
      assignedStoreIds: resolveRegionManagerAssignedStoreIds({ roleCodes: request.user.roleCodes, roleScopes: request.user.roleScopes, assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [] }),
      periodType: query.periodType,
      periodStart: query.periodStart,
      snapshotDate: query.snapshotDate,
      storeId: query.storeId,
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
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
      };
    },
    @Query() query: GetChecklistReportQueryDto,
  ) {
    return this.reportingService.getChecklistReport({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      checklistTemplateId: query.checklistTemplateId,
      ...this.resolveReadScope(request.user),
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
        roleCodes: string[];
        scope: StoreReadScope;
        roleScopes?: ReportViewerRoleScopes;
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
      ...this.resolveReadScope(request.user),
      limit: query.limit,
      offset: query.offset,
    });
  }

  private resolveReadScope(user: { roleCodes: string[]; scope: StoreReadScope; roleScopes?: ReportViewerRoleScopes; actionScope?: { assignedStoreIds: string[] } }) {
    return resolveReportingReadScope(user);
  }

  private resolvePersonnelProfileReadScope(input: {
    actorRoleCodes: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    roleScopes?: ReportViewerRoleScopes;
  }) {
    if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
      return resolveReportViewerCompanyScope({
        actorRoleCodes: input.actorRoleCodes,
        actorScope: input.actorScope,
        roleScopes: input.roleScopes,
      });
    }

    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (input.actorRoleCodes.includes("SUPER_ADMIN")) {
      if (input.actorScope.companyIds.length > 0) {
        return {
          companyIds: input.actorScope.companyIds,
          regionIds: [],
          storeIds: [],
        };
      }

      if (input.actorScope.regionIds.length > 0) {
        return {
          companyIds: [],
          regionIds: input.actorScope.regionIds,
          storeIds: [],
        };
      }

      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    if (input.actorRoleCodes.includes("REGION_MANAGER")) {
      return { companyIds: [], regionIds: [], storeIds: resolveRegionManagerAssignedStoreIds({ roleCodes: input.actorRoleCodes, roleScopes: input.roleScopes, assignedStoreIds: input.actorActionScope?.assignedStoreIds ?? [] }) };
    }

    return {
      companyIds: [],
      regionIds: [],
      storeIds,
    };
  }

  private resolveStoreReadScope(input: {
    actorRoleCodes: string[];
    actorScope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    broadReadRoles: string[];
    roleScopes?: ReportViewerRoleScopes;
  }) {
    if (input.actorRoleCodes.includes("REPORT_VIEWER")) {
      return resolveReportViewerCompanyScope({
        actorRoleCodes: input.actorRoleCodes,
        actorScope: input.actorScope,
        roleScopes: input.roleScopes,
      });
    }

    if (input.actorRoleCodes.includes("REGION_MANAGER") && !input.actorRoleCodes.includes("SUPER_ADMIN")) {
      return { companyIds: [], regionIds: [], storeIds: resolveRegionManagerAssignedStoreIds({ roleCodes: input.actorRoleCodes, roleScopes: input.roleScopes, assignedStoreIds: input.actorActionScope?.assignedStoreIds ?? [] }) };
    }

    const canUseBroadReadScope = input.actorRoleCodes.some((roleCode) =>
      input.broadReadRoles.includes(roleCode),
    );
    const storeIds = input.actorActionScope?.assignedStoreIds.length
      ? input.actorActionScope.assignedStoreIds
      : input.actorScope.storeIds;

    if (!canUseBroadReadScope) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds,
      };
    }

    if (input.actorScope.companyIds.length > 0) {
      return {
        companyIds: input.actorScope.companyIds,
        regionIds: [],
        storeIds: [],
      };
    }

    if (input.actorScope.regionIds.length > 0) {
      return {
        companyIds: [],
        regionIds: input.actorScope.regionIds,
        storeIds: [],
      };
    }

    return {
      companyIds: [],
      regionIds: [],
      storeIds,
    };
  }

}
