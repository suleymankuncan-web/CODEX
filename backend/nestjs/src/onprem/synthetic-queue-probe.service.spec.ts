import { SyntheticQueueProbeService } from "./synthetic-queue-probe.service";
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
});
