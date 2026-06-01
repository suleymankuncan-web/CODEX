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
import { Test } from "@nestjs/testing";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { WorkerModule } from "../../worker.module";
import { WorkerJobsModule } from "../../worker-jobs.module";
import { WorkerMaterializationJobsModule } from "../../worker-materialization-jobs.module";
import { WorkerSnapshotJobsModule } from "../../worker-snapshot-jobs.module";
import { MaterializationService } from "../../modules/integration/application/materialization.service";
import { SnapshotService } from "../../modules/store-ops/application/snapshot.service";
import { AppConfigService } from "../app-config.service";
import { PG_POOL } from "../database/database.constants";
import { IntegrationModule } from "../../modules/integration/integration.module";
import { StoreOpsModule } from "../../modules/store-ops/store-ops.module";

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

  it("wires worker jobs through the focused worker module instead of broad feature modules", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule) ?? [];

    expect(imports).toContain(WorkerJobsModule);
    expect(imports).not.toContain(IntegrationModule);
    expect(imports).not.toContain(StoreOpsModule);
  });

  it("keeps worker job providers behind focused job modules", () => {
    const imports =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerJobsModule) ?? [];
    const providers =
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, WorkerJobsModule) ?? [];
    const exports =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, WorkerJobsModule) ?? [];
    const materializationExports =
      Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        WorkerMaterializationJobsModule,
      ) ?? [];
    const snapshotExports =
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, WorkerSnapshotJobsModule) ??
      [];

    expect(imports).toEqual([
      WorkerMaterializationJobsModule,
      WorkerSnapshotJobsModule,
    ]);
    expect(providers).toEqual([]);
    expect(exports).toEqual([
      WorkerMaterializationJobsModule,
      WorkerSnapshotJobsModule,
    ]);
    expect(materializationExports).toEqual([MaterializationService]);
    expect(snapshotExports).toEqual([SnapshotService]);
  });

  it("compiles the worker context with BullMQ disabled", async () => {
    const pool = { end: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(AppConfigService)
      .useValue({
        queueBackend: "in-memory",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
        databaseUrl: "postgres://user:pass@localhost:5432/store_ops",
        dbPoolMax: 1,
        dbSslMode: "disable",
      })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    await moduleRef.init();

    expect(moduleRef.get(BullMqWorkerHostService)).toBeInstanceOf(
      BullMqWorkerHostService,
    );
    expect(redisConstructorMock).not.toHaveBeenCalled();
    expect(workerConstructorMock).not.toHaveBeenCalled();

    await moduleRef.close();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
