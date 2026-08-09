import { EventEmitter } from "node:events";
import { Worker } from "bullmq";
import {
  PROBE_TIMEOUT_MS,
  SyntheticQueueProbeFailure,
  SyntheticQueueProbeService,
  getSyntheticQueueProbeFailureReason,
  waitForOneCompletion,
} from "./synthetic-queue-probe.service";
import { formatFailureDiagnostic } from "./synthetic-queue-probe";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("SyntheticQueueProbeService", () => {
  it.each([
    [{ dataClass: "synthetic", isStrictLocal: false }],
    [{ dataClass: "company", isStrictLocal: true }],
  ])("rejects use outside strict-local synthetic mode", async (config) => {
    const service = new SyntheticQueueProbeService(config as never);

    await expect(service.run("status")).rejects.toThrow(
      "synthetic queue probe requires strict-local synthetic mode",
    );
  });

  it("emits a deterministic sanitized success record for the runtime harness", () => {
    const cli = readFileSync(
      join(process.cwd(), "src", "onprem", "synthetic-queue-probe.ts"),
      "utf8",
    );

    expect(cli).toContain("process.stdout.write");
    expect(cli).toContain("onprem.synthetic_queue_probe.completed");
    expect(cli).not.toContain("redisUrl");
  });

  it("resolves on completion and removes every worker listener", async () => {
    const worker = createWorkerDouble();
    const completion = waitForOneCompletion(worker);

    expect(worker.listenerCount("completed")).toBe(1);
    expect(worker.listenerCount("failed")).toBe(1);
    expect(worker.listenerCount("error")).toBe(1);

    (worker as unknown as EventEmitter).emit("completed");
    await expect(completion).resolves.toBeUndefined();

    expect(worker.listenerCount("completed")).toBe(0);
    expect(worker.listenerCount("failed")).toBe(0);
    expect(worker.listenerCount("error")).toBe(0);
  });

  it.each([
    ["failed", "job_failed"],
    ["error", "worker_error"],
  ] as const)("maps the worker %s event to a typed failure", async (event, reason) => {
    const worker = createWorkerDouble();
    const completion = waitForOneCompletion(worker);

    (worker as unknown as EventEmitter).emit(
      event,
      undefined,
      new Error("sensitive worker detail"),
      "prev",
    );

    await expect(completion).rejects.toEqual(
      expect.objectContaining({ reason }),
    );
    expect(worker.listenerCount("completed")).toBe(0);
    expect(worker.listenerCount("failed")).toBe(0);
    expect(worker.listenerCount("error")).toBe(0);
  });

  it("maps a worker.run rejection to a typed failure", async () => {
    const worker = createWorkerDouble();
    (worker as unknown as { run: jest.Mock }).run.mockRejectedValue(
      new Error("redis://secret"),
    );

    await expect(waitForOneCompletion(worker)).rejects.toEqual(
      expect.objectContaining({ reason: "worker_run_failed" }),
    );
    expect(worker.listenerCount("completed")).toBe(0);
    expect(worker.listenerCount("failed")).toBe(0);
    expect(worker.listenerCount("error")).toBe(0);
  });

  it("maps the 60 second wait timeout and removes listeners", async () => {
    jest.useFakeTimers();
    try {
      const worker = createWorkerDouble(new Promise<void>(() => undefined));
      const completion = waitForOneCompletion(worker);
      const failure = expect(completion).rejects.toEqual(
        expect.objectContaining({ reason: "timeout" }),
      );

      await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

      await failure;
      expect(PROBE_TIMEOUT_MS).toBe(60_000);
      expect(worker.listenerCount("completed")).toBe(0);
      expect(worker.listenerCount("failed")).toBe(0);
      expect(worker.listenerCount("error")).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("maps an unknown thrown value to the closed unexpected reason", () => {
    expect(getSyntheticQueueProbeFailureReason("raw secret message")).toBe(
      "unexpected",
    );
    expect(getSyntheticQueueProbeFailureReason(new Error("stack and URL"))).toBe(
      "unexpected",
    );
    expect(new SyntheticQueueProbeFailure("unexpected").reason).toBe("unexpected");
  });

  it("formats failure JSON with only the safe diagnostic fields", () => {
    const diagnostic = formatFailureDiagnostic("process", "worker_error");
    expect(diagnostic).toEqual({
      event: "onprem.synthetic_queue_probe.failed",
      mode: "process",
      reason: "worker_error",
    });
    expect(Object.keys(diagnostic).sort()).toEqual(["event", "mode", "reason"]);

    const serialized = JSON.stringify(diagnostic);
    expect(serialized).not.toContain("sensitive worker detail");
    expect(serialized).not.toContain("redis://");
    expect(serialized).not.toContain("secret");
    expect(formatFailureDiagnostic("redis://secret", "unexpected").mode).toBe(
      "unknown",
    );
  });
});

function createWorkerDouble(runResult: Promise<void> = Promise.resolve()): Worker {
  return Object.assign(new EventEmitter(), {
    run: jest.fn(() => runResult),
  }) as unknown as Worker;
}
