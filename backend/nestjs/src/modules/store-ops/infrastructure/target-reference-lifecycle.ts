export type TargetRevisionConflictCode =
  | "target_revision_period_closed"
  | "target_revision_stale_base"
  | "target_revision_incomplete"
  | "target_revision_chain_conflict"
  | "target_revision_active_conflict"
  | "target_revision_import_replacement_forbidden";

export class TargetRevisionConflict extends Error {
  constructor(readonly code: TargetRevisionConflictCode) {
    super(code);
    this.name = "TargetRevisionConflict";
  }
}

export function isValidNextDayPrimaryRotation(input: {
  predecessorEndDate: string | null;
  successorStartDate: string;
}) {
  return input.predecessorEndDate !== null && input.predecessorEndDate < input.successorStartDate;
}

type ActiveTargetReference = {
  employeeId: string;
  targetReferenceId: string;
};

export function reconcileTargetRevision(input: {
  activeReferences: ActiveTargetReference[];
  allocationEmployeeIds: string[];
  baseReferenceIds: string[];
  removedEmployeeIds: string[];
}) {
  const activeByReferenceId = new Map(
    input.activeReferences.map((reference) => [
      reference.targetReferenceId.toLowerCase(),
      reference,
    ]),
  );
  const submittedBaseIds = input.baseReferenceIds.map((id) => id.toLowerCase());
  if (
    new Set(submittedBaseIds).size !== submittedBaseIds.length ||
    submittedBaseIds.length !== input.activeReferences.length ||
    submittedBaseIds.some((id) => !activeByReferenceId.has(id))
  ) {
    throw new TargetRevisionConflict("target_revision_stale_base");
  }

  const allocationIds = new Set(input.allocationEmployeeIds.map((id) => id.toLowerCase()));
  const removedIds = new Set(input.removedEmployeeIds.map((id) => id.toLowerCase()));
  if (
    removedIds.size !== input.removedEmployeeIds.length ||
    [...removedIds].some((id) => allocationIds.has(id))
  ) {
    throw new TargetRevisionConflict("target_revision_incomplete");
  }

  const baseByEmployeeId = new Map(
    input.activeReferences.map((reference) => [reference.employeeId.toLowerCase(), reference]),
  );
  if (
    [...baseByEmployeeId.keys()].some(
      (employeeId) => !allocationIds.has(employeeId) && !removedIds.has(employeeId),
    ) ||
    [...removedIds].some((employeeId) => !baseByEmployeeId.has(employeeId))
  ) {
    throw new TargetRevisionConflict("target_revision_incomplete");
  }

  const predecessorsByEmployeeId = new Map<string, string>();
  const removedPredecessors: ActiveTargetReference[] = [];
  for (const [employeeId, reference] of baseByEmployeeId) {
    if (removedIds.has(employeeId)) {
      removedPredecessors.push(reference);
    } else {
      predecessorsByEmployeeId.set(reference.employeeId.toLowerCase(), reference.targetReferenceId);
    }
  }

  return {
    predecessorsByEmployeeId,
    removedPredecessors,
    newRootEmployeeIds: input.allocationEmployeeIds.filter(
      (employeeId) => !baseByEmployeeId.has(employeeId.toLowerCase()),
    ),
  };
}
