export type StoreMonthlyReportPackageStatus = "ready" | "partial";

export type StoreMonthlyReportPackageSection = {
  code: string;
  label: string;
  value: string;
  status: StoreMonthlyReportPackageStatus;
};

export type StoreMonthlyReportPackageRow = {
  region_manager_name: string | null;
  store_id: string;
  store_name: string;
  store_type: string;
  region_name: string | null;
  score_value: string | null;
  upt_value: string | null;
  atv_value: string | null;
  cr_value: string | null;
  hg_value: string | null;
  gsm_value: string | null;
  bm_checklist_score: string | null;
  vm_checklist_score: string | null;
  pending_ack_count: string | null;
  open_action_count: string | null;
  closed_action_count: string | null;
  target_status: string | null;
  incentive_status: string | null;
  incentive_total_amount: string | null;
  planned_headcount: string | null;
  active_headcount: string | null;
  leaver_count: string | null;
  turnover_rate: string | null;
  last_visit_date: string | null;
  days_since_visit: string | null;
};

export type StoreMonthlyReportPackageScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  regionManagerUserId?: string;
};

export type StoreMonthlyReportPackageItem = {
  regionManager: string;
  storeName: string;
  city: string;
  period: string;
  reportRange: string;
  score: string;
  upt: string;
  atv: string;
  cr: string;
  hg: string;
  gsm: string;
  bmChecklist: string;
  vmChecklist: string;
  actionStatus: string;
  targetStatus: string;
  incentiveStatus: string;
  normFiili: string;
  missingDays: string;
  turnover: string;
  lastVisit: string;
  daysSinceVisit: string;
  dataNote: string;
};

export type StoreMonthlyReportPackageSummary = {
  period: string;
  periodLabel: string;
  coverageLabel: string;
  isCurrentPeriod: boolean;
  storeCount: number;
  sections: StoreMonthlyReportPackageSection[];
  items: StoreMonthlyReportPackageItem[];
};

export type StoreMonthlyReportWorkbook = {
  buffer: Buffer;
  fileName: string;
};
