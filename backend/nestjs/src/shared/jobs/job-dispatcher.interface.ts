export type JobType = "import-batch" | "snapshot-run" | "visual-comparison-shadow";

export interface JobDispatchResult {
  status: "queued";
  jobType: JobType;
  backend: string;
  jobId?: string | null;
  queueName?: string | null;
}

export interface JobDispatcher {
  dispatch<TPayload>(
    type: JobType,
    payload: TPayload,
    handler: (payload: TPayload) => Promise<void>,
    options?: { jobId?: string; strictLocalJobId?: string },
  ): Promise<JobDispatchResult>;
}
