import { Body, Controller, Get, Param, Patch, Query, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiQuery } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { RankingService } from "../application/ranking.service";
import { ReportingService } from "../application/reporting.service";
import { StoreMonthlyReportPackageService } from "../application/store-monthly-report-package.service";
import { GetChecklistReportQueryDto } from "./dto/get-checklist-report.query";
import { GetClosedLeaderboardQueryDto } from "./dto/get-closed-leaderboard.query";
import { GetMyPerformanceQueryDto } from "./dto/get-my-performance.query";
import { GetRankingQueryDto } from "./dto/get-ranking.query";
import { GetStoreKpiHighlightsQueryDto } from "./dto/get-store-kpi-highlights.query";
import { GetStoreMonthlyReportPackageQueryDto } from "./dto/get-store-monthly-report-package.query";
import { GetTurnoverReportQueryDto } from "./dto/get-turnover-report.query";
import { GetWorkforceReportQueryDto } from "./dto/get-workforce-report.query";
import { ListSnapshotRunsQueryDto } from "./dto/list-snapshot-runs.query";

type HeaderResponse = {
  setHeader(name: string, value: string): unknown;
};

const STORE_MONTHLY_REPORT_PERIOD_QUERY = {
  name: "period",
  required: true,
  schema: {
    type: "string",
    pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
    example: "2026-06",
  },
};

const STORE_MONTHLY_REPORT_PACKAGE_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "period",
    "periodLabel",
    "coverageLabel",
    "isCurrentPeriod",
    "storeCount",
    "sections",
    "items",
  ],
  properties: {
    period: { type: "string", example: "2026-06" },
    periodLabel: { type: "string", example: "Haziran 2026" },
    coverageLabel: { type: "string", example: "1-14 Haziran" },
    isCurrentPeriod: { type: "boolean", example: true },
    storeCount: { type: "number", example: 30 },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "label", "value", "status"],
        properties: {
          code: { type: "string", example: "scope" },
          label: { type: "string", example: "Kapsam" },
          value: { type: "string", example: "30 mağaza" },
          status: { type: "string", enum: ["ready", "partial"] },
        },
      },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          regionManager: { type: "string" },
          storeName: { type: "string" },
          city: { type: "string" },
          period: { type: "string" },
          reportRange: { type: "string" },
          score: { type: "string" },
          upt: { type: "string" },
          atv: { type: "string" },
          cr: { type: "string" },
          hg: { type: "string" },
          gsm: { type: "string" },
          bmChecklist: { type: "string" },
          vmChecklist: { type: "string" },
          actionStatus: { type: "string" },
          targetStatus: { type: "string" },
          incentiveStatus: { type: "string" },
          normFiili: { type: "string" },
          missingDays: { type: "string" },
          turnover: { type: "string" },
          lastVisit: { type: "string" },
          daysSinceVisit: { type: "string" },
          dataNote: { type: "string" },
        },
      },
    },
  },
};

@Controller("reports")
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly rankingService: RankingService,
    private readonly storeMonthlyReportPackageService: StoreMonthlyReportPackageService,
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

  @Get("store-monthly-package")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "REGION_MANAGER", "SUPER_ADMIN")
  @ApiQuery(STORE_MONTHLY_REPORT_PERIOD_QUERY)
  @ApiOkResponse({
    schema: STORE_MONTHLY_REPORT_PACKAGE_RESPONSE_SCHEMA,
  })
  async getStoreMonthlyReportPackage(
    @Req()
    request: {
      user: {
        userId: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetStoreMonthlyReportPackageQueryDto,
  ) {
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      broadReadRoles: ["REPORT_VIEWER", "AUDITOR", "SUPER_ADMIN"],
    });
    const isRegionManagerRead =
      request.user.roleCodes.includes("REGION_MANAGER") &&
      !request.user.roleCodes.includes("SUPER_ADMIN");

    return this.storeMonthlyReportPackageService.getSummary({
      period: query.period,
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
      regionManagerUserId: isRegionManagerRead ? request.user.userId : undefined,
    });
  }

  @Get("store-monthly-package.xlsx")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "REGION_MANAGER", "SUPER_ADMIN")
  @ApiQuery(STORE_MONTHLY_REPORT_PERIOD_QUERY)
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @ApiOkResponse({
    schema: {
      type: "string",
      format: "binary",
    },
  })
  async downloadStoreMonthlyReportPackage(
    @Req()
    request: {
      user: {
        userId: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetStoreMonthlyReportPackageQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      broadReadRoles: ["REPORT_VIEWER", "AUDITOR", "SUPER_ADMIN"],
    });
    const isRegionManagerRead =
      request.user.roleCodes.includes("REGION_MANAGER") &&
      !request.user.roleCodes.includes("SUPER_ADMIN");
    const workbook = await this.storeMonthlyReportPackageService.buildWorkbook({
      period: query.period,
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
      regionManagerUserId: isRegionManagerRead ? request.user.userId : undefined,
    });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${workbook.fileName}"`,
    );

    return workbook.buffer;
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
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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

  @Get("personnel-performance/:employeeId")
  @RequireScope("authenticated")
  @RequireRoles("STORE_PERSONNEL", "STORE_MANAGER", "REGION_MANAGER", "SUPER_ADMIN")
  async getPersonnelPerformance(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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
    });

    return this.reportingService.getPersonnelPerformance({
      userId: request.user.userId,
      employeeId: request.user.employeeId,
      targetEmployeeId: employeeId,
      roleCodes: request.user.roleCodes,
      identityCompanyIds: request.user.scope.companyIds,
      companyIds: personnelProfileReadScope.companyIds,
      regionIds: personnelProfileReadScope.regionIds,
      storeIds: personnelProfileReadScope.storeIds,
      assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [],
      mode: query.mode,
      snapshotDate: query.snapshotDate,
      periodType: query.periodType,
      periodStart: query.periodStart,
    });
  }

  @Get("store-kpi-highlights")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER")
  async getStoreKpiHighlights(
    @Req()
    request: {
      user: {
        userId?: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
        actionScope?: {
          assignedStoreIds: string[];
        };
      };
    },
    @Query() query: GetStoreKpiHighlightsQueryDto,
  ) {
    const assignedStoreIds = request.user.actionScope?.assignedStoreIds.length
      ? request.user.actionScope.assignedStoreIds
      : request.user.scope.storeIds;
    const isRegionManagerRead =
      request.user.roleCodes.includes("REGION_MANAGER") &&
      !request.user.roleCodes.includes("SUPER_ADMIN");
    const storeReadScope =
      isRegionManagerRead
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
      periodStart: query.periodStart,
      storeId: query.storeId,
      regionManagerUserId: isRegionManagerRead ? request.user.userId : undefined,
    });
  }

  @Get("store-score-breakdown")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER")
  async getStoreScoreBreakdown(
    @Req()
    request: {
      user: {
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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
      broadReadRoles: ["SUPER_ADMIN"],
    });

    return this.reportingService.getStoreMonthlyScoreBreakdown({
      snapshotRunId: query.snapshotRunId,
      storeId: query.storeId,
      storeIds: storeReadScope.storeIds,
    });
  }

  @Get("rankings")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "STORE_PERSONNEL", "REGION_MANAGER", "SUPER_ADMIN")
  async getRankings(
    @Req()
    request: {
      user: {
        userId: string;
        employeeId?: string;
        roleCodes: string[];
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [],
      periodType: query.periodType ?? "monthly",
      periodStart: query.periodStart,
      regionManagerUserId: query.regionManagerUserId,
      regionId: query.regionId,
      storeId: query.storeId,
      search: query.search,
      sortKey: query.sortKey,
      sortDirection: query.sortDirection,
      limit: query.limit,
      offset: query.offset,
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
        scope: {
          companyIds: string[];
          regionIds: string[];
          storeIds: string[];
        };
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
      companyIds: request.user.scope.companyIds,
      regionIds: request.user.scope.regionIds,
      storeIds: request.user.scope.storeIds,
      roleCodes: request.user.roleCodes,
      assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [],
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
  }) {
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
  }) {
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
