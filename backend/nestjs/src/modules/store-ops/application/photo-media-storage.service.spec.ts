import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { buildPhotoMediaObjectKeys } from "./photo-media-storage.contract";
import { PhotoMediaObjectCreateConflictError } from "./photo-media-storage.ports";
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
    findFinalizeObjectCheckpoints: jest.fn().mockResolvedValue({}),
    checkpointThumbnailObject: jest.fn(),
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
    listObjectVersions: jest.fn(),
  };
  const recovery = {
    createSignedUpload: jest.fn(),
    createSignedRead: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
    listObjectVersions: jest.fn(),
  };
  const processor = { process: jest.fn() };
  const scanner = { scan: jest.fn() };
  const configuration = {
    enabled: true,
    syntheticOnly: true,
    provider: "r2" as const,
    jurisdiction: "eu" as const,
    region: "auto" as const,
    forcePathStyle: true as const,
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

  function createLocalService() {
    return new PhotoMediaStorageService(
      repository as never,
      primary as never,
      recovery as never,
      processor as never,
      scanner as never,
      {
        ...configuration,
        provider: "seaweedfs",
        jurisdiction: "onprem",
        region: "us-east-1",
        primaryEndpoint: "http://object-storage:8333",
        recoveryEndpoint: "http://object-storage:8333",
      } as never,
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
    repository.findFinalizeObjectCheckpoints.mockResolvedValue({});
    repository.acquireProcessingLease.mockResolvedValue("77777777-7777-4777-8777-777777777777");
    primary.createSignedRead.mockResolvedValue({ url: "https://signed.invalid", expiresInSeconds: 120 });
    primary.listObjectVersions.mockResolvedValue({ versions: [] });
    recovery.listObjectVersions.mockResolvedValue({ versions: [] });
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

  it("leaves the exact local object for reconciliation when lease-fenced DB transition fails", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    const rawObjectKey = "transient/companies/1/media/2/raw";
    const rawVersionId = "raw-version-1";
    repository.createInitiatedAsset.mockResolvedValueOnce({
      mediaAssetId: mediaAsset.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey,
    });
    primary.putObject.mockResolvedValueOnce({ versionId: rawVersionId });
    primary.headObject.mockResolvedValueOnce({
      byteCount: approvedFixture.byteLength,
      sha256: createHash("sha256").update(approvedFixture).digest("hex"),
    });
    primary.getObject.mockResolvedValueOnce(approvedFixture);
    repository.markUploaded.mockRejectedValueOnce(new Error("Photo media upload state is stale"));

    await expect(createLocalService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
    })).rejects.toThrow("upload state is stale");

    expect(repository.markUploaded).toHaveBeenCalledWith(expect.objectContaining({
      rawObjectVersionId: rawVersionId,
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRejected).not.toHaveBeenCalled();
  });

  it("does not claim a local upload or issue a key-only compensation when the raw version is missing", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    const rawObjectKey = "transient/companies/1/media/2/raw";
    repository.createInitiatedAsset.mockResolvedValueOnce({
      mediaAssetId: mediaAsset.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey,
    });
    primary.putObject.mockResolvedValueOnce({});

    await expect(createLocalService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
    })).rejects.toThrow("object version identity");

    expect(repository.markUploaded).not.toHaveBeenCalled();
    expect(primary.deleteObject).not.toHaveBeenCalled();
  });

  it("leaves historical R2 objects for reconciliation after a lease-fenced transition failure", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    const rawObjectKey = "transient/companies/1/media/2/raw";
    repository.createInitiatedAsset.mockResolvedValueOnce({
      mediaAssetId: mediaAsset.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey,
    });
    primary.putObject.mockResolvedValueOnce({});
    repository.markUploaded.mockRejectedValueOnce(new Error("Photo media upload state is stale"));

    await expect(createService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
    })).rejects.toThrow("upload state is stale");

    expect(repository.markUploaded).toHaveBeenCalledWith(expect.objectContaining({
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(primary.deleteObject).not.toHaveBeenCalled();
    expect(repository.markRejected).not.toHaveBeenCalled();
  });

  it("recovers the single exact raw version after a PUT-to-DB crash without writing another version", async () => {
    const approvedFixture = Buffer.from("approved-fixture");
    const rawObjectKey = "transient/companies/1/media/2/raw";
    const rawVersionId = "raw-crash-version-1";
    const rawSha256 = createHash("sha256").update(approvedFixture).digest("hex");
    repository.createInitiatedAsset.mockResolvedValueOnce({
      mediaAssetId: mediaAsset.mediaAssetId,
      companyId: mediaAsset.companyId,
      regionId: mediaAsset.regionId,
      storeId: mediaAsset.storeId,
      state: "initiated",
      rawObjectKey,
    });
    primary.listObjectVersions
      .mockResolvedValueOnce({ versions: [] })
      .mockResolvedValueOnce({
        versions: [{ objectKey: rawObjectKey, versionId: rawVersionId }],
      });
    primary.putObject.mockRejectedValueOnce(new PhotoMediaObjectCreateConflictError());
    primary.headObject.mockResolvedValueOnce({ byteCount: approvedFixture.byteLength, sha256: rawSha256 });
    primary.getObject.mockResolvedValueOnce(approvedFixture);

    await expect(createLocalService().initiateApprovedSyntheticFixtureUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      contentType: "image/png",
      contentLength: approvedFixture.byteLength,
      contentBody: approvedFixture,
    })).resolves.toMatchObject({ state: "uploaded" });

    expect(primary.putObject).toHaveBeenCalledTimes(1);
    expect(primary.putObject).toHaveBeenCalledWith(expect.objectContaining({
      createOnly: true,
    }));
    expect(repository.markUploaded).toHaveBeenCalledWith(expect.objectContaining({
      rawObjectVersionId: rawVersionId,
    }));
  });

  it("[FR-2][AC-2] accepts only cohort-authorized attested real VM image bytes", async () => {
    const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    repository.createInitiatedAsset.mockResolvedValueOnce({
      ...mediaAsset, state: "initiated", rawObjectKey: "transient/real/raw",
      classification: "vm_campaign_evidence",
    });
    await expect(createService().initiateRealVmCampaignUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [mediaAsset.regionId], storeIds: [mediaAsset.storeId] },
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      companyId: mediaAsset.companyId,
      contentType: "image/png",
      contentLength: png.length,
      contentBody: png,
      captureSource: "camera",
      contentPolicyAttestation: true,
      cohortAuthorized: true,
    })).resolves.toMatchObject({ state: "uploaded" });
    expect(repository.createInitiatedAsset).toHaveBeenCalledWith(expect.objectContaining({
      captureSource: "camera", classification: "vm_campaign_evidence",
    }));
    expect(primary.putObject).toHaveBeenCalled();

    await expect(createService().initiateRealVmCampaignUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId,
      companyId: mediaAsset.companyId,
      contentType: "image/jpeg",
      contentLength: png.length,
      contentBody: png,
      captureSource: "gallery",
      contentPolicyAttestation: true,
      cohortAuthorized: true,
    })).rejects.toThrow("does not match");
  });

  it("[NFR-5][EC-2] decodes under the processing lease and never writes malformed real input to R2", async () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    repository.createInitiatedAsset.mockResolvedValueOnce({
      ...mediaAsset, state: "initiated", rawObjectKey: "transient/real/raw",
      classification: "vm_campaign_evidence", captureSource: "gallery",
    });
    processor.process.mockRejectedValueOnce(new BadRequestException("Photo media image decode failed"));
    await expect(createService().initiateRealVmCampaignUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId, companyId: mediaAsset.companyId,
      contentType: "image/jpeg", contentLength: jpegHeader.length, contentBody: jpegHeader,
      captureSource: "gallery", contentPolicyAttestation: true, cohortAuthorized: true,
    })).rejects.toThrow("decode failed");
    expect(repository.acquireProcessingLease).toHaveBeenCalled();
    expect(primary.putObject).not.toHaveBeenCalled();
    expect(repository.markRejected).not.toHaveBeenCalled();
  });

  it("[AC-2][EC-2] binds the fresh assignment and revision before writing real bytes to R2", async () => {
    const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    repository.createInitiatedAsset.mockResolvedValueOnce({
      ...mediaAsset, state: "initiated", rawObjectKey: "transient/real/raw",
      classification: "vm_campaign_evidence", captureSource: "camera",
    });
    const bindInitiatedAsset = jest.fn(async () => { throw new ForbiddenException("assignment changed"); });
    await expect(createService().initiateRealVmCampaignUpload({
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: [mediaAsset.companyId], regionIds: [], storeIds: [mediaAsset.storeId] },
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
      storeId: mediaAsset.storeId, companyId: mediaAsset.companyId,
      contentType: "image/png", contentLength: png.length, contentBody: png,
      captureSource: "camera", contentPolicyAttestation: true, cohortAuthorized: true,
      bindInitiatedAsset,
    })).rejects.toThrow("assignment changed");
    expect(bindInitiatedAsset).toHaveBeenCalledWith(expect.any(String));
    expect(processor.process).not.toHaveBeenCalled();
    expect(primary.putObject).not.toHaveBeenCalled();
    // No processing lease was acquired before the binding failed, so the
    // initiated row must remain untouched rather than being rejected by an
    // unfenced mutation.
    expect(repository.markRejected).not.toHaveBeenCalled();
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

  it("uses exact active-primary and thumbnail versions for local signed and content reads", async () => {
    const localAsset = {
      ...mediaAsset,
      canonicalObjectVersionId: "canonical-version-1",
      thumbnailObjectVersionId: "thumbnail-version-1",
    };
    repository.findAssetForRead.mockResolvedValue(localAsset);
    primary.createSignedRead.mockResolvedValue({ url: "http://signed.invalid/local", expiresInSeconds: 120 });
    primary.getObject.mockResolvedValue(Buffer.from("thumbnail"));

    await expect(createLocalService().createSignedRead({
      mediaAssetId: localAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [localAsset.companyId], regionIds: [], storeIds: [] },
      variant: "canonical",
    })).resolves.toEqual({ url: "http://signed.invalid/local", expiresInSeconds: 120 });
    expect(primary.createSignedRead).toHaveBeenCalledWith({
      objectKey: localAsset.canonicalObjectKey,
      versionId: localAsset.canonicalObjectVersionId,
      expiresInSeconds: 120,
    });

    await expect(createLocalService().readContent({
      mediaAssetId: localAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorScope: { companyIds: [localAsset.companyId], regionIds: [], storeIds: [] },
      variant: "thumbnail",
    })).resolves.toEqual({ body: Buffer.from("thumbnail"), contentType: "image/webp" });
    expect(primary.getObject).toHaveBeenCalledWith({
      objectKey: localAsset.thumbnailObjectKey,
      versionId: localAsset.thumbnailObjectVersionId,
    });
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
      mediaAssetId: mediaAsset.mediaAssetId,
      reasonCode: "scanner_unsafe",
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
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

  it("captures exact versions for raw, primary, recovery, and thumbnail finalization", async () => {
    const raw = Buffer.from("synthetic-image");
    const canonical = Buffer.from("canonical");
    const thumbnail = Buffer.from("thumbnail");
    const canonicalSha256 = createHash("sha256").update(canonical).digest("hex");
    const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
    const uploaded = {
      ...mediaAsset,
      state: "uploaded" as const,
      rawObjectKey: "transient/companies/1/media/2/raw",
      rawObjectVersionId: "raw-version-1",
      storageAttemptId: "99999999-9999-4999-8999-999999999999",
      rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    repository.claimReadyRawDisposal.mockResolvedValueOnce({
      mediaAssetId: mediaAsset.mediaAssetId,
      rawObjectKey: uploaded.rawObjectKey,
      rawObjectVersionId: uploaded.rawObjectVersionId,
      cleanupLeaseToken: "88888888-8888-4888-8888-888888888888",
    });
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
    primary.headObject.mockImplementation(async (reference) => ({
      byteCount: reference.objectKey.includes("thumbnail") ? thumbnail.byteLength : canonical.byteLength,
      sha256: reference.objectKey.includes("thumbnail") ? thumbnailSha256 : canonicalSha256,
    }));
    recovery.headObject.mockResolvedValue({ byteCount: canonical.byteLength, sha256: canonicalSha256 });
    primary.putObject
      .mockResolvedValueOnce({ versionId: "canonical-version-1" })
      .mockResolvedValueOnce({ versionId: "thumbnail-version-1" });
    recovery.putObject.mockResolvedValueOnce({ versionId: "recovery-version-1" });
    recovery.getObject.mockResolvedValueOnce(canonical);

    await expect(createLocalService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).resolves.toMatchObject({ state: "ready", rawDisposal: "verified" });

    expect(primary.getObject).toHaveBeenNthCalledWith(1, {
      objectKey: uploaded.rawObjectKey,
      versionId: uploaded.rawObjectVersionId,
    });
    expect(primary.getObject).toHaveBeenNthCalledWith(2, {
      objectKey: expect.stringContaining("canonical.webp"),
      versionId: "canonical-version-1",
    });
    expect(primary.getObject).toHaveBeenNthCalledWith(3, {
      objectKey: expect.stringContaining("thumbnail.webp"),
      versionId: "thumbnail-version-1",
    });
    expect(recovery.getObject).toHaveBeenCalledWith({
      objectKey: expect.stringContaining("canonical.webp"),
      versionId: "recovery-version-1",
    });
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(1, expect.objectContaining({
      objectVersionId: "canonical-version-1",
    }));
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(2, expect.objectContaining({
      objectVersionId: "recovery-version-1",
    }));
    expect(repository.resizeByteReservation).toHaveBeenCalledWith(expect.objectContaining({
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(1, expect.objectContaining({
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(2, expect.objectContaining({
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(repository.checkpointThumbnailObject).toHaveBeenCalledWith(expect.objectContaining({
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(repository.markReadyAfterVerifiedRecovery).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailObjectVersionId: "thumbnail-version-1",
      processingLeaseToken: "77777777-7777-4777-8777-777777777777",
    }));
    expect(primary.deleteObject).toHaveBeenCalledWith({
      objectKey: uploaded.rawObjectKey,
      versionId: uploaded.rawObjectVersionId,
    });
  });

  it("reuses durable local finalize checkpoints after a crash without creating new versions", async () => {
    const raw = Buffer.from("synthetic-image");
    const canonical = Buffer.from("canonical");
    const thumbnail = Buffer.from("thumbnail");
    const canonicalSha256 = createHash("sha256").update(canonical).digest("hex");
    const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
    const storageAttemptId = "66666666-6666-4666-8666-666666666666";
    const keys = buildPhotoMediaObjectKeys({
      companyId: mediaAsset.companyId,
      mediaAssetId: mediaAsset.mediaAssetId,
      storageAttemptId,
    });
    const uploaded = {
      ...mediaAsset,
      state: "uploaded" as const,
      rawObjectKey: buildPhotoMediaObjectKeys({
        companyId: mediaAsset.companyId,
        mediaAssetId: mediaAsset.mediaAssetId,
      }).raw,
      rawObjectVersionId: "raw-version-1",
      thumbnailObjectKey: keys.thumbnail,
      thumbnailObjectVersionId: "thumbnail-version-1",
      storageAttemptId,
      rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    repository.findFinalizeObjectCheckpoints.mockResolvedValueOnce({
      primary: {
        objectKey: keys.canonical,
        versionId: "canonical-version-1",
      },
      recovery: {
        objectKey: keys.recovery,
        versionId: "recovery-version-1",
      },
    });
    repository.claimReadyRawDisposal.mockResolvedValueOnce(null);
    scanner.scan.mockResolvedValue({
      verdict: "clean", engine: "synthetic_sha256_allowlist",
      assurance: "fixture_identity_only", signatureVersion: "test",
    });
    processor.process.mockResolvedValue({
      canonical, thumbnail, canonicalSha256, thumbnailSha256,
      widthPx: 100, heightPx: 100, mimeType: "image/webp",
    });
    primary.headObject.mockImplementation(async (reference) => ({
      byteCount: reference.objectKey.includes("thumbnail") ? thumbnail.byteLength : canonical.byteLength,
      sha256: reference.objectKey.includes("thumbnail") ? thumbnailSha256 : canonicalSha256,
    }));
    recovery.headObject.mockResolvedValue({ byteCount: canonical.length, sha256: canonicalSha256 });
    primary.getObject
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce(canonical)
      .mockResolvedValueOnce(thumbnail);
    recovery.getObject.mockResolvedValueOnce(canonical);

    await expect(createLocalService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).resolves.toMatchObject({ state: "ready" });

    expect(primary.putObject).not.toHaveBeenCalled();
    expect(recovery.putObject).not.toHaveBeenCalled();
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(1, expect.objectContaining({
      objectVersionId: "canonical-version-1",
    }));
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(2, expect.objectContaining({
      objectVersionId: "recovery-version-1",
    }));
    expect(repository.checkpointThumbnailObject).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailObjectVersionId: "thumbnail-version-1",
    }));
    expect(repository.markReadyAfterVerifiedRecovery).toHaveBeenCalledTimes(1);
  });

  it("adopts single exact canonical, thumbnail, and recovery versions left before DB checkpoints", async () => {
    const raw = Buffer.from("synthetic-image");
    const canonical = Buffer.from("canonical");
    const thumbnail = Buffer.from("thumbnail");
    const canonicalSha256 = createHash("sha256").update(canonical).digest("hex");
    const thumbnailSha256 = createHash("sha256").update(thumbnail).digest("hex");
    const storageAttemptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const keys = buildPhotoMediaObjectKeys({
      companyId: mediaAsset.companyId,
      mediaAssetId: mediaAsset.mediaAssetId,
      storageAttemptId,
    });
    const uploaded = {
      ...mediaAsset,
      state: "uploaded" as const,
      rawObjectKey: buildPhotoMediaObjectKeys({
        companyId: mediaAsset.companyId,
        mediaAssetId: mediaAsset.mediaAssetId,
      }).raw,
      rawObjectVersionId: "raw-version-1",
      thumbnailObjectKey: null,
      thumbnailObjectVersionId: null,
      storageAttemptId,
      rawDisposedAt: null,
    };
    repository.findAssetForRead.mockResolvedValueOnce(uploaded);
    repository.prepareFinalizeAttempt.mockResolvedValueOnce(uploaded);
    repository.claimReadyRawDisposal.mockResolvedValueOnce(null);
    scanner.scan.mockResolvedValue({
      verdict: "clean", engine: "synthetic_sha256_allowlist",
      assurance: "fixture_identity_only", signatureVersion: "test",
    });
    processor.process.mockResolvedValue({
      canonical, thumbnail, canonicalSha256, thumbnailSha256,
      widthPx: 100, heightPx: 100, mimeType: "image/webp",
    });
    primary.listObjectVersions.mockImplementation(async ({ objectKey }) => ({
      versions: [{
        objectKey,
        versionId: objectKey === keys.thumbnail ? "thumbnail-crash-version" : "canonical-crash-version",
      }],
    }));
    recovery.listObjectVersions.mockResolvedValue({
      versions: [{ objectKey: keys.recovery, versionId: "recovery-crash-version" }],
    });
    primary.headObject.mockImplementation(async (reference) => ({
      byteCount: reference.objectKey === keys.thumbnail ? thumbnail.byteLength : canonical.byteLength,
      sha256: reference.objectKey === keys.thumbnail ? thumbnailSha256 : canonicalSha256,
    }));
    recovery.headObject.mockResolvedValue({ byteCount: canonical.byteLength, sha256: canonicalSha256 });
    primary.getObject
      .mockResolvedValueOnce(raw)
      .mockResolvedValueOnce(canonical)
      .mockResolvedValueOnce(thumbnail);
    recovery.getObject.mockResolvedValueOnce(canonical);

    await expect(createLocalService().finalizeSyntheticUpload({
      mediaAssetId: mediaAsset.mediaAssetId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorActionScope: { assignedStoreIds: [mediaAsset.storeId] },
    })).resolves.toMatchObject({ state: "ready" });

    expect(primary.putObject).not.toHaveBeenCalled();
    expect(recovery.putObject).not.toHaveBeenCalled();
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(1, expect.objectContaining({
      objectVersionId: "canonical-crash-version",
    }));
    expect(repository.checkpointThumbnailObject).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailObjectVersionId: "thumbnail-crash-version",
    }));
    expect(repository.recordVerifiedReplica).toHaveBeenNthCalledWith(2, expect.objectContaining({
      objectVersionId: "recovery-crash-version",
    }));
  });

});
