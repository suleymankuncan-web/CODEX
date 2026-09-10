import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { JobDispatchResult, JobDispatcher, JobType } from "./job-dispatcher.interface";
import { logStructuredError, logStructuredMessage } from "../structured-log";

@Injectable()
export class InMemoryJobDispatcherService implements JobDispatcher {
  private readonly logger = new Logger(InMemoryJobDispatcherService.name);
  private readonly activeJobs = new Set<string>();
  private readonly completedJobs = new Set<string>();

  async dispatch<TPayload>(
    type: JobType,
    payload: TPayload,
    handler: (payload: TPayload) => Promise<void>,
    options?: { jobId?: string; strictLocalJobId?: string },
  ): Promise<JobDispatchResult> {
    const jobId = options?.jobId ?? randomUUID();
    const key = `${type}:${jobId}`;
    const receipt: JobDispatchResult = {
      status: "queued",
      jobType: type,
      backend: "in-memory",
      jobId,
      queueName: `in-memory:${type}`,
    };
    if (this.completedJobs.has(key)) {
      return { ...receipt, status: "completed" };
    }
    if (this.activeJobs.has(key)) return receipt;
    this.activeJobs.add(key);

    setImmediate(async () => {
      try {
        logStructuredMessage(this.logger, "job.execution.started", {
          jobId,
          jobType: type,
          queueName: `in-memory:${type}`,
          payload,
        });
        await handler(payload);
        this.completedJobs.add(key);
        // Match the bounded completed-job retention used by BullMQ.
        if (this.completedJobs.size > 1000) {
          this.completedJobs.delete(this.completedJobs.values().next().value!);
        }
        logStructuredMessage(this.logger, "job.execution.completed", {
          jobId,
          jobType: type,
          queueName: `in-memory:${type}`,
          payload,
        });
      } catch (error) {
        logStructuredError(this.logger, "job.execution.failed", error, {
          jobId,
          jobType: type,
          queueName: `in-memory:${type}`,
          payload,
        });
      } finally {
        this.activeJobs.delete(key);
      }
    });

    return receipt;
  }
}
