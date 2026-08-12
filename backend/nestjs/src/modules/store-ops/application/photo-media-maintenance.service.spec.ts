import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { PhotoMediaMaintenanceService } from "./photo-media-maintenance.service";
import { PhotoMediaObjectCreateConflictError } from "./photo-media-storage.ports";

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
    checkpointRestoreObjectVersion: jest.fn(),
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
    listObjectVersions: jest.fn(), listObjectVersionsByPrefix: jest.fn(),
  };
  const recovery = {
    createSignedUpload: jest.fn(), createSignedRead: jest.fn(), getObject: jest.fn(),
    putObject: jest.fn(), headObject: jest.fn(), deleteObject: jest.fn(), listObjectKeys: jest.fn(),
    listObjectVersions: jest.fn(), listObjectVersionsByPrefix: jest.fn(),
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
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => {
      const inventory = await primary.listObjectVersions({ objectKey: prefix });
      return { versions: inventory?.versions ?? [], deleteMarkers: inventory?.deleteMarkers ?? [] };
    });
    recovery.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => {
      const inventory = await recovery.listObjectVersions({ objectKey: prefix });
      return { versions: inventory?.versions ?? [], deleteMarkers: inventory?.deleteMarkers ?? [] };
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

  it("reconciles a local exact-version inventory through HEAD and GET proofs", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    const versionId = "local-primary-version-1";
    const local = service({ provider: "seaweedfs", jurisdiction: "onprem" });
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-reconcile",
      recoveryRequired: true,
      primaryObjects: [{ objectKey, versionId, sha256: sha, byteCount: canonicalBody.byteLength }],
      recoveryObjects: [{ objectKey, versionId, sha256: sha, byteCount: canonicalBody.byteLength }],
    }]);
    primary.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    recovery.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [{ objectKey, versionId }] : [],
      deleteMarkers: [],
    }));
    recovery.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [{ objectKey, versionId }] : [],
      deleteMarkers: [],
    }));
    primary.headObject.mockResolvedValue({
      byteCount: canonicalBody.byteLength, sha256: sha, versionId,
    });
    recovery.headObject.mockResolvedValue({
      byteCount: canonicalBody.byteLength, sha256: sha, versionId,
    });
    primary.getObject.mockResolvedValue(canonicalBody);
    recovery.getObject.mockResolvedValue(canonicalBody);

    await expect(local.reconcile()).resolves.toEqual(expect.objectContaining({
      expectedAssetCount: 1,
      missingObjectCount: 0,
      mismatchObjectCount: 0,
      orphanPrimaryCount: 0,
      orphanRecoveryCount: 0,
    }));
    expect(primary.headObject).toHaveBeenCalledWith({ objectKey, versionId });
    expect(primary.getObject).toHaveBeenCalledWith({ objectKey, versionId });
    expect(recovery.headObject).toHaveBeenCalledWith({ objectKey, versionId });
    expect(recovery.getObject).toHaveBeenCalledWith({ objectKey, versionId });
    expect(repository.recordReconciliationReceipt).toHaveBeenCalledTimes(1);
  });

  it("uses direct paginated local version inventory instead of key-list seeding", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    const versionId = "local-prefix-version-1";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-prefix-reconcile",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId, sha256: sha, byteCount: canonicalBody.byteLength }],
      recoveryObjects: [],
    }]);
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [{ objectKey, versionId }] : [],
      deleteMarkers: [],
    }));
    recovery.listObjectVersionsByPrefix.mockResolvedValue({ versions: [], deleteMarkers: [] });
    primary.headObject.mockResolvedValue({
      byteCount: canonicalBody.byteLength, sha256: sha, versionId,
    });
    primary.getObject.mockResolvedValue(canonicalBody);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .resolves.toEqual(expect.objectContaining({ orphanPrimaryCount: 0 }));
    expect(primary.listObjectVersionsByPrefix).toHaveBeenCalled();
    expect(primary.listObjectKeys).not.toHaveBeenCalled();
    expect(primary.listObjectVersions).not.toHaveBeenCalled();
  });

  it("fails closed before receipt when a local expected object lacks a VersionId", async () => {
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-null-reconcile",
      recoveryRequired: false,
      primaryObjects: [{ objectKey: "locked/companies/a/media/1/canonical.webp", versionId: null }],
      recoveryObjects: [],
    }]);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("object version identity is unavailable");
    expect(repository.recordReconciliationReceipt).not.toHaveBeenCalled();
    expect(primary.listObjectKeys).not.toHaveBeenCalled();
    expect(primary.headObject).not.toHaveBeenCalled();
  });

  it("counts a hidden local extra version as an orphan even when its key is expected", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-orphan-version",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId: "local-version-1", sha256: sha, byteCount: canonicalBody.byteLength }],
      recoveryObjects: [],
    }]);
    primary.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [
        { objectKey, versionId: "local-version-1" },
        { objectKey, versionId: "local-version-2" },
      ] : [],
      deleteMarkers: [],
    }));
    primary.headObject.mockResolvedValue({
      byteCount: canonicalBody.byteLength, sha256: sha, versionId: "local-version-1",
    });
    primary.getObject.mockResolvedValue(canonicalBody);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("integrity violations");
    expect(repository.recordReconciliationReceipt).toHaveBeenCalledWith(expect.objectContaining({
      orphanPrimaryCount: 1,
      missingObjectCount: 0,
      mismatchObjectCount: 0,
    }));
  });

  it("keeps historical R2 NULL-version reconciliation key-based", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-r2-reconcile",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId: null, sha256: sha, byteCount: canonicalBody.byteLength }],
      recoveryObjects: [],
    }]);
    primary.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    primary.headObject.mockResolvedValue({ byteCount: canonicalBody.byteLength, sha256: sha });
    primary.getObject.mockResolvedValue(canonicalBody);

    await expect(service().reconcile()).resolves.toEqual(expect.objectContaining({
      expectedAssetCount: 1,
      orphanPrimaryCount: 0,
      mismatchObjectCount: 0,
    }));
    expect(primary.headObject).toHaveBeenCalledWith(objectKey);
    expect(primary.getObject).toHaveBeenCalledWith(objectKey);
    expect(primary.listObjectVersions).not.toHaveBeenCalled();
  });

  it("fails closed without receipt when local provider inventory has a malformed identity", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-malformed-inventory",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId: "local-version-1" }],
      recoveryObjects: [],
    }]);
    primary.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [{ objectKey, versionId: "" }] : [],
      deleteMarkers: [],
    }));

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("object version identity is unavailable");
    expect(repository.recordReconciliationReceipt).not.toHaveBeenCalled();
  });

  it("counts a local HEAD VersionId mismatch as an integrity finding", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-head-mismatch",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId: "local-version-1", sha256: sha, byteCount: canonicalBody.byteLength }],
      recoveryObjects: [],
    }]);
    primary.listObjectKeys.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      objectKeys: prefix === "locked/" ? [objectKey] : [],
    }));
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: prefix === "locked/" ? [{ objectKey, versionId: "local-version-1" }] : [],
      deleteMarkers: [],
    }));
    primary.headObject.mockResolvedValue({
      byteCount: canonicalBody.byteLength, sha256: sha, versionId: "local-version-2",
    });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("integrity violations");
    expect(primary.getObject).not.toHaveBeenCalled();
    expect(repository.recordReconciliationReceipt).toHaveBeenCalledWith(expect.objectContaining({
      mismatchObjectCount: 1,
    }));
  });

  it("does not treat a local delete-marker-only inventory as clean", async () => {
    const objectKey = "locked/companies/a/media/1/canonical.webp";
    repository.listReconciliationInventory.mockResolvedValue([{
      mediaAssetId: "asset-local-delete-marker",
      recoveryRequired: false,
      primaryObjects: [{ objectKey, versionId: "local-version-1" }],
      recoveryObjects: [],
    }]);
    primary.listObjectVersionsByPrefix.mockImplementation(async ({ prefix }: { prefix: string }) => ({
      versions: [],
      deleteMarkers: prefix === "locked/" ? [{ objectKey, versionId: "marker-version-1" }] : [],
    }));
    primary.headObject.mockResolvedValue(null);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("integrity violations");
    expect(repository.recordReconciliationReceipt).toHaveBeenCalledWith(expect.objectContaining({
      orphanPrimaryCount: 1,
      missingObjectCount: 1,
    }));
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

  it("rehearses local storage only through exact version references", async () => {
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const digest = createHash("sha256").update(body).digest("hex");
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    recovery.listObjectVersions.mockResolvedValue({ versions: [] });
    primary.putObject
      .mockResolvedValueOnce({ versionId: "primary-original-v1" })
      .mockResolvedValueOnce({ versionId: "primary-restored-v1" });
    recovery.putObject.mockResolvedValue({ versionId: "recovery-v1" });
    primary.headObject
      .mockResolvedValueOnce({ byteCount: body.byteLength, sha256: digest, versionId: "primary-original-v1" })
      .mockResolvedValueOnce({ byteCount: body.byteLength, sha256: digest, versionId: "primary-restored-v1" });
    recovery.headObject.mockResolvedValue({
      byteCount: body.byteLength, sha256: digest, versionId: "recovery-v1",
    });
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).rehearseRestore())
      .resolves.toEqual(expect.objectContaining({
        status: "verified",
        byteCount: body.byteLength,
        manifestDigest: digest,
      }));
    expect(primary.putObject).toHaveBeenNthCalledWith(1, expect.objectContaining({ createOnly: true }));
    expect(recovery.putObject).toHaveBeenCalledWith(expect.objectContaining({ createOnly: true }));
    expect(primary.putObject).toHaveBeenNthCalledWith(2, expect.objectContaining({ createOnly: true }));
    expect(primary.deleteObject).toHaveBeenNthCalledWith(1, {
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "primary-original-v1",
    });
    expect(primary.deleteObject).toHaveBeenNthCalledWith(2, {
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "primary-restored-v1",
    });
    expect(recovery.deleteObject).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "recovery-v1",
    });
    expect(primary.headObject.mock.calls.every(([reference]) => (
      typeof reference === "object" && typeof reference.versionId === "string"
    ))).toBe(true);
    expect(primary.getObject.mock.calls.every(([reference]) => (
      typeof reference === "object" && typeof reference.versionId === "string"
    ))).toBe(true);
    expect(recovery.getObject.mock.calls.every(([reference]) => (
      typeof reference === "object" && typeof reference.versionId === "string"
    ))).toBe(true);
  });

  it("deletes a freshly created local rehearsal version when verification fails", async () => {
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    primary.putObject.mockResolvedValue({ versionId: "fresh-primary-v1" });
    primary.headObject.mockResolvedValue({ byteCount: 1, sha256: "b".repeat(64), versionId: "fresh-primary-v1" });
    primary.getObject.mockResolvedValue(Buffer.from("wrong"));

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).rehearseRestore())
      .rejects.toThrow("integrity verification failed");
    expect(primary.deleteObject).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^rehearsals\//),
      versionId: "fresh-primary-v1",
    });
    expect(primary.deleteObject.mock.calls.some(([reference]) => typeof reference === "string")).toBe(false);
    expect(recovery.putObject).not.toHaveBeenCalled();
  });

  it("deletes a freshly created historical R2 rehearsal key when verification fails", async () => {
    primary.putObject.mockResolvedValue({});
    primary.getObject.mockResolvedValue(Buffer.from("wrong"));

    await expect(service().rehearseRestore()).rejects.toThrow("integrity verification failed");
    expect(primary.deleteObject).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^rehearsals\//),
    });
    expect(recovery.putObject).not.toHaveBeenCalled();
  });

  it("rejects local reconciliation on the operation quota before provider inventory", async () => {
    repository.reserveProviderOperations.mockRejectedValue(new Error("operation limit"));
    repository.listReconciliationInventory.mockResolvedValue([]);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).reconcile())
      .rejects.toThrow("operation limit");
    expect(primary.listObjectVersionsByPrefix).not.toHaveBeenCalled();
    expect(primary.listObjectKeys).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["blank", { versionId: "" }],
  ])("fails closed without key-only cleanup when a local rehearsal PUT has a %s VersionId", async (_label, putResult) => {
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    primary.putObject.mockResolvedValue(putResult);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).rehearseRestore())
      .rejects.toThrow("object version identity is unavailable");
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(recovery.deleteObject).not.toHaveBeenCalled();
    expect(primary.putObject).toHaveBeenCalledWith(expect.objectContaining({
      createOnly: true,
      body,
    }));
    expect(primary.deleteObject.mock.calls.flat()).not.toContainEqual(expect.any(String));
  });

  it("surfaces local rehearsal cleanup failure after exact known-ref cleanup attempts", async () => {
    const body = Buffer.from("hr-axis-synthetic-restore-rehearsal-v1");
    const digest = createHash("sha256").update(body).digest("hex");
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    recovery.listObjectVersions.mockResolvedValue({ versions: [] });
    primary.putObject
      .mockResolvedValueOnce({ versionId: "primary-original-v1" })
      .mockResolvedValueOnce({ versionId: "primary-restored-v1" });
    recovery.putObject.mockResolvedValue({ versionId: "recovery-v1" });
    primary.headObject
      .mockResolvedValueOnce({ byteCount: body.byteLength, sha256: digest, versionId: "primary-original-v1" })
      .mockResolvedValueOnce({ byteCount: body.byteLength, sha256: digest, versionId: "primary-restored-v1" });
    recovery.headObject.mockResolvedValue({
      byteCount: body.byteLength, sha256: digest, versionId: "recovery-v1",
    });
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);
    primary.deleteObject
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("restored cleanup failed"));
    recovery.deleteObject.mockResolvedValue(undefined);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).rehearseRestore())
      .rejects.toThrow("cleanup failed");
    expect(primary.deleteObject).toHaveBeenNthCalledWith(1, {
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "primary-original-v1",
    });
    expect(primary.deleteObject).toHaveBeenNthCalledWith(2, {
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "primary-restored-v1",
    });
    expect(recovery.deleteObject).toHaveBeenCalledWith({
      objectKey: expect.stringMatching(/^rehearsals\//), versionId: "recovery-v1",
    });
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

  it("deletes a local raw candidate by its persisted exact version", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-local-versioned",
      cleanupLeaseToken: "lease-local-versioned",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: "local-version-1",
    }]);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupReadyRawDisposals(1, null)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(primary.deleteObject).toHaveBeenCalledWith({
      objectKey: "transient/companies/a/media/raw",
      versionId: "local-version-1",
    });
    expect(repository.markRawDisposed).toHaveBeenCalledTimes(1);
  });

  it("recovers one local raw version before deleting a NULL-version candidate", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-local-recovered",
      cleanupLeaseToken: "lease-local-recovered",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);
    primary.listObjectVersions.mockResolvedValue({ versions: [{
      objectKey: "transient/companies/a/media/raw",
      versionId: "local-version-recovered",
    }] });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupReadyRawDisposals(1, null)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(primary.listObjectVersions).toHaveBeenCalledWith({
      objectKey: "transient/companies/a/media/raw",
    });
    expect(primary.deleteObject).toHaveBeenCalledWith({
      objectKey: "transient/companies/a/media/raw",
      versionId: "local-version-recovered",
    });
    expect(repository.markRawDisposed).toHaveBeenCalledTimes(1);
  });

  it("completes local NULL-version cleanup when exact inventory proves absence", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-local-absent",
      cleanupLeaseToken: "lease-local-absent",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);
    primary.listObjectVersions.mockResolvedValue({ versions: [] });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupReadyRawDisposals(1, null)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRawDisposed).toHaveBeenCalledTimes(1);
    expect(repository.recordCleanupFailure).not.toHaveBeenCalled();
  });

  it("fails closed on ambiguous local NULL-version cleanup inventory", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-local-ambiguous",
      cleanupLeaseToken: "lease-local-ambiguous",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);
    primary.listObjectVersions.mockResolvedValue({ versions: [
      { objectKey: "transient/companies/a/media/raw", versionId: "local-version-1" },
      { objectKey: "transient/companies/a/media/raw", versionId: "local-version-2" },
    ] });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupReadyRawDisposals(1, null)).rejects.toThrow("ambiguous");
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRawDisposed).not.toHaveBeenCalled();
    expect(repository.recordCleanupFailure).toHaveBeenCalledWith({
      mediaAssetId: "asset-local-ambiguous",
      cleanupLeaseToken: "lease-local-ambiguous",
      reasonCode: "provider_delete_failed",
    });
  });

  it.each([
    ["wrong key", { objectKey: "transient/other/raw", versionId: "local-version-1" }],
    ["empty version", { objectKey: "transient/companies/a/media/raw", versionId: "" }],
  ])("fails closed when recovered local cleanup identity has %s", async (_label, version) => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-local-invalid",
      cleanupLeaseToken: "lease-local-invalid",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);
    primary.listObjectVersions.mockResolvedValue({ versions: [version] });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupReadyRawDisposals(1, null)).rejects.toThrow("ambiguous");
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRawDisposed).not.toHaveBeenCalled();
    expect(repository.recordCleanupFailure).toHaveBeenCalledTimes(1);
  });

  it("keeps historical R2 NULL-version cleanup key-only", async () => {
    repository.claimReadyRawDisposals.mockResolvedValue([{
      mediaAssetId: "asset-r2-historical",
      cleanupLeaseToken: "lease-r2-historical",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);

    await expect(service().cleanupReadyRawDisposals(1, null)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(primary.listObjectVersions).not.toHaveBeenCalled();
    expect(primary.deleteObject).toHaveBeenCalledWith("transient/companies/a/media/raw");
    expect(repository.markRawDisposed).toHaveBeenCalledTimes(1);
  });

  it("applies the same exact-version recovery rules to stale partial cleanup", async () => {
    repository.claimStalePartialUploads.mockResolvedValue([{
      mediaAssetId: "asset-local-partial",
      cleanupLeaseToken: "lease-local-partial",
      rawObjectKey: "transient/companies/a/media/raw",
      rawObjectVersionId: null,
    }]);
    primary.listObjectVersions.mockResolvedValue({ versions: [] });

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" })
      .cleanupStalePartials(1)).resolves.toEqual({ claimed: 1, deleted: 1 });
    expect(primary.listObjectVersions).toHaveBeenCalledWith({
      objectKey: "transient/companies/a/media/raw",
    });
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markPartialUploadDisposed).toHaveBeenCalledWith({
      mediaAssetId: "asset-local-partial",
      cleanupLeaseToken: "lease-local-partial",
      reasonCode: "partial_expired",
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

  it("skips a local restore only after exact primary proof matches", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-local-restore", cleanupLeaseToken: "lease-local-restore",
      canonicalObjectKey: "locked/current.webp", canonicalObjectVersionId: "primary-v1",
      recoveryObjectKey: "locked/recovery.webp", recoveryObjectVersionId: "recovery-v1",
      restoreObjectKey: "locked/new.webp", restoreObjectVersionId: null, replicaGeneration: 2,
      canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest, versionId: "primary-v1" });
    primary.getObject.mockResolvedValue(body);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).restoreAsset({
      mediaAssetId: "asset-local-restore", actorUserId: "actor",
    })).resolves.toEqual({ mediaAssetId: "asset-local-restore", status: "not_required" });
    expect(primary.headObject).toHaveBeenCalledWith({
      objectKey: "locked/current.webp", versionId: "primary-v1",
    });
    expect(primary.getObject).toHaveBeenCalledWith({
      objectKey: "locked/current.webp", versionId: "primary-v1",
    });
    expect(repository.markRestoreSkipped).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: "asset-local-restore", cleanupLeaseToken: "lease-local-restore",
    }));
    expect(repository.reserveRestoreGeneration).not.toHaveBeenCalled();
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

  it("does not clean up a failed R2 restore write without rehearsal cleanup mode", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-r2-failed", cleanupLeaseToken: "lease-r2-failed",
      canonicalObjectKey: null, recoveryObjectKey: "locked/recovery.webp",
      restoreObjectKey: "locked/restored.webp", replicaGeneration: 2,
      canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue(null);
    recovery.getObject.mockResolvedValue(body);
    primary.putObject.mockResolvedValue({});
    primary.getObject.mockResolvedValue(Buffer.from("wrong"));

    await expect(service().restoreAsset({ mediaAssetId: "asset-r2-failed", actorUserId: "actor" }))
      .rejects.toThrow("integrity verification failed");
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRestoreFailed).toHaveBeenCalledTimes(1);
  });

  it("restores a local missing primary from an exact recovery version", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-local-missing", cleanupLeaseToken: "lease-local-missing",
      canonicalObjectKey: null, canonicalObjectVersionId: null,
      recoveryObjectKey: "locked/recovery.webp", recoveryObjectVersionId: "recovery-v1",
      restoreObjectKey: "locked/restored.webp", restoreObjectVersionId: null,
      replicaGeneration: 2, canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest, versionId: "restored-v1" });
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    primary.putObject.mockResolvedValue({ versionId: "restored-v1" });
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).restoreAsset({
      mediaAssetId: "asset-local-missing", actorUserId: "actor",
    })).resolves.toEqual({ mediaAssetId: "asset-local-missing", status: "verified" });
    expect(recovery.getObject).toHaveBeenCalledWith({
      objectKey: "locked/recovery.webp", versionId: "recovery-v1",
    });
    expect(primary.putObject).toHaveBeenCalledWith(expect.objectContaining({
      objectKey: "locked/restored.webp", createOnly: true,
    }));
    expect(repository.checkpointRestoreObjectVersion).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: "asset-local-missing", restoreObjectVersionId: "restored-v1",
    }));
    expect(repository.markRestoreVerified).toHaveBeenCalledWith(expect.objectContaining({
      previousPrimaryMissing: true, restoreObjectVersionId: "restored-v1",
    }));
  });

  it("reuses a persisted local restore checkpoint without a second PUT", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-local-retry", cleanupLeaseToken: "lease-local-retry",
      canonicalObjectKey: null, canonicalObjectVersionId: null,
      recoveryObjectKey: "locked/recovery.webp", recoveryObjectVersionId: "recovery-v1",
      restoreObjectKey: "locked/restored.webp", restoreObjectVersionId: "restored-v1",
      replicaGeneration: 2, canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest, versionId: "restored-v1" });
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).restoreAsset({
      mediaAssetId: "asset-local-retry", actorUserId: "actor",
    })).resolves.toEqual({ mediaAssetId: "asset-local-retry", status: "verified" });
    expect(primary.putObject).not.toHaveBeenCalled();
    expect(primary.listObjectVersions).not.toHaveBeenCalled();
    expect(primary.headObject).toHaveBeenCalledWith({
      objectKey: "locked/restored.webp", versionId: "restored-v1",
    });
    expect(repository.checkpointRestoreObjectVersion).toHaveBeenCalledWith(expect.objectContaining({
      restoreObjectVersionId: "restored-v1",
    }));
  });

  it("adopts one local restore version after create-only conflict without duplicating the PUT", async () => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-local-conflict", cleanupLeaseToken: "lease-local-conflict",
      canonicalObjectKey: null, canonicalObjectVersionId: null,
      recoveryObjectKey: "locked/recovery.webp", recoveryObjectVersionId: "recovery-v1",
      restoreObjectKey: "locked/restored.webp", restoreObjectVersionId: null,
      replicaGeneration: 2, canonicalSha256: digest, canonicalByteCount: body.byteLength,
    });
    primary.headObject.mockResolvedValue({ byteCount: body.byteLength, sha256: digest, versionId: "restored-v1" });
    primary.listObjectVersions
      .mockResolvedValueOnce({ versions: [] })
      .mockResolvedValueOnce({ versions: [{ objectKey: "locked/restored.webp", versionId: "restored-v1" }] });
    primary.putObject.mockRejectedValueOnce(new PhotoMediaObjectCreateConflictError());
    primary.getObject.mockResolvedValue(body);
    recovery.getObject.mockResolvedValue(body);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).restoreAsset({
      mediaAssetId: "asset-local-conflict", actorUserId: "actor",
    })).resolves.toEqual({ mediaAssetId: "asset-local-conflict", status: "verified" });
    expect(primary.putObject).toHaveBeenCalledTimes(1);
    expect(primary.putObject).toHaveBeenCalledWith(expect.objectContaining({ createOnly: true }));
    expect(repository.markRestoreVerified).toHaveBeenCalledWith(expect.objectContaining({
      restoreObjectVersionId: "restored-v1",
    }));
  });

  it.each([
    ["missing recovery version", { recoveryObjectVersionId: null }, undefined],
    ["blank recovery version", { recoveryObjectVersionId: "" }, undefined],
    ["ambiguous restore inventory", { restoreObjectVersionId: null }, {
      versions: [
        { objectKey: "locked/restored.webp", versionId: "restored-v1" },
        { objectKey: "locked/restored.webp", versionId: "restored-v2" },
      ],
    }],
  ])("fails closed for local restore with %s", async (_label, overrides, inventory) => {
    const body = Buffer.from("canonical");
    const digest = createHash("sha256").update(body).digest("hex");
    repository.claimRestoreCandidate.mockResolvedValue({
      mediaAssetId: "asset-local-invalid", cleanupLeaseToken: "lease-local-invalid",
      canonicalObjectKey: null, canonicalObjectVersionId: null,
      recoveryObjectKey: "locked/recovery.webp", recoveryObjectVersionId: "recovery-v1",
      restoreObjectKey: "locked/restored.webp", restoreObjectVersionId: "restored-v1",
      replicaGeneration: 2, canonicalSha256: digest, canonicalByteCount: body.byteLength,
      ...overrides,
    });
    primary.listObjectVersions.mockResolvedValue(inventory ?? { versions: [] });
    recovery.getObject.mockResolvedValue(body);
    repository.markRestoreFailed.mockResolvedValue(undefined);

    await expect(service({ provider: "seaweedfs", jurisdiction: "onprem" }).restoreAsset({
      mediaAssetId: "asset-local-invalid", actorUserId: "actor",
    })).rejects.toThrow(/Photo media restore object/);
    expect(primary.putObject).not.toHaveBeenCalled();
    expect(repository.markRestoreVerified).not.toHaveBeenCalled();
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
      primaryObjects: [{ objectKey: "companies/a/media/1/canonical.webp" }],
      thumbnailObject: { objectKey: "companies/a/media/1/thumbnail.webp" },
      recoveryObjects: [{ objectKey: "companies/a/media/1/canonical.webp" }],
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

  it("deletes a local purge candidate through exact object references before tombstoning", async () => {
    retentionRepository.claimPurgeManifest.mockResolvedValue({
      manifestId: "manifest-local-1",
      manifestDigest: "c".repeat(64),
      manifestLeaseToken: "manifest-lease-local-1",
      candidates: [{
        mediaAssetId: "asset-local-1",
        canonicalSha256: sha,
        cleanupLeaseToken: "lease-local-1",
        thumbnailObject: {
          objectKey: "derived/companies/a/media/1/thumbnail.webp",
          versionId: "thumbnail-version-1",
        },
        primaryObjects: [{
          objectKey: "locked/companies/a/media/1/canonical.webp",
          versionId: "primary-version-1",
        }],
        recoveryObjects: [{
          objectKey: "locked/companies/a/media/1/canonical.webp",
          versionId: "recovery-version-1",
        }],
      }],
    });
    retentionRepository.markPurgeManifestCompleted.mockResolvedValue(undefined);

    await expect(service({
      provider: "seaweedfs",
      jurisdiction: "onprem",
      scheduledRetentionCleanupEnabled: true,
    }).executeRetentionPurge({
      manifestId: "manifest-local-1",
      manifestDigest: "c".repeat(64),
      actorUserId: "actor-1",
    })).resolves.toEqual(expect.objectContaining({
      claimedCount: 1,
      deletedCount: 1,
      status: "completed",
    }));
    expect(primary.deleteObject).toHaveBeenNthCalledWith(1, {
      objectKey: "locked/companies/a/media/1/canonical.webp",
      versionId: "primary-version-1",
    });
    expect(primary.deleteObject).toHaveBeenNthCalledWith(2, {
      objectKey: "derived/companies/a/media/1/thumbnail.webp",
      versionId: "thumbnail-version-1",
    });
    expect(recovery.deleteObject).toHaveBeenCalledWith({
      objectKey: "locked/companies/a/media/1/canonical.webp",
      versionId: "recovery-version-1",
    });
    expect(repository.markDeletedTombstone).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: "asset-local-1",
      purgeManifestId: "manifest-local-1",
    }));
  });

  it("fails closed when a local purge candidate is missing an exact object version", async () => {
    retentionRepository.claimPurgeManifest.mockResolvedValue({
      manifestId: "manifest-local-null",
      manifestDigest: "d".repeat(64),
      manifestLeaseToken: "manifest-lease-local-null",
      candidates: [{
        mediaAssetId: "asset-local-null",
        canonicalSha256: sha,
        cleanupLeaseToken: "lease-local-null",
        thumbnailObject: { objectKey: "derived/companies/a/media/1/thumbnail.webp" },
        primaryObjects: [{
          objectKey: "locked/companies/a/media/1/canonical.webp",
          versionId: "primary-version-1",
        }],
        recoveryObjects: [],
      }],
    });
    repository.recordCleanupFailure.mockResolvedValue(undefined);
    retentionRepository.releasePurgeManifestAssetLeases.mockResolvedValue(undefined);
    retentionRepository.markPurgeManifestRetryableFailure.mockResolvedValue(undefined);

    await expect(service({
      provider: "seaweedfs",
      jurisdiction: "onprem",
      scheduledRetentionCleanupEnabled: true,
    }).executeRetentionPurge({
      manifestId: "manifest-local-null",
      manifestDigest: "d".repeat(64),
      actorUserId: "actor-1",
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "provider_delete_failed" }),
    });
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markDeletedTombstone).not.toHaveBeenCalled();
    expect(repository.recordCleanupFailure).toHaveBeenCalledWith({
      mediaAssetId: "asset-local-null",
      cleanupLeaseToken: "lease-local-null",
      reasonCode: "provider_delete_failed",
    });
  });

  it("reconciles a local empty inventory after exact support is enabled", async () => {
    const localService = service({
      provider: "seaweedfs",
      jurisdiction: "onprem",
      scheduledRetentionCleanupEnabled: true,
    });
    repository.listReconciliationInventory.mockResolvedValue([]);
    primary.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    recovery.listObjectKeys.mockResolvedValue({ objectKeys: [] });
    await expect(localService.reconcile()).resolves.toEqual(expect.objectContaining({
      expectedAssetCount: 0,
      orphanPrimaryCount: 0,
      orphanRecoveryCount: 0,
    }));
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
        primaryObjects: [{ objectKey: "locked/companies/a/media/1/canonical.webp" }],
        thumbnailObject: { objectKey: "derived/companies/a/media/1/thumbnail.webp" },
        recoveryObjects: [],
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
      storageIdentity: expect.objectContaining({ provider: "r2", jurisdiction: "eu" }),
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
        primaryObjects: [{ objectKey: "locked/companies/a/media/1/canonical.webp" }],
        thumbnailObject: { objectKey: "derived/companies/a/media/1/thumbnail.webp" },
        recoveryObjects: [{ objectKey: "locked/companies/a/media/1/canonical.webp" }],
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
