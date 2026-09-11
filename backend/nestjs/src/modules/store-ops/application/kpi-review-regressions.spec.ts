import { ReportingService } from "./reporting.service";
import { RankingService } from "./ranking.service";
import { storeKpiScoreProfile } from "./kpi-config.contract";

const period = {period_type: "monthly", period_start: "2026-09-01", period_end: "2026-09-30"};
const employeeId = "00000000-0000-4000-8000-000000000001";
function fixture() {
  const storeRows = storeKpiScoreProfile.metrics.filter(m => !m.code.includes("CHECKLIST")).map(m => ({
    store_id: "store-1", store_name: "Store", region_id: "region-1", region_name: "Region",
    region_manager_user_id: "manager", region_manager_name: "Manager", kpi_code: m.code, kpi_name: m.label,
    actual_value: "100", target_value: "100", achievement_rate: "1",
  }));
  const assignment = {employee_id: employeeId, company_id: "company-1", region_id: "region-1", store_id: "store-1", first_name: "Demo", last_name: "Person", store_name: "Store"};
  const repository = {
    resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
    getActiveEmployeeAssignmentScope: jest.fn(async () => assignment),
    getActiveEmployeeAssignmentScopes: jest.fn(async () => []),
    getActiveStorePersonnelScopeSummary: jest.fn(async () => ({active_personnel_count: "1", store_count: "1"})),
    getStoreNameById: jest.fn(async () => "Store"), listStoreKpiPeriods: jest.fn(async () => [period]),
    getLatestStoreKpiPeriod: jest.fn(async () => period), getLatestRankingPeriod: jest.fn(async () => period),
    listRankingAvailablePeriods: jest.fn(async () => [period]), getStorePerformanceRows: jest.fn(async () => storeRows),
    listRankingStoreKpiRows: jest.fn(async () => storeRows), listRankingStoreChecklistRows: jest.fn(async () => []),
    listRankingPersonnelKpiRows: jest.fn(async () => [] as Array<Record<string, unknown>>),
    getStoreTurkeyBenchmarkValues: jest.fn(async () => storeRows.map(row => ({kpi_code: row.kpi_code, benchmark_value: "100"}))),
    getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [{kpi_code: "ATV", benchmark_value: "300"}, {kpi_code: "UPT", benchmark_value: "3"}]),
    listEmployeeKpiPeriods: jest.fn(async () => [period]),
  };
  const config = {getKpiConfigRows: jest.fn(async () => []), getLatestPublishedKpiConfigVersion: jest.fn(async () => null)};
  const reporting = new ReportingService(repository as never, config as never, {} as never, {} as never, repository as never, repository as never, repository as never, repository as never, repository as never);
  const ranking = new RankingService(repository as never, config as never, repository as never, repository as never);
  return {repository, reporting, ranking};
}
const scope = {userId: "manager", companyIds: ["company-1"], regionIds: ["region-1"], storeIds: ["store-1"], assignedStoreIds: ["store-1"]};

describe("KPI review regressions", () => {
  it("uses real KPI values and the same checklist redistribution in list and detail", async () => {
    const {reporting, ranking} = fixture();
    const detail = await reporting.getStoreKpiHighlights({...scope, periodType: "monthly", periodStart: period.period_start});
    const list = await ranking.getRankings({...scope, roleCodes: ["STORE_MANAGER"], periodType: "monthly", periodStart: period.period_start});
    expect(detail.score.value * 100).toBe(70);
    expect(list.storeLeaderboard.currentStore?.scoreValue).toBe(detail.score.value * 100);
  });
  it("exposes aggregate ranks for an authorized region manager only", async () => {
    const {ranking} = fixture();
    const own = await ranking.getRankings({...scope, roleCodes: ["REGION_MANAGER"], storeId: "store-1"});
    expect(own.storeLeaderboard.currentStoreComparisons?.find(r => r.code === "ATV")?.region.rank).toBe(1);
    const denied = await ranking.getRankings({...scope, storeIds: ["other"], assignedStoreIds: ["other"], regionIds: ["other"], roleCodes: ["REGION_MANAGER"], storeId: "store-1"});
    expect(denied.storeLeaderboard.currentStoreComparisons).toBeUndefined();
  });
  it("uses the same personnel range facts and prorated target in profile and ranking", async () => {
    const {repository, reporting, ranking} = fixture();
    repository.getActiveEmployeeAssignmentScopes.mockResolvedValue([{employee_id: employeeId, store_id: "store-1", region_id: "region-1", company_id: "company-1"}] as never);
    const facts = [["TARGET_ACHIEVEMENT", "600", "500"], ["NET_SALES", "600", "500"], ["ATV", "300", null], ["UPT", "3", null]].map(([code, actual, target]) => ({
      employee_id: employeeId, first_name: "Demo", last_name: "Person", store_id: "store-1", store_name: "Store", region_id: "region-1", region_name: "Region",
      region_manager_user_id: "manager", region_manager_name: "Manager", position_code: "SALES_ASSOCIATE", net_sales_value: "600", store_net_sales_value: "600",
      kpi_code: code, kpi_name: code, actual_value: actual, target_value: target,
    }));
    repository.listRankingPersonnelKpiRows.mockResolvedValue(facts);
    const input = {...scope, roleCodes: ["STORE_MANAGER"], periodType: "daily" as const, periodStart: "2026-09-05", periodEnd: "2026-09-10"};
    const profile = await reporting.getPersonnelPerformance({...input, targetEmployeeId: employeeId});
    const list = await ranking.getRankings(input);
    expect(profile.period).toEqual({periodStart: input.periodStart, periodEnd: input.periodEnd});
    expect(profile.score.value).toBe(75.6);
    expect(list.personnelLeaderboard.managedStorePersonnel[0].scoreValue).toBe(profile.score.value);
    expect(profile.metrics.find(m => m.code === "TARGET_ACHIEVEMENT")).toMatchObject({targetValue: 500});
    expect(repository.listRankingPersonnelKpiRows).toHaveBeenCalledWith(expect.objectContaining({isRange: true, periodEnd: input.periodEnd}));
    await expect(reporting.getPersonnelPerformance({...input, targetEmployeeId: employeeId, storeIds: ["other"], assignedStoreIds: ["other"]})).rejects.toThrow();
  });
});
