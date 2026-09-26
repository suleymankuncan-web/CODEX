import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import * as XLSX from "xlsx-js-style";
import { RankingService } from "./ranking.service";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import { StoreMonthlyReportPackageRepository } from "../infrastructure/store-monthly-report-package.repository";
import {
  StoreMonthlyReportPackageItem,
  StoreMonthlyReportPackageRow,
  StoreMonthlyReportPackageScope,
  StoreMonthlyReportPackageSection,
  StoreMonthlyReportPackageSummary,
  StoreMonthlyReportWorkbook,
} from "../infrastructure/store-monthly-report-package.types";

const EMPTY_VALUE = "Veri yok";

type StyledWorksheet = XLSX.WorkSheet & {
  "!autofilter"?: { ref: string };
};

type StyledCell = XLSX.CellObject & {
  s?: Record<string, unknown>;
};

const WORKBOOK_HEADER_STYLE = {
  fill: { fgColor: { rgb: "3F2A8C" }, patternType: "solid" },
  font: { bold: true, color: { rgb: "FFFFFF" } },
  alignment: { horizontal: "center", vertical: "center" },
};

const WORKBOOK_STATUS_STYLES = {
  good: {
    fill: { fgColor: { rgb: "DDF8ED" }, patternType: "solid" },
    font: { bold: true, color: { rgb: "087751" } },
  },
  warning: {
    fill: { fgColor: { rgb: "FFF3D6" }, patternType: "solid" },
    font: { bold: true, color: { rgb: "A35B00" } },
  },
  danger: {
    fill: { fgColor: { rgb: "FFE6EE" }, patternType: "solid" },
    font: { bold: true, color: { rgb: "C52D54" } },
  },
  muted: {
    fill: { fgColor: { rgb: "F2F4F8" }, patternType: "solid" },
    font: { color: { rgb: "65708D" } },
  },
};

const WORKBOOK_STATUS_COLUMN_INDEXES = [13, 14, 15, 16, 17, 18, 21];

const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export const STORE_MONTHLY_REPORT_PACKAGE_HEADERS = [
  "Bölge Müdürü",
  "Mağaza",
  "Bölge",
  "Dönem",
  "Rapor aralığı",
  "Skor",
  "UPT",
  "ATV",
  "CR",
  "HG%",
  "GSM",
  "BM Checklist",
  "VM Checklist",
  "Aksiyon durumu",
  "Hedef durumu",
  "Prim durumu",
  "Norm / Fiili",
  "Eksik gün",
  "Turnover",
  "Son ziyaret",
  "Ziyaretten geçen gün",
  "Veri notu",
];

export function getIstanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function resolveMonthlyRange(period: string, today = getIstanbulToday()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new BadRequestException("Dönem YYYY-AA formatında olmalı");
  }

  const [year, month] = period.split("-").map(Number);
  const periodStart = `${period}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fullPeriodEnd = `${period}-${String(lastDay).padStart(2, "0")}`;
  const currentMonth = today.slice(0, 7) === period;
  const futureMonth = period > today.slice(0, 7);

  if (futureMonth) {
    throw new BadRequestException("Gelecek dönem raporu indirilemez");
  }

  return {
    periodStart,
    periodEnd: currentMonth ? today : fullPeriodEnd,
    isCurrentPeriod: currentMonth,
  };
}

type StoreMonthlyReportPackageInput = StoreMonthlyReportPackageScope & {
  period: string;
  requestedRegionManagerUserId?: string;
  today?: string;
  rankingContext?: {
    userId: string;
    employeeId?: string;
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
  };
};

@Injectable()
export class StoreMonthlyReportPackageService {
  constructor(
    private readonly storeMonthlyReportPackageRepository: StoreMonthlyReportPackageRepository,
    @Optional()
    private readonly rankingService?: RankingService,
    @Optional()
    private readonly managerDirectoryRepository?: RankingReportingReadRepository,
  ) {}

  async getSummary(input: StoreMonthlyReportPackageInput): Promise<StoreMonthlyReportPackageSummary> {
    const range = resolveMonthlyRange(input.period, input.today);
    const managerFilter = input.requestedRegionManagerUserId
      ? { selectedStoreIds: await this.resolveSelectedManagerStores(input) }
      : {};
    const rows = await this.storeMonthlyReportPackageRepository.getStoreMonthlyReportPackageRows({
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      regionManagerUserId: input.regionManagerUserId,
      ...managerFilter,
    });
    const scoreByStoreId = await this.getRankingScoresByStoreId({
      input,
      periodStart: range.periodStart,
      storeIds: rows.map((row) => row.store_id),
    });
    const periodLabel = formatPeriodLabel(input.period);
    const coverageLabel = formatCoverageLabel({
      period: input.period,
      periodEnd: range.periodEnd,
    });
    const items = rows.map((row) =>
      toPackageItem({
        row,
        periodLabel,
        coverageLabel,
        scoreValue: scoreByStoreId.get(row.store_id) ?? null,
      }),
    );

    return {
      period: input.period,
      periodLabel,
      coverageLabel,
      isCurrentPeriod: range.isCurrentPeriod,
      storeCount: items.length,
      sections: buildSections({
        periodLabel,
        storeCount: items.length,
      }),
      items,
    };
  }

  async buildWorkbook(input: StoreMonthlyReportPackageInput): Promise<StoreMonthlyReportWorkbook> {
    const summary = await this.getSummary(input);
    const worksheetRows = [
      STORE_MONTHLY_REPORT_PACKAGE_HEADERS,
      ...summary.items.map((item) => [
        item.regionManager,
        item.storeName,
        item.city,
        item.period,
        item.reportRange,
        item.score,
        item.upt,
        item.atv,
        item.cr,
        item.hg,
        item.gsm,
        item.bmChecklist,
        item.vmChecklist,
        item.actionStatus,
        item.targetStatus,
        item.incentiveStatus,
        item.normFiili,
        item.missingDays,
        item.turnover,
        item.lastVisit,
        item.daysSinceVisit,
        item.dataNote,
      ]),
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows) as StyledWorksheet;
    worksheet["!cols"] = STORE_MONTHLY_REPORT_PACKAGE_HEADERS.map((header) => ({
      wch: Math.max(14, Math.min(28, header.length + 6)),
    }));
    applyWorkbookPresentation(worksheet, worksheetRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mağaza İzleyiş");

    return {
      buffer: Buffer.from(
        XLSX.write(workbook, { bookType: "xlsx", cellStyles: true, type: "buffer" }),
      ),
      fileName: `magaza-izleyis-${input.period}.xlsx`,
    };
  }

  private async resolveSelectedManagerStores(input: StoreMonthlyReportPackageInput): Promise<string[]> {
    if (!input.companyIds.length || !this.managerDirectoryRepository) return [];
    const managers = await this.managerDirectoryRepository.listRegionManagerDirectory({ companyIds: input.companyIds });
    return managers.find(manager => manager.id === input.requestedRegionManagerUserId)?.storeIds ?? [];
  }

  private async getRankingScoresByStoreId(input: {
    input: StoreMonthlyReportPackageInput;
    periodStart: string;
    storeIds: string[];
  }) {
    const scopedStoreIds = new Set(input.storeIds);
    if (
      !this.rankingService ||
      !input.input.rankingContext ||
      scopedStoreIds.size === 0
    ) {
      return new Map<string, number>();
    }

    const ranking = await this.rankingService.getRankings({
      userId: input.input.rankingContext.userId,
      employeeId: input.input.rankingContext.employeeId,
      roleCodes: input.input.rankingContext.roleCodes,
      companyIds: input.input.rankingContext.companyIds,
      regionIds: input.input.rankingContext.regionIds,
      storeIds: input.input.rankingContext.storeIds,
      assignedStoreIds: input.input.rankingContext.assignedStoreIds,
      periodType: "monthly",
      periodStart: input.periodStart,
      limit: 500,
      offset: 0,
    });

    return new Map(
      ranking.storeLeaderboard.items
        .filter((item) => scopedStoreIds.has(item.storeId))
        .map((item) => [item.storeId, item.scoreValue]),
    );
  }
}

function applyWorkbookPresentation(
  worksheet: StyledWorksheet,
  worksheetRows: Array<Array<string>>,
) {
  if (worksheetRows.length === 0) {
    return;
  }

  const headerCount = worksheetRows[0].length;
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: 0 },
      e: { c: headerCount - 1, r: Math.max(0, worksheetRows.length - 1) },
    }),
  };

  for (let columnIndex = 0; columnIndex < headerCount; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ c: columnIndex, r: 0 });
    const cell = worksheet[cellAddress] as StyledCell | undefined;

    if (cell) {
      cell.s = WORKBOOK_HEADER_STYLE;
    }
  }

  for (let rowIndex = 1; rowIndex < worksheetRows.length; rowIndex += 1) {
    for (const columnIndex of WORKBOOK_STATUS_COLUMN_INDEXES) {
      const cellAddress = XLSX.utils.encode_cell({ c: columnIndex, r: rowIndex });
      const cell = worksheet[cellAddress] as StyledCell | undefined;
      const style = resolveStatusCellStyle(String(worksheetRows[rowIndex][columnIndex] ?? ""));

      if (cell && style) {
        cell.s = style;
      }
    }
  }
}

function resolveStatusCellStyle(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");

  if (
    normalized === EMPTY_VALUE.toLocaleLowerCase("tr-TR") ||
    normalized.includes("kayna") ||
    normalized.includes("veri yok")
  ) {
    return WORKBOOK_STATUS_STYLES.muted;
  }

  if (
    normalized.includes("devam") ||
    normalized.includes("bekliyor") ||
    normalized.includes("taslak") ||
    normalized.includes("eksik")
  ) {
    return WORKBOOK_STATUS_STYLES.warning;
  }

  if (
    normalized.includes("hata") ||
    normalized.includes("iade") ||
    normalized.includes("iptal")
  ) {
    return WORKBOOK_STATUS_STYLES.danger;
  }

  if (
    normalized.includes("bitirildi") ||
    normalized.includes("onayland") ||
    normalized.includes("kapand") ||
    normalized.includes("tamam") ||
    normalized === "yok"
  ) {
    return WORKBOOK_STATUS_STYLES.good;
  }

  return null;
}

function buildSections(input: {
  periodLabel: string;
  storeCount: number;
}): StoreMonthlyReportPackageSection[] {
  return [
    {
      code: "package",
      label: "Dönem paketi",
      value: "Birleşik Excel",
      status: "ready",
    },
    {
      code: "scope",
      label: "Kapsam",
      value: `${input.storeCount} mağaza`,
      status: input.storeCount > 0 ? "ready" : "partial",
    },
    {
      code: "detail",
      label: "Detay çıktı",
      value: `${STORE_MONTHLY_REPORT_PACKAGE_HEADERS.length} kolon`,
      status: "ready",
    },
    {
      code: "period",
      label: input.periodLabel,
      value: "Hazır",
      status: input.storeCount > 0 ? "ready" : "partial",
    },
  ];
}

function toPackageItem(input: {
  row: StoreMonthlyReportPackageRow;
  periodLabel: string;
  coverageLabel: string;
  scoreValue: number | null;
}): StoreMonthlyReportPackageItem {
  const normFiili = formatNormFiili(input.row);
  const missingDays = formatMissingDays(input.row);
  const turnover = formatTurnover(input.row);
  const scoreValue = input.scoreValue ?? input.row.score_value;
  const dataNotes = [
    scoreValue === null ? "Skor kaynağı yok" : null,
    turnover === EMPTY_VALUE ? "Turnover kaynağı yok" : null,
    normFiili === EMPTY_VALUE ? "Norm kaynağı yok" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    regionManager: valueOrEmpty(input.row.region_manager_name),
    storeName: valueOrEmpty(input.row.store_name),
    city: valueOrEmpty(input.row.region_name),
    period: input.periodLabel,
    reportRange: input.coverageLabel,
    score: formatNumber(scoreValue),
    upt: formatNumber(input.row.upt_value),
    atv: formatNumber(input.row.atv_value),
    cr: formatPercent(input.row.cr_value),
    hg: formatPercent(input.row.hg_value),
    gsm: formatPercent(input.row.gsm_value),
    bmChecklist: formatNumber(input.row.bm_checklist_score),
    vmChecklist: formatNumber(input.row.vm_checklist_score),
    actionStatus: formatActionStatus(input.row),
    targetStatus: formatTargetStatus(input.row.target_status),
    incentiveStatus: formatIncentiveStatus(input.row),
    normFiili,
    missingDays,
    turnover,
    lastVisit: formatDate(input.row.last_visit_date),
    daysSinceVisit: formatDaysSinceVisit(input.row.days_since_visit),
    dataNote: dataNotes.length > 0 ? dataNotes.join("; ") : "Tamam",
  };
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${TURKISH_MONTHS[month - 1]} ${year}`;
}

function formatCoverageLabel(input: { period: string; periodEnd: string }): string {
  const [, month] = input.period.split("-").map(Number);
  const endDay = Number(input.periodEnd.slice(8, 10));
  return `1-${endDay} ${TURKISH_MONTHS[month - 1]}`;
}

function valueOrEmpty(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : EMPTY_VALUE;
}

function formatNumber(value: string | number | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return EMPTY_VALUE;
  }

  return numericValue.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
  });
}

function formatPercent(value: string | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return EMPTY_VALUE;
  }

  const percentValue = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
  return `%${percentValue.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: percentValue % 1 === 0 ? 0 : 2,
  })}`;
}

function formatDate(value: string | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const [, month, day] = value.split("-").map(Number);
  if (!month || !day) {
    return EMPTY_VALUE;
  }

  return `${day} ${TURKISH_MONTHS[month - 1]}`;
}

function formatDaysSinceVisit(value: string | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return EMPTY_VALUE;
  }

  if (numericValue === 0) {
    return "Bugün";
  }

  return `${numericValue} gün`;
}

function formatActionStatus(row: StoreMonthlyReportPackageRow): string {
  const openCount = Number(row.open_action_count ?? 0);
  const closedCount = Number(row.closed_action_count ?? 0);

  if (openCount > 0) {
    return "Devam ediyor";
  }

  if (closedCount > 0) {
    return "Bitirildi";
  }

  return EMPTY_VALUE;
}

function formatTargetStatus(value: string | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const labels: Record<string, string> = {
    pending_region_approval: "Onay bekliyor",
    approved: "Onaylandı",
    rejected: "İade edildi",
    draft: "Taslak",
  };

  return labels[value] ?? value;
}

function formatIncentiveStatus(row: StoreMonthlyReportPackageRow): string {
  if (row.incentive_status === null && row.incentive_total_amount === null) {
    return EMPTY_VALUE;
  }

  const statusLabels: Record<string, string> = {
    queued: "Kapanış bekliyor",
    running: "Hesaplanıyor",
    succeeded: "Kapandı",
    failed: "Hata",
    cancelled: "İptal",
  };
  const status = row.incentive_status ? statusLabels[row.incentive_status] ?? row.incentive_status : "Kapandı";
  const amount = formatMoney(row.incentive_total_amount);

  return amount === EMPTY_VALUE ? status : `${status} / ${amount}`;
}

function formatTurnover(row: StoreMonthlyReportPackageRow): string {
  const leaverCount = Number(row.leaver_count ?? 0);
  if (row.turnover_rate === null || !Number.isFinite(leaverCount) || leaverCount <= 0) {
    return EMPTY_VALUE;
  }

  const turnoverRate = formatPercent(row.turnover_rate);
  if (turnoverRate === EMPTY_VALUE) {
    return EMPTY_VALUE;
  }

  return `${turnoverRate} / ${leaverCount.toLocaleString("tr-TR", {
    maximumFractionDigits: 0,
  })} ayrılan`;
}

function formatMoney(value: string | null): string {
  if (value === null) {
    return EMPTY_VALUE;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return EMPTY_VALUE;
  }

  return `${numericValue.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} TL`;
}

function formatNormFiili(row: StoreMonthlyReportPackageRow): string {
  if (row.planned_headcount === null) {
    return EMPTY_VALUE;
  }

  const planned = Number(row.planned_headcount);
  const active = Number(row.active_headcount ?? 0);
  if (!Number.isFinite(planned) || !Number.isFinite(active)) {
    return EMPTY_VALUE;
  }

  return `${active.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} / ${planned.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

function formatMissingDays(row: StoreMonthlyReportPackageRow): string {
  if (row.planned_headcount === null) {
    return EMPTY_VALUE;
  }

  const planned = Number(row.planned_headcount);
  const active = Number(row.active_headcount ?? 0);
  if (!Number.isFinite(planned) || !Number.isFinite(active)) {
    return EMPTY_VALUE;
  }

  return active < planned ? "Eksik" : "Yok";
}
