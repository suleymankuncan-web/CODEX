export type ShutdownResource = {
  close(): Promise<unknown> | unknown;
};

type ShutdownProcess = {
  exitCode?: number;
  once(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener?(event: "SIGINT" | "SIGTERM", listener: () => void): unknown;
};

type ShutdownLogger = {
  error(message: string): unknown;
  log(message: string): unknown;
};

export function installGracefulShutdown(input: {
  exit?: (code: number) => unknown;
  logger: ShutdownLogger;
  processRef?: ShutdownProcess;
  resources: ShutdownResource[];
  timeoutMs?: number;
}): void {
  const processRef = input.processRef ?? process;
  const exit = input.exit ?? ((code: number) => process.exit(code));
  const timeoutMs = input.timeoutMs ?? 10_000;
  let shutdown: Promise<void> | undefined;

  const closeOnce = (signal: "SIGINT" | "SIGTERM") => {
    processRef.removeListener?.("SIGINT", onSigint);
    processRef.removeListener?.("SIGTERM", onSigterm);
    shutdown ??= closeResources(input.resources, timeoutMs)
      .then(() => {
        input.logger.log(`Received ${signal}; graceful shutdown completed`);
        processRef.exitCode = 0;
      })
      .catch(() => {
        input.logger.error("Graceful shutdown failed");
        processRef.exitCode = 1;
        exit(1);
      });
    return shutdown;
  };

  const onSigint = () => void closeOnce("SIGINT");
  const onSigterm = () => void closeOnce("SIGTERM");
  processRef.once("SIGINT", onSigint);
  processRef.once("SIGTERM", onSigterm);
}

async function closeResources(
  resources: ShutdownResource[],
  timeoutMs: number,
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("shutdown timeout")), timeoutMs);
  });
  const closePromise = Promise.allSettled(
    resources.map((resource) => Promise.resolve().then(() => resource.close())),
  ).then((results) => {
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("resource close failed");
    }
  });

  try {
    await Promise.race([closePromise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
