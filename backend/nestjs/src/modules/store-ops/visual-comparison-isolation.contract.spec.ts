import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname);
const IMPLEMENTATION_FILES = [
  "application/visual-comparison.contract.ts",
  "application/visual-comparison.port.ts",
  "application/visual-comparison-smoke.contract.ts",
  "infrastructure/visual-comparison-result.validator.ts",
  "infrastructure/qwen-visual-comparison.adapter.ts",
] as const;

describe("PR-8B visual comparison isolation", () => {
  const source = IMPLEMENTATION_FILES.map((file) =>
    readFileSync(join(ROOT, file), "utf8"),
  ).join("\n");

  it("has no database, repository, API, queue, scoring or incentive dependency", () => {
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:database|repository|controller|bullmq|ioredis|queue)[^"']*["']/i,
    );
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:ranking|competition|target|incentive|checklist)[^"']*["']/i,
    );
  });

  it("keeps the exact snapshot, non-thinking mode and disabled tools explicit", () => {
    expect(source).toContain('"qwen3.7-plus-2026-05-26"');
    expect(source).toContain("enable_thinking: false");
    expect(source).toContain('tool_choice: "none"');
    expect(source).not.toMatch(/tools\s*:/);
  });

  it("does not contain provider secrets or a concrete workspace identity", () => {
    expect(source).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
    expect(source).not.toMatch(/[a-f0-9]{20,}\.eu-central-1\.maas\.aliyuncs\.com/i);
  });

  it("derives one receipt identity and validates configuration before claiming it", () => {
    const runner = readFileSync(
      join(ROOT, "../../../scripts/qwen-visual-comparison-smoke.ts"),
      "utf8",
    );
    expect(runner).not.toContain("QWEN_SMOKE_RECEIPT");
    expect(runner).toContain(".qwen-smoke-${runId}-${manifestSha256}.receipt.json");
    expect(runner.indexOf("new QwenVisualComparisonAdapter")).toBeLessThan(
      runner.indexOf("await open(receiptPath, \"wx\")"),
    );
  });
});
