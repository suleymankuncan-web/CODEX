import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { Job } from "bullmq";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { MaterializationService } from "../../modules/integration/application/materialization.service";
import { SnapshotService } from "../../modules/store-ops/application/snapshot.service";
import { AppConfigService } from "../app-config.service";
import { ImportBatchJobPayload, SnapshotRunJobPayload } from "./job-payloads";
import { logStructuredError, logStructuredMessage } from "../structured-log";
import { ObservabilityService } from "../observability/observability.service";

@Injectable()
export class BullMqWorkerHostService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMqWorkerHostService.name);
  private connection?: IORedis;
  private workers: Worker[] = [];

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly materializationService: MaterializationService,
    private readonly snapshotService: SnapshotService,
    @Optional() private readonly observabilityService?: ObservabilityService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.appConfigService.queueBackend !== "bullmq") {
      this.logger.log("Skipping BullMQ worker registration because queue backend is not bullmq");
      return;
    }

    this.connection = new IORedis(this.appConfigService.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    const importWorker = new Worker(
      this.appConfigService.importQueueName,
      async (job: Job<ImportBatchJobPayload>) => {
        logStructuredMessage(this.logger, "job.execution.started", {
          jobId: job.id?.toString() ?? null,
          jobType: job.name,
          queueName: this.appConfigService.importQueueName,
          batchId: job.data.batchId,
        });

        try {
          await this.materializationService.materializeBatch(job.data.batchId);
          logStructuredMessage(this.logger, "job.execution.completed", {
            jobId: job.id?.toString() ?? null,
            jobType: job.name,
            queueName: this.appConfigService.importQueueName,
            batchId: job.data.batchId,
          });
        } catch (error) {
          logStructuredError(this.logger, "job.execution.failed", error, {
            jobId: job.id?.toString() ?? null,
            jobType: job.name,
            queueName: this.appConfigService.importQueueName,
            batchId: job.data.batchId,
          });
          this.observabilityService?.captureException(error, {
            event: "job.execution.failed",
            source: "bullmq.import-worker",
            severity: "error",
            metadata: {
              jobType: job.name,
              queueName: this.appConfigService.importQueueName,
            },
          });
          throw error;
        }
      },
      { connection: this.connection },
    );

    const snapshotWorker = new Worker(
      this.appConfigService.snapshotQueueName,
      async (job: Job<SnapshotRunJobPayload>) => {
        logStructuredMessage(this.logger, "job.execution.started", {
          jobId: job.id?.toString() ?? null,
          jobType: job.name,
          queueName: this.appConfigService.snapshotQueueName,
          snapshotRunId: job.data.snapshotRunId,
        });

        try {
          await this.snapshotService.executeSnapshotRun(
            job.data.snapshotRunId,
            job.data.periodStart,
            job.data.periodEnd,
          );
          logStructuredMessage(this.logger, "job.execution.completed", {
            jobId: job.id?.toString() ?? null,
            jobType: job.name,
            queueName: this.appConfigService.snapshotQueueName,
            snapshotRunId: job.data.snapshotRunId,
          });
        } catch (error) {
          logStructuredError(this.logger, "job.execution.failed", error, {
            jobId: job.id?.toString() ?? null,
            jobType: job.name,
            queueName: this.appConfigService.snapshotQueueName,
            snapshotRunId: job.data.snapshotRunId,
          });
          this.observabilityService?.captureException(error, {
            event: "job.execution.failed",
            source: "bullmq.snapshot-worker",
            severity: "error",
            metadata: {
              jobType: job.name,
              queueName: this.appConfigService.snapshotQueueName,
            },
          });
          throw error;
        }
      },
      { connection: this.connection },
    );

    this.workers = [importWorker, snapshotWorker];
    this.logger.log(`Registered ${this.workers.length} BullMQ workers`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }

    this.workers = [];

    if (this.connection) {
      if (this.connection.status !== "end") {
        try {
          await this.connection.quit();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("Connection is closed")) {
            throw error;
          }
        }
      }
      this.connection = undefined;
    }
  }
}
