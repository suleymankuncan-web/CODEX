import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import { logStructuredError } from "../../../shared/structured-log";
import { KpiImportStoreReadRepository } from "../infrastructure/kpi-import-store-read.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
import { IntegrationService } from "./integration.service";
import { buildPowerBiReconciliationSummary } from "./power-bi-reconciliation.builder";
import {
  PowerBiExportParserService,
  type ExportRow,
  type UploadFile,
} from "./power-bi-export-parser.service";
import { PowerBiExportNormalizerService } from "./power-bi-export-normalizer.service";
import {
  GSM_APPROVAL_KPI_CODE,
  normalizeGsmOnayValue,
} from "./gsm-approval-normalization";

export {
  POWER_BI_EXPORT_MAX_FILE_BYTES,
  POWER_BI_EXPORT_MAX_SHEET_COLUMNS,
  POWER_BI_EXPORT_MAX_SHEET_ROWS,
  POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
  isSupportedPowerBiExportFileName,
} from "./power-bi-export-parser.service";

type PeriodType = "daily" | "weekly" | "monthly" | "custom";

type PeriodBounds = {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  periodMonth: string | null;
};

type CanonicalKpiRow = {
  kpiCode: string;
  sourceMetricId: string;
  actualValue: number | null;
  achievementRate?: number | null;
  validationError?: string | null;
  targetValue?: number | null;
  scopeType: "store" | "employee";
  storeExternalRef: string;
  employeeExternalRef: string | null;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  sourceCapturedAt: string;
  sourceRow: Record<string, unknown>;
};

type PersonnelAggregate = {
  personName: string;
  primaryStoreName: string;
  rows: ExportRow[];
  grossSales: number;
  itemCount: number;
  derivedTicketCount: number;
  denominatorConflictCount: number;
};

type StoreAggregate = {
  storeName: string;
  rows: ExportRow[];
  netSales: number;
  targetValue: number;
  itemCount: number;
  ticketCount: number;
  footfall: number;
};

type KpiImportStoreScope = {
  externalRefKeys: Set<string>;
};

@Injectable()
export class PowerBiExportUploadService {
  private readonly logger = new Logger(PowerBiExportUploadService.name);

  constructor(
    private readonly powerBiExportParserService: PowerBiExportParserService,
    private readonly kpiImportStoreReadRepository: KpiImportStoreReadRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly integrationService: IntegrationService,
    private readonly powerBiExportNormalizerService: PowerBiExportNormalizerService,
  ) {}

  async upload(input: {
    actorCompanyIds?: string[];
    sourceCode: string;
    periodMonth?: string;
    periodType?: PeriodType;
    periodStart?: string;
    periodEnd?: string;
    actorUserId: string;
    personnelFile?: UploadFile | null;
    storeFile?: UploadFile | null;
  }) {
    try {
      if (!input.personnelFile && !input.storeFile) {
        throw new BadRequestException("En az bir Power BI export dosyasi yuklenmeli");
      }

      const source = await this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(
        input.sourceCode,
        "kpi",
      );

      if (!source || !source.is_active) {
        throw new NotFoundException(
          `Aktif KPI integration source bulunamadi: ${input.sourceCode}`,
        );
      }

      if (source.source_system !== "power_bi") {
        throw new BadRequestException(
          "Bu upload adapter sadece power_bi source system ile kullanilir",
        );
      }

      const periodBounds = this.resolvePeriodBounds(input);
      const sourceCapturedAt = new Date().toISOString();

      const { personnelRows, storeRows } =
        await this.powerBiExportParserService.readUploadedRows(input);
      const scopedStoreRefs = await this.kpiImportStoreReadRepository.listKpiImportStoreExternalRefs({
        actorCompanyIds: input.actorCompanyIds ?? [],
        integrationSourceId: source.integration_source_id,
      });
      const storeScope = this.buildKpiImportStoreScope(scopedStoreRefs);

      const storeCanonicalRows = this.hasGsmApprovalRows(storeRows)
        ? this.mapGsmApprovalRows(storeRows, periodBounds, sourceCapturedAt, storeScope)
        : this.mapStoreRows(storeRows, periodBounds, sourceCapturedAt, storeScope);
      const canonicalRows = [
        ...this.mapPersonnelRows(personnelRows, periodBounds, sourceCapturedAt, storeScope),
        ...storeCanonicalRows,
      ];

      if (canonicalRows.length === 0) {
        throw new BadRequestException(
          "Yuklenen dosyalarda import edilebilir KPI satiri bulunamadi",
        );
      }

      const payloadHash = createHash("sha256")
        .update(JSON.stringify(canonicalRows))
        .digest("hex");
      const sourceBatchId = [
        "power-bi-export",
        input.sourceCode,
        periodBounds.periodType,
        periodBounds.periodStart,
        periodBounds.periodEnd,
        payloadHash.slice(0, 12),
      ].join(":");
      const fileReference = [input.personnelFile?.originalname, input.storeFile?.originalname]
        .filter(Boolean)
        .join(" + ");

      const batch = await this.integrationService.createImportBatch({
        actorCompanyIds: input.actorCompanyIds ?? [],
        sourceCode: input.sourceCode,
        entityType: "kpi",
        fileReference,
        actorUserId: input.actorUserId,
        sourceBatchId,
        idempotencyKey: sourceBatchId,
        sourcePayloadHash: payloadHash,
        sourceCapturedAt,
        sourceWindowStartedAt: `${periodBounds.periodStart}T00:00:00.000Z`,
        sourceWindowEndedAt: `${periodBounds.periodEnd}T23:59:59.999Z`,
        rows: canonicalRows,
      });

      return buildCommandResponse({
        status: batch.command.status,
        message: "Power BI export dosyalari import edildi",
        data: {
          batch: batch.data.batch,
          summary: {
            periodMonth: periodBounds.periodMonth,
            periodType: periodBounds.periodType,
            periodStart: periodBounds.periodStart,
            periodEnd: periodBounds.periodEnd,
            personnelRowsRead: personnelRows.length,
            storeRowsRead: storeRows.length,
            canonicalRowCount: canonicalRows.length,
            personnelGrossSalesRows: this.countPersonnelGrossSalesRows(
              personnelRows,
              storeScope,
            ),
            negativePersonnelRowsIgnored: this.countNegativePersonnelRows(personnelRows),
            ignoredPersonnelRows: this.countIgnoredPersonnelRows(personnelRows, storeScope),
            ignoredStoreRows: this.countIgnoredStoreRows(storeRows, storeScope),
            scopeExcludedPersonnelRows: this.countScopeExcludedPersonnelRows(
              personnelRows,
              storeScope,
            ),
            scopeExcludedStoreRows: this.countScopeExcludedStoreRows(storeRows, storeScope),
            reconciliation: buildPowerBiReconciliationSummary({
              storeRows,
              personnelRows,
              storeScope,
              normalizer: this.powerBiExportNormalizerService,
            }),
            mappingMode: "strict_external_id_map",
          },
        },
        job: batch.job,
      });
    } catch (error) {
      logStructuredError(this.logger, "power_bi_export_upload.failed", error, {
        sourceCode: input.sourceCode,
        periodMonth: input.periodMonth ?? null,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        hasPersonnelFile: Boolean(input.personnelFile),
        hasStoreFile: Boolean(input.storeFile),
      });
      throw error;
    }
  }

  private mapPersonnelRows(
    rows: ExportRow[],
    period: PeriodBounds,
    sourceCapturedAt: string,
    storeScope: KpiImportStoreScope,
  ): CanonicalKpiRow[] {
    const aggregates = new Map<string, PersonnelAggregate>();

    for (const row of rows) {
      const personName = this.getPersonName(row);
      const storeName = this.getStoreName(row);
      const grossSales = this.getPersonnelSalesAmount(row);

      if (
        !personName ||
        !storeName ||
        this.isSummaryText(personName) ||
        this.powerBiExportNormalizerService.normalizeKey(personName) === "estore" ||
        !this.isStoreInKpiImportScope(storeName, storeScope) ||
        grossSales === null ||
        grossSales <= 0
      ) {
        continue;
      }

      const aggregateKey = this.buildEmployeeExternalRef(storeName, personName);
      const aggregate =
        aggregates.get(aggregateKey) ??
        {
          personName,
          primaryStoreName: storeName,
          rows: [],
          grossSales: 0,
          itemCount: 0,
          derivedTicketCount: 0,
          denominatorConflictCount: 0,
        };

      aggregate.rows.push(row);
      aggregate.grossSales += grossSales;
      aggregate.itemCount += Math.max(this.getPersonnelItemCount(row) ?? 0, 0);
      const derivedTicket = this.derivePersonnelTicketCount(row);
      if (derivedTicket.ticketCount !== null) {
        aggregate.derivedTicketCount += derivedTicket.ticketCount;
      }
      if (derivedTicket.hasConflict) {
        aggregate.denominatorConflictCount += 1;
      }
      aggregates.set(aggregateKey, aggregate);
    }

    return [...aggregates.values()].flatMap((aggregate) => {
      const sourceRow = this.buildPersonnelSourceRow(aggregate);
      const rows = [
        this.buildEmployeeMetricRow(
          "NET_SALES",
          aggregate.grossSales,
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "ITEM_COUNT",
          aggregate.itemCount > 0 ? aggregate.itemCount : null,
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "TICKET_COUNT",
          aggregate.derivedTicketCount > 0
            ? this.powerBiExportNormalizerService.roundMetric(aggregate.derivedTicketCount)
            : null,
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "ATV",
          this.powerBiExportNormalizerService.divideMetric(aggregate.grossSales, aggregate.derivedTicketCount),
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "UPT",
          this.powerBiExportNormalizerService.divideMetric(aggregate.itemCount, aggregate.derivedTicketCount),
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
      ];

      return rows.filter((item): item is CanonicalKpiRow => item !== null);
    });
  }

  private mapStoreRows(
    rows: ExportRow[],
    period: PeriodBounds,
    sourceCapturedAt: string,
    storeScope: KpiImportStoreScope,
  ): CanonicalKpiRow[] {
    const aggregates = new Map<string, StoreAggregate>();

    for (const row of rows) {
      const storeName = this.getStoreName(row);
      if (
        !storeName ||
        this.isSummaryText(storeName) ||
        !this.isStoreInKpiImportScope(storeName, storeScope)
      ) {
        continue;
      }

      const aggregateKey = this.powerBiExportNormalizerService.normalizeKey(storeName);
      const aggregate =
        aggregates.get(aggregateKey) ??
        {
          storeName,
          rows: [],
          netSales: 0,
          targetValue: 0,
          itemCount: 0,
          ticketCount: 0,
          footfall: 0,
        };

      aggregate.rows.push(row);
      aggregate.netSales += this.getStoreNetSales(row) ?? 0;
      aggregate.targetValue += this.getStoreTarget(row) ?? 0;
      aggregate.itemCount += this.getStoreItemCount(row) ?? 0;
      aggregate.ticketCount += this.getStoreTicketCount(row) ?? 0;
      aggregate.footfall += this.getStoreFootfall(row) ?? 0;
      aggregates.set(aggregateKey, aggregate);
    }

    return [...aggregates.values()].flatMap((aggregate) => {
      const sourceRow = this.buildStoreSourceRow(aggregate);
      const atv = this.powerBiExportNormalizerService.divideMetric(aggregate.netSales, aggregate.ticketCount);
      const upt = this.powerBiExportNormalizerService.divideMetric(aggregate.itemCount, aggregate.ticketCount);
      const cr = this.powerBiExportNormalizerService.divideMetric(aggregate.ticketCount, aggregate.footfall);

      return [
        this.buildStoreMetricRow(
          "TARGET_ACHIEVEMENT",
          aggregate.netSales > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.netSales) : null,
          aggregate.targetValue > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.targetValue) : null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "NET_SALES",
          aggregate.netSales > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.netSales) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "ITEM_COUNT",
          aggregate.itemCount > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.itemCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "TICKET_COUNT",
          aggregate.ticketCount > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.ticketCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "FF",
          aggregate.footfall > 0 ? this.powerBiExportNormalizerService.roundMetric(aggregate.footfall) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "CR",
          cr,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "ATV",
          atv,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "UPT",
          upt,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
      ].filter((item): item is CanonicalKpiRow => item !== null);
    });
  }

  private mapGsmApprovalRows(
    rows: ExportRow[],
    period: PeriodBounds,
    sourceCapturedAt: string,
    storeScope: KpiImportStoreScope,
  ): CanonicalKpiRow[] {
    return rows.map((row, index) => {
      const storeCode = this.getStoreCode(row);
      const storeName = this.getStoreName(row);
      const storeExternalRef = storeCode ?? storeName ?? `gsm-row-${index + 1}`;
      const rawValue = this.getGsmApprovalRawValue(row);
      const gsmValue = normalizeGsmOnayValue(rawValue);
      const validationError =
        !storeCode && !storeName
          ? "gsm_approval store reference is required"
          : !this.isStoreInKpiImportScope(storeExternalRef, storeScope) &&
              (!storeName || !this.isStoreInKpiImportScope(storeName, storeScope))
            ? `gsm_approval store reference is not mapped: ${storeExternalRef}`
            : gsmValue.validationError;

      return {
        kpiCode: GSM_APPROVAL_KPI_CODE,
        sourceMetricId: GSM_APPROVAL_KPI_CODE,
        actualValue: gsmValue.actualValue,
        achievementRate: gsmValue.achievementRate,
        validationError,
        scopeType: "store",
        storeExternalRef,
        employeeExternalRef: null,
        periodType: "monthly",
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        sourceCapturedAt,
        sourceRow: {
          sourceKind: "gsm_onay",
          storeCode,
          storeName,
          gsmOnayRawValue: rawValue ?? null,
          sourceRow: row,
        },
      };
    });
  }


  private buildEmployeeMetricRow(
    kpiCode: string,
    actualValue: number | null,
    personName: string,
    storeName: string,
    period: PeriodBounds,
    sourceCapturedAt: string,
    sourceRow: Record<string, unknown>,
  ): CanonicalKpiRow | null {
    if (actualValue === null) {
      return null;
    }

    return {
      kpiCode,
      sourceMetricId: kpiCode,
      actualValue,
      scopeType: "employee",
      storeExternalRef: storeName,
      employeeExternalRef: this.buildEmployeeExternalRef(storeName, personName),
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      sourceCapturedAt,
      sourceRow,
    };
  }

  private buildStoreMetricRow(
    kpiCode: string,
    actualValue: number | null,
    targetValue: number | null,
    storeName: string,
    period: PeriodBounds,
    sourceCapturedAt: string,
    sourceRow: Record<string, unknown>,
  ): CanonicalKpiRow | null {
    if (actualValue === null) {
      return null;
    }

    return {
      kpiCode,
      sourceMetricId: kpiCode,
      actualValue,
      targetValue,
      scopeType: "store",
      storeExternalRef: storeName,
      employeeExternalRef: null,
      periodType: period.periodType,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      sourceCapturedAt,
      sourceRow,
    };
  }

  private buildPersonnelSourceRow(aggregate: PersonnelAggregate): Record<string, unknown> {
    return {
      sourceKind: "personnel_gross_sales",
      personName: aggregate.personName,
      primaryStoreName: aggregate.primaryStoreName,
      positiveRowCount: aggregate.rows.length,
      personnelGrossSales: this.powerBiExportNormalizerService.roundMetric(aggregate.grossSales),
      personnelPositiveItemCount: this.powerBiExportNormalizerService.roundMetric(aggregate.itemCount),
      personnelDerivedTicketCount: this.powerBiExportNormalizerService.roundMetric(aggregate.derivedTicketCount),
      denominatorConflictCount: aggregate.denominatorConflictCount,
      sourceRows: aggregate.rows,
    };
  }

  private buildStoreSourceRow(aggregate: StoreAggregate): Record<string, unknown> {
    const recomputedCr = this.powerBiExportNormalizerService.divideMetric(aggregate.ticketCount, aggregate.footfall);

    return {
      sourceKind: "store_net_sales",
      storeName: aggregate.storeName,
      sourceRowCount: aggregate.rows.length,
      storeNetSales: this.powerBiExportNormalizerService.roundMetric(aggregate.netSales),
      storeTargetValue: this.powerBiExportNormalizerService.roundMetric(aggregate.targetValue),
      storeItemCount: this.powerBiExportNormalizerService.roundMetric(aggregate.itemCount),
      storeTicketCount: this.powerBiExportNormalizerService.roundMetric(aggregate.ticketCount),
      storeFootfall: this.powerBiExportNormalizerService.roundMetric(aggregate.footfall),
      recomputedAtv: this.powerBiExportNormalizerService.divideMetric(aggregate.netSales, aggregate.ticketCount),
      recomputedUpt: this.powerBiExportNormalizerService.divideMetric(aggregate.itemCount, aggregate.ticketCount),
      recomputedCr,
      recomputedCrDisplayPercent:
        recomputedCr === null ? null : this.powerBiExportNormalizerService.roundMetric(recomputedCr * 100),
      sourceRows: aggregate.rows,
    };
  }

  private resolvePeriodBounds(input: {
    periodMonth?: string;
    periodType?: PeriodType;
    periodStart?: string;
    periodEnd?: string;
  }): PeriodBounds {
    if (input.periodStart || input.periodEnd) {
      if (!input.periodStart || !input.periodEnd) {
        throw new BadRequestException("Donem baslangic ve bitis tarihi birlikte verilmeli");
      }

      const periodStart = this.toDateOnly(input.periodStart, "periodStart");
      const periodEnd = this.toDateOnly(input.periodEnd, "periodEnd");
      if (periodEnd < periodStart) {
        throw new BadRequestException("Donem bitis tarihi baslangictan once olamaz");
      }

      return {
        periodType: input.periodType ?? "custom",
        periodStart,
        periodEnd,
        periodMonth: input.periodMonth ?? null,
      };
    }

    if (!input.periodMonth) {
      throw new BadRequestException("Donem ayi veya tarih araligi verilmeli");
    }

    if (!/^\d{4}-\d{2}$/.test(input.periodMonth)) {
      throw new BadRequestException("Donem ayi YYYY-MM formatinda olmali");
    }

    const [yearText, monthText] = input.periodMonth.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const periodStartDate = new Date(Date.UTC(year, monthIndex, 1));
    const periodEndDate = new Date(Date.UTC(year, monthIndex + 1, 0));

    return {
      periodType: input.periodType ?? "monthly",
      periodStart: periodStartDate.toISOString().slice(0, 10),
      periodEnd: periodEndDate.toISOString().slice(0, 10),
      periodMonth: input.periodMonth,
    };
  }

  private countPersonnelGrossSalesRows(
    rows: ExportRow[],
    storeScope: KpiImportStoreScope,
  ) {
    return rows.filter((row) => {
      const personName = this.getPersonName(row);
      const storeName = this.getStoreName(row);
      const salesAmount = this.getPersonnelSalesAmount(row);
      return (
        Boolean(personName) &&
        Boolean(storeName) &&
        !this.isSummaryText(personName) &&
        this.powerBiExportNormalizerService.normalizeKey(personName ?? "") !== "estore" &&
        this.isStoreInKpiImportScope(storeName ?? "", storeScope) &&
        salesAmount !== null &&
        salesAmount > 0
      );
    }).length;
  }

  private countNegativePersonnelRows(rows: ExportRow[]) {
    return rows.filter((row) => {
      const salesAmount = this.getPersonnelSalesAmount(row);
      return salesAmount !== null && salesAmount < 0;
    }).length;
  }

  private countIgnoredPersonnelRows(rows: ExportRow[], storeScope: KpiImportStoreScope) {
    return rows.length - this.countPersonnelGrossSalesRows(rows, storeScope);
  }

  private countIgnoredStoreRows(rows: ExportRow[], storeScope: KpiImportStoreScope) {
    return rows.filter((row) => {
      const storeName = this.getStoreName(row);
      return (
        !storeName ||
        this.isSummaryText(storeName) ||
        !this.isStoreInKpiImportScope(storeName, storeScope)
      );
    }).length;
  }

  private countScopeExcludedPersonnelRows(
    rows: ExportRow[],
    storeScope: KpiImportStoreScope,
  ) {
    return rows.filter((row) => {
      const personName = this.getPersonName(row);
      const storeName = this.getStoreName(row);
      const salesAmount = this.getPersonnelSalesAmount(row);
      return (
        Boolean(personName) &&
        Boolean(storeName) &&
        !this.isSummaryText(personName) &&
        this.powerBiExportNormalizerService.normalizeKey(personName ?? "") !== "estore" &&
        salesAmount !== null &&
        salesAmount > 0 &&
        !this.isStoreInKpiImportScope(storeName ?? "", storeScope)
      );
    }).length;
  }

  private countScopeExcludedStoreRows(rows: ExportRow[], storeScope: KpiImportStoreScope) {
    return rows.filter((row) => {
      const storeName = this.getStoreName(row);
      return (
        Boolean(storeName) &&
        !this.isSummaryText(storeName) &&
        !this.isStoreInKpiImportScope(storeName ?? "", storeScope)
      );
    }).length;
  }

  private getPersonName(row: ExportRow) {
    return this.powerBiExportNormalizerService.getText(row, ["Adi", "Adı"]);
  }

  private getStoreName(row: ExportRow) {
    return this.powerBiExportNormalizerService.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);
  }

  private getStoreCode(row: ExportRow) {
    return this.powerBiExportNormalizerService.getText(row, [
      "MagazaKodu",
      "Magaza Kodu",
      "Mağaza Kodu",
      "storeCode",
      "sourceStoreId",
    ]);
  }

  private hasGsmApprovalRows(rows: ExportRow[]) {
    return rows.some((row) => this.getGsmApprovalRawValue(row) !== undefined);
  }

  private getGsmApprovalRawValue(row: ExportRow) {
    return this.getRawValue(row, [
      "Gsm Onay %",
      "GSM Onayı",
      "% GSM Onayı",
      "GSM Onayi",
      "% GSM Onayi",
      "GSM ONAYI",
      "% GSM ONAYI",
      "gsmOnay",
      "gsmOnayYuzde",
      "gsmApproval",
      "gsmApprovalRate",
    ]);
  }

  private getStoreNetSales(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["Ciro"]);
  }

  private getStoreTarget(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["Hedef"]);
  }

  private getStoreItemCount(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["SatisAdedi", "Satis Adedi", "Satış Adedi"]);
  }

  private getStoreTicketCount(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["FaturaSayisi", "Fatura Sayisi", "Fatura Sayısı"]);
  }

  private getStoreFootfall(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["FF", "Footfall"]);
  }

  private getPersonnelSalesAmount(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["SatisTutari", "Satış Tutarı"]);
  }

  private getPersonnelItemCount(row: ExportRow) {
    return this.powerBiExportNormalizerService.getNumber(row, ["PSatisAdeti", "P. Satis Adeti", "P. Satış Adeti"]);
  }

  private getRawValue(row: ExportRow, aliases: string[]) {
    const aliasSet = new Set(
      aliases.map((alias) => this.powerBiExportNormalizerService.normalizeKey(alias)),
    );

    for (const [key, value] of Object.entries(row)) {
      if (aliasSet.has(this.powerBiExportNormalizerService.normalizeKey(key))) {
        return value;
      }
    }

    return undefined;
  }

  private derivePersonnelTicketCount(row: ExportRow) {
    const salesAmount = this.getPersonnelSalesAmount(row);
    const itemCount = this.getPersonnelItemCount(row);
    const reportedAtv = this.powerBiExportNormalizerService.getNumber(row, ["PATV", "P.ATV"]);
    const reportedUpt = this.powerBiExportNormalizerService.getNumber(row, ["PUPT", "P.UPT"]);

    const fromAtv =
      salesAmount !== null && reportedAtv !== null && reportedAtv > 0
        ? salesAmount / reportedAtv
        : null;
    const fromUpt =
      itemCount !== null && reportedUpt !== null && reportedUpt > 0
        ? itemCount / reportedUpt
        : null;

    if (fromAtv === null && fromUpt === null) {
      return { ticketCount: null, hasConflict: false };
    }

    if (fromAtv !== null && fromUpt !== null && Math.abs(fromAtv - fromUpt) > 0.05) {
      return { ticketCount: null, hasConflict: true };
    }

    const ticketCount = fromAtv ?? fromUpt;
    return {
      ticketCount: ticketCount === null ? null : this.powerBiExportNormalizerService.roundMetric(ticketCount),
      hasConflict: false,
    };
  }

  private buildEmployeeExternalRef(storeName: string, personName: string) {
    return `powerbi:${storeName}:${personName}`;
  }

  private isSummaryText(value: string | null) {
    if (!value) {
      return false;
    }

    const normalized = this.powerBiExportNormalizerService.normalizeKey(value);
    return normalized === "total" || normalized.startsWith("uygulananfiltreler");
  }

  private buildKpiImportStoreScope(
    refs: Array<{ external_ref: string | null }>,
  ): KpiImportStoreScope {
    return {
      externalRefKeys: new Set(
        refs
          .map((item) => item.external_ref)
          .filter((value): value is string => Boolean(value?.trim()))
          .map((value) => this.powerBiExportNormalizerService.normalizeKey(value)),
      ),
    };
  }

  private isStoreInKpiImportScope(storeName: string, storeScope: KpiImportStoreScope) {
    return storeScope.externalRefKeys.has(this.powerBiExportNormalizerService.normalizeKey(storeName));
  }

  private toDateOnly(value: string, fieldName: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldName} YYYY-MM-DD formatinda olmali`);
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${fieldName} gecerli bir tarih olmali`);
    }

    return value;
  }
}
