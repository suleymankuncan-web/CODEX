import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  QWEN_VISUAL_COMPARISON_MODEL,
  VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
  VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
  VISUAL_COMPARISON_RUBRIC_VERSION,
  VisualComparisonFailure,
} from "../src/modules/store-ops/application/visual-comparison.contract";
import { parseVisualComparisonSmokeManifest } from "../src/modules/store-ops/application/visual-comparison-smoke.contract";
import {
  FetchQwenVisualComparisonTransport,
  QwenVisualComparisonAdapter,
  QwenVisualComparisonConfiguration,
} from "../src/modules/store-ops/infrastructure/qwen-visual-comparison.adapter";
import { SharpPhotoMediaImageProcessor } from "../src/modules/store-ops/infrastructure/sharp-photo-media-image-processor";

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new VisualComparisonFailure("invalid_configuration", `${name} is required`);
  }
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new VisualComparisonFailure(
      "invalid_configuration",
      `${name} must be a positive safe integer`,
    );
  }
  return value;
}

function resolveInside(root: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new VisualComparisonFailure("invalid_request", "Smoke path must be relative");
  }
  const candidate = resolve(root, relativePath);
  const fromRoot = relative(root, candidate);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new VisualComparisonFailure("invalid_request", "Smoke image path escapes its root");
  }
  return candidate;
}

async function safeRead(root: string, relativePath: string, maxBytes: number): Promise<Buffer> {
  const candidate = resolveInside(root, relativePath);
  const entry = await lstat(candidate);
  if (entry.isSymbolicLink() || !entry.isFile() || entry.size <= 0 || entry.size > maxBytes) {
    throw new VisualComparisonFailure("invalid_request", "Smoke input file is invalid");
  }
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  const fromRoot = relative(realRoot, realCandidate);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new VisualComparisonFailure("invalid_request", "Smoke input resolves outside its root");
  }
  return readFile(realCandidate);
}

function sha256(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

async function run(): Promise<void> {
  if (process.env.QWEN_VISUAL_COMPARISON_ENABLED !== "true") {
    throw new VisualComparisonFailure(
      "disabled",
      "QWEN_VISUAL_COMPARISON_ENABLED must be exactly true for an operator-run smoke",
    );
  }
  const datasetRoot = await realpath(resolve(required("QWEN_SMOKE_DATASET_ROOT")));
  const manifestRelativePath = required("QWEN_SMOKE_MANIFEST");
  const manifestBody = await safeRead(datasetRoot, manifestRelativePath, MAX_MANIFEST_BYTES);
  const manifest = parseVisualComparisonSmokeManifest(
    JSON.parse(manifestBody.toString("utf8")),
  );
  const manifestSha256 = sha256(manifestBody);
  const runId = required("QWEN_SMOKE_RUN_ID");
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(runId)) {
    throw new VisualComparisonFailure("invalid_configuration", "QWEN_SMOKE_RUN_ID is invalid");
  }
  const configuration: QwenVisualComparisonConfiguration = {
    enabled: true,
    baseUrl: required("QWEN_BASE_URL"),
    allowedHostSha256: required("QWEN_ALLOWED_HOST_SHA256"),
    apiKey: required("QWEN_API_KEY"),
    model: required("QWEN_MODEL") as typeof QWEN_VISUAL_COMPARISON_MODEL,
    timeoutMs: positiveInteger("QWEN_TIMEOUT_MS"),
    maxResponseBytes: positiveInteger("QWEN_MAX_RESPONSE_BYTES"),
    maxOutputTokens: positiveInteger("QWEN_MAX_OUTPUT_TOKENS"),
    maxRequests: 20,
    maxTokensPerRequest: positiveInteger("QWEN_MAX_TOKENS_PER_REQUEST"),
    maxTotalTokens: positiveInteger("QWEN_SMOKE_MAX_TOTAL_TOKENS"),
    maxSpendUsdMicros: positiveInteger("QWEN_SMOKE_MAX_SPEND_USD_MICROS"),
    inputUsdMicrosPerMillionTokens: positiveInteger(
      "QWEN_INPUT_USD_MICROS_PER_MILLION_TOKENS",
    ),
    outputUsdMicrosPerMillionTokens: positiveInteger(
      "QWEN_OUTPUT_USD_MICROS_PER_MILLION_TOKENS",
    ),
    minimumAdvisoryConfidence: Number(required("QWEN_MIN_ADVISORY_CONFIDENCE")),
  };
  const adapter = new QwenVisualComparisonAdapter(
    configuration,
    new FetchQwenVisualComparisonTransport(),
  );
  const imageProcessor = new SharpPhotoMediaImageProcessor();
  const receiptPath = resolveInside(
    datasetRoot,
    `.qwen-smoke-${runId}-${manifestSha256}.receipt.json`,
  );
  const receipt = await open(receiptPath, "wx");

  const decisionCounts: Record<string, number> = {};
  const latencies: number[] = [];
  let matches = 0;
  let totalTokens = 0;
  let spendUsdMicros = 0;
  const falsePassIds: string[] = [];
  const falseFailIds: string[] = [];

  try {
    await receipt.writeFile(
      `${JSON.stringify({
        event: "visual_comparison.synthetic_smoke.started",
        runId,
        manifestSha256,
      })}\n`,
    );
    for (const pair of manifest.pairs) {
      const referenceSource = await safeRead(datasetRoot, pair.referenceFile, MAX_SOURCE_IMAGE_BYTES);
      const evidenceSource = await safeRead(datasetRoot, pair.evidenceFile, MAX_SOURCE_IMAGE_BYTES);
      if (
        sha256(referenceSource) !== pair.referenceSha256 ||
        sha256(evidenceSource) !== pair.evidenceSha256
      ) {
        throw new VisualComparisonFailure("invalid_request", "Smoke image digest mismatch");
      }
      let reference;
      let evidence;
      try {
        [reference, evidence] = await Promise.all([
          imageProcessor.process(referenceSource),
          imageProcessor.process(evidenceSource),
        ]);
      } catch {
        throw new VisualComparisonFailure("invalid_request", "Smoke image decode failed");
      }
      const invocation = await adapter.compare({
        comparisonId: pair.id,
        referenceImage: reference.canonical,
        evidenceImage: evidence.canonical,
        referenceMimeType: "image/webp",
        evidenceMimeType: "image/webp",
        referenceSha256: reference.canonicalSha256,
        evidenceSha256: evidence.canonicalSha256,
        referenceWidthPx: reference.widthPx,
        referenceHeightPx: reference.heightPx,
        evidenceWidthPx: evidence.widthPx,
        evidenceHeightPx: evidence.heightPx,
        criteria: manifest.criteria,
        locale: manifest.locale,
      });
      decisionCounts[invocation.result.decision] =
        (decisionCounts[invocation.result.decision] ?? 0) + 1;
      if (invocation.result.decision === pair.expectedDecision) matches += 1;
      if (invocation.result.decision === "pass" && pair.expectedDecision !== "pass") {
        falsePassIds.push(pair.id);
      }
      if (invocation.result.decision !== "pass" && pair.expectedDecision === "pass") {
        falseFailIds.push(pair.id);
      }
      latencies.push(invocation.latencyMs);
      totalTokens += invocation.usage.totalTokens;
      spendUsdMicros += invocation.usage.estimatedCostUsdMicros;
    }

    const terminal = {
      event: "visual_comparison.synthetic_smoke.completed",
      runId,
      version: manifest.version,
      promptPolicyVersion: VISUAL_COMPARISON_PROMPT_POLICY_VERSION,
      resultSchemaVersion: VISUAL_COMPARISON_RESULT_SCHEMA_VERSION,
      rubricVersion: VISUAL_COMPARISON_RUBRIC_VERSION,
      manifestSha256,
      model: configuration.model,
      pairCount: manifest.pairs.length,
      expectedDecisionMatches: matches,
      decisionCounts,
      schemaValidCount: manifest.pairs.length,
      latencyMs: {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        max: Math.max(...latencies),
      },
      totalTokens,
      spendUsdMicros,
      falsePassIds,
      falseFailIds,
      recommendation: falsePassIds.length > 0 ? "stop" : matches === 20 ? "continue" : "tune",
      budget: adapter.getBudgetSnapshot(),
    };
    const body = Buffer.from(`${JSON.stringify(terminal)}\n`);
    await receipt.truncate(0);
    await receipt.write(body, 0, body.length, 0);
    process.stdout.write(`${JSON.stringify(terminal)}\n`);
  } catch (error) {
    const failure = error instanceof VisualComparisonFailure
      ? error
      : new VisualComparisonFailure("invalid_provider_response", "Smoke failed");
    const terminal = {
      event: "visual_comparison.synthetic_smoke.failed",
      runId,
      manifestSha256,
      code: failure.code,
      budget: adapter.getBudgetSnapshot(),
    };
    const body = Buffer.from(`${JSON.stringify(terminal)}\n`);
    await receipt.truncate(0);
    await receipt.write(body, 0, body.length, 0);
    throw failure;
  } finally {
    await receipt.close();
  }
}

void run().catch((error: unknown) => {
  const failure = error instanceof VisualComparisonFailure
    ? error
    : new VisualComparisonFailure("invalid_provider_response", "Smoke failed");
  process.stderr.write(
    `${JSON.stringify({
      event: "visual_comparison.synthetic_smoke.failed",
      code: failure.code,
      message: failure.message,
    })}\n`,
  );
  process.exitCode = 1;
});
