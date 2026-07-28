import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TaskCommandWorkspaceReadService } from "./task-command-workspace-read.service";

const companyId = "22222222-2222-4222-8222-222222222222";
const actionPlanId = "33333333-3333-4333-8333-333333333333";

function actor(
  roleCodes: string[],
  scope: { companyIds: string[]; regionIds: string[]; storeIds: string[] } = {
    companyIds: [companyId],
    regionIds: [],
    storeIds: [],
  },
) {
  return {
    roleCodes, readScope: scope, actionScope: { assignedStoreIds: scope.storeIds },
    roleScopes: { REPORT_VIEWER: scope, REGION_MANAGER: scope, STORE_MANAGER: scope },
  } as never;
}

describe("TaskCommandWorkspaceReadService", () => {
  it("uses result-only statuses for report viewers and computes retained-page metrics", async () => {
    const repository = {
      readPage: jest.fn().mockResolvedValue({
        total: 3,
        items: [
          { status: "closed", source: { type: "checklist_remediation" } },
          { status: "cancelled", source: { type: "kpi_exception" } },
        ],
      }),
      readEvents: jest.fn(),
    };
    const service = new TaskCommandWorkspaceReadService(repository as never);
    const result = await service.getWorkspace({
      actor: actor(["REPORT_VIEWER"]), periodStart: "2026-07-01", periodEnd: "2026-07-31",
      limit: 20, offset: 0,
    });
    expect(repository.readPage).toHaveBeenCalledWith(expect.objectContaining({
      companyIds: [companyId], statuses: ["closed", "cancelled"], eventLimit: 3,
    }));
    expect(result.summary).toEqual({
      retained: 2, actionable: 0, completed: 1, cancelled: 1, checklist: 1,
    });
    expect(result.capabilities).toEqual({
      canStart: false, canUpdate: false, canComplete: false, canCancel: false, canReview: false,
    });
  });

  it("keeps store-manager actions enabled and includes active statuses", async () => {
    const repository = { readPage: jest.fn().mockResolvedValue({ total: 0, items: [] }), readEvents: jest.fn() };
    const service = new TaskCommandWorkspaceReadService(repository as never);
    const storeScope = { companyIds: [], regionIds: [], storeIds: ["11111111-1111-4111-8111-111111111111"] };
    const result = await service.getWorkspace({
      actor: actor(["STORE_MANAGER"], storeScope), periodStart: "2026-07-01", periodEnd: "2026-07-31",
    });
    expect(repository.readPage).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ["open", "in_progress", "blocked", "solution_review_pending", "correction_required", "closed", "cancelled"],
    }));
    expect(result.capabilities.canComplete).toBe(true);
  });

  it("rejects invalid periods and unsupported scopes", async () => {
    const service = new TaskCommandWorkspaceReadService({ readPage: jest.fn() } as never);
    await expect(service.getWorkspace({
      actor: actor(["REPORT_VIEWER"]), periodStart: "2026-08-01", periodEnd: "2026-07-01",
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getWorkspace({
      actor: actor(["EMPLOYEE"]), periodStart: "2026-07-01", periodEnd: "2026-07-31",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns a paged audit trail and hides out-of-scope records as not found", async () => {
    const repository = {
      readPage: jest.fn(),
      readEvents: jest.fn().mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 }).mockResolvedValueOnce(null),
    };
    const service = new TaskCommandWorkspaceReadService(repository as never);
    await expect(service.getEvents({ actor: actor(["REPORT_VIEWER"]), actionPlanId }))
      .resolves.toEqual({ items: [], total: 0, limit: 20, offset: 0 });
    expect(repository.readEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      statuses: ["closed", "cancelled"],
    }));
    await expect(service.getEvents({ actor: actor(["REPORT_VIEWER"]), actionPlanId }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
