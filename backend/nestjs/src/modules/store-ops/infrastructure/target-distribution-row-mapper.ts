import {
  parseApprovalEvidence,
  type TargetDistributionRow,
} from "./target-distribution-contract";

export function mapTargetDistributionRow(row: TargetDistributionRow) {
  const approvalEvidence = parseApprovalEvidence(row.approval_evidence_json);

  return {
    requestId: row.target_distribution_request_id,
    companyId: row.company_id,
    regionId: row.region_id,
    storeId: row.store_id,
    storeName: row.store_name,
    requestMonth: row.request_month,
    targetLabel: row.target_label,
    totalTargetValue: Number(row.total_target_value),
    allocationCount: row.allocation_count,
    status: row.request_status,
    requestReason: row.request_reason,
    allocations: Array.isArray(row.allocation_json) ? row.allocation_json : [],
    submittedByUserId: row.submitted_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at,
    approvalNote: row.approval_note,
    approvalMode: approvalEvidence?.approvalMode ?? null,
    originalTotalTargetValue: approvalEvidence?.originalTotalTargetValue ?? null,
    approvedTotalTargetValue: approvalEvidence?.approvedTotalTargetValue ?? null,
    originalAllocations: approvalEvidence?.originalAllocations ?? [],
    approvedAllocations: approvalEvidence?.approvedAllocations ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
