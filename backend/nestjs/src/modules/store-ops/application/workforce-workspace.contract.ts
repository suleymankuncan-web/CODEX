import type { WorkforceWorkspaceView } from "./workforce-workspace-scope";

export type WorkforceWorkspacePerson = {
  employeeId: string;
  displayName: string;
  positionId: string;
  positionCode: string;
  positionName: string;
  assignmentStartDate: string | null;
  employmentStatus: string;
};

export type WorkforceWorkspaceStore = {
  companyId: string;
  companyName: string | null;
  regionId: string;
  regionName: string | null;
  regionManagerName: string | null;
  storeId: string;
  storeCode: string;
  storeName: string;
  storeStatus: string;
  norm: number | null;
  active: number;
  averageTenureDays: number | null;
  gap: number | null;
  shortageDays: number | null;
  personnel: WorkforceWorkspacePerson[];
  personnelTotal: number;
  personnelLimit: number;
  personnelOffset: number;
  personnelHasMore: boolean;
};

export type WorkforceWorkspaceHistoryRow = {
  employeeId: string;
  displayName: string;
  entryDate: string;
  exitDate: string | null;
  totalWorkingDays: number | null;
};

export type WorkforceCommandWorkspace = {
  view: WorkforceWorkspaceView;
  summary: {
    totalStores: number;
    activePersonnel: number;
    shortageStores: number;
    openPositions: number;
    averageTenureDays: number | null;
  };
  stores: {
    items: WorkforceWorkspaceStore[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  history: {
    storeId: string;
    items: WorkforceWorkspaceHistoryRow[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  capabilities: {
    canCreateSellerCodeRequest: boolean;
    canCreateOffboardingRequest: boolean;
  };
};
