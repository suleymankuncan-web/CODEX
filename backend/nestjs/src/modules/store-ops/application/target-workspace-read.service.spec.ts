import { ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { TargetWorkspaceReadService } from "./target-workspace-read.service";

// Traceability: TGT-FR-001..007, NFR-005..008/011, AC-TGT-001/003/006, EC-001..009/015/017/022.

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000011";
const storeA = "00000000-0000-4000-8000-000000000101";
const storeB = "00000000-0000-4000-8000-000000000102";

function storeRow(overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId, company_name: "HR Axis", region_id: regionId,
    region_name: "Marmara", region_manager_name: "Bölge Müdürü",
    store_id: storeA, store_code: "ST-01", store_name: "Mağaza A", store_status: "active",
    request_id: "00000000-0000-4000-8000-000000000701",
    request_status: "pending_region_approval", target_label: "Temmuz hedefi",
    total_target_value: "1000.0000", allocation_count: 1, request_reason: "İlk dağılım",
    allocation_json: [{ employeeId: "00000000-0000-4000-8000-000000000201", assigneeLabel: "Personel A", targetValue: 1000 }],
    approved_at: null, approval_note: null, approval_evidence_json: null,
    created_at: "2026-07-01T08:00:00.000Z", updated_at: "2026-07-01T08:00:00.000Z",
    has_revision_conflict: false, has_stale_reference: false,
    ...overrides,
  };
}

function repository(overrides: Record<string, unknown> = {}) {
  return {
    summarizeScope: jest.fn().mockResolvedValue({
      totalStores: 2, pendingStores: 1, approvedStores: 0,
      adjustedApprovedStores: 0, returnedStores: 0, missingStores: 1,
      totalTargetValue: "1000.0000",
    }),
    listHierarchy: jest.fn().mockResolvedValue([{
      company_id: companyId, company_name: "HR Axis", region_id: regionId,
      region_name: "Marmara", manager_assignment_exists: true, region_manager_name: "Bölge Müdürü",
    }]),
    listStorePage: jest.fn().mockResolvedValue({
      items: [storeRow(), storeRow({
        store_id: storeB, store_code: "ST-02", store_name: "Mağaza B",
        request_id: null, request_status: null, target_label: null,
        total_target_value: null, allocation_count: null, request_reason: null,
        allocation_json: null, created_at: null, updated_at: null,
      })],
      total: 2, limit: 50, offset: 0,
    }),
    listPersonnel: jest.fn().mockResolvedValue([{
      store_id: storeA, employee_id: "00000000-0000-4000-8000-000000000201",
      display_name: "Personel A", position_code: "SALES_ASSOCIATE", position_name: "Satış Danışmanı",
    }]),
    listMonthStatuses: jest.fn().mockResolvedValue([
      {
        store_id: storeA, request_month: "2026-05-01", request_status: "approved", approval_evidence_json: null,
        approved_source_count: 1, approved_source_status: "approved", approved_source_evidence_json: null,
      },
      {
        store_id: storeA, request_month: "2026-06-01", request_status: "approved",
        approval_evidence_json: {
          approvalMode: "adjusted", originalTotalTargetValue: 900, approvedTotalTargetValue: 1000,
          originalAllocations: [{ employeeId: "00000000-0000-4000-8000-000000000201", assigneeLabel: "Personel A", targetValue: 900 }],
          approvedAllocations: [{ employeeId: "00000000-0000-4000-8000-000000000201", assigneeLabel: "Personel A", targetValue: 1000 }],
        },
        approved_source_count: 1, approved_source_status: "approved",
        approved_source_evidence_json: {
          approvalMode: "adjusted", originalTotalTargetValue: 900, approvedTotalTargetValue: 1000,
          originalAllocations: [], approvedAllocations: [],
        },
      },
    ]),
    ...overrides,
  };
}

function regionManagerActor(storeIds: string[]) {
  return buildAuthenticatedUser({
    userId: "u", roleCodes: ["REGION_MANAGER"], actionScope: { assignedStoreIds: storeIds },
    roleScopes: {
      REGION_MANAGER: { companyIds: [companyId], regionIds: [regionId], storeIds: [] },
    },
  });
}

describe("TargetWorkspaceReadService", () => {
  it("returns a company hierarchy, complete missing store, safe personnel and persisted month truth", async () => {
    const repo = repository();
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000901",
      roleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      readScope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
      actionScope: { assignedStoreIds: [storeA] },
      roleScopes: { REPORT_VIEWER: { companyIds: [companyId], regionIds: [], storeIds: [] } },
    });

    const result = await service.getWorkspace({ actor, periodKey: "2026-07", historyYear: 2026, limit: 50, offset: 0 });

    expect(repo.listStorePage).toHaveBeenCalledWith({
      scope: { companyIds: [companyId], regionIds: [], storeIds: [] },
      periodStart: "2026-07-01", periodEnd: "2026-07-31", limit: 50, offset: 0,
    });
    expect(result.view).toBe("report_viewer");
    expect(result.capabilities).toEqual({ canCreateRequest: false, canApproveRequest: false });
    expect(result.sections).toEqual({
      hierarchy: { status: "available" }, summary: { status: "available" },
      personnel: { status: "available" }, monthStatuses: { status: "available" },
    });
    expect(result.warnings).toEqual([]);
    expect(result.pagination).toEqual({ total: 2, limit: 50, offset: 0, hasMore: false });
    expect(result.companies[0].regions[0].regionManager).toEqual({ displayName: "Bölge Müdürü", identityStatus: "resolved" });
    expect(result.companies[0].regions[0].stores).toHaveLength(2);
    const first = result.companies[0].regions[0].stores[0];
    expect(first.personnel).toEqual([expect.objectContaining({
      displayName: "Personel A", positionLabel: "Satış Danışmanı", targetValue: "1000",
    })]);
    expect(first.monthStatuses).toHaveLength(12);
    expect(first.monthStatuses.find((item) => item.period === "2026-05")).toEqual({
      period: "2026-05", status: "approved", approvalStatus: "approved", isApproved: true,
    });
    expect(first.monthStatuses.find((item) => item.period === "2026-06")).toEqual({
      period: "2026-06", status: "adjusted_approved", approvalStatus: "adjusted_approved", isApproved: true,
    });
    expect(first.monthStatuses.find((item) => item.period === "2026-04")).toEqual({
      period: "2026-04", status: "unknown", approvalStatus: null, isApproved: false,
    });
    expect(result.companies[0].regions[0].stores[1]).toEqual(expect.objectContaining({ status: "missing", request: null, personnel: [] }));
  });

  it("grants Store Manager create capability only on its exact own store", async () => {
    const repo = repository({ listStorePage: jest.fn().mockResolvedValue({ items: [storeRow()], total: 1, limit: 20, offset: 0 }) });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000902", roleCodes: ["STORE_MANAGER"],
      readScope: { companyIds: [], regionIds: [], storeIds: [storeA, storeB] },
      actionScope: { assignedStoreIds: [storeA, storeB] },
      roleScopes: { STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeA] } },
    });
    const result = await service.getWorkspace({ actor, periodKey: "2026-07", limit: 20 });
    expect(repo.listStorePage).toHaveBeenCalledWith(expect.objectContaining({ scope: { companyIds: [], regionIds: [], storeIds: [storeA] } }));
    expect(result.view).toBe("store_manager");
    expect(result.companies[0].regions[0].stores[0].capabilities).toEqual({ canCreateRequest: true, canApproveRequest: false });
  });

  it("maps persisted lifecycle and integrity states without date inference", async () => {
    const repo = repository({
      listStorePage: jest.fn().mockResolvedValue({
        items: [
          storeRow({ store_id: "1", store_name: "Adjusted", request_status: "approved", approval_evidence_json: { approvalMode: "adjusted", originalTotalTargetValue: 1, approvedTotalTargetValue: 1, originalAllocations: [], approvedAllocations: [] } }),
          storeRow({ store_id: "2", store_name: "Returned", request_status: "rejected" }),
          storeRow({ store_id: "3", store_name: "Conflict", has_revision_conflict: true }),
          storeRow({ store_id: "4", store_name: "Stale", request_id: null, request_status: null, has_stale_reference: true }),
        ], total: 4, limit: 50, offset: 0,
      }),
      listPersonnel: jest.fn().mockResolvedValue([]), listMonthStatuses: jest.fn().mockResolvedValue([]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = regionManagerActor(["1", "2", "3", "4"]);
    const result = await service.getWorkspace({ actor, periodKey: "2026-07" });
    expect(result.companies[0].regions[0].stores.map((item) => item.status)).toEqual([
      "adjusted_approved", "returned", "revision_conflict", "stale_reference",
    ]);
  });

  it("reports deterministic continuation for a scope larger than one server page", async () => {
    const repo = repository({
      listStorePage: jest.fn().mockResolvedValue({
        items: [storeRow({ region_manager_name: null })], total: 35, limit: 20, offset: 0,
      }),
      listHierarchy: jest.fn().mockResolvedValue([{
        company_id: companyId, company_name: "HR Axis", region_id: regionId,
        region_name: "Marmara", manager_assignment_exists: false, region_manager_name: null,
      }]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = regionManagerActor([storeA]);
    const result = await service.getWorkspace({ actor, periodKey: "2026-07", limit: 20 });
    expect(result.pagination).toEqual({ total: 35, limit: 20, offset: 0, hasMore: true });
    expect(result.companies[0].regions[0].regionManager).toEqual({
      displayName: null, identityStatus: "unassigned",
    });
  });

  it("returns an empty typed workspace without repository access when persona scope is absent", async () => {
    const repo = repository();
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = buildAuthenticatedUser({ userId: "u", roleCodes: ["REPORT_VIEWER"], roleScopes: {} });
    const result = await service.getWorkspace({ actor, periodKey: "2026-07" });
    expect(result.companies).toEqual([]);
    expect(result.summary?.totalStores).toBe(0);
    expect(repo.listStorePage).not.toHaveBeenCalled();
  });

  it("rejects roles outside the workspace", async () => {
    const service = new TargetWorkspaceReadService(repository() as never);
    const actor = buildAuthenticatedUser({ userId: "u", roleCodes: ["STORE_PERSONNEL"] });
    await expect(service.getWorkspace({ actor, periodKey: "2026-07" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps active approved basis truth when the latest request is pending or returned", async () => {
    const adjustedEvidence = {
      approvalMode: "adjusted", originalTotalTargetValue: 900, approvedTotalTargetValue: 1000,
      originalAllocations: [], approvedAllocations: [],
    };
    const repo = repository({
      listStorePage: jest.fn().mockResolvedValue({ items: [storeRow()], total: 1, limit: 50, offset: 0 }),
      listMonthStatuses: jest.fn().mockResolvedValue([
        {
          store_id: storeA, request_month: "2026-05-01", request_status: "pending_region_approval",
          approval_evidence_json: null, approved_source_count: 1,
          approved_source_status: "approved", approved_source_evidence_json: null,
        },
        {
          store_id: storeA, request_month: "2026-06-01", request_status: "rejected",
          approval_evidence_json: null, approved_source_count: 1,
          approved_source_status: "approved", approved_source_evidence_json: adjustedEvidence,
        },
      ]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = regionManagerActor([storeA]);
    const result = await service.getWorkspace({ actor, periodKey: "2026-07", historyYear: 2026 });
    const months = result.companies[0].regions[0].stores[0].monthStatuses;
    expect(months.find((item) => item.period === "2026-05")).toEqual({
      period: "2026-05", status: "pending", approvalStatus: "approved", isApproved: true,
    });
    expect(months.find((item) => item.period === "2026-06")).toEqual({
      period: "2026-06", status: "returned", approvalStatus: "adjusted_approved", isApproved: true,
    });
  });

  it.each([
    ["listHierarchy", "hierarchy", "hierarchy_unavailable"],
    ["summarizeScope", "summary", "summary_unavailable"],
    ["listPersonnel", "personnel", "personnel_unavailable"],
    ["listMonthStatuses", "monthStatuses", "month_statuses_unavailable"],
  ] as const)("returns typed partial data when %s fails", async (method, section, warning) => {
    const repo = repository({ [method]: jest.fn().mockRejectedValue(new Error("private repository failure")) });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = regionManagerActor([storeA]);
    const result = await service.getWorkspace({ actor, periodKey: "2026-07" });
    expect(result.sections[section]).toEqual({ status: "unavailable" });
    expect(result.warnings).toContain(warning);
    if (method === "summarizeScope") expect(result.summary).toBeNull();
    if (method === "listHierarchy") expect(result.companies[0].regions[0].stores).toHaveLength(2);
    if (method === "listPersonnel") {
      expect(result.companies[0].regions[0].stores[0].personnel).toEqual([
        expect.objectContaining({ eligibilityStatus: "historical_allocation" }),
      ]);
    }
    if (method === "listMonthStatuses") {
      expect(result.companies[0].regions[0].stores[0].monthStatuses).toHaveLength(12);
    }
  });

  it("preserves empty companies and regions and distinguishes unavailable manager identity", async () => {
    const emptyCompany = "00000000-0000-4000-8000-000000000002";
    const emptyRegion = "00000000-0000-4000-8000-000000000012";
    const repo = repository({
      listHierarchy: jest.fn().mockResolvedValue([
        {
          company_id: companyId, company_name: "HR Axis", region_id: regionId,
          region_name: "Marmara", manager_assignment_exists: true, region_manager_name: null,
        },
        {
          company_id: companyId, company_name: "HR Axis", region_id: emptyRegion,
          region_name: "Empty", manager_assignment_exists: false, region_manager_name: null,
        },
        {
          company_id: emptyCompany, company_name: "No regions", region_id: null,
          region_name: null, manager_assignment_exists: false, region_manager_name: null,
        },
      ]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = buildAuthenticatedUser({
      userId: "u", roleCodes: ["REPORT_VIEWER"],
      roleScopes: { REPORT_VIEWER: { companyIds: [companyId, emptyCompany], regionIds: [], storeIds: [] } },
    });
    const result = await service.getWorkspace({ actor, periodKey: "2026-07" });
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0].regions[0].regionManager.identityStatus).toBe("unavailable");
    expect(result.companies[0].regions[1].stores).toEqual([]);
    expect(result.companies[1].regions).toEqual([]);
  });

  it("reports conflicting active approval bases without claiming approval", async () => {
    const repo = repository({
      listMonthStatuses: jest.fn().mockResolvedValue([{
        store_id: storeA, request_month: "2026-05-01", request_status: "pending_region_approval",
        approval_evidence_json: null, approved_source_count: 2,
        approved_source_status: "approved", approved_source_evidence_json: null,
      }]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const actor = regionManagerActor([storeA]);
    const result = await service.getWorkspace({ actor, periodKey: "2026-07", historyYear: 2026 });
    expect(result.warnings).toContain("approval_basis_conflict");
    expect(result.companies[0].regions[0].stores[0].monthStatuses[4]).toEqual({
      period: "2026-05", status: "pending", approvalStatus: null, isApproved: false,
    });
  });

  it("classifies malformed adjusted evidence consistently as direct approval", async () => {
    const malformed = { approvalMode: "adjusted", originalTotalTargetValue: 900, approvedTotalTargetValue: 1000 };
    const repo = repository({
      listStorePage: jest.fn().mockResolvedValue({
        items: [storeRow({ request_status: "approved", approval_evidence_json: malformed })],
        total: 1, limit: 50, offset: 0,
      }),
      listMonthStatuses: jest.fn().mockResolvedValue([{
        store_id: storeA, request_month: "2026-05-01", request_status: "approved",
        approval_evidence_json: malformed, approved_source_count: 1,
        approved_source_status: "approved", approved_source_evidence_json: malformed,
      }]),
    });
    const service = new TargetWorkspaceReadService(repo as never);
    const result = await service.getWorkspace({
      actor: regionManagerActor([storeA]), periodKey: "2026-07", historyYear: 2026,
    });
    const store = result.companies[0].regions[0].stores[0];
    expect(store.status).toBe("approved");
    expect(store.request?.approvalMode).toBe("direct");
    expect(store.monthStatuses[4]).toEqual({
      period: "2026-05", status: "approved", approvalStatus: "approved", isApproved: true,
    });
  });
});
