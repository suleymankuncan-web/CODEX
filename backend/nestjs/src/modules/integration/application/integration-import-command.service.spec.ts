import { IntegrationImportCommandService } from "./integration-import-command.service";
import { InMemoryJobDispatcherService } from "../../../shared/jobs/in-memory-job-dispatcher.service";

const input = {
  actorCompanyIds: ["company-1"], sourceCode: "HRIS", entityType: "employee" as const,
  fileReference: "fixture.csv", actorUserId: "actor-1", idempotencyKey: "upload-1",
};
const batch = { batchId: "batch-1", status: "pending", reused: false };

function setup() {
  const repository = { createImportBatch: jest.fn().mockResolvedValue(batch) };
  const materialization = { materializeBatch: jest.fn().mockResolvedValue(undefined) };
  const dispatcher = new InMemoryJobDispatcherService();
  const dispatch = jest.spyOn(dispatcher, "dispatch");
  const service = new IntegrationImportCommandService(
    repository as never, {} as never, {} as never, {} as never,
    materialization as never, {} as never, {} as never, dispatcher,
  );
  return { service, repository, materialization, dispatch, dispatcher };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("Import command dispatch recovery", () => {
  it("re-enqueues a persisted pending batch after the first enqueue fails", async () => {
    const { service, repository, dispatch, materialization } = setup();
    dispatch.mockRejectedValueOnce(new Error("queue unavailable"));
    await expect(service.createImportBatch(input)).rejects.toThrow("queue unavailable");
    repository.createImportBatch.mockResolvedValue({ ...batch, reused: true });
    const result = await service.createImportBatch(input);
    expect(result.command.status).toBe("queued");
    expect(result.job).toMatchObject({ backend: "in-memory", jobId: "import-batch-batch-1-initial" });
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls.map((call) => call[3])).toEqual([
      { jobId: "import-batch-batch-1-initial", strictLocalJobId: "import-batch-batch-1-initial" },
      { jobId: "import-batch-batch-1-initial", strictLocalJobId: "import-batch-batch-1-initial" },
    ]);
    await tick();
    expect(materialization.materializeBatch).toHaveBeenCalledTimes(1);
  });

  it("does not report queued when repeated dispatch attempts fail", async () => {
    const { service, repository, dispatch } = setup();
    repository.createImportBatch.mockResolvedValue({ ...batch, reused: true });
    dispatch.mockRejectedValue(new Error("queue unavailable"));
    await expect(service.createImportBatch(input)).rejects.toThrow("queue unavailable");
    await expect(service.createImportBatch(input)).rejects.toThrow("queue unavailable");
  });

  it("executes concurrent replays and a lost-ack retry only once", async () => {
    const { service, repository, dispatcher, dispatch, materialization } = setup();
    const realDispatch = InMemoryJobDispatcherService.prototype.dispatch.bind(dispatcher);
    dispatch.mockImplementationOnce(async (...args) => {
      await realDispatch(...args);
      throw new Error("ack lost");
    });
    await expect(service.createImportBatch(input)).rejects.toThrow("ack lost");
    repository.createImportBatch.mockResolvedValue({ ...batch, reused: true });
    await Promise.all([service.createImportBatch(input), service.createImportBatch(input)]);
    await tick();
    expect(materialization.materializeBatch).toHaveBeenCalledTimes(1);
    // Even a stale pending DB read must not schedule a retained completed job again.
    expect((await service.createImportBatch(input)).command.status).toBe("completed");
    await tick();
    expect(materialization.materializeBatch).toHaveBeenCalledTimes(1);
  });

  it.each(["completed", "completed_with_errors", "failed", "processing"])(
    "reports the existing %s batch without enqueue or materialization",
    async (status) => {
      const { service, repository, dispatch, materialization } = setup();
      repository.createImportBatch.mockResolvedValue({ ...batch, status, reused: true });
      const result = await service.createImportBatch(input);
      expect(result.command.status).toBe(status);
      expect(result.job?.backend).toBe("reused");
      expect(dispatch).not.toHaveBeenCalled();
      expect(materialization.materializeBatch).not.toHaveBeenCalled();
    },
  );
});
