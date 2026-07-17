import { TaskCommandWorkspaceController } from "./task-command-workspace.controller";

describe("TaskCommandWorkspaceController", () => {
  it("forwards the authenticated actor and bounded workspace query", async () => {
    const service = { getWorkspace: jest.fn().mockResolvedValue({ view: "report_viewer" }), getEvents: jest.fn() };
    const controller = new TaskCommandWorkspaceController(service as never);
    const user = { userId: "user-1" } as never;
    await expect(controller.getWorkspace(
      { user },
      { periodStart: "2026-07-01", periodEnd: "2026-07-31", limit: 20, offset: 0 },
    )).resolves.toEqual({ data: { view: "report_viewer" } });
    expect(service.getWorkspace).toHaveBeenCalledWith({
      actor: user, periodStart: "2026-07-01", periodEnd: "2026-07-31", limit: 20, offset: 0,
    });
  });

  it("forwards the scoped event page query", async () => {
    const service = { getWorkspace: jest.fn(), getEvents: jest.fn().mockResolvedValue({ items: [] }) };
    const controller = new TaskCommandWorkspaceController(service as never);
    const user = { userId: "user-1" } as never;
    await expect(controller.getEvents(
      { user }, "33333333-3333-4333-8333-333333333333", { limit: 20, offset: 20 },
    )).resolves.toEqual({ data: { items: [] } });
    expect(service.getEvents).toHaveBeenCalledWith({
      actor: user, actionPlanId: "33333333-3333-4333-8333-333333333333", limit: 20, offset: 20,
    });
  });
});
