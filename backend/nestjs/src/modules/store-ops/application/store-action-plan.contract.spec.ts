import { getAuditEventCatalogEntry } from "../../../shared/audit/audit-event-catalog";
import {
  canTransitionStoreActionPlanStatus,
  getAllowedStoreActionPlanStatusTransitions,
  isTerminalStoreActionPlanStatus,
  requiresStoreActionPlanCancelReason,
  requiresStoreActionPlanResolutionNote,
  storeActionPlanAuditEventTypes,
  storeActionPlanPriorities,
  storeActionPlanSourceTypes,
  storeActionPlanStatuses,
} from "./store-action-plan.contract";

describe("store action plan contract", () => {
  it("keeps lifecycle, priority, and source values aligned with the schema contract", () => {
    expect(storeActionPlanStatuses).toEqual([
      "open",
      "in_progress",
      "blocked",
      "solution_review_pending",
      "correction_required",
      "closed",
      "cancelled",
    ]);
    expect(storeActionPlanPriorities).toEqual(["high", "medium", "low"]);
    expect(storeActionPlanSourceTypes).toEqual(["kpi_exception", "checklist_remediation"]);
  });

  it("catalogs the Store Action audit events before runtime writes are added", () => {
    expect(Object.values(storeActionPlanAuditEventTypes)).toEqual([
      "store_action_plan.created",
      "store_action_plan.status_updated",
      "store_action_plan.closed",
      "store_action_plan.cancelled",
      "store_action_solution.submitted",
      "store_action_solution.resubmitted",
      "store_action_solution.approved",
      "store_action_solution.rejected",
    ]);

    for (const eventType of Object.values(storeActionPlanAuditEventTypes)) {
      expect(getAuditEventCatalogEntry(eventType)).toMatchObject({
        eventType,
        entityName: "ops.store_action_plan",
        ownerModule: "store_ops",
      });
    }
  });

  it("allows only the approved non-terminal lifecycle transitions", () => {
    expect(getAllowedStoreActionPlanStatusTransitions("open")).toEqual([
      "in_progress",
      "blocked",
      "closed",
      "cancelled",
    ]);
    expect(getAllowedStoreActionPlanStatusTransitions("in_progress")).toEqual(["blocked", "closed", "cancelled"]);
    expect(getAllowedStoreActionPlanStatusTransitions("blocked")).toEqual(["in_progress", "closed", "cancelled"]);
    expect(getAllowedStoreActionPlanStatusTransitions("solution_review_pending")).toEqual([]);
    expect(getAllowedStoreActionPlanStatusTransitions("correction_required")).toEqual(["in_progress", "cancelled"]);
    expect(getAllowedStoreActionPlanStatusTransitions("closed")).toEqual([]);
    expect(getAllowedStoreActionPlanStatusTransitions("cancelled")).toEqual([]);

    expect(canTransitionStoreActionPlanStatus("open", "in_progress")).toBe(true);
    expect(canTransitionStoreActionPlanStatus("open", "open")).toBe(true);
    expect(canTransitionStoreActionPlanStatus("in_progress", "open")).toBe(false);
    expect(canTransitionStoreActionPlanStatus("blocked", "open")).toBe(false);
    expect(canTransitionStoreActionPlanStatus("blocked", "in_progress")).toBe(true);
  });

  it("treats terminal statuses as immutable and evidence-backed", () => {
    expect(isTerminalStoreActionPlanStatus("closed")).toBe(true);
    expect(isTerminalStoreActionPlanStatus("cancelled")).toBe(true);
    expect(isTerminalStoreActionPlanStatus("open")).toBe(false);

    expect(canTransitionStoreActionPlanStatus("closed", "closed")).toBe(false);
    expect(canTransitionStoreActionPlanStatus("closed", "in_progress")).toBe(false);
    expect(canTransitionStoreActionPlanStatus("cancelled", "cancelled")).toBe(false);
    expect(canTransitionStoreActionPlanStatus("cancelled", "open")).toBe(false);

    expect(requiresStoreActionPlanResolutionNote("closed")).toBe(true);
    expect(requiresStoreActionPlanResolutionNote("cancelled")).toBe(false);
    expect(requiresStoreActionPlanCancelReason("cancelled")).toBe(true);
    expect(requiresStoreActionPlanCancelReason("closed")).toBe(false);
  });
});
