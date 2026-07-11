import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { StoreActionPlanTransitionConflictError } from "../infrastructure/store-action-plan.repository";
import { StoreActionPlanService } from "./store-action-plan.service";

const assignedStoreId = "00000000-0000-4000-8000-000000000201";
const unassignedStoreId = "00000000-0000-4000-8000-000000000202";

function createHarness() {
  const storeActionPlanRepository = {
    createPlan: jest.fn(),
    getPlanById: jest.fn(),
    getPlanByIdInCompanyScope: jest.fn(),
    listPlans: jest.fn(),
    updateStatus: jest.fn(),
    closePlan: jest.fn(),
    cancelPlan: jest.fn(),
  };
  const storeOpsRepository = {
    listStoresByScope: jest.fn(),
  };
  const service = new StoreActionPlanService(
    storeActionPlanRepository as never,
    storeOpsRepository as never,
  );

  return {
    service,
    storeActionPlanRepository,
    storeOpsRepository,
  };
}

function createPlanInput(overrides: Record<string, unknown> = {}) {
  return {
    actorUserId: "00000000-0000-4000-8000-000000000901",
    actorScope: {
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: ["00000000-0000-4000-8000-000000000010"],
      storeIds: [assignedStoreId],
    },
    actorActionScope: {
      assignedStoreIds: [assignedStoreId],
    },
    storeId: assignedStoreId,
    sourceType: "kpi_exception",
    sourceId: "snapshot-1:store-1:kpi-1",
    sourceDeepLink: "/store/kpis?kpi=kpi-1",
    sourceSnapshotRunId: "00000000-0000-4000-8000-000000000301",
    sourceKpiId: "00000000-0000-4000-8000-000000000401",
    title: "Net sales off track",
    summary: "Follow up on KPI exception",
    priority: "high",
    dueOn: "2026-06-01",
    ...overrides,
  } as const;
}

function existingPlan(overrides: Record<string, unknown> = {}) {
  return {
    actionPlanId: "00000000-0000-4000-8000-000000000701",
    companyId: "00000000-0000-4000-8000-000000000001",
    regionId: "00000000-0000-4000-8000-000000000010",
    storeId: assignedStoreId,
    storeName: "Marmara Park",
    ownerUserId: "00000000-0000-4000-8000-000000000901",
    ownerDisplayName: "Mert Alcan",
    createdByUserId: "00000000-0000-4000-8000-000000000901",
    sourceType: "kpi_exception",
    sourceId: "snapshot-1:store-1:kpi-1",
    sourceDeepLink: "/store/kpis?kpi=kpi-1",
    sourceSnapshotRunId: "00000000-0000-4000-8000-000000000301",
    sourceKpiId: "00000000-0000-4000-8000-000000000401",
    title: "Net sales off track",
    summary: "Follow up on KPI exception",
    priority: "high",
    status: "open",
    dueOn: "2026-06-01",
    resolutionNote: null,
    closedByUserId: null,
    closedAt: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: "2026-05-22T08:00:00.000Z",
    updatedAt: "2026-05-22T08:00:00.000Z",
    ...overrides,
  };
}

describe("StoreActionPlanService", () => {
  it("creates a plan only for an assigned action store and uses canonical store scope", async () => {
    const { service, storeActionPlanRepository, storeOpsRepository } = createHarness();
    storeOpsRepository.listStoresByScope.mockResolvedValue([
      {
        company_id: "00000000-0000-4000-8000-000000000001",
        region_id: "00000000-0000-4000-8000-000000000010",
        store_id: assignedStoreId,
      },
    ]);
    storeActionPlanRepository.createPlan.mockResolvedValue(existingPlan());

    const result = await service.createPlan(createPlanInput());

    expect(storeOpsRepository.listStoresByScope).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: [assignedStoreId],
      requestedStoreId: assignedStoreId,
    });
    expect(storeActionPlanRepository.createPlan).toHaveBeenCalledWith({
      companyId: "00000000-0000-4000-8000-000000000001",
      regionId: "00000000-0000-4000-8000-000000000010",
      storeId: assignedStoreId,
      ownerUserId: "00000000-0000-4000-8000-000000000901",
      createdByUserId: "00000000-0000-4000-8000-000000000901",
      sourceType: "kpi_exception",
      sourceId: "snapshot-1:store-1:kpi-1",
      sourceDeepLink: "/store/kpis?kpi=kpi-1",
      sourceSnapshotRunId: "00000000-0000-4000-8000-000000000301",
      sourceKpiId: "00000000-0000-4000-8000-000000000401",
      title: "Net sales off track",
      summary: "Follow up on KPI exception",
      priority: "high",
      dueOn: "2026-06-01",
    });
    expect(result.command.status).toBe("created");
    expect(result.data.plan.actionPlanId).toBe("00000000-0000-4000-8000-000000000701");
  });

  it("rejects unassigned store creation without using broad read scope as write permission", async () => {
    const { service, storeActionPlanRepository, storeOpsRepository } = createHarness();

    await expect(
      service.createPlan(
        createPlanInput({
          actorScope: {
            companyIds: ["00000000-0000-4000-8000-000000000001"],
            regionIds: ["00000000-0000-4000-8000-000000000010"],
            storeIds: [unassignedStoreId],
          },
          actorActionScope: {
            assignedStoreIds: [],
          },
          storeId: unassignedStoreId,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storeOpsRepository.listStoresByScope).not.toHaveBeenCalled();
    expect(storeActionPlanRepository.createPlan).not.toHaveBeenCalled();
  });

  it("maps duplicate active source writes to a conflict", async () => {
    const { service, storeActionPlanRepository, storeOpsRepository } = createHarness();
    storeOpsRepository.listStoresByScope.mockResolvedValue([
      {
        company_id: "00000000-0000-4000-8000-000000000001",
        region_id: "00000000-0000-4000-8000-000000000010",
        store_id: assignedStoreId,
      },
    ]);
    storeActionPlanRepository.createPlan.mockRejectedValue({
      code: "23505",
      constraint: "idx_store_action_plan_active_source_unique",
    });

    await expect(service.createPlan(createPlanInput())).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects missing due date before resolving store scope", async () => {
    const { service, storeActionPlanRepository, storeOpsRepository } = createHarness();

    await expect(service.createPlan(createPlanInput({ dueOn: "   " }))).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(storeOpsRepository.listStoresByScope).not.toHaveBeenCalled();
    expect(storeActionPlanRepository.createPlan).not.toHaveBeenCalled();
  });

  it("passes the observed status as the expected write state", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanById.mockResolvedValue(existingPlan({ status: "open" }));
    storeActionPlanRepository.updateStatus.mockResolvedValue(existingPlan({ status: "in_progress" }));

    await service.updateStatus({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId: "00000000-0000-4000-8000-000000000701",
      status: "in_progress",
      note: "Started field coaching",
    });

    expect(storeActionPlanRepository.updateStatus).toHaveBeenCalledWith({
      actionPlanId: "00000000-0000-4000-8000-000000000701",
      actorUserId: "00000000-0000-4000-8000-000000000901",
      expectedStatus: "open",
      status: "in_progress",
      note: "Started field coaching",
    });
  });

  it("maps concurrent lifecycle write misses to a conflict", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanById.mockResolvedValue(existingPlan({ status: "open" }));
    storeActionPlanRepository.updateStatus.mockRejectedValue(
      new StoreActionPlanTransitionConflictError(),
    );

    await expect(
      service.updateStatus({
        actorUserId: "00000000-0000-4000-8000-000000000901",
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actionPlanId: "00000000-0000-4000-8000-000000000701",
        status: "blocked",
        note: "Waiting for stock confirmation",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("lists only assigned action-store plans with normalized pagination", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.listPlans.mockResolvedValue({
      items: [existingPlan()],
      total: 1,
    });

    const result = await service.listPlans({
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      status: "open",
      statuses: ["open", "blocked"],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      limit: 500,
      offset: -4,
    });

    expect(storeActionPlanRepository.listPlans).toHaveBeenCalledWith({
      storeIds: [assignedStoreId],
      statuses: ["open", "blocked"],
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      limit: 100,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.meta).toEqual({
      count: 1,
      total: 1,
      limit: 100,
      offset: 0,
    });
  });

  it("rejects list filters outside assigned action stores", async () => {
    const { service, storeActionPlanRepository } = createHarness();

    await expect(
      service.listPlans({
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        storeId: unassignedStoreId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storeActionPlanRepository.listPlans).not.toHaveBeenCalled();
  });

  it("lists Report Viewer plans by role-specific company scope", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.listPlans.mockResolvedValue({
      items: [existingPlan()],
      total: 1,
    });

    await service.listPlans({
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: {
        companyIds: ["00000000-0000-0000-0000-000000000001"],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: [unassignedStoreId] },
      limit: 25,
      offset: 0,
    });

    expect(storeActionPlanRepository.listPlans).toHaveBeenCalledWith({
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      storeIds: [],
      statuses: [],
      periodStart: undefined,
      periodEnd: undefined,
      limit: 25,
      offset: 0,
    });
  });

  it("does not return a cross-company Report Viewer plan", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanByIdInCompanyScope.mockResolvedValue(null);

    await expect(
      service.getPlan({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: {
          companyIds: ["company-a"],
          regionIds: [],
          storeIds: [],
        },
        actorActionScope: { assignedStoreIds: [] },
        actionPlanId: "00000000-0000-0000-0000-000000000701",
      }),
    ).rejects.toThrow("Store action plan was not found");
  });

  it("returns plan detail only inside assigned action stores", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanById.mockResolvedValue(existingPlan());

    const result = await service.getPlan({
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId: "00000000-0000-4000-8000-000000000701",
    });

    expect(result.data.plan.actionPlanId).toBe("00000000-0000-4000-8000-000000000701");
  });

  it("rejects plan detail outside assigned action stores", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanById.mockResolvedValue(
      existingPlan({ storeId: unassignedStoreId }),
    );

    await expect(
      service.getPlan({
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actionPlanId: "00000000-0000-4000-8000-000000000701",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects status updates on terminal plans", async () => {
    const { service, storeActionPlanRepository } = createHarness();
    storeActionPlanRepository.getPlanById.mockResolvedValue(existingPlan({ status: "closed" }));

    await expect(
      service.updateStatus({
        actorUserId: "00000000-0000-4000-8000-000000000901",
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actionPlanId: "00000000-0000-4000-8000-000000000701",
        status: "in_progress",
        note: "Trying to reopen",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(storeActionPlanRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("requires resolution evidence before closing a plan", async () => {
    const { service, storeActionPlanRepository } = createHarness();

    await expect(
      service.closePlan({
        actorUserId: "00000000-0000-4000-8000-000000000901",
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actionPlanId: "00000000-0000-4000-8000-000000000701",
        resolutionNote: "   ",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storeActionPlanRepository.getPlanById).not.toHaveBeenCalled();
    expect(storeActionPlanRepository.closePlan).not.toHaveBeenCalled();
  });

  it("requires a cancel reason before cancelling a plan", async () => {
    const { service, storeActionPlanRepository } = createHarness();

    await expect(
      service.cancelPlan({
        actorUserId: "00000000-0000-4000-8000-000000000901",
        actorActionScope: { assignedStoreIds: [assignedStoreId] },
        actionPlanId: "00000000-0000-4000-8000-000000000701",
        cancelReason: "",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storeActionPlanRepository.getPlanById).not.toHaveBeenCalled();
    expect(storeActionPlanRepository.cancelPlan).not.toHaveBeenCalled();
  });
});
