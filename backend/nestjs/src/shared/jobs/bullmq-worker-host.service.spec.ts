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
import { WorkerVisualComparisonJobsModule } from "../../worker-visual-comparison-jobs.module";
import { MaterializationService } from "../../modules/integration/application/materialization.service";
import { SnapshotService } from "../../modules/store-ops/application/snapshot.service";
import { VisualComparisonShadowService } from "../../modules/store-ops/application/visual-comparison-shadow.service";
import { VisualComparisonShadowReconcilerService } from "../../modules/store-ops/application/visual-comparison-shadow-reconciler.service";
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

  it("registers the hidden visual comparison worker only behind both runtime boundaries", async () => {
    const process = jest.fn().mockResolvedValue({ status: "completed" });
    const reconcile = jest.fn().mockResolvedValue({ status: "queued", dispatched: 0 });
    const service = new BullMqWorkerHostService(
      {
        queueBackend: "bullmq",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
        visualComparisonWorkerEnabled: true,
        visualComparisonEnqueueEnabled: true,
        visualComparisonQueueName: "visual-shadow",
        visualComparisonReconcilePollSeconds: 60,
      } as never,
      { materializeBatch: jest.fn() } as never,
      { executeSnapshotRun: jest.fn() } as never,
      undefined,
      { process } as never,
      { reconcile } as never,
    );

    await service.onModuleInit();
    expect(workerConstructorMock).toHaveBeenCalledTimes(3);
    expect(workerConstructorMock).toHaveBeenNthCalledWith(
      3,
      "visual-shadow",
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
    expect(reconcile).toHaveBeenCalledTimes(1);

    const processor = workerConstructorMock.mock.calls[2][1] as (job: {
      id: string;
      name: string;
      data: { comparisonRunId: string };
    }) => Promise<void>;
    await processor({
      id: "run-1",
      name: "visual-comparison-shadow",
      data: { comparisonRunId: "run-1" },
    });
    expect(process).toHaveBeenCalledWith({ comparisonRunId: "run-1" });
    await service.onModuleDestroy();
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

  it("captures failed jobs without swallowing the BullMQ error", async () => {
    const failure = new Error("materialization failed");
    const captureException = jest.fn();
    const materializeBatch = jest.fn().mockRejectedValue(failure);

    const service = new BullMqWorkerHostService(
      {
        queueBackend: "bullmq",
        redisUrl: "redis://localhost:6379",
        importQueueName: "imports",
        snapshotQueueName: "snapshots",
      } as never,
      { materializeBatch } as never,
      { executeSnapshotRun: jest.fn() } as never,
      { captureException } as never,
    );

    await service.onModuleInit();
    const importProcessor = workerConstructorMock.mock.calls[0][1] as (job: {
      id: string;
      name: string;
      data: { batchId: string };
    }) => Promise<void>;

    await expect(
      importProcessor({
        id: "job-1",
        name: "materialize",
        data: { batchId: "batch-1" },
      }),
    ).rejects.toBe(failure);

    expect(captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        event: "job.execution.failed",
        source: "bullmq.import-worker",
        metadata: {
          jobType: "materialize",
          queueName: "imports",
        },
      }),
    );
  });

  it("wires worker jobs through the focused worker module instead of broad feature modules", () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkerModule) ?? [];

    expect(imports).toContain(WorkerJobsModule);
    expect(imports).not.toContain(WorkerVisualComparisonJobsModule);
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
    const visualComparisonExports =
      Reflect.getMetadata(
        MODULE_METADATA.EXPORTS,
        WorkerVisualComparisonJobsModule,
      ) ?? [];

    expect(imports).toEqual([
      WorkerMaterializationJobsModule,
      WorkerSnapshotJobsModule,
      WorkerVisualComparisonJobsModule,
    ]);
    expect(providers).toEqual([]);
    expect(exports).toEqual([
      WorkerMaterializationJobsModule,
      WorkerSnapshotJobsModule,
      WorkerVisualComparisonJobsModule,
    ]);
    expect(materializationExports).toEqual([MaterializationService]);
    expect(snapshotExports).toEqual([SnapshotService]);
    expect(visualComparisonExports).toEqual([
      VisualComparisonShadowService,
      VisualComparisonShadowReconcilerService,
    ]);
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
        visualComparisonEnqueueEnabled: false,
        visualComparisonWorkerEnabled: false,
        visualComparisonMaxAttempts: 3,
        visualComparisonProcessingLeaseSeconds: 300,
        visualComparisonCompanyId: "",
        visualComparisonReferenceSetId: "",
        visualComparisonNotBefore: "",
        visualComparisonReconcileLimit: 10,
        qwenVisualComparisonRuntimeConfiguration: {
          enabled: false,
        },
        photoMediaStorageConfiguration: {
          enabled: false,
          syntheticOnly: true,
          provider: "r2",
          jurisdiction: "eu",
          primaryBucket: "",
          recoveryBucket: "",
          primaryEndpoint: "",
          recoveryEndpoint: "",
          publicDeliveryEnabled: false,
          aggregateBytesHardLimit: 1,
          monthlyClassAHardLimit: 1,
          monthlyClassBHardLimit: 1,
          signedReadTtlSeconds: 1,
          lockSafetyDays: 1,
          perUserDailyBytesHardLimit: 1,
          perStoreDailyBytesHardLimit: 1,
          concurrentProcessingHardLimit: 1,
          syntheticFixtureSha256Allowlist: [],
          safetyAssurance: "fixture_identity_only",
        },
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
