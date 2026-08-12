import { PhotoMediaAssetRepository } from "./photo-media-asset.repository";
import {
  PHOTO_MEDIA_QUOTA_LOCK_KEY,
  PHOTO_MEDIA_USAGE_SCOPE,
} from "../application/photo-media-storage.contract";

describe("PhotoMediaAssetRepository", () => {
  it.each([
    [{ legal_hold: true, operational_hold: false, active_workflow_hold: false, ai_review_hold: false }, "asset_held"],
    [{ legal_hold: false, operational_hold: false, active_workflow_hold: false, ai_review_hold: false }, "manifest_stale"],
  ])("returns a typed retention conflict when tombstone ownership is invalid", async (holds, code) => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      company_id: "11111111-1111-4111-8111-111111111111",
      accounted_provider_bytes: "100",
      state: "purge_pending",
      cleanup_lease_token: "22222222-2222-4222-8222-222222222222",
      cleanup_lease_active: false,
      purge_manifest_id: "33333333-3333-4333-8333-333333333333",
      ...holds,
    }] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.markDeletedTombstone({
      mediaAssetId: "44444444-4444-4444-8444-444444444444",
      cleanupLeaseToken: "22222222-2222-4222-8222-222222222222",
      purgeManifestId: "33333333-3333-4333-8333-333333333333",
      tombstoneSha256: "a".repeat(64),
      reasonCode: "governed_cleanup",
    })).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
  });

  it("serializes account-wide quota reservation and derives tenant scope from the store", async () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const regionId = "22222222-2222-4222-8222-222222222222";
    const storeId = "33333333-3333-4333-8333-333333333333";
    const assetId = "44444444-4444-4444-8444-444444444444";
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ company_id: companyId, region_id: regionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        provider_visible_bytes: "0",
        class_a_operations: "0",
        class_b_operations: "0",
      }] })
      .mockResolvedValueOnce({ rows: [{
        retention_policy_id: "55555555-5555-4555-8555-555555555555",
        version_no: 1,
        evidence_retention_days: 365,
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [
        { subject_kind: "user", uploaded_bytes: "0" },
        { subject_kind: "store", uploaded_bytes: "0" },
      ] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        media_asset_id: assetId,
        company_id: companyId,
        region_id: regionId,
        store_id: storeId,
        state: "initiated",
        raw_object_key: `transient/companies/${companyId}/media/${assetId}/raw`,
      }] });
    const database = {
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.createInitiatedAsset({
      mediaAssetId: assetId,
      actorUserId: "66666666-6666-4666-8666-666666666666",
      allowedCompanyIds: [companyId],
      storeId,
      contentType: "image/jpeg",
      contentLength: 1024,
      captureSource: "system_generated",
      quota: {
        aggregateBytesHardLimit: 8 * 1024 * 1024 * 1024,
        monthlyClassAHardLimit: 750_000,
        monthlyClassBHardLimit: 7_500_000,
        lockSafetyDays: 30,
        perUserDailyBytesHardLimit: 100 * 1024 * 1024,
        perStoreDailyBytesHardLimit: 250 * 1024 * 1024,
        concurrentProcessingHardLimit: 2,
      },
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("company_id = ANY");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("quota_reserved_bytes");
    const initiation = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO ops.media_asset"));
    expect(initiation?.[0]).toContain("provider_adapter_id");
    expect(initiation?.[0]).toContain("jurisdiction");
    expect(initiation?.[1]).toEqual(expect.arrayContaining(["seaweedfs", "onprem"]));
  });

  it("transitions to ready only when finalized bytes match the reservation", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        company_id: "company",
        quota_reserved_bytes: "1244",
        quota_reserved_class_a: 4,
        quota_reserved_class_b: 2,
        evidence_retention_days: 365,
        declared_upload_byte_count: "1024",
      }] })
      .mockResolvedValueOnce({ rows: [{ media_asset_id: "asset" }] });
    const database = {
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await repository.markReadyAfterVerifiedRecovery({
      mediaAssetId: "asset",
      actorUserId: "actor",
      canonicalObjectKey: "companies/company/media/asset/canonical.webp",
      thumbnailObjectKey: "companies/company/media/asset/thumbnail.webp",
      recoveryObjectKey: "companies/company/media/asset/canonical.webp",
      originalSha256: "a".repeat(64),
      canonicalSha256: "b".repeat(64),
      canonicalByteCount: 100,
      thumbnailByteCount: 20,
      widthPx: 100,
      heightPx: 100,
      mimeType: "image/webp",
      scannerEngine: "clamav",
      scannerSignatureVersion: null,
      thumbnailObjectVersionId: "thumbnail-version-1",
      processingLeaseToken: "lease-1",
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("accounted_provider_bytes");
    expect(sql).toContain("state = 'ready'");
    expect(sql).toContain("thumbnail_object_version_id");
    expect(sql).not.toContain("INSERT INTO ops.media_asset_replica");
  });

  it("fails closed when the finalize processing lease is stale", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const database = {
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await expect(repository.markReadyAfterVerifiedRecovery({
      mediaAssetId: "asset",
      canonicalObjectKey: "locked/canonical.webp",
      thumbnailObjectKey: "locked/thumbnail.webp",
      thumbnailObjectVersionId: "thumbnail-version-1",
      canonicalByteCount: 100,
      thumbnailByteCount: 20,
      originalSha256: "a".repeat(64),
      canonicalSha256: "b".repeat(64),
      widthPx: 100,
      heightPx: 100,
      mimeType: "image/webp",
      processingLeaseToken: "stale-lease",
    })).rejects.toThrow("finalize state is stale");
    expect(String(query.mock.calls[0]?.[0])).toContain("processing_lease_token = $4::uuid");
    expect(String(query.mock.calls[0]?.[0])).toContain("processing_lease_expires_at > NOW()");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "asset", "seaweedfs", "onprem", "stale-lease",
    ]);
  });

  it("reads raw, thumbnail, and active-primary versions from the configured provider identity", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      media_asset_id: "asset",
      company_id: "company",
      region_id: "region",
      store_id: "store",
      state: "ready",
      raw_object_key: "transient/raw",
      raw_object_version_id: "raw-version-1",
      canonical_object_key: "locked/canonical",
      thumbnail_object_key: "derived/thumbnail",
      thumbnail_object_version_id: "thumbnail-version-1",
      canonical_sha256: "a".repeat(64),
      byte_count: "9",
      primary_object_version_id: "canonical-version-1",
    }] });
    const database = { query };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.findAssetForRead("asset")).resolves.toMatchObject({
      rawObjectVersionId: "raw-version-1",
      canonicalObjectVersionId: "canonical-version-1",
      thumbnailObjectVersionId: "thumbnail-version-1",
    });
    expect(query.mock.calls[0]?.[1]).toEqual(["asset", "seaweedfs", "onprem"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("provider_adapter_id = $2");
    expect(String(query.mock.calls[0]?.[0])).toContain("jurisdiction = $3");
  });

  it("carries the raw version through the finalize-attempt transition", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      media_asset_id: "asset",
      company_id: "company",
      region_id: "region",
      store_id: "store",
      state: "uploaded",
      raw_object_key: "transient/raw",
      raw_object_version_id: "raw-version-1",
      storage_attempt_id: "attempt",
    }] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.prepareFinalizeAttempt("asset")).resolves.toMatchObject({
      rawObjectKey: "transient/raw",
      rawObjectVersionId: "raw-version-1",
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("raw_object_version_id");
  });

  it("persists object versions and compares retries with NULL-safe identity equality", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ company_id: "company" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ media_asset_replica_id: "replica" }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.recordVerifiedReplica({
      mediaAssetId: "asset",
      actorUserId: "actor",
      replicaRole: "primary",
      objectKey: "locked/canonical",
      objectVersionId: "canonical-version-1",
      sha256: "a".repeat(64),
      byteCount: 9,
      processingLeaseToken: "lease-1",
    });

    const insertCall = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO ops.media_asset_replica"));
    const retryCall = query.mock.calls.find(([statement]) => String(statement).includes("SELECT media_asset_replica_id"));
    expect(insertCall?.[0]).toContain("object_version_id");
    expect(insertCall?.[1]).toEqual(expect.arrayContaining(["canonical-version-1"]));
    expect(retryCall?.[0]).toContain("object_version_id IS NOT DISTINCT FROM");
    expect(retryCall?.[1]).toEqual(expect.arrayContaining(["canonical-version-1"]));
  });

  it("stores the raw put version atomically with the initiated-to-upload transition", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ media_asset_id: "asset" }] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.markUploaded({
      mediaAssetId: "asset",
      byteCount: 9,
      contentType: "image/webp",
      rawObjectVersionId: "raw-version-1",
      processingLeaseToken: "lease-1",
    });

    expect(String(query.mock.calls[0]?.[0])).toContain("raw_object_version_id");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "asset", 9, "image/webp", "raw-version-1", "seaweedfs", "onprem", "lease-1",
    ]);
  });

  it("fails closed when the upload processing lease is stale", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.markUploaded({
      mediaAssetId: "asset",
      byteCount: 9,
      contentType: "image/webp",
      rawObjectVersionId: "raw-version-1",
      processingLeaseToken: "stale-lease",
    })).rejects.toThrow("upload state is stale");
    expect(String(query.mock.calls[0]?.[0])).toContain("processing_lease_token = $7::uuid");
    expect(String(query.mock.calls[0]?.[0])).toContain("processing_lease_expires_at > NOW()");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "asset", 9, "image/webp", "raw-version-1", "seaweedfs", "onprem", "stale-lease",
    ]);
  });

  it("filters reconciliation inventory to the configured provider and maps typed versions", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        media_asset_id: "asset",
        state: "ready",
        raw_object_key: "transient/raw",
        raw_object_version_id: "raw-version-1",
        raw_disposed_at: null,
        canonical_sha256: "a".repeat(64),
        byte_count: "9",
        canonical_object_key: "locked/canonical",
        thumbnail_object_key: "derived/thumbnail",
        thumbnail_object_version_id: "thumbnail-version-1",
      }] })
      .mockResolvedValueOnce({ rows: [{
        media_asset_id: "asset",
        replica_role: "primary",
        object_key: "locked/canonical",
        object_version_id: "canonical-version-1",
        content_sha256: "a".repeat(64),
        byte_count: "9",
        is_active: true,
      }] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.listReconciliationInventory(["company"])).resolves.toEqual([expect.objectContaining({
      primaryObjects: expect.arrayContaining([
        expect.objectContaining({ objectKey: "locked/canonical", versionId: "canonical-version-1" }),
      ]),
    })]);
    expect(String(query.mock.calls[1]?.[0])).toContain("replica.provider_adapter_id = $2");
    expect(String(query.mock.calls[1]?.[0])).toContain("replica.jurisdiction = $3");
    expect(query.mock.calls[1]?.[1]).toEqual([["company"], "seaweedfs", "onprem"]);
  });

  it("keeps initiated local NULL-version rows visible for reconciliation", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        media_asset_id: "asset",
        state: "initiated",
        raw_object_key: "transient/raw",
        raw_object_version_id: null,
        raw_disposed_at: null,
        canonical_sha256: null,
        byte_count: null,
        canonical_object_key: null,
        thumbnail_object_key: null,
        thumbnail_object_version_id: null,
      }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.listReconciliationInventory()).resolves.toEqual([
      expect.objectContaining({ mediaAssetId: "asset" }),
    ]);
    expect(query.mock.calls[0]?.[1]).toEqual([null, "seaweedfs", "onprem"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("ma.provider_adapter_id = $2");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("raw_object_version_id IS NULL");
  });

  it("scopes reconciliation finding receipts to the configured storage identity", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.recordReconciliationReceipt({
      expectedAssetCount: 1,
      missingObjectCount: 0,
      mismatchObjectCount: 1,
      orphanPrimaryCount: 0,
      orphanRecoveryCount: 0,
      danglingLinkCount: 0,
      stuckUploadCount: 0,
      stuckPurgeCount: 0,
      protectedExpiryCount: 0,
      tombstoneResidueCount: 0,
      manifestDigest: "a".repeat(64),
      findingEvents: [{ mediaAssetId: "asset", reasonCode: "hash_mismatch" }],
    });

    const findingCall = query.mock.calls.find(([statement]) => (
      String(statement).includes("reconciliation_detected")
    ));
    expect(findingCall?.[0]).toContain("provider_adapter_id = $4");
    expect(findingCall?.[0]).toContain("jurisdiction = $5");
    expect(findingCall?.[1]).toEqual([
      "asset", "hash_mismatch", "a".repeat(64), "seaweedfs", "onprem",
    ]);
  });

  it("prevents R2 cleanup claims from selecting local or NULL-version rows", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "r2",
      jurisdiction: "eu",
    });

    await expect(repository.claimReadyRawDisposal("asset")).resolves.toBeNull();
    expect(query.mock.calls[0]?.[1]).toEqual(["asset", "r2", "eu"]);
    expect(String(query.mock.calls[0]?.[0])).toContain("provider_adapter_id = $2");
    expect(String(query.mock.calls[0]?.[0])).toContain("jurisdiction = $3");
    expect(String(query.mock.calls[0]?.[0])).not.toContain("raw_object_version_id IS NULL");
  });

  it("releases the pre-update reservation when stale partials are disposed", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ quota_reserved_bytes: "4096" }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never);

    await repository.markPartialUploadDisposed({ mediaAssetId: "asset", reasonCode: "partial_expired" });

    expect(String(query.mock.calls[0]?.[0])).toContain("RETURNING target.quota_reserved_bytes");
    expect(query.mock.calls[1]?.[1]).toEqual([4096]);
  });

  it("serializes and fails closed provider operation reservations", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ class_a_operations: "749999", class_b_operations: "10" }] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never);

    await expect(repository.reserveProviderOperations({
      classAOperations: 2,
      classBOperations: 0,
      monthlyClassAHardLimit: 750000,
      monthlyClassBHardLimit: 7500000,
    })).rejects.toThrow("Class A hard limit");

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("FOR UPDATE");
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("increments governed cleanup accounting above the hard limit", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ class_a_operations: "750000", class_b_operations: "7500000" }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never);

    await expect(repository.reserveProviderOperations({
      classAOperations: 1,
      classBOperations: 1,
      monthlyClassAHardLimit: 750000,
      monthlyClassBHardLimit: 7500000,
      enforceHardLimits: false,
    })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3]?.[1]).toEqual([1, 1]);
  });

  it("fails closed on the per-user daily byte ceiling before reserving provider bytes", async () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const storeId = "33333333-3333-4333-8333-333333333333";
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ company_id: companyId, region_id: "region" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        provider_visible_bytes: "0", class_a_operations: "0", class_b_operations: "0",
      }] })
      .mockResolvedValueOnce({ rows: [{
        retention_policy_id: "policy", version_no: 1, evidence_retention_days: 365,
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [
        { subject_kind: "user", uploaded_bytes: "104857600" },
        { subject_kind: "store", uploaded_bytes: "0" },
      ] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never);

    await expect(repository.createInitiatedAsset({
      mediaAssetId: "44444444-4444-4444-8444-444444444444",
      actorUserId: "66666666-6666-4666-8666-666666666666",
      allowedCompanyIds: [companyId], storeId, contentType: "image/jpeg", contentLength: 1,
      captureSource: "system_generated",
      quota: {
        aggregateBytesHardLimit: 8 * 1024 * 1024 * 1024, monthlyClassAHardLimit: 750_000,
        monthlyClassBHardLimit: 7_500_000, lockSafetyDays: 30,
        perUserDailyBytesHardLimit: 100 * 1024 * 1024,
        perStoreDailyBytesHardLimit: 250 * 1024 * 1024, concurrentProcessingHardLimit: 2,
      },
    })).rejects.toThrow("per-user daily byte limit");
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).not.toContain("INSERT INTO ops.media_asset (");
  });

  it("serializes concurrent processing and recovers expired leases", async () => {
    const token = "77777777-7777-4777-8777-777777777777";
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uploaded_by_user_id: "user", store_id: "store" }] })
      .mockResolvedValueOnce({ rows: [{ user_count: "0", store_count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ processing_lease_token: token }] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await expect(repository.acquireProcessingLease({
      mediaAssetId: "asset", concurrentProcessingHardLimit: 2,
    })).resolves.toBe(token);
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("processing_lease_expires_at <= NOW()");
    expect(sql).toContain("processing_lease_expires_at > NOW()");
    for (const call of query.mock.calls.slice(1)) {
      expect(String(call[0])).toContain("provider_adapter_id");
      expect(String(call[0])).toContain("jurisdiction");
      expect(call[1]).toEqual(expect.arrayContaining(["seaweedfs", "onprem"]));
    }
  });

  it("tombstones only the replaced missing primary generation before promotion", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ company_id: "company", canonical_sha256: "a".repeat(64), byte_count: "9" }] })
      .mockResolvedValueOnce({ rows: [{ media_asset_replica_id: "old-primary" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ media_asset_replica_id: "new-primary" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never);

    await repository.markRestoreVerified({
      mediaAssetId: "asset", cleanupLeaseToken: "lease", actorUserId: "actor",
      replicaGeneration: 2, restoreObjectKey: "locked/new.webp", previousPrimaryMissing: true,
    });
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("SET replica_state = 'deleted_tombstone'");
    expect(sql).toContain("replica_generation = $2");
    expect(sql.indexOf("deleted_tombstone")).toBeLessThan(sql.indexOf("replica_generation = $2"));
  });

  it("writes the configured adapter identity while keeping quota accounting provider-neutral", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ company_id: "company" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ media_asset_replica_id: "replica" }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.recordVerifiedReplica({
      mediaAssetId: "asset",
      actorUserId: "actor",
      replicaRole: "primary",
      objectKey: "locked/companies/a/media/b/canonical.webp",
      objectVersionId: "local-version-1",
      sha256: "a".repeat(64),
      byteCount: 9,
    });

    expect(query.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["seaweedfs", "onprem"]));
    const source = [
      require("node:fs").readFileSync(__filename.replace(/\.spec\.ts$/, ".ts"), "utf8"),
      require("node:fs").readFileSync(
        __filename.replace("photo-media-asset.repository.spec.ts", "photo-media-asset-initiation.repository.ts"),
        "utf8",
      ),
      require("node:fs").readFileSync(
        __filename.replace("photo-media-asset.repository.spec.ts", "photo-media-asset-shared.repository.ts"),
        "utf8",
      ),
    ].join("\n");
    expect(PHOTO_MEDIA_USAGE_SCOPE).toBe("photo-media-v1");
    expect(PHOTO_MEDIA_QUOTA_LOCK_KEY).toBe("photo-media-v1-quota");
    expect(source).toContain("PHOTO_MEDIA_USAGE_SCOPE");
    expect(source).toContain("PHOTO_MEDIA_QUOTA_LOCK_KEY");
    expect(source).not.toContain("photo-media-r2-eu-quota");
    expect(source).not.toContain("usage_scope = 'r2-eu'");
  });

  it("rejects a local retry when an otherwise identical verified R2 replica owns the generation", async () => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("SELECT company_id FROM ops.media_asset")) {
        return Promise.resolve({ rows: [{ company_id: "company" }] });
      }
      if (statement.includes("INSERT INTO ops.media_asset_replica")) {
        return Promise.resolve({ rows: [] });
      }
      if (statement.includes("SELECT media_asset_replica_id")) {
        const providerScoped = statement.includes("provider_adapter_id") && statement.includes("jurisdiction");
        return Promise.resolve({ rows: providerScoped ? [] : [{ media_asset_replica_id: "r2-replica" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.recordVerifiedReplica({
      mediaAssetId: "asset",
      actorUserId: "actor",
      replicaRole: "primary",
      objectKey: "locked/companies/a/media/b/canonical.webp",
      objectVersionId: "local-version-1",
      sha256: "a".repeat(64),
      byteCount: 9,
    })).rejects.toThrow("immutable replica proof conflicts with retry");

    const exactCall = query.mock.calls.find(([statement]) => String(statement).includes("SELECT media_asset_replica_id"));
    expect(exactCall?.[0]).toContain("provider_adapter_id = $7");
    expect(exactCall?.[0]).toContain("jurisdiction = $8");
    expect(exactCall?.[1]).toEqual([
      "asset", "primary", "locked/companies/a/media/b/canonical.webp", "local-version-1", "a".repeat(64), 9,
      "seaweedfs", "onprem",
    ]);
  });

  it("does not select an R2 recovery candidate for a local restore", async () => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("UPDATE ops.media_asset ma")) {
        const providerScoped = statement.includes("recovery.provider_adapter_id")
          && statement.includes("recovery.jurisdiction");
        return Promise.resolve({ rows: providerScoped ? [] : [{
          media_asset_id: "asset",
          company_id: "company",
          cleanup_lease_token: "lease",
          canonical_object_key: "locked/current.webp",
          recovery_object_key: "locked/r2-recovery.webp",
          canonical_sha256: "a".repeat(64),
          byte_count: "9",
          replica_generation: 2,
          restore_object_key: "locked/r2-pending.webp",
        }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.claimRestoreCandidate({
      mediaAssetId: "asset",
      actorUserId: "actor",
    })).rejects.toThrow("restore target is stale");

    const candidateCall = query.mock.calls.find(([statement]) => String(statement).includes("UPDATE ops.media_asset ma"));
    expect(candidateCall?.[0]).toContain("recovery.provider_adapter_id = $2");
    expect(candidateCall?.[0]).toContain("recovery.jurisdiction = $3");
    expect(candidateCall?.[1]).toEqual(["asset", "seaweedfs", "onprem"]);
    const maxGenerationClause = String(candidateCall?.[0]).slice(
      String(candidateCall?.[0]).indexOf("(SELECT COALESCE(MAX(replica_generation), 0) + 1"),
    );
    expect(maxGenerationClause).toContain("generations.replica_role = 'primary'");
    expect(maxGenerationClause).not.toContain("generations.provider_adapter_id");
    expect(maxGenerationClause).not.toContain("generations.jurisdiction");
  });

  it("fails closed when a local restore generation conflicts with an identical R2 row", async () => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("SELECT ma.company_id, ma.accounted_provider_bytes")) {
        return Promise.resolve({ rows: [{ company_id: "company", accounted_provider_bytes: "9", retention_days: 365 }] });
      }
      if (statement.includes("INSERT INTO ops.media_asset_replica")) {
        return Promise.resolve({ rows: [] });
      }
      if (statement.includes("SELECT media_asset_replica_id")) {
        const providerScoped = statement.includes("provider_adapter_id") && statement.includes("jurisdiction");
        return Promise.resolve({ rows: providerScoped ? [] : [{ media_asset_replica_id: "r2-replica" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.reserveRestoreGeneration({
      mediaAssetId: "asset",
      cleanupLeaseToken: "lease",
      restoreObjectKey: "locked/local-pending.webp",
      replicaGeneration: 1,
      canonicalSha256: "a".repeat(64),
      canonicalByteCount: 9,
      additionalBytes: 0,
      aggregateBytesHardLimit: 100,
    })).rejects.toThrow("restore generation proof conflicts with provider identity");

    const conflictCall = query.mock.calls.find(([statement]) => String(statement).includes("SELECT media_asset_replica_id"));
    expect(conflictCall?.[0]).toContain("provider_adapter_id = $7");
    expect(conflictCall?.[0]).toContain("jurisdiction = $8");
    expect(conflictCall?.[1]).toEqual([
      "asset", "company", "locked/local-pending.webp", 1, "a".repeat(64), 9,
      "seaweedfs", "onprem",
    ]);
  });

  it("does not promote an R2 copying generation for a local restore", async () => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("SELECT company_id, canonical_sha256, byte_count")) {
        return Promise.resolve({ rows: [{ company_id: "company", canonical_sha256: "a".repeat(64), byte_count: "9" }] });
      }
      if (statement.includes("UPDATE ops.media_asset_replica SET is_active = FALSE")) {
        return Promise.resolve({ rows: [] });
      }
      if (statement.includes("UPDATE ops.media_asset_replica") && statement.includes("SET replica_state = 'verified'")) {
        const providerScoped = statement.includes("provider_adapter_id") && statement.includes("jurisdiction");
        return Promise.resolve({ rows: providerScoped ? [] : [{ media_asset_replica_id: "r2-replica" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await expect(repository.markRestoreVerified({
      mediaAssetId: "asset",
      cleanupLeaseToken: "lease",
      actorUserId: "actor",
      replicaGeneration: 1,
      restoreObjectKey: "locked/local-pending.webp",
      restoreObjectVersionId: "local-pending-v1",
      previousPrimaryMissing: false,
    })).rejects.toThrow("restore generation proof is stale");

    const promotionCall = query.mock.calls.find(([statement]) => (
      String(statement).includes("SET replica_state = 'verified'")
    ));
    expect(promotionCall?.[0]).toContain("provider_adapter_id = $7");
    expect(promotionCall?.[0]).toContain("jurisdiction = $8");
    expect(promotionCall?.[1]).toEqual([
      "asset", 1, "locked/local-pending.webp", "a".repeat(64), "9", "local-pending-v1", "seaweedfs", "onprem",
    ]);
  });

  it("keeps a deactivated historical R2 primary verified during a local missing-primary restore", async () => {
    const replicas = new Map([
      ["r2-primary", { provider: "r2", jurisdiction: "eu", state: "verified", isActive: true }],
      ["local-primary", { provider: "seaweedfs", jurisdiction: "onprem", state: "verified", isActive: true }],
    ]);
    const query = jest.fn().mockImplementation((statement: string, params?: unknown[]) => {
      if (statement.includes("SELECT company_id, canonical_sha256, byte_count")) {
        return Promise.resolve({ rows: [{ company_id: "company", canonical_sha256: "a".repeat(64), byte_count: "9" }] });
      }
      if (statement.includes("UPDATE ops.media_asset_replica SET is_active = FALSE")) {
        for (const replica of replicas.values()) replica.isActive = false;
        return Promise.resolve({ rows: [
          { media_asset_replica_id: "r2-primary" },
          { media_asset_replica_id: "local-primary" },
        ] });
      }
      if (statement.includes("SET replica_state = 'deleted_tombstone'")) {
        const providerScoped = statement.includes("provider_adapter_id = $2")
          && statement.includes("jurisdiction = $3");
        for (const id of (params?.[0] as string[] ?? [])) {
          const replica = replicas.get(id);
          if (
            replica && replica.state === "verified" && !replica.isActive
            && (!providerScoped || (params?.[1] === "seaweedfs" && params?.[2] === "onprem" && replica.provider === "seaweedfs"))
          ) {
            replica.state = "deleted_tombstone";
          }
        }
        return Promise.resolve({ rows: [] });
      }
      if (statement.includes("SET replica_state = 'verified'")) {
        return Promise.resolve({ rows: [{ media_asset_replica_id: "local-copying" }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    });

    await repository.markRestoreVerified({
      mediaAssetId: "asset",
      cleanupLeaseToken: "lease",
      actorUserId: "actor",
      replicaGeneration: 2,
      restoreObjectKey: "locked/local-restored.webp",
      restoreObjectVersionId: "local-restored-v1",
      previousPrimaryMissing: true,
    });

    expect(replicas.get("r2-primary")).toMatchObject({ isActive: false, state: "verified" });
    expect(replicas.get("local-primary")).toMatchObject({ isActive: false, state: "deleted_tombstone" });
    const tombstoneCall = query.mock.calls.find(([statement]) => (
      String(statement).includes("SET replica_state = 'deleted_tombstone'")
    ));
    const deactivationCall = query.mock.calls.find(([statement]) => (
      String(statement).includes("UPDATE ops.media_asset_replica SET is_active = FALSE")
    ));
    expect(deactivationCall?.[0]).toContain("provider_adapter_id = $2");
    expect(deactivationCall?.[0]).toContain("jurisdiction = $3");
    expect(deactivationCall?.[1]).toEqual(["asset", "seaweedfs", "onprem"]);
    expect(tombstoneCall?.[0]).toContain("provider_adapter_id = $2");
    expect(tombstoneCall?.[0]).toContain("jurisdiction = $3");
    expect(tombstoneCall?.[1]).toEqual([["r2-primary", "local-primary"], "seaweedfs", "onprem"]);
  });

  it("maps restore claims to configured exact primary, recovery, and checkpoint versions", async () => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("UPDATE ops.media_asset ma")) {
        return Promise.resolve({ rows: [{
          media_asset_id: "asset",
          company_id: "company",
          cleanup_lease_token: "lease",
          canonical_object_key: "locked/current.webp",
          canonical_object_version_id: "primary-v1",
          recovery_object_key: "locked/recovery.webp",
          recovery_object_version_id: "recovery-v1",
          canonical_sha256: "a".repeat(64),
          byte_count: "9",
          replica_generation: 2,
          restore_object_key: "locked/restored.webp",
          restore_object_version_id: "restored-v1",
        }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await expect(repository.claimRestoreCandidate({ mediaAssetId: "asset", actorUserId: "actor" }))
      .resolves.toMatchObject({
        canonicalObjectVersionId: "primary-v1",
        recoveryObjectVersionId: "recovery-v1",
        restoreObjectVersionId: "restored-v1",
      });
    const claimSql = String(query.mock.calls[0]?.[0]);
    expect(claimSql).toContain("ma.provider_adapter_id = $2");
    expect(claimSql).toContain("primary_current.provider_adapter_id = $2");
    expect(claimSql).toContain("recovery.provider_adapter_id = $2");
    expect(claimSql).toContain("recovery_object_version_id");
    expect(query.mock.calls[0]?.[1]).toEqual(["asset", "seaweedfs", "onprem"]);
  });

  it.each([
    ["missing", null],
    ["blank", ""],
  ])("fails closed before audit when local recovery version is %s", async (_label, version) => {
    const query = jest.fn().mockImplementation((statement: string) => {
      if (statement.includes("UPDATE ops.media_asset ma")) {
        return Promise.resolve({ rows: [{
          media_asset_id: "asset",
          company_id: "company",
          cleanup_lease_token: "lease",
          canonical_object_key: null,
          canonical_object_version_id: null,
          recovery_object_key: "locked/recovery.webp",
          recovery_object_version_id: version,
          canonical_sha256: "a".repeat(64),
          byte_count: "9",
          replica_generation: 2,
          restore_object_key: "locked/restored.webp",
          restore_object_version_id: null,
        }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const database = { withTransaction: jest.fn(async (callback) => callback({ query })) };
    const repository = new PhotoMediaAssetRepository(database as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await expect(repository.claimRestoreCandidate({ mediaAssetId: "asset", actorUserId: "actor" }))
      .rejects.toThrow("object version identity is unavailable");
    expect(query.mock.calls.filter(([statement]) => String(statement).includes("INSERT INTO audit"))).toHaveLength(0);
  });

  it("checkpoints a local restore version only under the exact live lease", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ media_asset_replica_id: "replica" }] });
    const repository = new PhotoMediaAssetRepository({ query } as never, {
      provider: "seaweedfs", jurisdiction: "onprem",
    });

    await repository.checkpointRestoreObjectVersion({
      mediaAssetId: "asset", cleanupLeaseToken: "lease", restoreObjectKey: "locked/restored.webp",
      restoreObjectVersionId: "restored-v1", replicaGeneration: 2,
      canonicalSha256: "a".repeat(64), canonicalByteCount: 9,
    });
    expect(String(query.mock.calls[0]?.[0])).toContain("cleanup_lease_expires_at > NOW()");
    expect(String(query.mock.calls[0]?.[0])).toContain("provider_adapter_id = $7");
    expect(String(query.mock.calls[0]?.[0])).toContain("jurisdiction = $8");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "asset", 2, "locked/restored.webp", "a".repeat(64), 9, "restored-v1", "seaweedfs", "onprem", "lease",
    ]);
  });
});
