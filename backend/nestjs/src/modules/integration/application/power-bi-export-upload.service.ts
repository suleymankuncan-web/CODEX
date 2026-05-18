import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { AppConfigService } from "../../../shared/app-config.service";
import { DatabaseService } from "../../../shared/database/database.service";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import {
  logStructuredError,
  logStructuredMessage,
} from "../../../shared/structured-log";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
import { IntegrationService } from "./integration.service";

type UploadFile = {
  originalname: string;
  buffer: Buffer;
};

type ExportRow = Record<string, unknown>;
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
  actualValue: number;
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

type ReconciliationMovement = {
  storeName: string;
  personnelPositiveSales: number;
  personnelNegativeMovements: number;
};

type KpiImportStoreScope = {
  externalRefKeys: Set<string>;
};

export const POWER_BI_EXPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const POWER_BI_EXPORT_MAX_SHEET_ROWS = 20_000;
export const POWER_BI_EXPORT_MAX_SHEET_COLUMNS = 80;
export const POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS = 5;

const POWER_BI_EXPORT_ALLOWED_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const POWER_BI_EXPORT_PARSE_WORKER_SCRIPT = `
const { parentPort, workerData } = require("node:worker_threads");
const XLSX = require("@e965/xlsx");

function postFailure(message) {
  parentPort.postMessage({ ok: false, message });
}

function run() {
  try {
    const fileName = workerData.fileName || "unknown-file";
    const workbook = XLSX.read(Buffer.from(workerData.buffer), { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      parentPort.postMessage({ ok: true, rows: [] });
      return;
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rangeRef = sheet["!ref"];

    if (rangeRef) {
      let range;
      try {
        range = XLSX.utils.decode_range(rangeRef);
      } catch {
        postFailure("Power BI export calisma sayfasi okunamadi: " + fileName);
        return;
      }

      const rowCount = range.e.r - range.s.r + 1;
      const columnCount = range.e.c - range.s.c + 1;

      if (rowCount > workerData.maxRows) {
        postFailure("Power BI export dosyasi en fazla " + workerData.maxRows + " satir olabilir");
        return;
      }

      if (columnCount > workerData.maxColumns) {
        postFailure("Power BI export dosyasi en fazla " + workerData.maxColumns + " kolon olabilir");
        return;
      }
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      raw: true,
      defval: "",
    });
    parentPort.postMessage({ ok: true, rows });
  } catch {
    postFailure("Power BI export calisma sayfasi okunamadi: " + (workerData.fileName || "unknown-file"));
  }
}

run();
`;

type ParseWorkerMessage =
  | { ok: true; rows: ExportRow[] }
  | { ok: false; message: string };

export function isSupportedPowerBiExportFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return POWER_BI_EXPORT_ALLOWED_FILE_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension),
  );
}

@Injectable()
export class PowerBiExportUploadService {
  private readonly logger = new Logger(PowerBiExportUploadService.name);
  private activeParseSlots = 0;

  constructor(
    _databaseService: DatabaseService,
    private readonly integrationRepository: IntegrationRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly integrationService: IntegrationService,
    private readonly appConfigService: AppConfigService,
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

      const { personnelRows, storeRows } = await this.readUploadedRows(input);
      const scopedStoreRefs = await this.integrationRepository.listKpiImportStoreExternalRefs({
        actorCompanyIds: input.actorCompanyIds ?? [],
        integrationSourceId: source.integration_source_id,
      });
      const storeScope = this.buildKpiImportStoreScope(scopedStoreRefs);

      const canonicalRows = [
        ...this.mapPersonnelRows(personnelRows, periodBounds, sourceCapturedAt, storeScope),
        ...this.mapStoreRows(storeRows, periodBounds, sourceCapturedAt, storeScope),
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
            reconciliation: this.buildReconciliationSummary(
              storeRows,
              personnelRows,
              storeScope,
            ),
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

  private async readUploadedRows(input: {
    sourceCode: string;
    personnelFile?: UploadFile | null;
    storeFile?: UploadFile | null;
  }): Promise<{ personnelRows: ExportRow[]; storeRows: ExportRow[] }> {
    return this.withParseSlot(async (signal) => {
      const personnelRows = input.personnelFile
        ? await this.readSheetRows(input.personnelFile, {
            fileRole: "personnel",
            sourceCode: input.sourceCode,
          }, signal)
        : [];
      const storeRows = input.storeFile
        ? await this.readSheetRows(input.storeFile, {
            fileRole: "store",
            sourceCode: input.sourceCode,
          }, signal)
        : [];

      return { personnelRows, storeRows };
    });
  }

  private async withParseSlot<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const maxConcurrency = this.appConfigService.uploadParseMaxConcurrency;

    if (this.activeParseSlots >= maxConcurrency) {
      throw this.buildRetryableParseException(
        "Power BI export isleme kapasitesi dolu; lutfen kisa sure sonra tekrar deneyin",
      );
    }

    this.activeParseSlots += 1;
    try {
      return await this.withParseTimeout(operation);
    } finally {
      this.activeParseSlots = Math.max(0, this.activeParseSlots - 1);
    }
  }

  private async withParseTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const timeoutMs = this.appConfigService.uploadParseTimeoutMs;
    const abortController = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    try {
      return await new Promise<T>((resolve, reject) => {
        timeout = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          abortController.abort();
          reject(
            this.buildRetryableParseException(
              "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
            ),
          );
        }, timeoutMs);

        operation(abortController.signal)
          .then((result) => {
            if (settled) {
              return;
            }

            settled = true;
            resolve(result);
          })
          .catch((error) => {
            if (settled) {
              return;
            }

            settled = true;
            reject(error);
          });
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private buildRetryableParseException(message: string): HttpException {
    return new HttpException(
      {
        message,
        retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async readSheetRows(
    file: UploadFile,
    context: { fileRole: "personnel" | "store"; sourceCode: string },
    signal: AbortSignal,
  ): Promise<ExportRow[]> {
    const startedAt = Date.now();
    const rows = await this.parseSheetRows(file, signal);

    logStructuredMessage(this.logger, "power_bi_export_upload.parse.completed", {
      fileRole: context.fileRole,
      fileType: this.safeFileExtension(file.originalname),
      fileSizeBytes: file.buffer.length,
      parseDurationMs: Date.now() - startedAt,
      rowCount: rows.length,
      sourceCode: context.sourceCode,
    });

    return rows;
  }

  private parseSheetRows(file: UploadFile, signal: AbortSignal): Promise<ExportRow[]> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        `Dosya okunamadi: ${file.originalname || "unknown-file"}`,
      );
    }

    if (file.buffer.length > POWER_BI_EXPORT_MAX_FILE_BYTES) {
      throw new BadRequestException("Power BI export dosyasi en fazla 8 MB olabilir");
    }

    if (!isSupportedPowerBiExportFileName(file.originalname || "")) {
      throw new BadRequestException("Power BI export dosyasi xlsx, xls veya csv olmali");
    }

    if (signal.aborted) {
      return Promise.reject(
        this.buildRetryableParseException(
          "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
        ),
      );
    }

    return new Promise<ExportRow[]>((resolve, reject) => {
      let settled = false;
      const worker = new Worker(POWER_BI_EXPORT_PARSE_WORKER_SCRIPT, {
        eval: true,
        workerData: {
          buffer: file.buffer,
          fileName: file.originalname || "unknown-file",
          maxColumns: POWER_BI_EXPORT_MAX_SHEET_COLUMNS,
          maxRows: POWER_BI_EXPORT_MAX_SHEET_ROWS,
        },
      });

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        signal.removeEventListener("abort", abortHandler);
        callback();
      };

      const abortHandler = () => {
        void worker.terminate();
        settle(() =>
          reject(
            this.buildRetryableParseException(
              "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
            ),
          ),
        );
      };

      signal.addEventListener("abort", abortHandler, { once: true });

      worker.once("message", (message: ParseWorkerMessage) => {
        settle(() => {
          if (message.ok) {
            resolve(message.rows);
            return;
          }

          reject(new BadRequestException(message.message));
        });
      });

      worker.once("error", (error) => {
        settle(() => reject(error));
      });

      worker.once("exit", (code) => {
        if (code === 0 || settled) {
          return;
        }

        settle(() =>
          reject(
            new BadRequestException(
              `Power BI export calisma sayfasi okunamadi: ${
                file.originalname || "unknown-file"
              }`,
            ),
          ),
        );
      });
    });
  }

  private safeFileExtension(fileName: string): string {
    const match = /\.[a-z0-9]+$/i.exec(fileName.trim());
    return match ? match[0].slice(1).toLowerCase() : "unknown";
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
        this.normalizeKey(personName) === "estore" ||
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
            ? this.roundMetric(aggregate.derivedTicketCount)
            : null,
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "ATV",
          this.divideMetric(aggregate.grossSales, aggregate.derivedTicketCount),
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "UPT",
          this.divideMetric(aggregate.itemCount, aggregate.derivedTicketCount),
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

      const aggregateKey = this.normalizeKey(storeName);
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
      const atv = this.divideMetric(aggregate.netSales, aggregate.ticketCount);
      const upt = this.divideMetric(aggregate.itemCount, aggregate.ticketCount);
      const cr = this.divideMetric(aggregate.ticketCount, aggregate.footfall);

      return [
        this.buildStoreMetricRow(
          "TARGET_ACHIEVEMENT",
          aggregate.netSales > 0 ? this.roundMetric(aggregate.netSales) : null,
          aggregate.targetValue > 0 ? this.roundMetric(aggregate.targetValue) : null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "NET_SALES",
          aggregate.netSales > 0 ? this.roundMetric(aggregate.netSales) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "ITEM_COUNT",
          aggregate.itemCount > 0 ? this.roundMetric(aggregate.itemCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "TICKET_COUNT",
          aggregate.ticketCount > 0 ? this.roundMetric(aggregate.ticketCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "FF",
          aggregate.footfall > 0 ? this.roundMetric(aggregate.footfall) : null,
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
      personnelGrossSales: this.roundMetric(aggregate.grossSales),
      personnelPositiveItemCount: this.roundMetric(aggregate.itemCount),
      personnelDerivedTicketCount: this.roundMetric(aggregate.derivedTicketCount),
      denominatorConflictCount: aggregate.denominatorConflictCount,
      sourceRows: aggregate.rows,
    };
  }

  private buildStoreSourceRow(aggregate: StoreAggregate): Record<string, unknown> {
    const recomputedCr = this.divideMetric(aggregate.ticketCount, aggregate.footfall);

    return {
      sourceKind: "store_net_sales",
      storeName: aggregate.storeName,
      sourceRowCount: aggregate.rows.length,
      storeNetSales: this.roundMetric(aggregate.netSales),
      storeTargetValue: this.roundMetric(aggregate.targetValue),
      storeItemCount: this.roundMetric(aggregate.itemCount),
      storeTicketCount: this.roundMetric(aggregate.ticketCount),
      storeFootfall: this.roundMetric(aggregate.footfall),
      recomputedAtv: this.divideMetric(aggregate.netSales, aggregate.ticketCount),
      recomputedUpt: this.divideMetric(aggregate.itemCount, aggregate.ticketCount),
      recomputedCr,
      recomputedCrDisplayPercent:
        recomputedCr === null ? null : this.roundMetric(recomputedCr * 100),
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
        this.normalizeKey(personName ?? "") !== "estore" &&
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
        this.normalizeKey(personName ?? "") !== "estore" &&
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

  private buildReconciliationSummary(
    storeRows: ExportRow[],
    personnelRows: ExportRow[],
    storeScope: KpiImportStoreScope,
  ) {
    const storeNetSalesByKey = new Map<string, { storeName: string; storeNetSales: number }>();
    const personnelMovementByKey = new Map<string, ReconciliationMovement>();

    for (const row of storeRows) {
      const storeName = this.getStoreName(row);
      if (
        !storeName ||
        this.isSummaryText(storeName) ||
        !this.isStoreInKpiImportScope(storeName, storeScope)
      ) {
        continue;
      }

      const key = this.normalizeKey(storeName);
      const existing = storeNetSalesByKey.get(key) ?? { storeName, storeNetSales: 0 };
      existing.storeNetSales += this.getStoreNetSales(row) ?? 0;
      storeNetSalesByKey.set(key, existing);
    }

    for (const row of personnelRows) {
      const personName = this.getPersonName(row);
      const storeName = this.getStoreName(row);
      const salesAmount = this.getPersonnelSalesAmount(row);
      if (
        !personName ||
        !storeName ||
        this.isSummaryText(personName) ||
        !this.isStoreInKpiImportScope(storeName, storeScope) ||
        salesAmount === null ||
        salesAmount === 0
      ) {
        continue;
      }

      const key = this.normalizeKey(storeName);
      const movement =
        personnelMovementByKey.get(key) ??
        {
          storeName,
          personnelPositiveSales: 0,
          personnelNegativeMovements: 0,
        };

      if (salesAmount > 0 && this.normalizeKey(personName) !== "estore") {
        movement.personnelPositiveSales += salesAmount;
      }
      if (salesAmount < 0) {
        movement.personnelNegativeMovements += salesAmount;
      }
      personnelMovementByKey.set(key, movement);
    }

    const items = [...storeNetSalesByKey.entries()].flatMap(([key, store]) => {
      const movement = personnelMovementByKey.get(key);
      if (!movement) {
        return [];
      }

      const personnelPositiveSales = this.roundMetric(movement.personnelPositiveSales);
      const personnelNegativeMovements = this.roundMetric(
        movement.personnelNegativeMovements,
      );
      const personnelNetMovement = this.roundMetric(
        personnelPositiveSales + personnelNegativeMovements,
      );
      const storeNetSales = this.roundMetric(store.storeNetSales);
      const reconciliationDelta = this.roundMetric(storeNetSales - personnelNetMovement);
      const status = Math.abs(reconciliationDelta) <= 0.01 ? "balanced" : "warning";

      return [
        {
          storeExternalRef: store.storeName,
          storeNetSales,
          personnelPositiveSales,
          personnelNegativeMovements,
          personnelNetMovement,
          reconciliationDelta,
          status,
        },
      ];
    });

    return {
      comparedStoreCount: items.length,
      balancedStoreCount: items.filter((item) => item.status === "balanced").length,
      warningStoreCount: items.filter((item) => item.status === "warning").length,
      items,
    };
  }

  private getPersonName(row: ExportRow) {
    return this.getText(row, ["Adi", "Adı"]);
  }

  private getStoreName(row: ExportRow) {
    return this.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);
  }

  private getStoreNetSales(row: ExportRow) {
    return this.getNumber(row, ["Ciro"]);
  }

  private getStoreTarget(row: ExportRow) {
    return this.getNumber(row, ["Hedef"]);
  }

  private getStoreItemCount(row: ExportRow) {
    return this.getNumber(row, ["SatisAdedi", "Satis Adedi", "Satış Adedi"]);
  }

  private getStoreTicketCount(row: ExportRow) {
    return this.getNumber(row, ["FaturaSayisi", "Fatura Sayisi", "Fatura Sayısı"]);
  }

  private getStoreFootfall(row: ExportRow) {
    return this.getNumber(row, ["FF", "Footfall"]);
  }

  private getPersonnelSalesAmount(row: ExportRow) {
    return this.getNumber(row, ["SatisTutari", "Satış Tutarı"]);
  }

  private getPersonnelItemCount(row: ExportRow) {
    return this.getNumber(row, ["PSatisAdeti", "P. Satis Adeti", "P. Satış Adeti"]);
  }

  private derivePersonnelTicketCount(row: ExportRow) {
    const salesAmount = this.getPersonnelSalesAmount(row);
    const itemCount = this.getPersonnelItemCount(row);
    const reportedAtv = this.getNumber(row, ["PATV", "P.ATV"]);
    const reportedUpt = this.getNumber(row, ["PUPT", "P.UPT"]);

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
      ticketCount: ticketCount === null ? null : this.roundMetric(ticketCount),
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

    const normalized = this.normalizeKey(value);
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
          .map((value) => this.normalizeKey(value)),
      ),
    };
  }

  private isStoreInKpiImportScope(storeName: string, storeScope: KpiImportStoreScope) {
    return storeScope.externalRefKeys.has(this.normalizeKey(storeName));
  }

  private getText(row: ExportRow, aliases: string[]) {
    const value = this.getValue(row, aliases);
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }

  private getNumber(row: ExportRow, aliases: string[]) {
    const value = this.getValue(row, aliases);
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value)
      .replace(/\s+/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private roundMetric(value: number) {
    return Number(value.toFixed(4));
  }

  private divideMetric(numerator: number, denominator: number) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return this.roundMetric(numerator / denominator);
  }

  private getValue(row: ExportRow, aliases: string[]) {
    const aliasSet = new Set(aliases.map((alias) => this.normalizeKey(alias)));

    for (const [key, value] of Object.entries(row)) {
      if (aliasSet.has(this.normalizeKey(key))) {
        return value;
      }
    }

    return null;
  }

  private normalizeKey(value: string) {
    return value
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
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
