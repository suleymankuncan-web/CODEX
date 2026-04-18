const workerCloseMock = jest.fn();
const workerInstances: Array<{ close: jest.Mock }> = [];
const workerConstructorMock = jest.fn(
  (_queueName: string, _processor: unknown, _options: unknown) => {
    const instance = { close: workerCloseMock };
    workerInstances.push(instance);
    return instance;
  },
);
const redisQuitMock = jest.fn();
const redisConstructorMock = jest.fn(() => ({
  quit: redisQuitMock,
}));

jest.mock("bullmq", () => ({
  Worker: workerConstructorMock,
}));

jest.mock("ioredis", () => ({
  __esModule: true,
  default: redisConstructorMock,
}));

import { BullMqWorkerHostService } from "./bullmq-worker-host.service";

describe("BullMqWorkerHostService", () => {
  beforeEach(() => {
    workerConstructorMock.mockClear();
    workerCloseMock.mockClear();
    redisConstructorMock.mockClear();
    redisQuitMock.mockClear();
    workerInstances.length = 0;
  });

  it("does not register BullMQ workers when queue backend is not bullmq", async () => {
    const service = new BullMqWorkerHostService(
      {
        queueBackend: "in-memory",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
      } as never,
      { materializeBatch: jest.fn() } as never,
      { executeSnapshotRun: jest.fn() } as never,
    );

    await service.onModuleInit();

    expect(redisConstructorMock).not.toHaveBeenCalled();
    expect(workerConstructorMock).not.toHaveBeenCalled();
  });

  it("registers import and snapshot workers and routes jobs into application services", async () => {
    const materializeBatch = jest.fn();
    const executeSnapshotRun = jest.fn();

    const service = new BullMqWorkerHostService(
      {
        queueBackend: "bullmq",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
      } as never,
      { materializeBatch } as never,
      { executeSnapshotRun } as never,
    );

    await service.onModuleInit();

    expect(redisConstructorMock).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    expect(workerConstructorMock).toHaveBeenCalledTimes(2);
    expect(workerConstructorMock).toHaveBeenNthCalledWith(
      1,
      "imports",
      expect.any(Function),
      expect.objectContaining({ connection: expect.any(Object) }),
    );
    expect(workerConstructorMock).toHaveBeenNthCalledWith(
      2,
      "snapshots",
      expect.any(Function),
      expect.objectContaining({ connection: expect.any(Object) }),
    );

    const importProcessor = workerConstructorMock.mock.calls[0][1] as (job: {
      data: { batchId: string };
    }) => Promise<void>;
    const snapshotProcessor = workerConstructorMock.mock.calls[1][1] as (job: {
      data: { snapshotRunId: string; periodStart: string; periodEnd: string };
    }) => Promise<void>;

    await importProcessor({ data: { batchId: "batch-1" } });
    await snapshotProcessor({
      data: {
        snapshotRunId: "snapshot-1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      },
    });

    expect(materializeBatch).toHaveBeenCalledWith("batch-1");
    expect(executeSnapshotRun).toHaveBeenCalledWith(
      "snapshot-1",
      "2026-04-01",
      "2026-04-30",
    );
  });

  it("closes workers and redis connection on shutdown", async () => {
    const service = new BullMqWorkerHostService(
      {
        queueBackend: "bullmq",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
      } as never,
      { materializeBatch: jest.fn() } as never,
      { executeSnapshotRun: jest.fn() } as never,
    );

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(workerCloseMock).toHaveBeenCalledTimes(2);
    expect(redisQuitMock).toHaveBeenCalledTimes(1);
  });
});
