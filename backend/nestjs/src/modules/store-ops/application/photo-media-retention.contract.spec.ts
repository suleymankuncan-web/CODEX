import {
  buildPurgeEligibilityDigest,
  classifyRetentionUsage,
} from "./photo-media-retention.contract";

describe("photo media retention operations contract", () => {
  it("builds a stable typed digest without object identity", () => {
    const input = {
      mediaAssetId: "11111111-1111-4111-8111-111111111111",
      companyId: "22222222-2222-4222-8222-222222222222",
      assetState: "ready" as const,
      canonicalSha256: "a".repeat(64),
      accountedProviderBytes: 1024,
      expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      retentionPolicyId: "33333333-3333-4333-8333-333333333333",
      retentionPolicyVersion: 1,
    };

    expect(buildPurgeEligibilityDigest(input)).toMatch(/^[0-9a-f]{64}$/);
    expect(buildPurgeEligibilityDigest(input)).toBe(buildPurgeEligibilityDigest({ ...input }));
    expect(JSON.stringify(input)).not.toContain("locked/");
  });

  it.each([
    [0, "normal"],
    [70, "warning"],
    [85, "critical"],
    [100, "limit_reached"],
  ] as const)("classifies %s percent as %s", (percent, expected) => {
    expect(classifyRetentionUsage({
      used: percent,
      limit: 100,
      warningPercent: 70,
      criticalPercent: 85,
    })).toBe(expected);
  });
});
