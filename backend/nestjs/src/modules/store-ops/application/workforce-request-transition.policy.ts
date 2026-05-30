export const WORKFORCE_REQUEST_STATUS = {
  pendingHrApproval: "pending_hr_approval",
  approved: "approved",
  rejected: "rejected",
} as const;

export type WorkforceRequestStatus =
  (typeof WORKFORCE_REQUEST_STATUS)[keyof typeof WORKFORCE_REQUEST_STATUS];

type WorkforceRequestTransitionPolicy = {
  sourceStatus?: WorkforceRequestStatus;
  targetStatus: WorkforceRequestStatus;
  auditEventType: string;
  entityName: string;
};

const sellerCodeRequestEntityName = "ops.seller_code_request";
const employeeOffboardingRequestEntityName =
  "ops.employee_offboarding_request";

export const WORKFORCE_SELLER_CODE_TRANSITIONS = {
  create: {
    targetStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    auditEventType: "seller_code_request.created",
    entityName: sellerCodeRequestEntityName,
  },
  approve: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    targetStatus: WORKFORCE_REQUEST_STATUS.approved,
    auditEventType: "seller_code_request.approved",
    entityName: sellerCodeRequestEntityName,
  },
  reject: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    targetStatus: WORKFORCE_REQUEST_STATUS.rejected,
    auditEventType: "seller_code_request.rejected",
    entityName: sellerCodeRequestEntityName,
  },
  resubmit: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.rejected,
    targetStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    auditEventType: "seller_code_request.resubmitted",
    entityName: sellerCodeRequestEntityName,
  },
} as const satisfies Record<string, WorkforceRequestTransitionPolicy>;

export const WORKFORCE_OFFBOARDING_TRANSITIONS = {
  create: {
    targetStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    auditEventType: "employee_offboarding_request.created",
    entityName: employeeOffboardingRequestEntityName,
  },
  approve: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    targetStatus: WORKFORCE_REQUEST_STATUS.approved,
    auditEventType: "employee_offboarding_request.approved",
    entityName: employeeOffboardingRequestEntityName,
  },
  reject: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    targetStatus: WORKFORCE_REQUEST_STATUS.rejected,
    auditEventType: "employee_offboarding_request.rejected",
    entityName: employeeOffboardingRequestEntityName,
  },
  resubmit: {
    sourceStatus: WORKFORCE_REQUEST_STATUS.rejected,
    targetStatus: WORKFORCE_REQUEST_STATUS.pendingHrApproval,
    auditEventType: "employee_offboarding_request.resubmitted",
    entityName: employeeOffboardingRequestEntityName,
  },
} as const satisfies Record<string, WorkforceRequestTransitionPolicy>;

export function canApplyWorkforceRequestTransition(
  currentStatus: string,
  transition: WorkforceRequestTransitionPolicy,
) {
  return !transition.sourceStatus || currentStatus === transition.sourceStatus;
}
