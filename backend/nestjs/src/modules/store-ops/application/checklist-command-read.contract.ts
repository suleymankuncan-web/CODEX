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
  pendingAcknowledgementCount: number;
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
