import type { SalesTargetIncentiveWorkspaceCapabilities } from "./sales-target-incentive-workspace-scope";

export type SalesTargetIncentiveWorkspaceView = "report_viewer" | "region_manager";

export type SalesTargetIncentiveWorkspaceSectionStatus = {
  status: "complete" | "unavailable";
};

export type SalesTargetIncentiveWorkspaceSections = {
  core: SalesTargetIncentiveWorkspaceSectionStatus;
  storeMetadata: SalesTargetIncentiveWorkspaceSectionStatus;
  rateMetadata: SalesTargetIncentiveWorkspaceSectionStatus;
  correctionActors: SalesTargetIncentiveWorkspaceSectionStatus;
};

export type SalesTargetIncentiveWorkspaceRateBracket = {
  minAchievementPct: string | null;
  maxAchievementPct: string | null;
  rate: string;
  displayLabel: string;
};

export type SalesTargetIncentiveWorkspaceRateTable = {
  audience: "manager" | "personnel";
  version: string;
  brackets: SalesTargetIncentiveWorkspaceRateBracket[];
};

export type SalesTargetIncentiveWorkspaceRateMetadata = {
  status: "resolved" | "unresolved";
  ruleVersionCode: string | null;
  effectiveFrom: string | null;
  periodTimezone: string;
  bracketBoundaryPolicy: "lower_inclusive_upper_exclusive" | null;
  tables: SalesTargetIncentiveWorkspaceRateTable[];
};

export type SalesTargetIncentiveWorkspaceCorrectionActor = {
  displayName: string | null;
  roleCode: "REGION_MANAGER" | "HR_ADMIN" | "SUPER_ADMIN" | null;
  identityStatus: "resolved" | "unavailable";
};

export type SalesTargetIncentiveWorkspaceCorrection = {
  correctionId: string;
  status: "draft" | "submitted" | "admin_approved" | "admin_returned" | "voided";
  beforeAmount: string;
  adjustmentAmount: string;
  finalAmount: string;
  reasonNote: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  actor: SalesTargetIncentiveWorkspaceCorrectionActor;
};

export type SalesTargetIncentiveWorkspaceRow = {
  employeeId: string;
  displayName: string;
  participantType: "store_manager" | "personnel";
  positionCode: string;
  target: string | null;
  actual: string | null;
  achievementPct: string | null;
  rate: string | null;
  calculatedAmount: string | null;
  finalAmount: string | null;
  signedDifferenceAmount: string | null;
  status: "projected" | "blocked" | "no_source" | "corrected" | "adjusted";
  correction: SalesTargetIncentiveWorkspaceCorrection | null;
  correctionRecords: SalesTargetIncentiveWorkspaceCorrection[];
};

export type SalesTargetIncentiveWorkspaceStore = {
  storeId: string;
  storeCode: string | null;
  storeName: string;
  city: null;
  storeTarget: string | null;
  storeActualNetSales: string | null;
  storeAchievementPct: string | null;
  capabilities: {
    canMarkStoreReview: boolean;
    canCreateCorrection: boolean;
    canVoidCorrection: boolean;
  };
  review: {
    status: "pending_review" | "reviewed";
    reviewedAt: string | null;
    periodCloseStatus: "projection_only" | "closed";
  };
  rows: SalesTargetIncentiveWorkspaceRow[];
};

export type SalesTargetIncentiveWorkspaceRegion = {
  regionId: string;
  regionName: string | null;
  regionManager: { displayName: string | null };
  capabilities: { canSubmitPackage: boolean };
  package: {
    status: "not_submitted" | "submitted" | "admin_approved" | "admin_returned";
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
  };
  stores: SalesTargetIncentiveWorkspaceStore[];
};

export type SalesTargetIncentiveWorkspaceResult = {
  period: string;
  periodStart: string;
  periodEnd: string;
  periodTimezone: string;
  view: SalesTargetIncentiveWorkspaceView;
  capabilities: SalesTargetIncentiveWorkspaceCapabilities;
  sections: SalesTargetIncentiveWorkspaceSections;
  rateMetadata: SalesTargetIncentiveWorkspaceRateMetadata;
  regions: SalesTargetIncentiveWorkspaceRegion[];
};
