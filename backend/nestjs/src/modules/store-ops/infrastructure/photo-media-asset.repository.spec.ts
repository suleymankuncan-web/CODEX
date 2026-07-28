import { PhotoMediaAssetRepository } from "./photo-media-asset.repository";

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
    const repository = new PhotoMediaAssetRepository(database as never);

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
    const repository = new PhotoMediaAssetRepository(database as never);

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
    const repository = new PhotoMediaAssetRepository(database as never);

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
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("accounted_provider_bytes");
    expect(sql).toContain("state = 'ready'");
    expect(sql).not.toContain("INSERT INTO ops.media_asset_replica");
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
    const repository = new PhotoMediaAssetRepository(database as never);

    await expect(repository.acquireProcessingLease({
      mediaAssetId: "asset", concurrentProcessingHardLimit: 2,
    })).resolves.toBe(token);
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("processing_lease_expires_at <= NOW()");
    expect(sql).toContain("processing_lease_expires_at > NOW()");
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
});
