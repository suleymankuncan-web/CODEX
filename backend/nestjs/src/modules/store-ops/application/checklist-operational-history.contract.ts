export const checklistOperationalHistoryKinds = [
  "checklist_completed",
  "visit_completed",
  "acknowledgement",
  "task_assigned",
  "task_resolved",
  "visit_plan_revised",
] as const;
export type ChecklistOperationalHistoryKind =
  (typeof checklistOperationalHistoryKinds)[number];

export const checklistOperationalHistoryRanges = ["3m", "6m", "12m", "all"] as const;
export type ChecklistOperationalHistoryRange =
  (typeof checklistOperationalHistoryRanges)[number];

export type ChecklistOperationalHistoryEvent = {
  id: string;
  kind: ChecklistOperationalHistoryKind;
  occurredAt: string;
  title: string;
  detail: string | null;
  actorSnapshot: {
    displayName: string | null;
    roleLabel: string | null;
    assignmentLabel: string | null;
    identityStatus: "captured" | "historical_projection" | "unknown";
  };
  details: Array<{ label: string; value: string }>;
};

export type ChecklistOperationalHistoryResult = {
  store: {
    id: string;
    name: string;
    city: null;
    district: null;
  };
  summary: {
    eventCount: number;
    completedAuditCount: number;
    completedVisitCount: number;
    assignedTaskCount: number;
    resolvedTaskCount: number;
    openTaskCount: number;
  };
  items: ChecklistOperationalHistoryEvent[];
  page: { nextCursor: string | null; hasMore: boolean };
};
