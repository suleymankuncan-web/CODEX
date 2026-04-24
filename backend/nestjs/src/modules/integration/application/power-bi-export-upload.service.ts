import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "@e965/xlsx";
import { DatabaseService } from "../../../shared/database/database.service";
import { buildCommandResponse } from "../../../shared/http/response-builders";
import { logStructuredError } from "../../../shared/structured-log";
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { IntegrationService } from "./integration.service";

type UploadFile = {
  originalname: string;
  buffer: Buffer;
};

type ExportRow = Record<string, unknown>;

type CanonicalKpiRow = {
  kpiCode: string;
  sourceMetricId: string;
  actualValue: number;
  targetValue?: number | null;
  scopeType: "store" | "employee";
  storeExternalRef: string;
  employeeExternalRef: string | null;
  periodType: "monthly";
  periodStart: string;
  periodEnd: string;
  sourceCapturedAt: string;
  sourceRow: Record<string, unknown>;
};

@Injectable()
export class PowerBiExportUploadService {
  private readonly logger = new Logger(PowerBiExportUploadService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly integrationRepository: IntegrationRepository,
    private readonly integrationService: IntegrationService,
  ) {}

  async upload(input: {
    sourceCode: string;
    periodMonth: string;
    actorUserId: string;
    personnelFile?: UploadFile | null;
    storeFile?: UploadFile | null;
  }) {
    try {
      if (!input.personnelFile && !input.storeFile) {
        throw new BadRequestException("En az bir Power BI export dosyasi yuklenmeli");
      }

      const source = await this.integrationRepository.getIntegrationSourceByCodeAndEntity(
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

      const periodBounds = this.getMonthBounds(input.periodMonth);
      const sourceCapturedAt = new Date().toISOString();

      const personnelRows = input.personnelFile
        ? this.readSheetRows(input.personnelFile)
        : [];
      const storeRows = input.storeFile ? this.readSheetRows(input.storeFile) : [];

      const canonicalRows = [
        ...this.mapPersonnelRows(personnelRows, periodBounds, sourceCapturedAt),
        ...this.mapStoreRows(storeRows, periodBounds, sourceCapturedAt),
      ];

      if (canonicalRows.length === 0) {
        throw new BadRequestException(
          "Yuklenen dosyalarda import edilebilir KPI satiri bulunamadi",
        );
      }

      await this.ensureTemporaryMappings({
        integrationSourceId: source.integration_source_id,
        rows: canonicalRows,
      });

      const payloadHash = createHash("sha256")
        .update(JSON.stringify(canonicalRows))
        .digest("hex");
      const sourceBatchId = `power-bi-export-${input.periodMonth}-${Date.now()}`;
      const fileReference = [input.personnelFile?.originalname, input.storeFile?.originalname]
        .filter(Boolean)
        .join(" + ");

      const batch = await this.integrationService.createImportBatch({
        sourceCode: input.sourceCode,
        entityType: "kpi",
        fileReference,
        actorUserId: input.actorUserId,
        sourceBatchId,
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
            periodMonth: input.periodMonth,
            personnelRowsRead: personnelRows.length,
            storeRowsRead: storeRows.length,
            canonicalRowCount: canonicalRows.length,
            ignoredPersonnelRows: this.countIgnoredPersonnelRows(personnelRows),
            ignoredStoreRows: this.countIgnoredStoreRows(storeRows),
            temporaryMappingMode: "storeName + name/storeName fallback",
          },
        },
        job: batch.job,
      });
    } catch (error) {
      logStructuredError(this.logger, "power_bi_export_upload.failed", error, {
        sourceCode: input.sourceCode,
        periodMonth: input.periodMonth,
        hasPersonnelFile: Boolean(input.personnelFile),
        hasStoreFile: Boolean(input.storeFile),
      });
      throw error;
    }
  }

  private readSheetRows(file: UploadFile): ExportRow[] {
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        `Dosya okunamadi: ${file.originalname || "unknown-file"}`,
      );
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return [];
    }

    const sheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json<ExportRow>(sheet, {
      raw: true,
      defval: "",
    });
  }

  private mapPersonnelRows(
    rows: ExportRow[],
    period: { periodStart: string; periodEnd: string },
    sourceCapturedAt: string,
  ): CanonicalKpiRow[] {
    return rows.flatMap((row) => {
      const personName = this.getText(row, ["Adi", "Adı"]);
      const storeName = this.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);

      if (!personName || !storeName || this.normalizeKey(personName) === "estore") {
        return [];
      }

      return [
        this.buildEmployeeMetricRow(
          "NET_SALES",
          this.getNumber(row, ["SatisTutari", "Satış Tutarı"]),
          personName,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildEmployeeMetricRow(
          "ATV",
          this.getNumber(row, ["PATV", "P.ATV"]),
          personName,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildEmployeeMetricRow(
          "UPT",
          this.getNumber(row, ["PUPT", "P.UPT"]),
          personName,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
      ].filter((item): item is CanonicalKpiRow => item !== null);
    });
  }

  private mapStoreRows(
    rows: ExportRow[],
    period: { periodStart: string; periodEnd: string },
    sourceCapturedAt: string,
  ): CanonicalKpiRow[] {
    return rows.flatMap((row) => {
      const storeName = this.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);
      if (!storeName) {
        return [];
      }

      return [
        this.buildStoreMetricRow(
          "TARGET_ACHIEVEMENT",
          this.getNumber(row, ["Ciro"]),
          this.getNumber(row, ["Hedef"]),
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildStoreMetricRow(
          "NET_SALES",
          this.getNumber(row, ["Ciro"]),
          null,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildStoreMetricRow(
          "CR",
          this.getNumber(row, ["CR"]),
          null,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildStoreMetricRow(
          "ATV",
          this.getNumber(row, ["ATV"]),
          null,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
        this.buildStoreMetricRow(
          "UPT",
          this.getNumber(row, ["UPT"]),
          null,
          storeName,
          period,
          sourceCapturedAt,
          row,
        ),
      ].filter((item): item is CanonicalKpiRow => item !== null);
    });
  }

  private buildEmployeeMetricRow(
    kpiCode: string,
    actualValue: number | null,
    personName: string,
    storeName: string,
    period: { periodStart: string; periodEnd: string },
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
      employeeExternalRef: this.buildEmployeeExternalRef(personName, storeName),
      periodType: "monthly",
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
    period: { periodStart: string; periodEnd: string },
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
      periodType: "monthly",
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      sourceCapturedAt,
      sourceRow,
    };
  }

  private async ensureTemporaryMappings(input: {
    integrationSourceId: string;
    rows: CanonicalKpiRow[];
  }) {
    const org = await this.getDefaultOrg();
    const storeNames = [...new Set(input.rows.map((row) => row.storeExternalRef))];
    const employeeExternalRefs = [
      ...new Set(
        input.rows
          .map((row) => row.employeeExternalRef)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    for (const storeName of storeNames) {
      const mappedStoreId = await this.resolveMappedId(
        input.integrationSourceId,
        "store",
        storeName,
      );

      if (mappedStoreId) {
        continue;
      }

      const storeId = await this.findOrCreateTemporaryStore(storeName, org);
      await this.databaseService.query(
        `
          INSERT INTO stg.external_id_map (
            integration_source_id,
            entity_type,
            external_id,
            internal_id,
            internal_table_name,
            is_active
          )
          VALUES ($1::uuid, 'store', $2, $3::uuid, 'ops.store', TRUE)
          ON CONFLICT (integration_source_id, entity_type, external_id) DO UPDATE
          SET internal_id = EXCLUDED.internal_id, is_active = TRUE
        `,
        [input.integrationSourceId, storeName, storeId],
      );
    }

    for (const employeeExternalRef of employeeExternalRefs) {
      const mappedEmployeeId = await this.resolveMappedId(
        input.integrationSourceId,
        "employee",
        employeeExternalRef,
      );

      if (mappedEmployeeId) {
        continue;
      }

      const employeeId = await this.findOrCreateTemporaryEmployee(
        employeeExternalRef,
        org.companyId,
      );
      await this.databaseService.query(
        `
          INSERT INTO stg.external_id_map (
            integration_source_id,
            entity_type,
            external_id,
            internal_id,
            internal_table_name,
            is_active
          )
          VALUES ($1::uuid, 'employee', $2, $3::uuid, 'ops.employee', TRUE)
          ON CONFLICT (integration_source_id, entity_type, external_id) DO UPDATE
          SET internal_id = EXCLUDED.internal_id, is_active = TRUE
        `,
        [input.integrationSourceId, employeeExternalRef, employeeId],
      );
    }
  }

  private async getDefaultOrg() {
    const result = await this.databaseService.query<{
      company_id: string;
      region_id: string;
    }>(
      `
        SELECT c.company_id, r.region_id
        FROM ops.company c
        INNER JOIN ops.region r
          ON r.company_id = c.company_id
        ORDER BY c.created_at ASC, r.created_at ASC
        LIMIT 1
      `,
    );

    if (result.rowCount === 0) {
      throw new BadRequestException(
        "Gecici Power BI import icin company/region bulunamadi",
      );
    }

    return {
      companyId: result.rows[0].company_id,
      regionId: result.rows[0].region_id,
    };
  }

  private async findOrCreateTemporaryStore(
    storeName: string,
    org: { companyId: string; regionId: string },
  ) {
    const existing = await this.databaseService.query<{ store_id: string }>(
      `
        SELECT store_id
        FROM ops.store
        WHERE store_name = $1
        LIMIT 1
      `,
      [storeName],
    );

    if (Number(existing.rowCount ?? 0) > 0) {
      return existing.rows[0].store_id;
    }

    const storeId = randomUUID();
    const storeCode = `PBI-${createHash("md5")
      .update(storeName)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase()}`;
    await this.databaseService.query(
      `
        INSERT INTO ops.store (
          store_id,
          company_id,
          region_id,
          store_code,
          store_name,
          store_type,
          status,
          timezone
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 'power_bi_temp', 'active', 'Europe/Istanbul')
      `,
      [storeId, org.companyId, org.regionId, storeCode, storeName],
    );

    return storeId;
  }

  private async findOrCreateTemporaryEmployee(
    employeeExternalRef: string,
    companyId: string,
  ) {
    const existing = await this.databaseService.query<{ employee_id: string }>(
      `
        SELECT employee_id
        FROM ops.employee
        WHERE external_employee_ref = $1
        LIMIT 1
      `,
      [employeeExternalRef],
    );

    if (Number(existing.rowCount ?? 0) > 0) {
      return existing.rows[0].employee_id;
    }

    const employeeId = randomUUID();
    const namePart = employeeExternalRef
      .replace(/^powerbi:/i, "")
      .split("::")[0]
      .trim();
    const segments = namePart.split(/\s+/).filter(Boolean);
    const firstName = segments[0] ?? "Temp";
    const lastName = segments.slice(1).join(" ") || "Personnel";

    await this.databaseService.query(
      `
        INSERT INTO ops.employee (
          employee_id,
          company_id,
          external_employee_ref,
          first_name,
          last_name,
          hire_date,
          employment_status,
          employment_type
        )
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, CURRENT_DATE, 'active', 'full_time')
      `,
      [employeeId, companyId, employeeExternalRef, firstName, lastName],
    );

    return employeeId;
  }

  private async resolveMappedId(
    integrationSourceId: string,
    entityType: "store" | "employee",
    externalId: string,
  ) {
    const result = await this.databaseService.query<{ internal_id: string }>(
      `
        SELECT internal_id
        FROM stg.external_id_map
        WHERE integration_source_id = $1::uuid
          AND entity_type = $2
          AND external_id = $3
          AND is_active = TRUE
        LIMIT 1
      `,
      [integrationSourceId, entityType, externalId],
    );

    return result.rows[0]?.internal_id ?? null;
  }

  private buildEmployeeExternalRef(personName: string, storeName: string) {
    return `powerbi:${personName}::${storeName}`;
  }

  private getMonthBounds(periodMonth: string) {
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      throw new BadRequestException("Donem ayi YYYY-MM formatinda olmali");
    }

    const [yearText, monthText] = periodMonth.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const periodStartDate = new Date(Date.UTC(year, monthIndex, 1));
    const periodEndDate = new Date(Date.UTC(year, monthIndex + 1, 0));

    return {
      periodStart: periodStartDate.toISOString().slice(0, 10),
      periodEnd: periodEndDate.toISOString().slice(0, 10),
    };
  }

  private countIgnoredPersonnelRows(rows: ExportRow[]) {
    return rows.filter((row) => {
      const personName = this.getText(row, ["Adi", "Adı"]);
      const storeName = this.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]);
      return !personName || !storeName || this.normalizeKey(personName) === "estore";
    }).length;
  }

  private countIgnoredStoreRows(rows: ExportRow[]) {
    return rows.filter(
      (row) => !this.getText(row, ["MagazaAdi", "Magaza Adi", "Mağaza Adı"]),
    ).length;
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
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }
}
