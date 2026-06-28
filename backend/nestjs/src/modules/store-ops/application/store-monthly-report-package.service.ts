import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "@e965/xlsx";
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
  "Şehir",
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
  today?: string;
};

@Injectable()
export class StoreMonthlyReportPackageService {
  constructor(
    private readonly storeMonthlyReportPackageRepository: StoreMonthlyReportPackageRepository,
  ) {}

  async getSummary(input: StoreMonthlyReportPackageInput): Promise<StoreMonthlyReportPackageSummary> {
    const range = resolveMonthlyRange(input.period, input.today);
    const rows = await this.storeMonthlyReportPackageRepository.getStoreMonthlyReportPackageRows({
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      regionManagerUserId: input.regionManagerUserId,
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
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
    worksheet["!cols"] = STORE_MONTHLY_REPORT_PACKAGE_HEADERS.map((header) => ({
      wch: Math.max(14, Math.min(28, header.length + 6)),
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mağaza İzleyiş");

    return {
      buffer: Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })),
      fileName: `magaza-izleyis-${input.period}.xlsx`,
    };
  }
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
}): StoreMonthlyReportPackageItem {
  const normFiili = formatNormFiili(input.row);
  const missingDays = formatMissingDays(input.row);
  const dataNotes = [
    input.row.score_value === null ? "Skor kaynağı yok" : null,
    "Turnover kaynağı yok",
    normFiili === EMPTY_VALUE ? "Norm kaynağı yok" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    regionManager: valueOrEmpty(input.row.region_manager_name),
    storeName: valueOrEmpty(input.row.store_name),
    city: valueOrEmpty(input.row.region_name),
    period: input.periodLabel,
    reportRange: input.coverageLabel,
    score: formatNumber(input.row.score_value),
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
    turnover: EMPTY_VALUE,
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

function formatNumber(value: string | null): string {
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
