import { BadRequestException, ConflictException } from "@nestjs/common";
import type { TargetRevisionConflictCode } from "./target-reference-lifecycle";

export type TargetDistributionRow = {
  target_distribution_request_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  request_month: string;
  target_label: string;
  total_target_value: string;
  allocation_count: number;
  request_status: string;
  request_reason: string | null;
  allocation_json: unknown;
  submitted_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  approval_note: string | null;
  created_at: string;
  updated_at: string;
  total_count?: string | number;
  original_allocation_json?: unknown;
  original_total_target_value?: string | null;
  approval_evidence_json?: unknown;
};

export type TargetDistributionAllocation = {
  employeeId: string;
  assigneeLabel: string;
  targetValue: number;
      distributionDays?: number;
  note?: string;
};

export type TargetDistributionApprovalEvidence = {
  approvalMode: "direct" | "adjusted";
  originalTotalTargetValue: number;
  approvedTotalTargetValue: number;
  originalAllocations: TargetDistributionAllocation[];
  approvedAllocations: TargetDistributionAllocation[];
};

export type TargetRevisionInput = {
  baseReferenceIds: string[];
  removedEmployeeIds: string[];
};

type TargetRevisionEvidence = TargetRevisionInput & {
  mode: "initial" | "revision";
  reasonPresent: boolean;
  predecessorSuccessorLinks?: Array<{
    predecessorId: string;
    successorId: string | null;
  }>;
};

export function parseTargetRevisionEvidence(value: unknown): TargetRevisionEvidence | null {
  if (!value || typeof value !== "object") return null;
  const targetRevision = (value as Record<string, unknown>).targetRevision;
  if (!targetRevision || typeof targetRevision !== "object") return null;
  const evidence = targetRevision as Record<string, unknown>;
  if (
    (evidence.mode !== "initial" && evidence.mode !== "revision") ||
    !Array.isArray(evidence.baseReferenceIds) ||
    !Array.isArray(evidence.removedEmployeeIds)
  ) {
    return null;
  }
  return {
    mode: evidence.mode,
    baseReferenceIds: evidence.baseReferenceIds.filter((id): id is string => typeof id === "string"),
    removedEmployeeIds: evidence.removedEmployeeIds.filter((id): id is string => typeof id === "string"),
    reasonPresent: evidence.reasonPresent === true,
    predecessorSuccessorLinks: [],
  };
}

export function throwTargetRevisionError(code: TargetRevisionConflictCode): never {
  const body = { code, message: code };
  if (code === "target_revision_incomplete") throw new BadRequestException(body);
  throw new ConflictException(body);
}

export type TargetCoverageRow = {
  store_id: string;
  store_name: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  external_employee_ref: string | null;
  personnel_target_reference_id: string | null;
  target_value: string | null;
  pending_request_id: string | null;
  pending_target_value: string | null;
  stale_target_reference_id: string | null;
  target_status:
    | "approved"
    | "pending_region_approval"
    | "pending_change_conflict"
    | "stale_reference"
    | "missing";
};

export function parseTargetDistributionAllocations(
  value: unknown,
): TargetDistributionAllocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const allocation = item as Record<string, unknown>;
      const employeeId = typeof allocation.employeeId === "string" ? allocation.employeeId : "";
      const assigneeLabel =
        typeof allocation.assigneeLabel === "string" ? allocation.assigneeLabel : "";
      const targetValue = Number(allocation.targetValue);
      const note = typeof allocation.note === "string" ? allocation.note : undefined;
      if (!employeeId || !assigneeLabel || !Number.isFinite(targetValue) || targetValue <= 0) {
        return null;
      }
      return { employeeId, assigneeLabel, targetValue,
        ...(note === undefined ? {} : { note }),
        ...(typeof allocation.distributionDays === "number" && Number.isSafeInteger(allocation.distributionDays) && allocation.distributionDays >= 0 ? { distributionDays: allocation.distributionDays } : {}),
      };
    })
    .filter((item): item is TargetDistributionAllocation => item !== null);
}

export function parseApprovalEvidence(
  value: unknown,
): TargetDistributionApprovalEvidence | null {
  if (!value || typeof value !== "object") return null;
  const evidence = value as Record<string, unknown>;
  const approvalMode = evidence.approvalMode;
  const originalTotalTargetValue = Number(evidence.originalTotalTargetValue);
  const approvedTotalTargetValue = Number(evidence.approvedTotalTargetValue);
  const originalAllocations = parseTargetDistributionAllocations(evidence.originalAllocations);
  const approvedAllocations = parseTargetDistributionAllocations(evidence.approvedAllocations);
  if (approvalMode !== "direct" && approvalMode !== "adjusted") return null;
  if (!Number.isFinite(originalTotalTargetValue) || !Number.isFinite(approvedTotalTargetValue)) {
    return null;
  }
  return {
    approvalMode,
    originalTotalTargetValue,
    approvedTotalTargetValue,
    originalAllocations,
    approvedAllocations,
  };
}
