export type ChecklistVisitPlanView = "report_viewer" | "region_manager" | "store_manager";
export type ChecklistVisitPlanItemStatus = "waiting" | "missed" | "completed";

export type ChecklistVisitPlanItem = {
  planItemId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  plannedDate: string;
  displayOrder: number;
  status: ChecklistVisitPlanItemStatus;
  checklistInstanceId: string | null;
  completedAt: string | null;
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
