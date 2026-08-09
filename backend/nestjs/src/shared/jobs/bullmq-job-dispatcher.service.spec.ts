const queueAddMock = jest.fn();
const queueCloseMock = jest.fn();
const queueConstructorMock = jest.fn((name: string) => ({
  add: queueAddMock,
  close: queueCloseMock,
  name,
}));
const redisQuitMock = jest.fn();
let redisStatus = "ready";
const redisConstructorMock = jest.fn(() => ({
  quit: redisQuitMock,
  get status() {
    return redisStatus;
  },
}));

jest.mock("bullmq", () => ({ Queue: queueConstructorMock }));
jest.mock("ioredis", () => ({
  __esModule: true,
  default: redisConstructorMock,
}));

import { BullMqJobDispatcherService } from "./bullmq-job-dispatcher.service";

function createConfig(strictLocal: boolean) {
  return {
    importQueueName: "imports",
    isStrictLocal: strictLocal,
    queueBackend: "bullmq",
    redisOperationTimeoutMs: 50,
    redisUrl: "redis://redis.example.invalid:6379",
    snapshotQueueName: "snapshots",
    visualComparisonEnqueueEnabled: false,
    visualComparisonMaxAttempts: 3,
    visualComparisonWorkerEnabled: false,
  } as never;
}

describe("BullMqJobDispatcherService Redis bounds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queueAddMock.mockResolvedValue({ id: "synthetic-job" });
    queueCloseMock.mockResolvedValue(undefined);
    redisQuitMock.mockResolvedValue(undefined);
    redisStatus = "ready";
  });

  it("keeps hosted Redis producer retry behavior unchanged", () => {
    new BullMqJobDispatcherService(createConfig(false));

    expect(redisConstructorMock).toHaveBeenCalledWith(
      "redis://redis.example.invalid:6379",
      { enableReadyCheck: false, maxRetriesPerRequest: null },
    );
  });

  it("keeps strict-local dispatch pending until Redis confirms the deterministic enqueue", async () => {
    jest.useFakeTimers();
    let resolveAdd: ((value: { id: string }) => void) | undefined;
    queueAddMock.mockImplementation(
      () => new Promise<{ id: string }>((resolve) => {
        resolveAdd = resolve;
      }),
    );
    const service = new BullMqJobDispatcherService(createConfig(true));

    let settled = false;
    const dispatch = service.dispatch(
      "import-batch",
      { batchId: "synthetic" },
      jest.fn(),
      { strictLocalJobId: "import-batch-synthetic-initial" },
    );
    void dispatch.finally(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(100);

    expect(settled).toBe(false);
    resolveAdd?.({ id: "import-batch-synthetic-initial" });

    await expect(dispatch).resolves.toEqual(
      expect.objectContaining({ jobId: "import-batch-synthetic-initial", status: "queued" }),
    );
    expect(redisConstructorMock).toHaveBeenCalledWith(
      "redis://redis.example.invalid:6379",
      {
        commandTimeout: 50,
        connectTimeout: 50,
        enableOfflineQueue: false,
        enableReadyCheck: true,
        maxRetriesPerRequest: 1,
      },
    );
    jest.useRealTimers();
  });

  it("refuses strict-local dispatch before queue.add without a stable job identity", async () => {
    const service = new BullMqJobDispatcherService(createConfig(true));

    await expect(
      service.dispatch("import-batch", { batchId: "synthetic" }, jest.fn()),
    ).rejects.toThrow("stable jobId");
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("refuses strict-local dispatch while its producer connection is not ready", async () => {
    redisStatus = "reconnecting";
    const service = new BullMqJobDispatcherService(createConfig(true));

    await expect(
      service.dispatch(
        "import-batch",
        { batchId: "synthetic" },
        jest.fn(),
        { strictLocalJobId: "import-batch-synthetic-initial" },
      ),
    ).rejects.toThrow("producer is not ready");
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("closes every queue and the producer connection", async () => {
    const service = new BullMqJobDispatcherService(createConfig(true));

    await service.onModuleDestroy();

    expect(queueCloseMock).toHaveBeenCalledTimes(2);
    expect(redisQuitMock).toHaveBeenCalledTimes(1);
  });
});
