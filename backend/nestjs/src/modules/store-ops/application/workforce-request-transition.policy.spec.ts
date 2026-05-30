import {
  WORKFORCE_OFFBOARDING_TRANSITIONS,
  WORKFORCE_REQUEST_STATUS,
  WORKFORCE_SELLER_CODE_TRANSITIONS,
  canApplyWorkforceRequestTransition,
} from "./workforce-request-transition.policy";

describe("workforce request transition policy", () => {
  it("keeps seller code transition statuses and audit events explicit", () => {
    expect(WORKFORCE_SELLER_CODE_TRANSITIONS).toMatchObject({
      create: {
        targetStatus: "pending_hr_approval",
        auditEventType: "seller_code_request.created",
        entityName: "ops.seller_code_request",
      },
      approve: {
        sourceStatus: "pending_hr_approval",
        targetStatus: "approved",
        auditEventType: "seller_code_request.approved",
        entityName: "ops.seller_code_request",
      },
      reject: {
        sourceStatus: "pending_hr_approval",
        targetStatus: "rejected",
        auditEventType: "seller_code_request.rejected",
        entityName: "ops.seller_code_request",
      },
      resubmit: {
        sourceStatus: "rejected",
        targetStatus: "pending_hr_approval",
        auditEventType: "seller_code_request.resubmitted",
        entityName: "ops.seller_code_request",
      },
    });
  });

  it("keeps offboarding transition statuses and audit events explicit", () => {
    expect(WORKFORCE_OFFBOARDING_TRANSITIONS).toMatchObject({
      create: {
        targetStatus: "pending_hr_approval",
        auditEventType: "employee_offboarding_request.created",
        entityName: "ops.employee_offboarding_request",
      },
      approve: {
        sourceStatus: "pending_hr_approval",
        targetStatus: "approved",
        auditEventType: "employee_offboarding_request.approved",
        entityName: "ops.employee_offboarding_request",
      },
      reject: {
        sourceStatus: "pending_hr_approval",
        targetStatus: "rejected",
        auditEventType: "employee_offboarding_request.rejected",
        entityName: "ops.employee_offboarding_request",
      },
      resubmit: {
        sourceStatus: "rejected",
        targetStatus: "pending_hr_approval",
        auditEventType: "employee_offboarding_request.resubmitted",
        entityName: "ops.employee_offboarding_request",
      },
    });
  });

  it("checks source status without changing service exception semantics", () => {
    expect(
      canApplyWorkforceRequestTransition(
        WORKFORCE_REQUEST_STATUS.pendingHrApproval,
        WORKFORCE_SELLER_CODE_TRANSITIONS.approve,
      ),
    ).toBe(true);
    expect(
      canApplyWorkforceRequestTransition(
        WORKFORCE_REQUEST_STATUS.approved,
        WORKFORCE_SELLER_CODE_TRANSITIONS.approve,
      ),
    ).toBe(false);
  });
});
