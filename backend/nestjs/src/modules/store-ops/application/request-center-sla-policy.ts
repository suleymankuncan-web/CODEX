export const REQUEST_CENTER_SLA_POLICY = {
  timezone: "Europe/Istanbul",
  targetPendingRegionDays: 2,
  workforcePendingHrDays: 3,
  workforceReturnedStoreDays: 2,
  resubmissionResetsClock: true,
  terminalStopsClock: true,
} as const;

export type RequestCenterPolicyType = "target" | "sellerCode" | "offboarding";
export type RequestCenterNextOwner = "store" | "region" | "hr" | "system" | null;
export type RequestCenterPolicyEvent = { eventType: string; occurredAt: string };

export function resolveAuthoritativeWaitingSince(input: {
  requestType: RequestCenterPolicyType;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  events: RequestCenterPolicyEvent[];
}) {
  if (input.status === "approved") return null;
  if (input.requestType === "target" && input.status === "pending_region_approval") return input.createdAt;
  if (input.requestType === "target" && input.status === "rejected") return input.reviewedAt;

  const prefix = input.requestType === "sellerCode"
    ? "seller_code_request"
    : input.requestType === "offboarding"
      ? "employee_offboarding_request"
      : "target_distribution_request";
  const relevantTypes = input.status === "rejected"
    ? [`${prefix}.rejected`]
    : [`${prefix}.created`, `${prefix}.resubmitted`];
  const latest = input.events
    .filter((event) => relevantTypes.includes(event.eventType))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (latest) return latest.occurredAt;
  if (input.status === "rejected") return input.reviewedAt;
  return input.createdAt || null;
}

export function resolveRequestCenterTiming(input: {
  requestType: RequestCenterPolicyType;
  status: string;
  waitingSince: string | null;
  now?: Date;
}) {
  if (input.status === "approved") {
    return { waitingSince: null, nextOwner: null, dueAt: null, isOverdue: false } as const;
  }
  const policy = resolveActivePolicy(input.requestType, input.status);
  if (!policy) {
    return { waitingSince: input.waitingSince, nextOwner: null, dueAt: null, isOverdue: null } as const;
  }
  if (!input.waitingSince) {
    return { waitingSince: null, nextOwner: policy.nextOwner, dueAt: null, isOverdue: null } as const;
  }
  const waitingAt = new Date(input.waitingSince);
  if (!Number.isFinite(waitingAt.getTime())) {
    return { waitingSince: null, nextOwner: policy.nextOwner, dueAt: null, isOverdue: null } as const;
  }
  const due = new Date(waitingAt.getTime() + policy.calendarDays * 86_400_000);
  const now = input.now ?? new Date();
  return {
    waitingSince: waitingAt.toISOString(),
    nextOwner: policy.nextOwner,
    dueAt: due.toISOString(),
    isOverdue: now.getTime() >= due.getTime(),
  } as const;
}

function resolveActivePolicy(requestType: RequestCenterPolicyType, status: string) {
  if (requestType === "target" && status === "pending_region_approval") {
    return { nextOwner: "region" as const, calendarDays: REQUEST_CENTER_SLA_POLICY.targetPendingRegionDays };
  }
  if (requestType !== "target" && status === "pending_hr_approval") {
    return { nextOwner: "hr" as const, calendarDays: REQUEST_CENTER_SLA_POLICY.workforcePendingHrDays };
  }
  if (requestType !== "target" && status === "rejected") {
    return { nextOwner: "store" as const, calendarDays: REQUEST_CENTER_SLA_POLICY.workforceReturnedStoreDays };
  }
  return null;
}
