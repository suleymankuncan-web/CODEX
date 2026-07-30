import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { JobDispatchResult, JobDispatcher, JobType } from "./job-dispatcher.interface";
import { logStructuredError, logStructuredMessage } from "../structured-log";

@Injectable()
export class InMemoryJobDispatcherService implements JobDispatcher {
  private readonly logger = new Logger(InMemoryJobDispatcherService.name);

  async dispatch<TPayload>(
    type: JobType,
    payload: TPayload,
    handler: (payload: TPayload) => Promise<void>,
    options?: { jobId?: string },
  ): Promise<JobDispatchResult> {
    const jobId = options?.jobId ?? randomUUID();

    setImmediate(async () => {
      try {
        logStructuredMessage(this.logger, "job.execution.started", {
          jobId,
          jobType: type,
          queueName: `in-memory:${type}`,
          payload,
        });
        await handler(payload);
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
      }
    });

    return {
      status: "queued" as const,
      jobType: type,
      backend: "in-memory",
      jobId,
      queueName: `in-memory:${type}`,
    };
  }
}
