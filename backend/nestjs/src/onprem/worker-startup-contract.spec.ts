import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("worker startup contract", () => {
  it("asserts strict-local runtime readiness before reporting started", () => {
    const source = readFileSync(join(process.cwd(), "src", "workers.ts"), "utf8");
    const readiness = source.indexOf('runtimeReadiness.assertReady("worker")');
    const started = source.indexOf('logger.log("BullMQ worker context started")');

    expect(readiness).toBeGreaterThan(-1);
    expect(started).toBeGreaterThan(readiness);
    expect(source).toContain("timeoutMs: 40_000");
  });

  it("keeps API and worker shutdown budgets below their Compose grace periods", () => {
    const apiSource = readFileSync(join(process.cwd(), "src", "main.ts"), "utf8");
    const workerSource = readFileSync(
      join(process.cwd(), "src", "workers.ts"),
      "utf8",
    );

    expect(apiSource).toContain("timeoutMs: 25_000");
    expect(workerSource).toContain("timeoutMs: 40_000");
  });
});
