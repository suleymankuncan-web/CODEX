import type { TargetWorkspaceCapabilities, TargetWorkspaceView } from "./target-workspace-scope";

export const TARGET_WORKSPACE_TIMEZONE = "Europe/Istanbul";

export type TargetWorkspaceStatus =
  | "pending"
  | "approved"
  | "adjusted_approved"
  | "returned"
  | "revision_conflict"
  | "stale_reference"
  | "missing"
  | "unknown";

export type TargetWorkspaceMonthStatus = {
  period: string;
  status: "pending" | "approved" | "adjusted_approved" | "returned" | "unknown";
  approvalStatus: "approved" | "adjusted_approved" | null;
  isApproved: boolean;
};

export type TargetWorkspaceSectionStatus = "available" | "unavailable";
export type TargetWorkspaceWarning =
  | "hierarchy_unavailable"
  | "summary_unavailable"
  | "personnel_unavailable"
  | "month_statuses_unavailable"
  | "approval_basis_conflict";

export type TargetWorkspacePersonnel = {
  employeeId: string;
  displayName: string;
  positionCode: string | null;
  positionLabel: string | null;
  targetValue: string | null;
  actualSales?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  eligibilityStatus: "targetable" | "historical_allocation";
};

export type TargetWorkspaceRequest = {
  requestId: string;
  status: "pending_region_approval" | "approved" | "rejected" | "unknown";
  targetLabel: string;
  totalTargetValue: string;
  allocationCount: number;
  requestReason: string | null;
  approvalMode: "direct" | "adjusted" | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string;
  allocations: Array<{
    employeeId: string;
    displayName: string;
    targetValue: string;
    distributionDays?: number;
    note: string | null;
  }>;
};

export type TargetWorkspaceStore = {
  storeId: string;
  storeCode: string;
  storeName: string;
  city: null;
  storeStatus: string;
  status: TargetWorkspaceStatus;
  capabilities: TargetWorkspaceCapabilities;
  request: TargetWorkspaceRequest | null;
  personnel: TargetWorkspacePersonnel[];
  monthStatuses: TargetWorkspaceMonthStatus[];
};

export type TargetWorkspaceRegion = {
  regionId: string;
  regionName: string | null;
  regionManager: {
    displayName: string | null;
    identityStatus: "resolved" | "unassigned" | "unavailable";
  };
  stores: TargetWorkspaceStore[];
};

export type TargetWorkspaceCompany = {
  companyId: string;
  companyName: string | null;
  regions: TargetWorkspaceRegion[];
};

export type TargetWorkspaceResult = {
  period: string;
  periodStart: string;
  periodEnd: string;
  periodTimezone: typeof TARGET_WORKSPACE_TIMEZONE;
  historyYear: number;
  view: TargetWorkspaceView;
  capabilities: TargetWorkspaceCapabilities;
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  sections: {
    hierarchy: { status: TargetWorkspaceSectionStatus };
    summary: { status: TargetWorkspaceSectionStatus };
    personnel: { status: TargetWorkspaceSectionStatus };
    monthStatuses: { status: TargetWorkspaceSectionStatus };
  };
  warnings: TargetWorkspaceWarning[];
  summary: {
    totalStores: number;
    pendingStores: number;
    approvedStores: number;
    adjustedApprovedStores: number;
    returnedStores: number;
    missingStores: number;
    totalTargetValue: string;
  } | null;
  companies: TargetWorkspaceCompany[];
};
