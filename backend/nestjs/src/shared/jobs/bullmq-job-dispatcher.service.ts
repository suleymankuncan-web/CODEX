import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { AppConfigService } from "../app-config.service";
import { JobDispatchResult, JobDispatcher, JobType } from "./job-dispatcher.interface";
import { logStructuredMessage } from "../structured-log";

@Injectable()
export class BullMqJobDispatcherService implements JobDispatcher, OnModuleDestroy {
  private readonly logger = new Logger(BullMqJobDispatcherService.name);
  private connection: IORedis | null = null;
  private importQueue: Queue | null = null;
  private snapshotQueue: Queue | null = null;
  private visualComparisonQueue: Queue | null = null;

  constructor(private readonly appConfigService: AppConfigService) {
    if (this.appConfigService.queueBackend !== "bullmq") {
      return;
    }

    this.connection = new IORedis(
      this.appConfigService.redisUrl,
      this.appConfigService.isStrictLocal
        ? {
            commandTimeout: this.appConfigService.redisOperationTimeoutMs,
            connectTimeout: this.appConfigService.redisOperationTimeoutMs,
            enableOfflineQueue: false,
            enableReadyCheck: true,
            maxRetriesPerRequest: 1,
          }
        : {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
    );

    this.importQueue = new Queue(this.appConfigService.importQueueName, {
      connection: this.connection,
    });

    this.snapshotQueue = new Queue(this.appConfigService.snapshotQueueName, {
      connection: this.connection,
    });
    if (
      this.appConfigService.visualComparisonEnqueueEnabled ||
      this.appConfigService.visualComparisonWorkerEnabled
    ) {
      this.visualComparisonQueue = new Queue(
        this.appConfigService.visualComparisonQueueName,
        { connection: this.connection },
      );
    }
  }

  async dispatch<TPayload>(
    type: JobType,
    payload: TPayload,
    _handler: (payload: TPayload) => Promise<void>,
    options?: { jobId?: string; strictLocalJobId?: string },
  ): Promise<JobDispatchResult> {
    const queue = type === "import-batch"
      ? this.importQueue
      : type === "snapshot-run"
        ? this.snapshotQueue
        : this.visualComparisonQueue;

    if (!queue) {
      throw new Error("BullMQ dispatcher is not active because queue backend is not bullmq");
    }
    const jobId = this.appConfigService.isStrictLocal
      ? options?.strictLocalJobId ?? options?.jobId
      : options?.jobId;
    if (this.appConfigService.isStrictLocal && !jobId) {
      throw new Error("Strict-local BullMQ dispatch requires a stable jobId");
    }
    if (this.appConfigService.isStrictLocal && this.connection?.status !== "ready") {
      throw new Error("Strict-local Redis producer is not ready");
    }

    const job = await queue.add(type, payload as object, {
      attempts: type === "visual-comparison-shadow"
        ? this.appConfigService.visualComparisonMaxAttempts
        : 3,
      removeOnComplete: 1000,
      removeOnFail: type === "visual-comparison-shadow" ? true : 1000,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      jobId,
    });

    // queue.add can return an existing retained job for a deterministic ID.
    const state = type === "import-batch" && jobId ? await job.getState() : undefined;
    if (state === "failed" || state === "unknown") {
      throw new Error(`Import job is ${state}; enqueue was not confirmed`);
    }
    const status = state === "completed" ? "completed" : "queued";

    logStructuredMessage(this.logger, `job.dispatch.${status}`, {
      jobId: job.id?.toString() ?? null,
      jobType: type,
      queueName: queue.name,
      batchId:
        type === "import-batch" && payload && typeof payload === "object" && "batchId" in payload
          ? String((payload as Record<string, unknown>).batchId)
          : null,
      snapshotRunId:
        type === "snapshot-run" &&
        payload &&
        typeof payload === "object" &&
        "snapshotRunId" in payload
          ? String((payload as Record<string, unknown>).snapshotRunId)
          : null,
    });

    return {
      status,
      jobType: type,
      backend: "bullmq",
      jobId: job.id?.toString() ?? null,
      queueName: queue.name,
    };
  }

  async onModuleDestroy(): Promise<void> {
    const queueCloseResults = await Promise.allSettled(
      [this.importQueue, this.snapshotQueue, this.visualComparisonQueue]
        .filter((queue): queue is Queue => Boolean(queue))
        .map((queue) => queue.close()),
    );

    if (this.connection && this.connection.status !== "end") {
      try {
        await this.connection.quit();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("Connection is closed")) {
          throw error;
        }
      }
    }

    if (queueCloseResults.some((result) => result.status === "rejected")) {
      throw new Error("BullMQ queue cleanup failed");
    }
  }
}
