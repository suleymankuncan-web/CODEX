import type { PersonnelRankingRow } from "./ranking.contract";
import { filterPersonnelByActiveAssignmentScope } from "./ranking-personnel-scope";

describe("ranking personnel active-assignment scope", () => {
  const rows = [row("inside-history", "region-2", "store-2"), row("outside-history", "region-1", "store-1")];

  it("keeps a historical outside row when the active assignment is inside and drops the inverse", () => {
    const result = filterPersonnelByActiveAssignmentScope(rows, {
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      assignmentByEmployeeId: new Map([
        ["inside-history", assignment("inside-history", "company-1", "region-1", "store-1")],
        ["outside-history", assignment("outside-history", "company-1", "region-2", "store-2")],
      ]),
    });

    expect(result.map((candidate) => candidate.employeeId)).toEqual(["inside-history"]);
    expect(result[0]).toEqual(expect.objectContaining({ regionId: "region-2", storeId: "store-2" }));
  });

  it("fails missing active assignments and out-of-company Report Viewer rows closed", () => {
    const result = filterPersonnelByActiveAssignmentScope(rows, {
      roleCodes: ["REPORT_VIEWER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      assignmentByEmployeeId: new Map([
        ["outside-history", assignment("outside-history", "company-2", "region-1", "store-1")],
      ]),
    });

    expect(result).toEqual([]);
  });

  it("applies requested store filters to the active assignment", () => {
    const result = filterPersonnelByActiveAssignmentScope(rows, {
      roleCodes: ["SUPER_ADMIN"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      requestedStoreId: "store-1",
      assignmentByEmployeeId: new Map([
        ["inside-history", assignment("inside-history", "company-1", "region-1", "store-1")],
        ["outside-history", assignment("outside-history", "company-1", "region-2", "store-2")],
      ]),
    });

    expect(result.map((candidate) => candidate.employeeId)).toEqual(["inside-history"]);
  });
});

function assignment(employeeId: string, companyId: string, regionId: string, storeId: string) {
  return { employee_id: employeeId, company_id: companyId, region_id: regionId, store_id: storeId };
}

function row(employeeId: string, regionId: string, storeId: string): PersonnelRankingRow {
  return {
    subject: "personnel", employeeId, displayName: employeeId, storeId, storeName: storeId,
    regionId, regionName: regionId, regionManagerUserId: null, regionManagerName: null,
    rank: 1, population: 2, storeRank: 1, storePopulation: 1, scoreValue: 80,
    canOpenProfile: false, visibility: "detail", metrics: [],
  };
}
