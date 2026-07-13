import {
  TargetRevisionConflict,
  isValidNextDayPrimaryRotation,
  reconcileTargetRevision,
} from "./target-reference-lifecycle";

const BASE_A = "00000000-0000-4000-8000-000000000401";
const BASE_B = "00000000-0000-4000-8000-000000000402";
const EMPLOYEE_A = "00000000-0000-4000-8000-000000000501";
const EMPLOYEE_B = "00000000-0000-4000-8000-000000000502";

describe("target reference lifecycle reconciliation", () => {
  it("accepts next-day primary rotation and rejects same-day overlap", () => {
    expect(isValidNextDayPrimaryRotation({
      predecessorEndDate: "2026-07-10",
      successorStartDate: "2026-07-11",
    })).toBe(true);
    expect(isValidNextDayPrimaryRotation({
      predecessorEndDate: "2026-07-11",
      successorStartDate: "2026-07-11",
    })).toBe(false);
  });
  it("links retained bases, terminates explicit removals and permits eligible new roots", () => {
    expect(reconcileTargetRevision({
      activeReferences: [
        { employeeId: EMPLOYEE_A, targetReferenceId: BASE_A },
        { employeeId: EMPLOYEE_B, targetReferenceId: BASE_B },
      ],
      allocationEmployeeIds: [EMPLOYEE_A, "00000000-0000-4000-8000-000000000503"],
      baseReferenceIds: [BASE_A, BASE_B],
      removedEmployeeIds: [EMPLOYEE_B],
    })).toEqual({
      predecessorsByEmployeeId: new Map([[EMPLOYEE_A, BASE_A]]),
      removedPredecessors: [{ employeeId: EMPLOYEE_B, targetReferenceId: BASE_B }],
      newRootEmployeeIds: ["00000000-0000-4000-8000-000000000503"],
    });
  });

  it("rejects a stale base set", () => {
    expect(() => reconcileTargetRevision({
      activeReferences: [{ employeeId: EMPLOYEE_A, targetReferenceId: BASE_A }],
      allocationEmployeeIds: [EMPLOYEE_A],
      baseReferenceIds: [BASE_B],
      removedEmployeeIds: [],
    })).toThrow(new TargetRevisionConflict("target_revision_stale_base"));
  });

  it("rejects silent omission from the final allocation set", () => {
    expect(() => reconcileTargetRevision({
      activeReferences: [
        { employeeId: EMPLOYEE_A, targetReferenceId: BASE_A },
        { employeeId: EMPLOYEE_B, targetReferenceId: BASE_B },
      ],
      allocationEmployeeIds: [EMPLOYEE_A],
      baseReferenceIds: [BASE_A, BASE_B],
      removedEmployeeIds: [],
    })).toThrow(new TargetRevisionConflict("target_revision_incomplete"));
  });

  it("normalizes mixed-case employee ids while preserving the exact predecessor", () => {
    const mixedEmployeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const result = reconcileTargetRevision({
      activeReferences: [{ employeeId: mixedEmployeeId, targetReferenceId: BASE_A }],
      allocationEmployeeIds: [mixedEmployeeId.toUpperCase()],
      baseReferenceIds: [BASE_A],
      removedEmployeeIds: [],
    });

    expect(result.predecessorsByEmployeeId.get(mixedEmployeeId)).toBe(BASE_A);
  });
});
