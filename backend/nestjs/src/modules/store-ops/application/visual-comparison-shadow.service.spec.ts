import { createHash } from "node:crypto";
import { VisualComparisonFailure } from "./visual-comparison.contract";
import { VisualComparisonShadowService } from "./visual-comparison-shadow.service";

const image = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA/vz0AAA=",
  "base64",
);
const digest = createHash("sha256").update(image).digest("hex");

function claim() {
  return {
    comparisonRunId: "run-1",
    companyId: "company-1",
    regionId: "region-1",
    storeId: "store-1",
    actorUserId: "user-1",
    referenceMediaAssetId: "reference-1",
    evidenceMediaAssetId: "evidence-1",
    referenceSha256: digest,
    evidenceSha256: digest,
    referenceWidthPx: 2,
    referenceHeightPx: 2,
    evidenceWidthPx: 2,
    evidenceHeightPx: 2,
    expectedVisualIntent: "Approved layout",
    reviewInstructions: "Compare visible presentation",
    attemptNumber: 1,
  };
}

function runtime(workerEnabled = true, enqueueEnabled = true) {
  return {
    enqueueEnabled,
    isolationClass: "shadow" as const,
    workerEnabled,
    maxAttempts: 3,
    processingLeaseSeconds: 120,
    budget: {
      maxRequests: 20,
      maxTotalTokens: 400000,
      maxSpendUsdMicros: 1000000,
      reservedTokensPerAttempt: 20000,
      reservedSpendUsdMicrosPerAttempt: 1000,
    },
    scope: {
      companyId: "company-1",
      referenceSetId: "reference-set-1",
      notBefore: new Date("2026-07-30T00:00:00.000Z"),
      limit: 20,
    },
  };
}

function setup(options: { failure?: VisualComparisonFailure; claimed?: boolean } = {}) {
  const repository = {
    claim: jest.fn().mockResolvedValue(
      options.claimed === false
        ? { status: "idempotent" }
        : { status: "claimed", claim: claim() },
    ),
    complete: jest.fn().mockResolvedValue(true),
    fail: jest.fn().mockResolvedValue(true),
  };
  const media = {
    readContent: jest.fn().mockResolvedValue({ body: image, contentType: "image/webp" }),
  };
  const provider = {
    compare: options.failure
      ? jest.fn().mockRejectedValue(options.failure)
      : jest.fn().mockResolvedValue({
          result: {
            decision: "pass",
            dimensions: [],
            overallConfidence: 0.9,
            qualityFlags: [],
            modelLimitations: [],
          },
          usage: {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            estimatedCostUsdMicros: 40,
          },
          latencyMs: 15,
        }),
  };
  const service = new VisualComparisonShadowService(
    repository as never,
    media as never,
    provider,
    runtime(),
  );
  return { service, repository, media, provider };
}

describe("VisualComparisonShadowService", () => {
  it("keeps duplicate delivery idempotent without media or provider calls", async () => {
    const { service, media, provider } = setup({ claimed: false });
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toEqual({
      status: "idempotent",
    });
    expect(media.readContent).not.toHaveBeenCalled();
    expect(provider.compare).not.toHaveBeenCalled();
  });

  it("reads private canonical media and stores only the structured shadow invocation", async () => {
    const { service, repository, provider } = setup();
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toMatchObject({
      status: "completed",
    });
    expect(provider.compare).toHaveBeenCalledTimes(1);
    expect(repository.complete).toHaveBeenCalledTimes(1);
  });

  it("records transient provider failures as retryable and rethrows for BullMQ", async () => {
    const failure = new VisualComparisonFailure("provider_timeout", "timeout");
    const { service, repository } = setup({ failure });
    await expect(service.process({ comparisonRunId: "run-1" })).rejects.toBe(failure);
    expect(repository.fail).toHaveBeenCalledWith(expect.objectContaining({ retryable: true }));
  });

  it("records invalid provider output as terminal without retrying", async () => {
    const failure = new VisualComparisonFailure("invalid_provider_response", "invalid");
    const { service, repository } = setup({ failure });
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toMatchObject({
      status: "failed_terminal",
    });
    expect(repository.fail).toHaveBeenCalledWith(expect.objectContaining({ retryable: false }));
  });

  it("records unexpected failures as terminal without BullMQ retry", async () => {
    const { service, repository, media } = setup();
    media.readContent.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toEqual({
      status: "failed_terminal",
      code: "unexpected_failure",
    });
    expect(repository.fail).toHaveBeenCalledWith(expect.objectContaining({
      code: "unexpected_failure",
      retryable: false,
    }));
  });

  it("makes zero claim or provider calls when the worker kill switch is off", async () => {
    const { repository, media, provider } = setup();
    const service = new VisualComparisonShadowService(
      repository as never,
      media as never,
      provider,
      runtime(false),
    );
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toEqual({
      status: "disabled",
    });
    expect(repository.claim).not.toHaveBeenCalled();
    expect(provider.compare).not.toHaveBeenCalled();
  });

  it("makes zero claim or provider calls when the enqueue kill switch is off", async () => {
    const { repository, media, provider } = setup();
    const service = new VisualComparisonShadowService(
      repository as never,
      media as never,
      provider,
      runtime(true, false),
    );
    await expect(service.process({ comparisonRunId: "run-1" })).rejects.toThrow(
      "enqueue is disabled",
    );
    expect(repository.claim).not.toHaveBeenCalled();
    expect(provider.compare).not.toHaveBeenCalled();
  });

  it("does not acknowledge an in-flight claim as idempotent success", async () => {
    const { service, repository, provider } = setup();
    repository.claim.mockResolvedValueOnce({ status: "busy" });
    await expect(service.process({ comparisonRunId: "run-1" })).rejects.toThrow(
      "still processing",
    );
    expect(provider.compare).not.toHaveBeenCalled();
  });

  it("marks the final transient attempt terminal instead of retryable", async () => {
    const failure = new VisualComparisonFailure("provider_timeout", "timeout");
    const { service, repository } = setup({ failure });
    repository.claim.mockResolvedValueOnce({
      status: "claimed",
      claim: { ...claim(), attemptNumber: 3 },
    });
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toMatchObject({
      status: "failed_terminal",
    });
    expect(repository.fail).toHaveBeenCalledWith(expect.objectContaining({
      retryable: false,
      attemptNumber: 3,
    }));
  });

  it("surfaces stale attempt CAS rejection as superseded", async () => {
    const { service, repository } = setup();
    repository.complete.mockResolvedValueOnce(false);
    await expect(service.process({ comparisonRunId: "run-1" })).resolves.toEqual({
      status: "superseded",
    });
  });
});
