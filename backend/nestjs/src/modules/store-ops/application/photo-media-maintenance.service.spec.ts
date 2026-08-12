import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { PhotoMediaMaintenanceService } from "./photo-media-maintenance.service";

describe("PhotoMediaMaintenanceService", () => {
  const canonicalBody = Buffer.from("canonical");
  const sha = createHash("sha256").update(canonicalBody).digest("hex");
  const repository = {
    listReconciliationInventory: jest.fn(),
    recordReconciliationReceipt: jest.fn(),
    markDeletedTombstone: jest.fn(),
    claimStalePartialUploads: jest.fn(),
    claimReadyRawDisposals: jest.fn(),
    markPartialUploadDisposed: jest.fn(),
    markRawDisposed: jest.fn(),
    recordCleanupFailure: jest.fn(),
    claimRestoreCandidate: jest.fn(),
    reserveRestoreGeneration: jest.fn(),
    markRestoreVerified: jest.fn(),
    markRestoreFailed: jest.fn(),
    markRestoreSkipped: jest.fn(),
    reserveProviderOperations: jest.fn(),
  };
  const retentionRepository = {
    createPurgeManifest: jest.fn(),
    claimPurgeManifest: jest.fn(),
    markPurgeManifestCompleted: jest.fn(),
    markPurgeManifestRetryableFailure: jest.fn(),
    releasePurgeManifestAssetLeases: jest.fn(),
    getLifecycleReconciliationSummary: jest.fn(),
    getUsageForecast: jest.fn(),
  };
  const primary = {
    createSignedUpload: jest.fn(), createSignedRead: jest.fn(), getObject: jest.fn(),
    putObject: jest.fn(), headObject: jest.fn(), deleteObject: jest.fn(), listObjectKeys: jest.fn(),
  };
  const recovery = {
    createSignedUpload: jest.fn(), createSignedRead: jest.fn(), getObject: jest.fn(),
    putObject: jest.fn(), headObject: jest.fn(), deleteObject: jest.fn(), listObjectKeys: jest.fn(),
  };

  const service = (configurationOverrides: Record<string, unknown> = {}) => new PhotoMediaMaintenanceService(
    repository as never,
    retentionRepository as never,
    primary as never,
    recovery as never,
    {
      enabled: true,
      syntheticOnly: true,
      provider: "r2",
      jurisdiction: "eu",
      region: "auto",
      forcePathStyle: true,
      primaryBucket: "primary",
      recoveryBucket: "recovery",
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
      scheduledRetentionCleanupEnabled: false,
      retentionManifestTtlMinutes: 60,
      retentionWarningPercent: 70,
      retentionCriticalPercent: 85,
      safetyAssurance: "fixture_identity_only",
      ...configurationOverrides,
    },
  );

  beforeEach(() => {
    for (const value of [
      ...Object.values(repository),
      ...Object.values(retentionRepository),
      ...Object.values(primary),
      ...Object.values(recovery),
    ]) {
      value.mockReset();
    }
    retentionRepository.getLifecycleReconciliationSummary.mockResolvedValue({
      danglingLinkCount: 0,
      stuckUploadCount: 0,
      stuckPurgeCount: 0,
      protectedExpiryCount: 0,
      tombstoneResidueCount: 0,
      findingEvents: [],
    });
  });

  it("detects missing, mismatched and orphan objects without returning object keys", async () => {
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-1",
      recoveryRequired: true,
      primaryObjects: [
        { objectKey: "companies/a/media/1/canonical.webp", sha256: sha, byteCount: 9 },
        { objectKey: "companies/a/media/1/thumbnail.webp" },
      ],
      recoveryObjects: [
        { objectKey: "companies/a/media/1/canonical.webp", sha256: sha, byteCount: 9 },
      ],
    }]);
    primary.listObjectKeys.mockResolvedValue({
      objectKeys: [
        "companies/a/media/1/canonical.webp",
        "companies/a/media/1/thumbnail.webp",
        "companies/a/media/orphan/canonical.webp",
      ],
    });
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: ["companies/a/media/1/canonical.webp"] });
    primary.headObject
      .mockResolvedValueOnce({ byteCount: canonicalBody.byteLength, sha256: sha })
      .mockResolvedValueOnce({ byteCount: 3, sha256: "d".repeat(64) });
    recovery.headObject.mockResolvedValue({ byteCount: 9, sha256: sha });
    primary.getObject.mockResolvedValue(Buffer.from("corrupt!!"));
    recovery.getObject.mockResolvedValue(canonicalBody);

    await expect(service().reconcile()).rejects.toThrow("integrity violations");
    expect(repository.recordReconciliationReceipt).toHaveBeenCalledWith(expect.objectContaining({
      expectedAssetCount: 1,
      orphanPrimaryCount: 1,
      missingObjectCount: 0,
      mismatchObjectCount: 1,
      manifestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(JSON.stringify(repository.recordReconciliationReceipt.mock.calls[0]?.[0])).not.toContain("companies/");
  });

  it("restores a synthetic object from recovery and removes rehearsal residue", async () => {
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const digest = createHash("sha256").update(body).digest("hex");
    primary.getObject.mockResolvedValue(body);
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest });
    recovery.getObject.mockResolvedValue(body);
    recovery.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest });

    await expect(service().rehearseRestore()).resolves.toEqual(expect.objectContaining({
      status: "verified",
      byteCount: body.byteLength,
      manifestDigest: digest,
    }));
    expect(primary.deleteObject).toHaveBeenCalledTimes(2);
    expect(recovery.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("fails the rehearsal when residue cleanup cannot be proven", async () => {
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const digest = createHash("sha256").update(body).digest("hex");
    primary.getObject.mockResolvedValue(body);
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest });
    recovery.getObject.mockResolvedValue(body);
    recovery.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest });
    primary.deleteObject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("delete failed"));

    await expect(service().rehearseRestore()).rejects.toThrow("cleanup failed");
  });

  it("retries scheduled raw disposal through a lease-bound repository claim", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-raw",
      cleanupLeaseToken: "lease-raw",
      rawObjectKey: "transient/companies/a/media/raw",
    }]);

    await expect(service().cleanupReadyRawDisposals(25, null)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(repository.markRawDisposed).toHaveBeenCalledWith({
      mediaAssetId: "asset-raw",
      cleanupLeaseToken: "lease-raw",
      actorUserId: null,
    });
  });

  it("skips restore when the active primary still matches canonical proof", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-restore", cleanupLeaseToken: "lease-restore",
      canonicalObjectKey: "locked/old.webp", recoveryObjectKey: "locked/recovery.webp",
      restoreObjectKey: "locked/new.webp", replicaGeneration: 2,
      canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest });
    primary.getObject.mockResolvedValue(body);

    await expect(service().restoreAsset({ mediaAssetId: "asset-restore", actorUserId: "actor" }))
      .resolves.toEqual({ mediaAssetId: "asset-restore", status: "not_required" });
    expect(repository.markRestoreSkipped).toHaveBeenCalledTimes(1);
    expect(repository.reserveRestoreGeneration).not.toHaveBeenCalled();
    expect(recovery.getObject).not.toHaveBeenCalled();
  });

  it("restores a missing primary into a fresh immutable generation without double accounting", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-restore", cleanupLeaseToken: "lease-restore",
      canonicalObjectKey: "locked/old.webp", recoveryObjectKey: "locked/recovery.webp",
      restoreObjectKey: "locked/new.webp", replicaGeneration: 2,
      canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue(null);
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service().restoreAsset({ mediaAssetId: "asset-restore", actorUserId: "actor" }))
      .resolves.toEqual({ mediaAssetId: "asset-restore", status: "verified" });
    expect(repository.reserveRestoreGeneration).toHaveBeenCalledWith(expect.objectContaining({
      restoreObjectKey: "locked/new.webp", replicaGeneration: 2, additionalBytes: 0,
    }));
    expect(repository.markRestoreVerified).toHaveBeenCalledTimes(1);
    expect(repository.markRestoreVerified).toHaveBeenCalledWith(expect.objectContaining({
      previousPrimaryMissing: true,
    }));
  });

  it("retains and accounts a corrupt locked primary while restoring a new generation", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-restore", cleanupLeaseToken: "lease-restore",
      canonicalObjectKey: "locked/old.webp", recoveryObjectKey: "locked/recovery.webp",
      restoreObjectKey: "locked/new.webp", replicaGeneration: 3,
      canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: "f".repeat(64) });
    primary.getObject.mockResolvedValueOnce(Buffer.from("corrupted")).mockResolvedValueOnce(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service().restoreAsset({ mediaAssetId: "asset-restore", actorUserId: "actor" }))
      .resolves.toEqual({ mediaAssetId: "asset-restore", status: "verified" });
    expect(repository.reserveRestoreGeneration).toHaveBeenCalledWith(expect.objectContaining({
      replicaGeneration: 3, additionalBytes: body.byteLength,
    }));
    expect(repository.markRestoreVerified).toHaveBeenCalledWith(expect.objectContaining({
      previousPrimaryMissing: false,
    }));
  });

  it("purges only repository-claimed hold-safe candidates and writes tombstones after deletes", async () => {
    retentionRepository.claimPurgeManifest.mockResolvedValue({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      manifestLeaseToken: "manifest-lease-1",
      candidates: [{
      mediaAssetId: "asset-1",
      canonicalSha256: sha,
      cleanupLeaseToken: "lease-1",
      primaryObjectKeys: ["companies/a/media/1/canonical.webp"],
      thumbnailObjectKey: "companies/a/media/1/thumbnail.webp",
      recoveryObjectKeys: ["companies/a/media/1/canonical.webp"],
      }],
    });
    retentionRepository.markPurgeManifestCompleted.mockResolvedValue(undefined);

    await expect(service({ scheduledRetentionCleanupEnabled: true }).executeRetentionPurge({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      actorUserId: "actor-1",
    })).resolves.toEqual(expect.objectContaining({
      claimedCount: 1,
      deletedCount: 1,
      status: "completed",
    }));
    expect(primary.deleteObject).toHaveBeenCalledTimes(2);
    expect(recovery.deleteObject).toHaveBeenCalledTimes(1);
    expect(repository.markDeletedTombstone).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: "asset-1",
      purgeManifestId: "manifest-1",
      tombstoneSha256: sha,
    }));
  });

  it("keeps local retention preview and execution fail-closed until exact-version Slice 2", async () => {
    const localService = service({
      provider: "seaweedfs",
      jurisdiction: "onprem",
      scheduledRetentionCleanupEnabled: true,
    });
    const expectedFailure = {
      response: expect.objectContaining({ code: "exact_version_maintenance_pending" }),
    };
    await expect(localService.previewRetentionPurge({
      limit: 10,
      reason: "manual_retention_cleanup",
      source: "manual",
      actorUserId: null,
    })).rejects.toMatchObject(expectedFailure);
    await expect(localService.executeRetentionPurge({
      manifestId: "manifest-1",
      manifestDigest: "a".repeat(64),
      actorUserId: null,
    })).rejects.toMatchObject(expectedFailure);
    await expect(localService.reconcile()).rejects.toMatchObject(expectedFailure);
    await expect(localService.rehearseRestore()).rejects.toMatchObject(expectedFailure);
    await expect(localService.cleanupStalePartials(10)).rejects.toMatchObject(expectedFailure);
    await expect(localService.cleanupReadyRawDisposals(10, null)).rejects.toMatchObject(expectedFailure);
    await expect(localService.restoreAsset({
      mediaAssetId: "asset-1",
      actorUserId: "actor-1",
    })).rejects.toMatchObject(expectedFailure);

    expect([
      ...Object.values(repository),
      ...Object.values(retentionRepository),
      ...Object.values(primary),
      ...Object.values(recovery),
    ].every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it("releases every unprocessed manifest asset lease before marking a retryable failure", async () => {
    retentionRepository.claimPurgeManifest.mockResolvedValue({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      manifestLeaseToken: "manifest-lease-1",
      candidates: [{
        mediaAssetId: "asset-1",
        canonicalSha256: sha,
        cleanupLeaseToken: "lease-1",
        primaryObjectKeys: ["locked/companies/a/media/1/canonical.webp"],
        thumbnailObjectKey: "derived/companies/a/media/1/thumbnail.webp",
        recoveryObjectKeys: [],
      }],
    });
    primary.deleteObject.mockRejectedValueOnce(new Error("provider failed"));
    repository.recordCleanupFailure.mockResolvedValue(undefined);
    retentionRepository.releasePurgeManifestAssetLeases.mockResolvedValue(undefined);
    retentionRepository.markPurgeManifestRetryableFailure.mockResolvedValue(undefined);

    await expect(service({ scheduledRetentionCleanupEnabled: true }).executeRetentionPurge({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      actorUserId: "actor-1",
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "provider_delete_failed" }),
    });
    expect(retentionRepository.releasePurgeManifestAssetLeases).toHaveBeenCalledWith({
      manifestId: "manifest-1",
      manifestLeaseToken: "manifest-lease-1",
    });
    expect(retentionRepository.markPurgeManifestRetryableFailure).toHaveBeenCalledTimes(1);
  });

  it("fails without completion when provider deletion succeeds but tombstone persistence fails", async () => {
    retentionRepository.claimPurgeManifest.mockResolvedValue({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      manifestLeaseToken: "manifest-lease-1",
      candidates: [{
        mediaAssetId: "asset-1", canonicalSha256: sha, cleanupLeaseToken: "lease-1",
        primaryObjectKeys: ["locked/companies/a/media/1/canonical.webp"],
        thumbnailObjectKey: "derived/companies/a/media/1/thumbnail.webp",
        recoveryObjectKeys: ["locked/companies/a/media/1/canonical.webp"],
      }],
    });
    primary.deleteObject.mockResolvedValue(undefined);
    recovery.deleteObject.mockResolvedValue(undefined);
    repository.markDeletedTombstone.mockRejectedValue(
      new BadRequestException("tombstone persistence failed"),
    );
    repository.recordCleanupFailure.mockResolvedValue(undefined);
    retentionRepository.releasePurgeManifestAssetLeases.mockResolvedValue(undefined);
    retentionRepository.markPurgeManifestRetryableFailure.mockResolvedValue(undefined);

    await expect(service({ scheduledRetentionCleanupEnabled: true }).executeRetentionPurge({
      manifestId: "manifest-1",
      manifestDigest: "b".repeat(64),
      actorUserId: "actor-1",
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "provider_delete_failed" }),
    });
    expect(retentionRepository.markPurgeManifestCompleted).not.toHaveBeenCalled();
    expect(retentionRepository.releasePurgeManifestAssetLeases).toHaveBeenCalledTimes(1);
  });

  it("creates a read-only digest-bound purge preview without provider deletes", async () => {
    retentionRepository.createPurgeManifest.mockResolvedValue({
      manifestId: "manifest-1",
      manifestDigest: "c".repeat(64),
      candidateCount: 2,
      candidateBytes: 2048,
      expiresAt: new Date("2026-07-28T13:00:00.000Z"),
      status: "previewed",
    });

    await expect(service().previewRetentionPurge({
      limit: 25,
      reason: "manual_retention_cleanup",
      source: "manual",
      actorUserId: "actor-1",
    })).resolves.toEqual(expect.objectContaining({
      manifestDigest: "c".repeat(64),
      candidateCount: 2,
      status: "previewed",
    }));
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(recovery.deleteObject).not.toHaveBeenCalled();
  });

  it("fails closed before claiming a manifest when retention cleanup is disabled", async () => {
    await expect(service().executeRetentionPurge({
      manifestId: "manifest-1",
      manifestDigest: "d".repeat(64),
      actorUserId: "actor-1",
    })).rejects.toThrow("disabled");
    expect(retentionRepository.claimPurgeManifest).not.toHaveBeenCalled();
  });

  it("returns sanitized usage forecasts and threshold states", async () => {
    retentionRepository.getUsageForecast.mockResolvedValue({
      currentBytes: 6 * 1024 * 1024 * 1024,
      classAOperations: 100,
      classBOperations: 200,
      recentGrowthBytes: 512,
      projectedThirtyDayBytes: 1024,
      classifications: [],
      purgeEligibleCount: 0,
      protectedExpiredCount: 1,
      stuckUploadCount: 0,
      stuckPurgeCount: 0,
      cleanupFailureCount: 0,
    });

    await expect(service().getRetentionUsage()).resolves.toEqual(expect.objectContaining({
      current: expect.objectContaining({ bytes: 6 * 1024 * 1024 * 1024 }),
      alerts: expect.arrayContaining([
        expect.objectContaining({ dimension: "bytes", state: "warning" }),
      ]),
    }));
  });
});
