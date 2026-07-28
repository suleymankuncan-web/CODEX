export const storeActionPlanStatuses = [
  "open",
  "in_progress",
  "blocked",
  "solution_review_pending",
  "correction_required",
  "closed",
  "cancelled",
] as const;

export type StoreActionPlanStatus = (typeof storeActionPlanStatuses)[number];

export const storeActionPlanPriorities = ["high", "medium", "low"] as const;

export type StoreActionPlanPriority = (typeof storeActionPlanPriorities)[number];

export const storeActionPlanSourceTypes = ["kpi_exception", "checklist_remediation"] as const;

export type StoreActionPlanSourceType = (typeof storeActionPlanSourceTypes)[number];

export const storeActionPlanAuditEventTypes = {
  created: "store_action_plan.created",
  statusUpdated: "store_action_plan.status_updated",
  closed: "store_action_plan.closed",
  cancelled: "store_action_plan.cancelled",
  solutionSubmitted: "store_action_solution.submitted",
  solutionResubmitted: "store_action_solution.resubmitted",
  solutionApproved: "store_action_solution.approved",
  solutionRejected: "store_action_solution.rejected",
} as const;

export type StoreActionPlanAuditEventType =
  (typeof storeActionPlanAuditEventTypes)[keyof typeof storeActionPlanAuditEventTypes];

export const terminalStoreActionPlanStatuses = [
  "closed",
  "cancelled",
] as const satisfies readonly StoreActionPlanStatus[];

const allowedStoreActionPlanStatusTransitions = {
  open: ["in_progress", "blocked", "closed", "cancelled"],
  in_progress: ["blocked", "closed", "cancelled"],
  blocked: ["in_progress", "closed", "cancelled"],
  solution_review_pending: [],
  correction_required: ["in_progress", "cancelled"],
  closed: [],
  cancelled: [],
} as const satisfies Record<StoreActionPlanStatus, readonly StoreActionPlanStatus[]>;

export function isTerminalStoreActionPlanStatus(status: StoreActionPlanStatus) {
  return (terminalStoreActionPlanStatuses as readonly StoreActionPlanStatus[]).includes(status);
}

export function getAllowedStoreActionPlanStatusTransitions(status: StoreActionPlanStatus) {
  return [...allowedStoreActionPlanStatusTransitions[status]];
}

export function canTransitionStoreActionPlanStatus(from: StoreActionPlanStatus, to: StoreActionPlanStatus) {
  if (isTerminalStoreActionPlanStatus(from)) {
    return false;
  }

  if (from === to) {
    return true;
  }

  const allowedTransitions = allowedStoreActionPlanStatusTransitions[from] as readonly StoreActionPlanStatus[];
  return allowedTransitions.includes(to);
}

export function requiresStoreActionPlanResolutionNote(status: StoreActionPlanStatus) {
  return status === "closed";
}

export function requiresStoreActionPlanCancelReason(status: StoreActionPlanStatus) {
  return status === "cancelled";
}
