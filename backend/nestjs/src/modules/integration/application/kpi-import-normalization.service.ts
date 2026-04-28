import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

type KpiImportSourceSystem = "nebim_v3" | "power_bi" | "manual" | "other";

type NormalizeKpiImportInput = {
  sourceSystem: KpiImportSourceSystem;
  sourceCapturedAt?: string;
  sourceWindowStartedAt?: string;
  sourceWindowEndedAt?: string;
  rows: Record<string, unknown>[];
};

type MetricCandidate = {
  code: string;
  aliases: string[];
  defaultScopeType: "store" | "employee";
};

const KPI_METRIC_CANDIDATES: MetricCandidate[] = [
  {
    code: "ATV",
    aliases: ["atv", "averageTicketValue", "avgTicketValue", "ortalamaFaturaTutari"],
    defaultScopeType: "employee",
  },
  {
    code: "UPT",
    aliases: ["upt", "unitsPerTicket", "averageUnitPerTicket", "ortalamaUrunAdedi"],
    defaultScopeType: "employee",
  },
  {
    code: "TICKET_COUNT",
    aliases: ["ticketCount", "receiptCount", "transactionCount", "fisSayisi", "faturaSayisi"],
    defaultScopeType: "employee",
  },
  {
    code: "ITEM_COUNT",
    aliases: ["itemCount", "unitCount", "unitsSold", "urunAdedi", "adet"],
    defaultScopeType: "employee",
  },
  {
    code: "FF",
    aliases: ["ff", "footfall", "visitorCount", "trafficCount", "musteriGiris"],
    defaultScopeType: "store",
  },
  {
    code: "CR",
    aliases: ["cr", "conversionRate", "customerConversionRate", "donusumOrani"],
    defaultScopeType: "store",
  },
  {
    code: "NET_SALES",
    aliases: ["netSales", "netAmount", "netRevenue", "sales", "ciro", "netTutar"],
    defaultScopeType: "employee",
  },
  {
    code: "BM_CHECKLIST",
    aliases: ["bmChecklist", "bmChecklistScore", "bmChecklistPuan"],
    defaultScopeType: "store",
  },
  {
    code: "VM_CHECKLIST",
    aliases: ["vmChecklist", "vmChecklistScore", "vmChecklistPuan"],
    defaultScopeType: "store",
  },
];

@Injectable()
export class KpiImportNormalizationService {
  normalize(input: NormalizeKpiImportInput): Record<string, unknown>[] {
    return input.rows.flatMap((row) => this.normalizeRow(row, input));
  }

  private normalizeRow(
    row: Record<string, unknown>,
    input: NormalizeKpiImportInput,
  ): Record<string, unknown>[] {
    if (this.looksCanonical(row)) {
      return [this.normalizeCanonicalRow(row, input)];
    }

    if (input.sourceSystem === "nebim_v3" || input.sourceSystem === "power_bi") {
      return this.expandMetricColumns(row, input);
    }

    return [this.normalizeCanonicalRow(row, input)];
  }

  private looksCanonical(row: Record<string, unknown>) {
    return (
      this.hasValue(row["actualValue"]) &&
      (this.hasValue(row["kpiCode"]) || this.hasValue(row["sourceMetricId"]) || this.hasValue(row["kpiId"]))
    );
  }

  private normalizeCanonicalRow(
    row: Record<string, unknown>,
    input: Omit<NormalizeKpiImportInput, "rows">,
  ): Record<string, unknown> {
    const periodStart = this.resolvePeriodStart(row, input);
    const periodEnd = this.resolvePeriodEnd(row, input, periodStart);
    const sourceMetricId = this.resolveMetricCode(row);
    const kpiCode = this.resolveKpiCode(row, sourceMetricId);
    const scopeType =
      this.getString(row, ["scopeType"]) ??
      (this.hasValue(this.resolveEmployeeExternalRef(row)) ? "employee" : "store");

    const normalizedRow = {
      ...row,
      kpiCode,
      sourceMetricId,
      scopeType,
      storeExternalRef:
        this.resolveStoreExternalRef(row) ??
        this.getString(row, ["storeExternalRef"]) ??
        this.getString(row, ["sourceStoreId"]),
      employeeExternalRef:
        scopeType === "employee"
          ? this.resolveEmployeeExternalRef(row) ??
            this.getString(row, ["employeeExternalRef"]) ??
            this.getString(row, ["sourceEmployeeId"])
          : null,
      actualValue: this.resolveNumericValue(row),
      periodType: this.getString(row, ["periodType"]) ?? "daily",
      periodStart,
      periodEnd,
      sourceSystem: input.sourceSystem,
      sourceCapturedAt: row["sourceCapturedAt"] ?? input.sourceCapturedAt ?? null,
    };

    return this.withSourceLineage(normalizedRow, row);
  }

  private expandMetricColumns(
    row: Record<string, unknown>,
    input: Omit<NormalizeKpiImportInput, "rows">,
  ): Record<string, unknown>[] {
    const storeExternalRef = this.resolveStoreExternalRef(row);
    const employeeExternalRef = this.resolveEmployeeExternalRef(row);
    const periodStart = this.resolvePeriodStart(row, input);
    const periodEnd = this.resolvePeriodEnd(row, input, periodStart);
    const periodType = this.getString(row, ["periodType"]) ?? "daily";

    return KPI_METRIC_CANDIDATES.flatMap((metric) => {
      const metricValue = this.getNumber(row, metric.aliases);
      if (metricValue === null) {
        return [];
      }

      const scopeType = metric.defaultScopeType === "employee" && employeeExternalRef ? "employee" : "store";
      const normalizedRow = {
        kpiCode: metric.code,
        sourceMetricId: metric.code,
        actualValue: metricValue,
        scopeType,
        storeExternalRef,
        employeeExternalRef: scopeType === "employee" ? employeeExternalRef : null,
        periodType,
        periodStart,
        periodEnd,
        sourceSystem: input.sourceSystem,
        sourceCapturedAt: input.sourceCapturedAt ?? null,
        sourceRow: row,
      };

      return [this.withSourceLineage(normalizedRow, { metricCode: metric.code, sourceRow: row })];
    });
  }

  private withSourceLineage(
    row: Record<string, unknown>,
    hashInput: Record<string, unknown>,
  ): Record<string, unknown> {
    const rowHash = this.getString(row, ["rowHash"]) ?? this.hashStable(hashInput);
    const rawRowReference =
      this.getString(row, ["rawRowReference"]) ?? this.buildRawRowReference(row);

    return {
      ...row,
      rowHash,
      rawRowReference,
    };
  }

  private buildRawRowReference(row: Record<string, unknown>) {
    const employeeExternalRef = this.getString(row, ["employeeExternalRef"]);
    return [
      this.getString(row, ["sourceSystem"]) ?? "unknown_source",
      this.getString(row, ["sourceMetricId", "kpiCode"]) ?? "unknown_metric",
      this.getString(row, ["periodType"]) ?? "daily",
      this.getString(row, ["periodStart"]) ?? "unknown_start",
      this.getString(row, ["periodEnd"]) ?? "unknown_end",
      this.getString(row, ["storeExternalRef"]) ?? "unknown_store",
      employeeExternalRef ?? "store",
    ].join(":");
  }

  private hashStable(value: unknown) {
    return createHash("sha256").update(this.stableStringify(value)).digest("hex");
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
    }

    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      );
      return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`)
        .join(",")}}`;
    }

    return JSON.stringify(value);
  }

  private resolveMetricCode(row: Record<string, unknown>) {
    return (
      this.getString(row, ["sourceMetricId", "metricId", "metricCode", "kpiCode", "kpiName"]) ??
      "unknown"
    );
  }

  private resolveKpiCode(row: Record<string, unknown>, sourceMetricId: string) {
    return this.getString(row, ["kpiCode", "metricCode"]) ?? this.toMetricCode(sourceMetricId);
  }

  private resolveStoreExternalRef(row: Record<string, unknown>) {
    return this.getString(row, [
      "storeExternalRef",
      "sourceStoreId",
      "storeCode",
      "storeId",
      "magazaKodu",
      "magazaKod",
    ]);
  }

  private resolveEmployeeExternalRef(row: Record<string, unknown>) {
    return this.getString(row, [
      "employeeExternalRef",
      "sourceEmployeeId",
      "employeeId",
      "sellerCode",
      "sellerId",
      "saticiKodu",
      "saticiKod",
      "saticiRumuzu",
    ]);
  }

  private resolveNumericValue(row: Record<string, unknown>) {
    const directValue = this.getNumber(row, ["actualValue", "metricValue", "value", "amount"]);
    return directValue ?? 0;
  }

  private resolvePeriodStart(
    row: Record<string, unknown>,
    input: Omit<NormalizeKpiImportInput, "rows">,
  ) {
    return (
      this.getDateString(row, ["periodStart", "date", "businessDate"]) ??
      this.toDateOnly(input.sourceWindowStartedAt) ??
      this.toDateOnly(input.sourceCapturedAt) ??
      this.todayDateOnly()
    );
  }

  private resolvePeriodEnd(
    row: Record<string, unknown>,
    input: Omit<NormalizeKpiImportInput, "rows">,
    periodStart: string,
  ) {
    return (
      this.getDateString(row, ["periodEnd", "date", "businessDate"]) ??
      this.toDateOnly(input.sourceWindowEndedAt) ??
      this.toDateOnly(input.sourceCapturedAt) ??
      periodStart
    );
  }

  private getString(row: Record<string, unknown>, aliases: string[]) {
    const value = this.getValue(row, aliases);
    if (!this.hasValue(value)) {
      return null;
    }

    return String(value).trim();
  }

  private getNumber(row: Record<string, unknown>, aliases: string[]) {
    const value = this.getValue(row, aliases);
    if (!this.hasValue(value)) {
      return null;
    }

    const normalized = Number(String(value).replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  private getDateString(row: Record<string, unknown>, aliases: string[]) {
    const value = this.getString(row, aliases);
    return value ? this.toDateOnly(value) : null;
  }

  private getValue(row: Record<string, unknown>, aliases: string[]) {
    const normalizedEntries = new Map(
      Object.entries(row).map(([key, value]) => [this.normalizeKey(key), value]),
    );

    for (const alias of aliases) {
      const value = normalizedEntries.get(this.normalizeKey(alias));
      if (value !== undefined) {
        return value;
      }
    }

    return undefined;
  }

  private normalizeKey(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
  }

  private toMetricCode(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
  }

  private toDateOnly(value?: string | null) {
    if (!value) {
      return null;
    }

    return new Date(value).toISOString().slice(0, 10);
  }

  private todayDateOnly() {
    return new Date().toISOString().slice(0, 10);
  }

  private hasValue(value: unknown) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }
}
