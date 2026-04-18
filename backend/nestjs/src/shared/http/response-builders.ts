export function buildListResponse<T>(items: T[], input?: {
  total?: number;
  limit?: number;
  offset?: number;
}) {
  return {
    items,
    meta: {
      count: items.length,
      total: input?.total ?? items.length,
      limit: input?.limit ?? 50,
      offset: input?.offset ?? 0,
    },
  };
}

export function buildCommandResponse<TData>(input: {
  status: string;
  message: string;
  data: TData;
  job?: {
    jobType: string;
    backend: string;
    jobId?: string | null;
    queueName?: string | null;
  };
}) {
  return {
    command: {
      status: input.status,
      message: input.message,
    },
    data: input.data,
    ...(input.job ? { job: input.job } : {}),
  };
}
