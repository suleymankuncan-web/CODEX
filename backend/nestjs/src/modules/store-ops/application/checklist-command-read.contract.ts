import type { ChecklistCommandView } from "./checklist-command-read-scope";

export const checklistCommandStatuses = [
  "all",
  "needs_visit",
  "active",
  "pending",
  "completed",
] as const;
export type ChecklistCommandStatus = (typeof checklistCommandStatuses)[number];

export const checklistCommandSorts = [
  "store_asc",
  "store_desc",
  "bm_score_desc",
  "vm_score_desc",
  "last_visit_asc",
  "last_visit_desc",
  "open_actions_desc",
  "status_asc",
  "status_desc",
] as const;
export type ChecklistCommandSort = (typeof checklistCommandSorts)[number];

export const checklistCommandSignals = [
  "all",
  "missing_visit",
  "open_actions",
  "completed_coverage",
] as const;
export type ChecklistCommandSignal = (typeof checklistCommandSignals)[number];

export const checklistCommandRegionSorts = [
  "manager_asc",
  "manager_desc",
  "stores_desc",
  "missing_desc",
  "open_actions_desc",
  "score_desc",
] as const;
export type ChecklistCommandRegionSort = (typeof checklistCommandRegionSorts)[number];

export type ChecklistCommandRowStatus = Exclude<ChecklistCommandStatus, "all">;

export type ChecklistCommandRow = {
  storeId: string;
  storeCode: string;
  storeName: string;
  regionId: string;
  regionName: string;
  regionManagers: Array<{ displayName: string }>;
  bmScore: number | null;
  vmScore: number | null;
  bmCompletedAt: string | null;
  vmCompletedAt: string | null;
  lastCompletedVisitAt: string | null;
  elapsedDaysSinceLastVisit: number | null;
  activeChecklistCount: number;
  activeBmChecklistCount: number;
  activeVmChecklistCount: number;
  pendingAcknowledgementCount: number;
  pendingBmAcknowledgementCount: number;
  pendingVmAcknowledgementCount: number;
  openActionCount: number;
  blockedActionCount: number;
  status: ChecklistCommandRowStatus;
  reasonCodes: string[];
  lastOperationalAt: string | null;
};

export type ChecklistCommandReadResult = {
  period: string;
  view: ChecklistCommandView;
  capabilities: {
    weeklyVisitPlanningAvailable: boolean;
    canMaintainWeeklyVisitPlan: boolean;
  };
  metrics: {
    totalStores: number;
    needsVisit: number;
    active: number;
    pending: number;
    completed: number;
  };
  items: ChecklistCommandRow[];
  page: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type ChecklistCommandRegionMetrics = {
  totalStores: number;
  missingVisitStores: number;
  storesWithOpenActions: number;
  openActionCount: number;
  completedCoverageStores: number;
};

export type ChecklistCommandRegionRow = {
  regionId: string;
  regionName: string;
  regionManagers: Array<{ displayName: string }>;
  metrics: ChecklistCommandRegionMetrics & { blockedActionCount: number };
  visitAverageScore: number | null;
  scoreSampleCount: number;
  lastOperationalAt: string | null;
};

export type ChecklistCommandRegionReadResult = {
  period: string;
  view: "report_viewer";
  capabilities: {
    weeklyVisitPlanningAvailable: false;
    canMaintainWeeklyVisitPlan: false;
  };
  metrics: ChecklistCommandRegionMetrics;
  items: ChecklistCommandRegionRow[];
  page: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};
