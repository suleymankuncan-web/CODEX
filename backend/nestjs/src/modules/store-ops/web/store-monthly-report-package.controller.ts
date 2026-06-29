import { Controller, Get, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { ApiOkResponse, ApiProduces, ApiQuery } from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { StoreMonthlyReportPackageService } from "../application/store-monthly-report-package.service";
import { GetStoreMonthlyReportPackageQueryDto } from "./dto/get-store-monthly-report-package.query";

type HeaderResponse = {
  setHeader(name: string, value: string): unknown;
};

type ReportPackageRequest = {
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
export class StoreMonthlyReportPackageController {
  constructor(
    private readonly storeMonthlyReportPackageService: StoreMonthlyReportPackageService,
  ) {}

  @Get("store-monthly-package")
  @RequireScope("authenticated")
  @RequireRoles("REPORT_VIEWER", "AUDITOR", "REGION_MANAGER", "SUPER_ADMIN")
  @ApiQuery(STORE_MONTHLY_REPORT_PERIOD_QUERY)
  @ApiOkResponse({
    schema: STORE_MONTHLY_REPORT_PACKAGE_RESPONSE_SCHEMA,
  })
  async getStoreMonthlyReportPackage(
    @Req() request: ReportPackageRequest,
    @Query() query: GetStoreMonthlyReportPackageQueryDto,
  ) {
    return this.storeMonthlyReportPackageService.getSummary({
      period: query.period,
      ...this.resolveReadScope(request.user),
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
    @Req() request: ReportPackageRequest,
    @Query() query: GetStoreMonthlyReportPackageQueryDto,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const workbook = await this.storeMonthlyReportPackageService.buildWorkbook({
      period: query.period,
      ...this.resolveReadScope(request.user),
    });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${workbook.fileName}"`,
    );

    return new StreamableFile(workbook.buffer);
  }

  private resolveReadScope(user: ReportPackageRequest["user"]) {
    const storeReadScope = this.resolveStoreReadScope({
      actorRoleCodes: user.roleCodes,
      actorScope: user.scope,
      actorActionScope: user.actionScope,
      broadReadRoles: ["REPORT_VIEWER", "AUDITOR", "SUPER_ADMIN"],
    });
    const isRegionManagerRead =
      user.roleCodes.includes("REGION_MANAGER") && !user.roleCodes.includes("SUPER_ADMIN");

    return {
      companyIds: storeReadScope.companyIds,
      regionIds: storeReadScope.regionIds,
      storeIds: storeReadScope.storeIds,
      regionManagerUserId: isRegionManagerRead ? user.userId : undefined,
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
