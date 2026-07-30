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
import { VisualComparisonShadowService } from "../../modules/store-ops/application/visual-comparison-shadow.service";
import { VisualComparisonShadowReconcilerService } from "../../modules/store-ops/application/visual-comparison-shadow-reconciler.service";
import { AppConfigService } from "../app-config.service";
import {
  ImportBatchJobPayload,
  SnapshotRunJobPayload,
  VisualComparisonShadowJobPayload,
} from "./job-payloads";
import { logStructuredError, logStructuredMessage } from "../structured-log";
import { ObservabilityService } from "../observability/observability.service";

@Injectable()
export class BullMqWorkerHostService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMqWorkerHostService.name);
  private connection?: IORedis;
  private workers: Worker[] = [];
  private visualComparisonReconcileTimer?: NodeJS.Timeout;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly materializationService: MaterializationService,
    private readonly snapshotService: SnapshotService,
    @Optional() private readonly observabilityService?: ObservabilityService,
    @Optional() private readonly visualComparisonService?: VisualComparisonShadowService,
    @Optional() private readonly visualComparisonReconciler?: VisualComparisonShadowReconcilerService,
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

    const workers: Worker[] = [importWorker, snapshotWorker];
    if (this.appConfigService.visualComparisonWorkerEnabled) {
      if (!this.visualComparisonService) {
        throw new Error("Visual comparison worker service is unavailable");
      }
      const visualComparisonService = this.visualComparisonService;
      workers.push(new Worker(
        this.appConfigService.visualComparisonQueueName,
        async (job: Job<VisualComparisonShadowJobPayload>) => {
          logStructuredMessage(this.logger, "job.execution.started", {
            jobId: job.id?.toString() ?? null,
            jobType: job.name,
            queueName: this.appConfigService.visualComparisonQueueName,
            comparisonRunId: job.data.comparisonRunId,
          });
          try {
            const comparisonResult = await visualComparisonService.process(job.data);
            logStructuredMessage(this.logger, "job.execution.completed", {
              jobId: job.id?.toString() ?? null,
              jobType: job.name,
              queueName: this.appConfigService.visualComparisonQueueName,
              comparisonRunId: job.data.comparisonRunId,
              comparisonStatus: comparisonResult.status,
            });
          } catch (error) {
            logStructuredError(this.logger, "job.execution.failed", error, {
              jobId: job.id?.toString() ?? null,
              jobType: job.name,
              queueName: this.appConfigService.visualComparisonQueueName,
              comparisonRunId: job.data.comparisonRunId,
            });
            throw error;
          }
        },
        { connection: this.connection, concurrency: 1 },
      ));
    }

    this.workers = workers;
    if (this.appConfigService.visualComparisonEnqueueEnabled) {
      if (!this.visualComparisonReconciler) {
        throw new Error("Visual comparison reconciler is unavailable");
      }
      await this.reconcileVisualComparisons();
      this.visualComparisonReconcileTimer = setInterval(
        () => void this.reconcileVisualComparisons(),
        this.appConfigService.visualComparisonReconcilePollSeconds * 1000,
      );
    }
    this.logger.log(`Registered ${this.workers.length} BullMQ workers`);
  }

  private async reconcileVisualComparisons(): Promise<void> {
    try {
      if (!this.visualComparisonReconciler) return;
      const result = await this.visualComparisonReconciler.reconcile();
      if (result.dispatched > 0) {
        logStructuredMessage(this.logger, "visual_comparison.shadow.reconciled", {
          dispatched: result.dispatched,
          queueName: this.appConfigService.visualComparisonQueueName,
        });
      }
    } catch (error) {
      logStructuredError(this.logger, "visual_comparison.shadow.reconcile_failed", error, {
        queueName: this.appConfigService.visualComparisonQueueName,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.visualComparisonReconcileTimer) {
      clearInterval(this.visualComparisonReconcileTimer);
      this.visualComparisonReconcileTimer = undefined;
    }
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
