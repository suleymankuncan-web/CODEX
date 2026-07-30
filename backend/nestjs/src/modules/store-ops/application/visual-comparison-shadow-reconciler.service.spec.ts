import { VisualComparisonShadowReconcilerService } from "./visual-comparison-shadow-reconciler.service";

function runtime(enqueueEnabled = true) {
  return {
    enqueueEnabled,
    isolationClass: "shadow" as const,
    workerEnabled: false,
    maxAttempts: 3,
    processingLeaseSeconds: 120,
    budget: {
      maxRequests: 20,
      maxTotalTokens: 400000,
      maxSpendUsdMicros: 1000000,
      reservedTokensPerAttempt: 20000,
      reservedSpendUsdMicrosPerAttempt: 1000,
    },
    scope: {
      companyId: "company-1",
      referenceSetId: "reference-set-1",
      notBefore: new Date("2026-07-30T00:00:00.000Z"),
      limit: 20,
    },
  };
}

describe("VisualComparisonShadowReconcilerService", () => {
  it("re-dispatches durable queued runs with stable BullMQ job identities", async () => {
    const repository = { reconcile: jest.fn().mockResolvedValue(["run-1", "run-2"]) };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue({ status: "queued" }) };
    const processor = { process: jest.fn() };
    const service = new VisualComparisonShadowReconcilerService(
      repository as never,
      dispatcher as never,
      processor as never,
      runtime(),
    );

    await expect(service.reconcile()).resolves.toEqual({ status: "queued", dispatched: 2 });
    expect(dispatcher.dispatch).toHaveBeenNthCalledWith(
      1,
      "visual-comparison-shadow",
      { comparisonRunId: "run-1" },
      expect.any(Function),
      { jobId: "run-1" },
    );
  });

  it("does not inspect the ledger or queue when enqueue is disabled", async () => {
    const repository = { reconcile: jest.fn() };
    const dispatcher = { dispatch: jest.fn() };
    const service = new VisualComparisonShadowReconcilerService(
      repository as never,
      dispatcher as never,
      { process: jest.fn() } as never,
      runtime(false),
    );
    await expect(service.reconcile()).resolves.toEqual({ status: "disabled", dispatched: 0 });
    expect(repository.reconcile).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("AC-4 dispatches advisory reconciliation through the unchanged queue contract", async () => {
    const repository = { reconcile: jest.fn().mockResolvedValue(["run-advisory-1"]) };
    const dispatcher = { dispatch: jest.fn().mockResolvedValue({ status: "queued" }) };
    const advisoryRuntime = { ...runtime(), isolationClass: "advisory" as const };
    const service = new VisualComparisonShadowReconcilerService(
      repository as never,
      dispatcher as never,
      { process: jest.fn() } as never,
      advisoryRuntime,
    );

    await expect(service.reconcile()).resolves.toEqual({ status: "queued", dispatched: 1 });
    expect(repository.reconcile).toHaveBeenCalledWith(expect.objectContaining({
      isolationClass: "advisory",
    }));
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      "visual-comparison-shadow",
      { comparisonRunId: "run-advisory-1" },
      expect.any(Function),
      { jobId: "run-advisory-1" },
    );
  });
});
