import { EventEmitter } from "node:events";
import { installGracefulShutdown } from "./graceful-shutdown";

describe("installGracefulShutdown", () => {
  it("closes every owned resource once across repeated signals", async () => {
    const processRef = new EventEmitter() as EventEmitter & { exitCode?: number };
    const first = { close: jest.fn().mockResolvedValue(undefined) };
    const second = { close: jest.fn().mockResolvedValue(undefined) };
    const logger = { error: jest.fn(), log: jest.fn() };
    installGracefulShutdown({
      logger,
      processRef,
      resources: [first, second],
      timeoutMs: 1000,
    });

    processRef.emit("SIGTERM");
    processRef.emit("SIGINT");
    await new Promise((resolve) => setImmediate(resolve));

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(processRef.exitCode).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
    expect(processRef.listenerCount("SIGINT")).toBe(0);
    expect(processRef.listenerCount("SIGTERM")).toBe(0);
  });

  it("bounds shutdown and reports only a sanitized failure", async () => {
    jest.useFakeTimers();
    const processRef = new EventEmitter() as EventEmitter & { exitCode?: number };
    const logger = { error: jest.fn(), log: jest.fn() };
    const exit = jest.fn();
    installGracefulShutdown({
      exit,
      logger,
      processRef,
      resources: [{ close: jest.fn(() => new Promise(() => undefined)) }],
      timeoutMs: 50,
    });

    processRef.emit("SIGTERM");
    await jest.advanceTimersByTimeAsync(51);

    expect(processRef.exitCode).toBe(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith("Graceful shutdown failed");
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("credential");
    jest.useRealTimers();
  });

  it("lets an active worker close inside the configured 40-second budget", async () => {
    jest.useFakeTimers();
    const processRef = new EventEmitter() as EventEmitter & { exitCode?: number };
    const logger = { error: jest.fn(), log: jest.fn() };
    const exit = jest.fn();
    const close = jest.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 35_000)),
    );
    installGracefulShutdown({
      exit,
      logger,
      processRef,
      resources: [{ close }],
      timeoutMs: 40_000,
    });

    processRef.emit("SIGTERM");
    await jest.advanceTimersByTimeAsync(35_000);

    expect(close).toHaveBeenCalledTimes(1);
    expect(processRef.exitCode).toBe(0);
    expect(exit).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      "Received SIGTERM; graceful shutdown completed",
    );
    jest.useRealTimers();
  });
});
