import { EventEmitter } from "node:events";
import { Worker } from "bullmq";
import {
  PROBE_TIMEOUT_MS,
  SyntheticQueueProbeFailure,
  SyntheticQueueProbeService,
  classifySyntheticQueueProbeJobState,
  classifySyntheticQueueProbeMarkerState,
  getSyntheticQueueProbeFailureReason,
  isSyntheticQueueProbePreflightReady,
  sanitizeSyntheticQueueProbeFailureDetails,
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
        expect.objectContaining({ reason: "worker_timeout" }),
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

  it.each([
    "missing",
    "delayed",
    "waiting",
    "active",
    "completed",
    "failed",
  ] as const)("preserves the allowlisted %s job state", (state) => {
    expect(classifySyntheticQueueProbeJobState(state)).toBe(state);
  });

  it.each(["waiting-children", "paused", "redis://secret", undefined, 1])(
    "maps unsupported job state %p to unknown",
    (state) => {
      expect(classifySyntheticQueueProbeJobState(state)).toBe("unknown");
    },
  );

  it("rebuilds failure details from the runtime allowlist", () => {
    const malformed = {
      event: "raw-event-override",
      mode: "redis://user:secret@redis:6379",
      preflightMarker: { secret: true },
      preflightState: "redis://user:secret@redis:6379",
      reason: "raw-secret-override",
      timeoutMarker: "1",
      timeoutState: "active",
    };

    expect(sanitizeSyntheticQueueProbeFailureDetails(malformed)).toEqual({
      preflightMarker: "unknown",
      preflightState: "unknown",
      timeoutMarker: "unknown",
      timeoutState: "active",
    });

    const diagnostic = formatFailureDiagnostic(
      "process",
      "worker_timeout",
      "raw-event-parameter",
      malformed as never,
    );
    expect(diagnostic).toEqual({
      event: "onprem.synthetic_queue_probe.failed",
      mode: "process",
      preflightMarker: "unknown",
      preflightState: "unknown",
      reason: "worker_timeout",
      timeoutMarker: "unknown",
      timeoutState: "active",
    });
    expect(JSON.stringify(diagnostic)).not.toContain("redis://");
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
    expect(JSON.stringify(diagnostic)).not.toContain("raw-event-override");
  });

  it("classifies only closed marker states", () => {
    expect(classifySyntheticQueueProbeMarkerState(null)).toBe("absent");
    expect(classifySyntheticQueueProbeMarkerState("1")).toBe("present");
    expect(classifySyntheticQueueProbeMarkerState("unexpected-value")).toBe(
      "present",
    );
    expect(classifySyntheticQueueProbeMarkerState(undefined)).toBe("unknown");
  });

  it.each([
    ["delayed", "absent", true],
    ["missing", "absent", false],
    ["waiting", "absent", false],
    ["active", "absent", false],
    ["completed", "present", false],
    ["failed", "present", false],
    ["unknown", "unknown", false],
    ["delayed", "present", false],
  ] as const)(
    "allows processing only for %s/%s preflight",
    (state, marker, expected) => {
      expect(isSyntheticQueueProbePreflightReady({ marker, state })).toBe(
        expected,
      );
    },
  );

  it.each([
    "redis_connect_timeout",
    "state_read_timeout",
    "worker_timeout",
  ] as const)("keeps the %s reason distinct", (reason) => {
    expect(getSyntheticQueueProbeFailureReason(new SyntheticQueueProbeFailure(reason))).toBe(
      reason,
    );
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

  it.each([
    ["missing", "absent"],
    ["delayed", "absent"],
    ["waiting", "absent"],
    ["active", "present"],
    ["completed", "present"],
    ["failed", "present"],
    ["unknown", "unknown"],
  ] as const)(
    "formats a closed worker-timeout diagnostic for %s/%s",
    (timeoutState, timeoutMarker) => {
      const diagnostic = formatFailureDiagnostic(
        "process",
        "worker_timeout",
        "onprem.synthetic_queue_probe.failed",
        {
          preflightMarker: "absent",
          preflightState: "delayed",
          timeoutMarker,
          timeoutState,
        },
      );
      expect(diagnostic).toEqual({
        event: "onprem.synthetic_queue_probe.failed",
        mode: "process",
        preflightMarker: "absent",
        preflightState: "delayed",
        reason: "worker_timeout",
        timeoutMarker,
        timeoutState,
      });
      const serialized = JSON.stringify(diagnostic);
      expect(serialized).not.toContain("redis://");
      expect(serialized).not.toContain(PROBE_JOB_ID_FOR_LEAK_ASSERTION);
    },
  );
});

const PROBE_JOB_ID_FOR_LEAK_ASSERTION = "synthetic-recovery-v1";

function createWorkerDouble(runResult: Promise<void> = Promise.resolve()): Worker {
  return Object.assign(new EventEmitter(), {
    run: jest.fn(() => runResult),
  }) as unknown as Worker;
}
