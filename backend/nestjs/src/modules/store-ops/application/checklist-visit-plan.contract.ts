export type ChecklistVisitPlanView = "report_viewer" | "region_manager" | "store_manager";
export type ChecklistVisitPlanItemStatus = "planned" | "waiting" | "missed" | "completed";

export const checklistVisitPlanRisks = ["all", "high", "medium", "low"] as const;
export type ChecklistVisitPlanRisk = Exclude<(typeof checklistVisitPlanRisks)[number], "all">;

export const checklistVisitPlanScoreBands = {
  highBelow: 70,
  mediumFrom: 70,
  mediumThrough: 84,
  strongFrom: 85,
} as const;

export const checklistVisitPlanReasons = [
  "all",
  "missing_current_month_visit",
  "low_checklist_score",
  "watch_checklist_result",
  "active_draft",
  "pending_acknowledgement",
  "visit_completed",
  "strong_score",
  "insufficient_signal",
] as const;
export type ChecklistVisitPlanReason = Exclude<(typeof checklistVisitPlanReasons)[number], "all">;

export const checklistVisitPlanPeriodStatuses = [
  "all", "unplanned", "planned", "waiting", "missed", "completed", "mixed",
] as const;
export type ChecklistVisitPlanPeriodStatus = Exclude<(typeof checklistVisitPlanPeriodStatuses)[number], "all">;

export const checklistVisitPlanPeriodSorts = [
  "risk_desc",
  "store_asc",
  "store_desc",
  "last_visit_asc",
  "last_visit_desc",
  "next_plan_asc",
  "next_plan_desc",
] as const;
export type ChecklistVisitPlanPeriodSort = (typeof checklistVisitPlanPeriodSorts)[number];

export type ChecklistVisitPlanItem = {
  planItemId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  plannedDate: string;
  displayOrder: number;
  status: ChecklistVisitPlanItemStatus;
  checklistInstanceId: string | null;
  visitCompletedAt: string | null;
  completedAt: string | null;
};

export type ChecklistVisitPlanVisitCompletion = {
  planItemId: string;
  completedAt: string;
};

export type ChecklistVisitPlanResult = {
  planId: string | null;
  regionId: string;
  regionName: string;
  weekStart: string;
  revision: number;
  revisedAt: string | null;
  view?: ChecklistVisitPlanView;
  capabilities?: { canMaintainWeeklyVisitPlan: boolean };
  items: ChecklistVisitPlanItem[];
};

export type SaveChecklistVisitPlanItem = {
  storeId: string;
  plannedDate: string;
  displayOrder: number;
};

export type ChecklistVisitPlanPeriodItem = ChecklistVisitPlanItem & {
  planId: string;
  revision: number;
  weekStart: string;
};

export type ChecklistVisitPlanPeriodRow = {
  storeId: string;
  storeCode: string;
  storeName: string;
  regionId: string;
  regionName: string;
  bmScore: number | null;
  vmScore: number | null;
  lastCompletedVisitAt: string | null;
  elapsedDaysSinceLastVisit: number | null;
  risk: ChecklistVisitPlanRisk;
  reasonCodes: ChecklistVisitPlanReason[];
  planStatus: ChecklistVisitPlanPeriodStatus;
  planItems: ChecklistVisitPlanPeriodItem[];
};

export type ChecklistVisitPlanPeriodResult = {
  period: string;
  regionId: string;
  regionName: string;
  view: "region_manager";
  capabilities: { canMaintainWeeklyVisitPlan: true };
  metrics: {
    totalStores: number;
    high: number;
    medium: number;
    low: number;
    planned: number;
    unplanned: number;
    waiting: number;
    missed: number;
    completed: number;
  };
  items: ChecklistVisitPlanPeriodRow[];
  page: { total: number; limit: number; offset: number; hasMore: boolean };
};

export type ChecklistVisitPlanCandidate = {
  storeId: string;
  storeCode: string;
  storeName: string;
  regionId: string;
  regionName: string;
};

export type ChecklistVisitPlanCandidateResult = {
  regionId: string;
  view: "region_manager";
  items: ChecklistVisitPlanCandidate[];
  page: { total: number; limit: number; offset: number; hasMore: boolean };
};

export type ChecklistVisitPlanRegionOption = {
  regionId: string;
  regionName: string;
};

export type ChecklistVisitPlanRegionOptionResult = {
  view: "region_manager";
  capabilities: { canMaintainWeeklyVisitPlan: true };
  items: ChecklistVisitPlanRegionOption[];
  page: { total: number; limit: number; offset: number; hasMore: boolean };
};
