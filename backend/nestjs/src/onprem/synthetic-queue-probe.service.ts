import { Injectable } from "@nestjs/common";
import { Job, Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { AppConfigService } from "../shared/app-config.service";

const PROBE_QUEUE = "hr-axis-onprem-synthetic-recovery-v1";
const PROBE_JOB_ID = "synthetic-recovery-v1";
const PROBE_MARKER = "hr-axis:onprem:synthetic-recovery-v1:processed";
const PROBE_TIMEOUT_MS = 60_000;

type ProbeMode = "enqueue" | "process" | "status";

@Injectable()
export class SyntheticQueueProbeService {
  constructor(private readonly config: AppConfigService) {}

  async run(mode: ProbeMode) {
    this.assertContext();
    if (mode === "enqueue") {
      return this.enqueue();
    }
    if (mode === "process") {
      return this.process();
    }
    return this.status();
  }

  private assertContext(): void {
    if (!this.config.isStrictLocal || this.config.dataClass !== "synthetic") {
      throw new Error("synthetic queue probe requires strict-local synthetic mode");
    }
  }

  private createProducerConnection(): IORedis {
    return new IORedis(this.config.redisUrl, {
      connectTimeout: this.config.redisOperationTimeoutMs,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  private async enqueue() {
    const connection = this.createProducerConnection();
    let queue: Queue | undefined;
    try {
      await withTimeout(
        connection.connect(),
        this.config.redisOperationTimeoutMs,
      );
      queue = new Queue(PROBE_QUEUE, { connection });
      const [existing, marker] = await withTimeout(
        Promise.all([queue.getJob(PROBE_JOB_ID), connection.get(PROBE_MARKER)]),
        this.config.redisOperationTimeoutMs,
      );
      if (existing || marker) {
        throw new Error("synthetic queue probe state is not clean");
      }
      await withTimeout(
        queue.add(
          "synthetic-recovery",
          { dataClass: "synthetic", schemaVersion: 1 },
          {
            attempts: 1,
            delay: 30_000,
            jobId: PROBE_JOB_ID,
            removeOnComplete: false,
            removeOnFail: false,
          },
        ),
        this.config.redisOperationTimeoutMs,
      );
      return { mode: "enqueue" as const, queuedCount: 1, status: "queued" as const };
    } finally {
      const activeQueue = queue;
      if (activeQueue) {
        await boundedClose(
          () => activeQueue.close(),
          this.config.redisOperationTimeoutMs,
        );
      }
      connection.disconnect(false);
    }
  }

  private async process() {
    const connection = new IORedis(this.config.redisUrl, {
      connectTimeout: this.config.redisOperationTimeoutMs,
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    let duplicateCount = 0;
    let processedCount = 0;
    let worker: Worker | undefined;

    try {
      await withTimeout(connection.connect(), this.config.redisOperationTimeoutMs);
      worker = new Worker(
        PROBE_QUEUE,
        async (_job: Job) => {
          const first = await connection.set(PROBE_MARKER, "1", "NX");
          if (first !== "OK") {
            duplicateCount += 1;
            throw new Error("synthetic queue probe duplicate processing detected");
          }
          processedCount += 1;
        },
        { autorun: false, connection, concurrency: 1 },
      );
      await withTimeout(waitForOneCompletion(worker), PROBE_TIMEOUT_MS);
      if (processedCount !== 1 || duplicateCount !== 0) {
        throw new Error("synthetic queue probe exactly-once assertion failed");
      }
      return {
        duplicateCount,
        mode: "process" as const,
        processedCount,
        status: "completed" as const,
      };
    } finally {
      if (worker) {
        await boundedClose(
          () => worker!.close(true),
          this.config.redisOperationTimeoutMs,
        );
      }
      connection.disconnect(false);
    }
  }

  private async status() {
    const connection = this.createProducerConnection();
    let queue: Queue | undefined;
    try {
      await withTimeout(connection.connect(), this.config.redisOperationTimeoutMs);
      queue = new Queue(PROBE_QUEUE, { connection });
      const [job, marker] = await withTimeout(
        Promise.all([queue.getJob(PROBE_JOB_ID), connection.get(PROBE_MARKER)]),
        this.config.redisOperationTimeoutMs,
      );
      const state = job ? await withTimeout(job.getState(), this.config.redisOperationTimeoutMs) : "missing";
      return {
        markerCount: marker === "1" ? 1 : 0,
        mode: "status" as const,
        state,
      };
    } finally {
      const activeQueue = queue;
      if (activeQueue) {
        await boundedClose(
          () => activeQueue.close(),
          this.config.redisOperationTimeoutMs,
        );
      }
      connection.disconnect(false);
    }
  }
}

function waitForOneCompletion(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    worker.once("completed", () => resolve());
    worker.once("failed", (_job, error) => reject(error));
    void worker.run().catch(reject);
  });
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("synthetic queue probe timed out")),
      timeoutMs,
    );
    void work.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function boundedClose(
  close: () => Promise<unknown>,
  timeoutMs: number,
): Promise<void> {
  try {
    await withTimeout(close(), timeoutMs);
  } catch {
    // The owned Redis connection is disconnected immediately by the caller.
  }
}
