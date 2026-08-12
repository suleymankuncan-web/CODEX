import {
  assertPhotoMediaStorageConfiguration,
  assertPhotoMediaUploadQuota,
  buildPhotoMediaObjectKeys,
} from "./photo-media-storage.contract";

describe("photo media storage contract", () => {
  const validConfiguration = {
    enabled: true,
    syntheticOnly: true,
    provider: "r2" as const,
    jurisdiction: "eu" as const,
    region: "auto" as const,
    forcePathStyle: true as const,
    primaryBucket: "hr-axis-photo-primary",
    recoveryBucket: "hr-axis-photo-recovery",
    primaryEndpoint: "https://account.eu.r2.cloudflarestorage.com",
    recoveryEndpoint: "https://account.eu.r2.cloudflarestorage.com",
    publicDeliveryEnabled: false,
    aggregateBytesHardLimit: 8 * 1024 * 1024 * 1024,
    monthlyClassAHardLimit: 750_000,
    monthlyClassBHardLimit: 7_500_000,
    signedReadTtlSeconds: 120,
    lockSafetyDays: 30,
    perUserDailyBytesHardLimit: 100 * 1024 * 1024,
    perStoreDailyBytesHardLimit: 250 * 1024 * 1024,
    concurrentProcessingHardLimit: 2,
    syntheticFixtureSha256Allowlist: ["a".repeat(64)],
    safetyAssurance: "fixture_identity_only" as const,
  };

  it("accepts the historical private R2 posture and the bounded local S3 posture", () => {
    expect(() => assertPhotoMediaStorageConfiguration(validConfiguration)).not.toThrow();
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      provider: "seaweedfs",
      jurisdiction: "onprem",
      region: "us-east-1",
      primaryEndpoint: "http://object-storage:8333",
      recoveryEndpoint: "http://object-storage:8333",
    })).not.toThrow();
    expect(() =>
      assertPhotoMediaStorageConfiguration({
        ...validConfiguration,
        jurisdiction: "auto" as never,
      }),
    ).toThrow("provider and jurisdiction");
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      provider: "seaweedfs",
      jurisdiction: "eu",
      region: "us-east-1",
      primaryEndpoint: "http://object-storage:8333",
      recoveryEndpoint: "http://object-storage:8333",
    })).toThrow("provider and jurisdiction");
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      provider: "seaweedfs",
      jurisdiction: "onprem",
      region: "us-east-1",
      primaryEndpoint: "http://127.0.0.1:8333",
      recoveryEndpoint: "http://object-storage:8333",
    })).toThrow("private local S3 endpoint");
    expect(() =>
      assertPhotoMediaStorageConfiguration({
        ...validConfiguration,
        recoveryBucket: validConfiguration.primaryBucket,
      }),
    ).toThrow("distinct");
    expect(() =>
      assertPhotoMediaStorageConfiguration({
        ...validConfiguration,
        publicDeliveryEnabled: true,
      }),
    ).toThrow("public delivery");
  });

  it("confines fixture identity assurance to exactly one synthetic digest", () => {
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      syntheticFixtureSha256Allowlist: [],
    })).toThrow("exactly one approved synthetic fixture digest");
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      syntheticFixtureSha256Allowlist: ["a".repeat(64), "b".repeat(64)],
    })).toThrow("exactly one approved synthetic fixture digest");
    expect(() => assertPhotoMediaStorageConfiguration({
      ...validConfiguration,
      safetyAssurance: "malware_scan",
    })).toThrow("fixture identity assurance");
  });

  it("creates opaque server-owned keys without accepting user path input", () => {
    expect(
      buildPhotoMediaObjectKeys({
        companyId: "11111111-1111-4111-8111-111111111111",
        mediaAssetId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toEqual({
      raw: "transient/companies/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/raw",
      canonical: "locked/companies/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/canonical.webp",
      thumbnail: "derived/companies/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/thumbnail.webp",
      recovery: "locked/companies/11111111-1111-4111-8111-111111111111/media/22222222-2222-4222-8222-222222222222/canonical.webp",
    });
  });

  it("accepts canonical PostgreSQL UUIDs used by deterministic staging identities", () => {
    expect(
      buildPhotoMediaObjectKeys({
        companyId: "c0000000-0000-0000-0000-000000000001",
        mediaAssetId: "22222222-2222-4222-8222-222222222222",
      }).raw,
    ).toBe(
      "transient/companies/c0000000-0000-0000-0000-000000000001/media/22222222-2222-4222-8222-222222222222/raw",
    );
  });

  it("fails closed before an upload crosses any owner-approved hard limit", () => {
    expect(() =>
      assertPhotoMediaUploadQuota({
        aggregateStoredBytes: validConfiguration.aggregateBytesHardLimit - 100,
        requestedBytes: 100,
        monthlyClassAOperations: 749_999,
        monthlyClassBOperations: 7_499_999,
        configuration: validConfiguration,
      }),
    ).not.toThrow();

    expect(() =>
      assertPhotoMediaUploadQuota({
        aggregateStoredBytes: validConfiguration.aggregateBytesHardLimit - 99,
        requestedBytes: 100,
        monthlyClassAOperations: 0,
        monthlyClassBOperations: 0,
        configuration: validConfiguration,
      }),
    ).toThrow("storage hard limit");
  });
});
