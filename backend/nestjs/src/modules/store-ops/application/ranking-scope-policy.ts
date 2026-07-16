export type RankingScopePolicyInput = {
  roleCodes: string[];
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  assignedStoreIds: string[];
};

export function resolveRankingScopePolicy(input: RankingScopePolicyInput) {
  const isReportViewer = input.roleCodes.includes("REPORT_VIEWER");
  const isSuperAdmin = input.roleCodes.includes("SUPER_ADMIN");
  const isRegionManager = input.roleCodes.includes("REGION_MANAGER");
  const hasAssignedRegionOrStore =
    input.regionIds.length > 0 ||
    input.storeIds.length > 0 ||
    input.assignedStoreIds.length > 0;

  return {
    failClosed:
      (isReportViewer && input.companyIds.length === 0) ||
      (!isReportViewer && !isSuperAdmin && isRegionManager && !hasAssignedRegionOrStore),
    enforceAssignedReadScope: !isReportViewer && !isSuperAdmin && isRegionManager,
  };
}
