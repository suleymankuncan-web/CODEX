import type { PersonnelRankingRow } from "./ranking.contract";

export type RankingActiveAssignment = {
  employee_id: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
};

export function filterPersonnelByActiveAssignmentScope<Row extends PersonnelRankingRow>(
  rows: Row[],
  input: {
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
    requestedRegionId?: string;
    requestedStoreId?: string;
    assignmentByEmployeeId: Map<string, RankingActiveAssignment>;
  },
) {
  const managerStoreIds = unique([...input.assignedStoreIds, ...input.storeIds]);

  return rows.filter((row) => {
    const assignment = input.assignmentByEmployeeId.get(row.employeeId);
    const isSuperAdmin = input.roleCodes.includes("SUPER_ADMIN");
    if (!assignment) return isSuperAdmin && !input.requestedStoreId && !input.requestedRegionId;

    if (input.roleCodes.includes("REPORT_VIEWER")) {
      if (assignment.company_id === null || !input.companyIds.includes(assignment.company_id)) {
        return false;
      }
    } else if (!isSuperAdmin && input.roleCodes.includes("REGION_MANAGER")) {
      const insideAssignedScope = managerStoreIds.length > 0
        ? assignment.store_id !== null && managerStoreIds.includes(assignment.store_id)
        : assignment.region_id !== null && input.regionIds.includes(assignment.region_id);
      if (!insideAssignedScope) return false;
    }

    if (input.requestedStoreId && assignment.store_id !== input.requestedStoreId) return false;
    if (input.requestedRegionId && assignment.region_id !== input.requestedRegionId) return false;
    return true;
  });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
