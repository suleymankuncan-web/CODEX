import { InMemoryJobDispatcherService } from "./in-memory-job-dispatcher.service";
import { Logger } from "@nestjs/common";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("In-memory deterministic dispatch", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  it("keeps active work deduplicated across awaits and retains completed receipts", async () => {
    const service = new InMemoryJobDispatcherService();
    let finish!: () => void;
    const handler = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const enqueue = () => service.dispatch("import-batch", {}, handler, { jobId: "initial-1" });
    await Promise.all([enqueue(), enqueue()]);
    await tick();
    await enqueue();
    expect(handler).toHaveBeenCalledTimes(1);
    finish();
    await tick();
    expect((await enqueue()).status).toBe("completed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not suppress an explicit retry ID, a different job type, or anonymous work", async () => {
    const service = new InMemoryJobDispatcherService();
    const handler = jest.fn().mockResolvedValue(undefined);
    await service.dispatch("import-batch", {}, handler, { jobId: "batch-initial" });
    await service.dispatch("import-batch", {}, handler, { jobId: "batch-retry-1" });
    await service.dispatch("snapshot-run", {}, handler, { jobId: "batch-initial" });
    await service.dispatch("import-batch", {}, handler);
    await service.dispatch("import-batch", {}, handler);
    await tick();
    expect(handler).toHaveBeenCalledTimes(5);
  });

  it("releases a failed in-memory job so a pending batch can recover", async () => {
    const service = new InMemoryJobDispatcherService();
    const handler = jest.fn().mockRejectedValueOnce(new Error("worker failed")).mockResolvedValue(undefined);
    await service.dispatch("import-batch", {}, handler, { jobId: "batch-initial" });
    await tick();
    await service.dispatch("import-batch", {}, handler, { jobId: "batch-initial" });
    await tick();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("bounds completed receipt retention without evicting active work", async () => {
    const service = new InMemoryJobDispatcherService();
    const handler = jest.fn().mockResolvedValue(undefined);
    for (let i = 0; i <= 1000; i++) {
      await service.dispatch("import-batch", {}, handler, { jobId: `job-${i}` });
    }
    await tick();
    expect((await service.dispatch("import-batch", {}, handler, { jobId: "job-1000" })).status).toBe("completed");
    expect((await service.dispatch("import-batch", {}, handler, { jobId: "job-0" })).status).toBe("queued");
    await tick();
    expect(handler).toHaveBeenCalledTimes(1002);
  });
});
