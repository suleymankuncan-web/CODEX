import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PhotoMediaStorageService } from "./photo-media-storage.service";

describe("PhotoMediaStorageService", () => {
  const mediaAsset = {
    mediaAssetId: "22222222-2222-4222-8222-222222222222",
    companyId: "11111111-1111-4111-8111-111111111111",
    regionId: "33333333-3333-4333-8333-333333333333",
    storeId: "44444444-4444-4444-8444-444444444444",
    state: "ready" as const,
    canonicalObjectKey: "companies/1/media/2/canonical.webp",
    thumbnailObjectKey: "companies/1/media/2/thumbnail.webp",
    canonicalSha256: "a".repeat(64),
    canonicalByteCount: 128,
  };

  const repository = {
    getUsage: jest.fn().mockResolvedValue({
      aggregateStoredBytes: 0,
      monthlyClassAOperations: 0,
      monthlyClassBOperations: 0,
    }),
    createInitiatedAsset: jest.fn(),
    findAssetForRead: jest.fn().mockResolvedValue(mediaAsset),
    recordAccessEvent: jest.fn(),
    markQuarantined: jest.fn(),
    markRejected: jest.fn(),
    markReadyAfterVerifiedRecovery: jest.fn(),
    markUploaded: jest.fn(),
    prepareFinalizeAttempt: jest.fn(),
    acquireProcessingLease: jest.fn().mockResolvedValue("77777777-7777-4777-8777-777777777777"),
    releaseProcessingLease: jest.fn(),
    resizeByteReservation: jest.fn(),
    recordVerifiedReplica: jest.fn(),
    recordProviderFailure: jest.fn(),
    recordQuotaDenial: jest.fn(),
    claimReadyRawDisposal: jest.fn(),
    markRawDisposed: jest.fn(),
    recordCleanupFailure: jest.fn(),
    reserveProviderOperations: jest.fn(),
  };
  const primary = {
    createSignedUpload: jest.fn(),
    createSignedRead: jest.fn().mockResolvedValue({ url: "https://signed.invalid", expiresInSeconds: 120 }),
    getObject: jest.fn(),
    putObject: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const recovery = {
    createSignedUpload: jest.fn(),
    createSignedRead: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  };
  const processor = { process: jest.fn() };
  const scanner = { scan: jest.fn() };
  const configuration = {
    enabled: true,
    syntheticOnly: true,
    provider: "r2" as const,
    jurisdiction: "eu" as const,
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
    syntheticFixtureSha256Allowlist: [createHash("sha256").update(Buffer.from("approved-fixture")).digest("hex")],
    safetyAssurance: "fixture_identity_only" as const,
  };

  function createService() {
    return new PhotoMediaStorageService(
      repository as never,
      primary as never,
      recovery as never,
      processor as never,
      scanner as never,
      configuration,
    );
  }

  beforeEach(() => {
    for (const value of [
      ...Object.values(repository), ...Object.values(primary), ...Object.values(recovery),
      ...Object.values(processor), ...Object.values(scanner),
    ]) {
      value.mockReset();
    }
    repository.findAssetForRead.mockResolvedValue(mediaAsset);
    repository.acquireProcessingLease.mockResolvedValue("77777777-7777-4777-8777-777777777777");
    primary.createSignedRead.mockResolvedValue({ url: "https://signed.invalid", expiresInSeconds: 120 });
    repository.claimReadyRawDisposal.mockResolvedValue({
      mediaAssetId: mediaAsset.mediaAssetId,
      rawObjectKey: "companies/1/media/2/raw",
      cleanupLeaseToken: "88888888-8888-4888-8888-888888888888",
    });
  });

  it("denies signed reads outside the authenticated company/store scope", async () => {
    await expect(
      createService().createSignedRead({
        mediaAssetId: mediaAsset.mediaAssetId,
        actorUserId: "55555555-5555-4555-8555-555555555555",
        actorScope: { companyIds: [], regionIds: [], storeIds: [] },
        variant: "thumbnail",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(primary.createSignedRead).not.toHaveBeenCalled();
  });

  it("initiates only attested synthetic fixtures for a scoped super admin", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    repository.createInitiatedAsset.mockImplementationOnce(async (input) => ({
      mediaAssetId: input.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey: input.rawObjectKey,
    }));
    primary.putObject.mockResolvedValueOnce(undefined);

    await expect(createService().initiateSyntheticUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["SUPER_ADMIN"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [] },
      storeId: mediaAsset.storeId,
      contentType: "image/jpeg",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
      syntheticFixtureAttestation: true,
    })).resolves.toMatchObject({
      mediaAssetId: expect.any(String),
      state: "uploaded",
    });
    expect(repository.createInitiatedAsset).toHaveBeenCalledWith(expect.objectContaining({
      allowedCompanyIds: [mediaAsset.companyId],
      captureSource: "system_generated",
      quota: expect.objectContaining({ aggregateBytesHardLimit: 8 * 1024 * 1024 * 1024 }),
    }));
    expect(repository.acquireProcessingLease).toHaveBeenCalledWith(expect.objectContaining({
      requiredState: "initiated",
    }));
    expect(repository.releaseProcessingLease).toHaveBeenCalledTimes(1);
  });

  it("rejects ordinary actors and non-synthetic upload initiation", async () => {
    await expect(createService().initiateSyntheticUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/jpeg",
      contentLength: 1024,
      contentBody: Buffer.alloc(1024),
      syntheticFixtureAttestation: true,
    })).rejects.toBeInstanceOf(ForbiddenException);

    await expect(createService().initiateSyntheticUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["SUPER_ADMIN"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [] },
      storeId: mediaAsset.storeId,
      contentType: "image/jpeg",
      contentLength: 1024,
      contentBody: Buffer.alloc(1024),
      syntheticFixtureAttestation: false,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createInitiatedAsset).not.toHaveBeenCalled();
  });

  it("proxies scoped thumbnail bytes without exposing a provider URL", async () => {
    const body = Buffer.from("synthetic-thumbnail");
    primary.getObject.mockResolvedValueOnce(body);

    await expect(createService().readContent({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [], regionIds: [], storeIds: [mediaAsset.storeId] },
      variant: "thumbnail",
    })).resolves.toEqual({ body, contentType: "image/webp" });

    expect(primary.getObject).toHaveBeenCalledWith(mediaAsset.thumbnailObjectKey);
    expect(primary.createSignedRead).not.toHaveBeenCalled();
    expect(repository.recordAccessEvent).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: mediaAsset.mediaAssetId,
      variant: "thumbnail",
    }));
  });

  it("accepts only a server-allowlisted synthetic fixture for checklist-scoped upload", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    repository.createInitiatedAsset.mockImplementationOnce(async (input) => ({
      mediaAssetId: input.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey: input.rawObjectKey,
    }));
    primary.putObject.mockResolvedValueOnce(undefined);

    await expect(createService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
    })).resolves.toMatchObject({ state: "uploaded" });
  });

  it("rejects a client-attested body whose digest is not on the server allowlist", async () => {
    const unapproved = Buffer.from("not-approved");
    await expect(createService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: unapproved.byteLength,
      contentBody: unapproved,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createInitiatedAsset).not.toHaveBeenCalled();
  });

  it("does not let Super Admin attestation bypass the approved fixture digest", async () => {
    const unapproved = Buffer.from("unapproved-super-admin-fixture");

    await expect(createService().initiateSyntheticUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["SUPER_ADMIN"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: unapproved.byteLength,
      contentBody: unapproved,
      syntheticFixtureAttestation: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createInitiatedAsset).not.toHaveBeenCalled();
    expect(primary.putObject).not.toHaveBeenCalled();
  });

  it("leaves an uploaded asset retryable when the safety scanner is unavailable", async () => {
    const uploaded = {
      ...mediaAsset, state: "uploaded" as const, rawObjectKey: "companies/1/media/2/raw",
      storageAttemptId: "99999999-9999-4999-8999-999999999999", rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    primary.getObject.mockResolvedValue(Buffer.from("synthetic-image"));
    scanner.scan.mockResolvedValue({ verdict: "unavailable", engine: "synthetic_sha256_allowlist", assurance: "fixture_identity_only" });

    await expect(createService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.markQuarantined).not.toHaveBeenCalled();
    expect(repository.releaseProcessingLease).toHaveBeenCalledTimes(1);
  });

  it("quarantines unsafe content and requires explicit disposal", async () => {
    const uploaded = {
      ...mediaAsset, state: "uploaded" as const, rawObjectKey: "companies/1/media/2/raw",
      storageAttemptId: "99999999-9999-4999-8999-999999999999", rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    primary.getObject.mockResolvedValue(Buffer.from("unsafe-image"));
    scanner.scan.mockResolvedValue({ verdict: "unsafe", engine: "synthetic_sha256_allowlist", assurance: "fixture_identity_only", reasonCode: "scanner_unsafe" });

    await expect(createService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).rejects.toThrow("did not pass safety scanning");
    expect(repository.markQuarantined).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId: mediaAsset.mediaAssetId, reasonCode: "scanner_unsafe",
    }));
    expect(primary.deleteObject).not.toHaveBeenCalled();
  });

  it("refuses a scanner result whose assurance does not match synthetic fixture identity", async () => {
    const uploaded = {
      ...mediaAsset, state: "uploaded" as const, rawObjectKey: "companies/1/media/2/raw",
      storageAttemptId: "99999999-9999-4999-8999-999999999999", rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    primary.getObject.mockResolvedValue(Buffer.from("approved-fixture"));
    scanner.scan.mockResolvedValue({
      verdict: "clean",
      engine: "unexpected-malware-scanner",
      assurance: "malware_scan",
    });

    await expect(createService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).rejects.toThrow("safety assurance does not match");
    expect(processor.process).not.toHaveBeenCalled();
    expect(primary.putObject).not.toHaveBeenCalled();
    expect(recovery.putObject).not.toHaveBeenCalled();
  });

  it("does not finalize when the recovery copy cannot be hash verified", async () => {
    const raw = Buffer.from("synthetic-image");
    const canonical = Buffer.from("canonical");
    const thumbnail = Buffer.from("thumbnail");
    const canonicalSha256 = createHash("sha256").update(canonical).digest("hex");
    const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
    const uploaded = {
      ...mediaAsset,
      state: "uploaded" as const,
      rawObjectKey: "companies/1/media/2/raw",
      storageAttemptId: "99999999-9999-4999-8999-999999999999",
      rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    primary.getObject
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce(canonical)
      .mockResolvedValueOnce(thumbnail);
    scanner.scan.mockResolvedValue({ verdict: "clean", engine: "synthetic_sha256_allowlist", assurance: "fixture_identity_only", signatureVersion: "test" });
    processor.process.mockResolvedValue({
      canonical,
      thumbnail,
      canonicalSha256,
      thumbnailSha256,
      widthPx: 100,
      heightPx: 100,
      mimeType: "image/webp",
    });
    primary.headObject.mockResolvedValue(null);
    recovery.headObject.mockResolvedValue({ byteCount: 9, sha256: "c".repeat(64) });
    recovery.getObject.mockResolvedValue(Buffer.from("corrupt"));

    await expect(
      createService().finalizeSyntheticUpload({
        mediaAssetId: mediaAsset.mediaAssetId,
        actorUserId: "55555555-5555-4555-8555-555555555555",
        actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.markReadyAfterVerifiedRecovery).not.toHaveBeenCalled();
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.reserveProviderOperations).toHaveBeenCalledWith(expect.objectContaining({
      classAOperations: 3,
      classBOperations: 7,
    }));
    expect(repository.releaseProcessingLease).toHaveBeenCalledTimes(1);
  });

  it("binds each stored object to its own digest and disposes raw only after recovery verification", async () => {
    const raw = Buffer.from("synthetic-image");
    const canonical = Buffer.from("canonical");
    const thumbnail = Buffer.from("thumbnail");
    const canonicalSha256 = createHash("sha256").update(canonical).digest("hex");
    const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
    const uploaded = {
      ...mediaAsset,
      state: "uploaded" as const,
      rawObjectKey: "companies/1/media/2/raw",
      storageAttemptId: "99999999-9999-4999-8999-999999999999",
      rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    primary.getObject
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce(canonical)
      .mockResolvedValueOnce(thumbnail);
    scanner.scan.mockResolvedValue({ verdict: "clean", engine: "synthetic_sha256_allowlist", assurance: "fixture_identity_only", signatureVersion: "test" });
    processor.process.mockResolvedValue({
      canonical,
      thumbnail,
      canonicalSha256,
      thumbnailSha256,
      widthPx: 100,
      heightPx: 100,
      mimeType: "image/webp",
    });
    primary.headObject.mockResolvedValue(null);
    recovery.headObject.mockResolvedValue(null);
    recovery.getObject.mockResolvedValue(canonical);

    await expect(createService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).resolves.toEqual({
      mediaAssetId: mediaAsset.mediaAssetId,
      state: "ready",
      rawDisposal: "verified",
    });

    expect(primary.putObject).toHaveBeenNthCalledWith(1, expect.objectContaining({
      body: canonical,
      sha256: canonicalSha256,
    }));
    expect(primary.putObject).toHaveBeenNthCalledWith(2, expect.objectContaining({
      body: thumbnail,
      sha256: thumbnailSha256,
    }));
    expect(primary.deleteObject).toHaveBeenCalledWith("companies/1/media/2/raw");
    expect(repository.markReadyAfterVerifiedRecovery).toHaveBeenCalledTimes(1);
    expect(repository.recordVerifiedReplica).toHaveBeenCalledTimes(2);
    expect(repository.markRawDisposed).toHaveBeenCalledTimes(1);
    expect(repository.releaseProcessingLease).toHaveBeenCalledTimes(1);
  });

});
