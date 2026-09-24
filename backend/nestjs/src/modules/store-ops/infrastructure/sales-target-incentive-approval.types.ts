export type SalesTargetIncentiveStoreReviewStatus = "pending_review" | "reviewed";

export type SalesTargetIncentiveRegionPackageStatus = "submitted" | "admin_approved" | "admin_returned";

export type SalesTargetIncentiveRegionCorrectionStatus = "draft" | "submitted" | "admin_approved" | "admin_returned" | "voided";

export type SalesTargetIncentiveParticipantType = "store_manager" | "personnel";

export type SalesTargetIncentiveApprovalStore = {
  companyId: string;
  regionId: string;
  storeId: string;
};

export type SalesTargetIncentiveWorkflowState = {
  reviews: SalesTargetIncentiveStoreReviewRow[];
  corrections: SalesTargetIncentiveRegionCorrectionRow[];
  packages: SalesTargetIncentiveRegionPackageRow[];
};

export type SalesTargetIncentiveStoreReviewRow = {
  sales_target_incentive_store_review_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  final_snapshot_id: string;
  period_key: string;
  review_status: SalesTargetIncentiveStoreReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

export type SalesTargetIncentiveRegionPackageRow = {
  sales_target_incentive_region_package_id: string;
  company_id: string;
  region_id: string | null;
  package_scope: "legacy_region" | "manager_assignment";
  manager_user_id: string | null;
  period_key: string;
  package_status: SalesTargetIncentiveRegionPackageStatus;
  submitted_by_user_id: string;
  submitted_at: string;
  submission_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  store_count?: string;
  correction_count?: string;
};

export type SalesTargetIncentiveRegionCorrectionRow = {
  sales_target_incentive_region_correction_id: string;
  region_package_id: string | null;
  company_id: string;
  region_id: string;
  store_id: string;
  employee_id: string;
  participant_type: SalesTargetIncentiveParticipantType;
  final_row_id: string;
  period_key: string;
  before_amount: string;
  final_amount: string;
  adjustment_amount: string;
  reason_note: string;
  correction_status: SalesTargetIncentiveRegionCorrectionStatus;
  created_by_user_id: string;
  submitted_by_user_id: string | null;
  submitted_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  approved_adjustment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesTargetIncentiveClosedFinalSnapshotTargetRow = {
  final_row_id: string;
  company_id: string;
  region_id: string;
  store_id: string;
  store_name: string;
  employee_id: string;
  user_id: string | null;
  participant_type: SalesTargetIncentiveParticipantType;
  position_code: string;
  target_amount: string | null;
  actual_sales_amount: string | null;
  achievement_pct: string | null;
  applied_rate: string | null;
  payable_amount: string;
  final_amount: string;
  approved_adjustment_amount: string;
  current_amount: string;
};

export type SalesTargetIncentiveClosedFinalSnapshotStoreRow = {
  store_id: string;
  final_snapshot_id: string;
};
