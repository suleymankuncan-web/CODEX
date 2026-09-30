import { SalesTargetIncentiveWorkspaceReadService } from "./sales-target-incentive-workspace-read.service";

function harness(closed = false) {
  const repository = {
    listParticipationRevisions: jest.fn().mockResolvedValue([]),
    listPersonnelRoster: jest.fn().mockResolvedValue([{ store_id: "store-a", employee_id: "cashier-a",
      assignment_id: "assignment-a", display_name: "Assigned cashier", position_code: "CASHIER",
      current_employment_status: "active", termination_date: null, target_amount: null }]),
    listStoreMetadata: jest.fn().mockResolvedValue([]),
    listClosedRateSnapshots: jest.fn().mockResolvedValue(closed ? [{ store_id: "store-a", final_snapshot_id: "snapshot-a",
      store_target_amount: "1000.00", store_net_sales_amount: "1200.00", store_achievement_pct: "120.00" }] : []),
    listExactRateTables: jest.fn().mockResolvedValue([]),
    listWorkflowAudit: jest.fn().mockResolvedValue({ reviews: [], corrections: [], packages: [] }),
    listCorrectionActors: jest.fn().mockResolvedValue([]),
  };
  const corrections = { listApprovedAdjustmentSummaries: jest.fn().mockResolvedValue([]) };
  const readModel = {
    buildCurrentProjection: jest.fn().mockResolvedValue({ periodKey: "2026-05", periodStart: "2026-05-01", periodEnd: "2026-05-31", timezone: "Europe/Istanbul",
      stores: [{ companyId: "company-a", regionId: "region-a", storeId: "store-a", storeName: "Assigned store",
        storeTargetAmount: "1000.00", storeNetSalesAmount: "1200.00", manager: null, personnel: [] }] }),
    listDailySalesTracking: jest.fn().mockResolvedValue([]),
    listMovementTracking: jest.fn().mockResolvedValue([{ scope_type: "store", store_id: "store-a", sale_amount: "1400.00", return_amount: "-200.00", net_amount: "1200.00" }]),
  };
  const positiveSellers = { list: jest.fn().mockResolvedValue([]), listActivity: jest.fn().mockResolvedValue([]) };
  const service = new SalesTargetIncentiveWorkspaceReadService(readModel as never, corrections as never, repository as never, positiveSellers as never);
  const get = () => service.getWorkspace({ periodKey: "2026-05", actor: {
    userId: "manager-a", roleCodes: ["REGION_MANAGER"], readScope: { companyIds: ["company-a"], regionIds: [], storeIds: [] },
    roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["store-a"] } },
    actionScope: { assignedStoreIds: ["store-a"] },
  } as never });
  return { get, repository, corrections, readModel, positiveSellers };
}

describe("incentive norm roster visibility", () => {
  it.each([false,true])("unions positive sellers with norms while preserving payout and identity; closed=%p",async closed=>{
    const {get,positiveSellers,corrections,repository}=harness(closed);
    const seller={store_id:"store-a",employee_id:"seller-a",personnel_code:"SELLER-A",display_name:"Positive seller",
      position_code:null,current_employment_status:"active",termination_date:null,sale_amount:"100.00",
      return_amount:"-150.00",net_amount:"-50.00",last_positive_date:"2026-05-20",covered_days:15,no_positive_sales_15_days:false};
    positiveSellers.list.mockResolvedValue([seller,{...seller,employee_id:null,personnel_code:"UNKNOWN-A"},
      {...seller,employee_id:"cashier-a"}] as never);
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue(closed?[{store_id:"store-a",employee_id:"cashier-a",participant_type:"personnel",
      final_row_id:"final-a",payable_amount:"12.00",final_amount:"12.00",adjustment_amount:"0.00",actual_sales_amount:"1200.00"}]:[]);
    repository.listParticipationRevisions.mockResolvedValue([{store_id:"store-a",final_snapshot_id:closed?"snapshot-a":null,
      exclusions_json:[{employeeId:"cashier-a",displayName:"Cashier",positionCode:"CASHIER",reasonNote:"Prime dahil değildir"}]}] as never);
    const store=(await get()).managerGroups[0]!.stores[0]!;
    expect(store.rows.map(row=>row.employeeId)).toEqual(["cashier-a","seller-a"]);
    expect(store.rows[1]).toMatchObject({status:"blocked",target:null,actual:null,calculatedAmount:null,finalAmount:null,trackedNetAmount:"-50.00"});
    expect(store.rows[0]).toMatchObject({participation:{included:false},finalAmount:"0.00",actual:closed?"1200.00":null});
    expect(store.positiveSellers?.find(row=>row.personnelCode==="UNKNOWN-A")?.employeeId).toBeNull();
  });
  it("preserves the workspace and exposes an unavailable positive-seller section on query failure",async()=>{
    const {get,positiveSellers}=harness();
    positiveSellers.list.mockRejectedValueOnce(new Error("bounded read failed"));
    const result=await get();
    expect(result.sections.positiveSellers).toEqual({status:"unavailable"});
    expect(result.managerGroups[0]!.stores[0]!.rows).toHaveLength(1);
  });

  it.each([false, true])("shows assigned targetless personnel without fabricating payout or changing store sales; closed=%p", async (closed) => {
    const { get, repository } = harness(closed);
    const result = await get();
    const store = result.managerGroups[0]!.stores[0]!;
    expect(store.rows).toEqual([expect.objectContaining({ employeeId: "cashier-a", positionCode: "CASHIER", target: null,
      calculatedAmount: null, finalAmount: null, status: "blocked" })]);
    expect([store.storeActualNetSales, store.trackedSaleAmount, store.trackedReturnAmount, store.trackedNetAmount]).toEqual(["1200.00", "1400.00", "-200.00", "1200.00"]);
    expect(repository.listPersonnelRoster).toHaveBeenCalledWith({ storeIds: ["store-a"], assignmentAsOfDate: "2026-05-31", periodStart: "2026-05-01", periodEnd: "2026-05-31" });
  });

  it("does not duplicate an employee or rewrite immutable final amounts when their current position differs", async () => {
    const { get, corrections } = harness(true);
    corrections.listApprovedAdjustmentSummaries.mockResolvedValue([{ store_id: "store-a", employee_id: "cashier-a", participant_type: "store_manager",
      final_row_id: "final-row-a", employee_display_name: "Historical manager", position_code: "STORE_MANAGER",
      target_amount: "1000.00", actual_sales_amount: "1200.00", payable_amount: "12.00", final_amount: "12.00", adjustment_amount: "0.00" }] as never);
    const store = (await get()).managerGroups[0]!.stores[0]!;
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ displayName: "Historical manager", positionCode: "STORE_MANAGER", calculatedAmount: "12.00", finalAmount: "12.00" });
  });

  it("fails closed when the norm roster is unavailable rather than silently omitting personnel", async () => {
    const { get, repository } = harness();
    repository.listPersonnelRoster.mockRejectedValue(new Error("roster unavailable"));
    await expect(get()).rejects.toThrow("roster unavailable");
  });

  it("does not duplicate norm personnel in out-of-roster returns despite a stale active-roster marker", async () => {
    const { get, readModel } = harness();
    readModel.listMovementTracking.mockResolvedValue([{
      scope_type: "employee", store_id: "store-a", employee_id: "cashier-a", display_name: "Assigned cashier",
      sale_amount: "0.00", return_amount: "-5.00", net_amount: "-5.00", is_active_roster: false,
    }, {
      scope_type: "employee", store_id: "store-a", employee_id: "former-a", display_name: "Former employee",
      sale_amount: "0.00", return_amount: "-10.00", net_amount: "-10.00", is_active_roster: false,
    }] as never);
    const store = (await get()).managerGroups[0]!.stores[0]!;
    expect(store.rows[0]).toMatchObject({ employeeId: "cashier-a", trackedReturnAmount: "-5.00" });
    expect(store.outOfRosterReturns.map((person) => person.employeeId)).toEqual(["former-a"]);
  });
});
