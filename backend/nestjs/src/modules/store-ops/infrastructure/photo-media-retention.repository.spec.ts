import { PhotoMediaRetentionRepository } from "./photo-media-retention.repository";
import { readFileSync } from "node:fs";
import {
  buildPurgeEligibilityDigest,
  buildPurgeManifestDigest,
} from "../application/photo-media-retention.contract";

describe("PhotoMediaRetentionRepository", () => {
  it("creates an immutable hold-safe preview manifest without claiming deletion leases", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        media_asset_id: "asset-1",
        company_id: "company-1",
        state: "ready",
        canonical_sha256: "a".repeat(64),
        accounted_provider_bytes: "100",
        expires_at: new Date("2026-07-01T00:00:00.000Z"),
        retention_policy_id: "policy-1",
        retention_policy_version: 1,
      }] })
      .mockResolvedValueOnce({ rows: [{ photo_media_purge_manifest_id: "manifest-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await repository.createPurgeManifest({
      limit: 25,
      reason: "manual_retention_cleanup",
      source: "manual",
      actorUserId: "actor-1",
      ttlMinutes: 60,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("NOT ma.legal_hold");
    expect(sql).toContain("NOT ma.operational_hold");
    expect(sql).toContain("NOT ma.active_workflow_hold");
    expect(sql).toContain("NOT ma.ai_review_hold");
    expect(sql).toContain("ma.raw_disposed_at IS NOT NULL");
    expect(sql).not.toContain("cleanup_lease_token = gen_random_uuid()");
    expect(sql).not.toContain("object_key");
  });

  it("revalidates the whole digest-bound manifest before acquiring any delete lease", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        photo_media_purge_manifest_id: "11111111-1111-4111-8111-111111111111",
        status: "previewed",
        manifest_digest: "b".repeat(64),
        candidate_count: 1,
        candidate_bytes: "100",
        expires_at: new Date(Date.now() + 60_000),
        execution_lease_token: null,
        execution_lease_expires_at: null,
        execution_lease_expired: true,
        manifest_not_expired: true,
      }] })
      .mockResolvedValueOnce({ rows: [] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await expect(repository.claimPurgeManifest({
      manifestId: "11111111-1111-4111-8111-111111111111",
      manifestDigest: "b".repeat(64),
      actorUserId: "22222222-2222-4222-8222-222222222222",
    })).rejects.toThrow();

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("manifest_digest");
    expect(sql).toContain("ma.raw_disposed_at");
    expect(sql).toContain("ma.purge_manifest_id");
    expect(sql).toContain("item.company_id = ANY");
  });

  it("persists DB-time expiry before refusing execution", async () => {
    const transaction = jest.fn();
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ photo_media_purge_manifest_id: "manifest-1" }] }),
      withTransaction: transaction,
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await expect(repository.claimPurgeManifest({
      manifestId: "11111111-1111-4111-8111-111111111111",
      manifestDigest: "b".repeat(64),
      actorUserId: null,
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: "manifest_expired" }) });
    expect(transaction).not.toHaveBeenCalled();
    expect(String(database.query.mock.calls[0]?.[0])).toContain("expires_at <= NOW()");
  });

  it("does not expire an executing manifest while its execution lease is active", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      photo_media_purge_manifest_id: "11111111-1111-4111-8111-111111111111",
      status: "executing",
      manifest_digest: "b".repeat(64),
      candidate_count: 1,
      candidate_bytes: "100",
      expires_at: new Date("2026-07-01T00:00:00.000Z"),
      execution_lease_token: "22222222-2222-4222-8222-222222222222",
      execution_lease_expires_at: new Date("2026-08-01T00:00:00.000Z"),
      execution_lease_expired: false,
      manifest_not_expired: false,
    }] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await expect(repository.claimPurgeManifest({
      manifestId: "11111111-1111-4111-8111-111111111111",
      manifestDigest: "b".repeat(64),
      actorUserId: null,
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "manifest_not_executable" }),
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(database.query.mock.calls[0]?.[0])).toContain(
      "status = 'executing' AND execution_lease_expires_at <= NOW()",
    );
  });

  it("treats solution review and correction action evidence as active lifecycle links", () => {
    const source = readFileSync(__filename.replace(/\.spec\.ts$/, ".ts"), "utf8");
    expect(source).toContain("'solution_review_pending', 'correction_required'");
    expect(source).toContain("'draft', 'scheduled', 'open', 'closed'");
  });

  it("scopes every lifecycle reconciliation count to the configured provider identity", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      dangling_link_count: "0",
      stuck_upload_count: "0",
      stuck_purge_count: "0",
      protected_expiry_count: "0",
      tombstone_residue_count: "0",
    }] });
    const repository = new PhotoMediaRetentionRepository({ query } as never);

    await expect(repository.getLifecycleReconciliationSummary(["company"], {
      provider: "seaweedfs",
      jurisdiction: "onprem",
    })).resolves.toMatchObject({
      danglingLinkCount: 0,
      tombstoneResidueCount: 0,
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(query.mock.calls[0]?.[1]).toEqual([["company"], "seaweedfs", "onprem"]);
    expect(sql).toContain("ma.provider_adapter_id = $2");
    expect(sql).toContain("ma.jurisdiction = $3");
    expect(sql).toContain("mar.provider_adapter_id = $2");
    expect(sql).toContain("mar.jurisdiction = $3");
    expect((sql.match(/provider_adapter_id = \$2/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("rejects a tombstone owned by a competing manifest before provider deletion", async () => {
    const snapshot = {
      mediaAssetId: "11111111-1111-4111-8111-111111111111",
      companyId: "22222222-2222-4222-8222-222222222222",
      assetState: "ready" as const,
      canonicalSha256: "a".repeat(64),
      accountedProviderBytes: 100,
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      retentionPolicyId: "33333333-3333-4333-8333-333333333333",
      retentionPolicyVersion: 1,
    };
    const eligibilityDigest = buildPurgeEligibilityDigest(snapshot);
    const manifestDigest = buildPurgeManifestDigest([{ ...snapshot, eligibilityDigest }]);
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        photo_media_purge_manifest_id: "44444444-4444-4444-8444-444444444444",
        status: "previewed", manifest_digest: manifestDigest, candidate_count: 1,
        candidate_bytes: "100", expires_at: new Date("2026-08-01T00:00:00.000Z"),
        execution_lease_token: null, execution_lease_expires_at: null,
        execution_lease_expired: true, manifest_not_expired: true,
      }] })
      .mockResolvedValueOnce({ rows: [{
        item_no: 1, media_asset_id: snapshot.mediaAssetId, company_id: snapshot.companyId,
        asset_state: "ready", state: "deleted_tombstone",
        canonical_sha256: snapshot.canonicalSha256, accounted_provider_bytes: "100",
        expires_at: snapshot.expiresAt, retention_policy_id: snapshot.retentionPolicyId,
        retention_policy_version: 1, eligibility_digest: eligibilityDigest,
        purge_manifest_id: "55555555-5555-4555-8555-555555555555",
        raw_disposed_at: new Date(), expiry_eligible: true, cleanup_lease_available: true,
      }] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await expect(repository.claimPurgeManifest({
      manifestId: "44444444-4444-4444-8444-444444444444",
      manifestDigest,
      actorUserId: null,
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: "manifest_stale" }) });
    expect(query.mock.calls.map(([sql]) => String(sql)).join("\n"))
      .not.toContain("SET state = 'purge_pending'");
  });

  it("maps purge candidates to exact thumbnail and replica object references", async () => {
    const snapshot = {
      mediaAssetId: "11111111-1111-4111-8111-111111111111",
      companyId: "22222222-2222-4222-8222-222222222222",
      assetState: "ready" as const,
      canonicalSha256: "a".repeat(64),
      accountedProviderBytes: 100,
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      retentionPolicyId: "33333333-3333-4333-8333-333333333333",
      retentionPolicyVersion: 1,
    };
    const eligibilityDigest = buildPurgeEligibilityDigest(snapshot);
    const manifestDigest = buildPurgeManifestDigest([{ ...snapshot, eligibilityDigest }]);
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        photo_media_purge_manifest_id: "44444444-4444-4444-8444-444444444444",
        status: "previewed", manifest_digest: manifestDigest, candidate_count: 1,
        candidate_bytes: "100", expires_at: new Date("2026-08-01T00:00:00.000Z"),
        execution_lease_token: null, execution_lease_expires_at: null,
        execution_lease_expired: true, manifest_not_expired: true,
      }] })
      .mockResolvedValueOnce({ rows: [{
        item_no: 1, media_asset_id: snapshot.mediaAssetId, company_id: snapshot.companyId,
        asset_state: "ready", state: "ready", canonical_sha256: snapshot.canonicalSha256,
        accounted_provider_bytes: "100", expires_at: snapshot.expiresAt,
        retention_policy_id: snapshot.retentionPolicyId, retention_policy_version: 1,
        eligibility_digest: eligibilityDigest, legal_hold: false, operational_hold: false,
        active_workflow_hold: false, ai_review_hold: false, cleanup_origin_state: null,
        cleanup_lease_token: null, cleanup_lease_expires_at: null,
        thumbnail_object_key: "derived/asset-1/thumb.webp",
        thumbnail_object_version_id: "thumb-v1", raw_disposed_at: new Date(),
        purge_manifest_id: null, expiry_eligible: true, cleanup_lease_available: true,
      }] })
      .mockResolvedValueOnce({ rows: [
        { replica_role: "primary", object_key: "locked/asset-1/canonical.webp", object_version_id: "primary-v1" },
        { replica_role: "recovery", object_key: "locked/asset-1/canonical.webp", object_version_id: "recovery-v1" },
      ] })
      .mockResolvedValueOnce({ rows: [{ execution_lease_token: "55555555-5555-4555-8555-555555555555" }] })
      .mockResolvedValueOnce({ rows: [{
        cleanup_lease_token: "66666666-6666-4666-8666-666666666666",
        thumbnail_object_key: "derived/asset-1/thumb.webp",
        thumbnail_object_version_id: "thumb-v1",
      }] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    const claim = await repository.claimPurgeManifest({
      manifestId: "44444444-4444-4444-8444-444444444444",
      manifestDigest,
      actorUserId: null,
      storageIdentity: { provider: "seaweedfs", jurisdiction: "onprem" },
    });

    expect(claim.candidates).toEqual([{
      mediaAssetId: snapshot.mediaAssetId,
      cleanupLeaseToken: "66666666-6666-4666-8666-666666666666",
      canonicalSha256: snapshot.canonicalSha256,
      thumbnailObject: {
        objectKey: "derived/asset-1/thumb.webp",
        versionId: "thumb-v1",
      },
      primaryObjects: [{
        objectKey: "locked/asset-1/canonical.webp",
        versionId: "primary-v1",
      }],
      recoveryObjects: [{
        objectKey: "locked/asset-1/canonical.webp",
        versionId: "recovery-v1",
      }],
    }]);
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("thumbnail_object_version_id");
    expect(sql).toContain("object_version_id");
  });

  it("fails closed for a local purge candidate missing a version before acquiring leases", async () => {
    const snapshot = {
      mediaAssetId: "11111111-1111-4111-8111-111111111111",
      companyId: "22222222-2222-4222-8222-222222222222",
      assetState: "ready" as const,
      canonicalSha256: "a".repeat(64),
      accountedProviderBytes: 100,
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
      retentionPolicyId: "33333333-3333-4333-8333-333333333333",
      retentionPolicyVersion: 1,
    };
    const eligibilityDigest = buildPurgeEligibilityDigest(snapshot);
    const manifestDigest = buildPurgeManifestDigest([{ ...snapshot, eligibilityDigest }]);
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{
        photo_media_purge_manifest_id: "44444444-4444-4444-8444-444444444444",
        status: "previewed", manifest_digest: manifestDigest, candidate_count: 1,
        candidate_bytes: "100", expires_at: new Date("2026-08-01T00:00:00.000Z"),
        execution_lease_token: null, execution_lease_expires_at: null,
        execution_lease_expired: true, manifest_not_expired: true,
      }] })
      .mockResolvedValueOnce({ rows: [{
        item_no: 1, media_asset_id: snapshot.mediaAssetId, company_id: snapshot.companyId,
        asset_state: "ready", state: "ready", canonical_sha256: snapshot.canonicalSha256,
        accounted_provider_bytes: "100", expires_at: snapshot.expiresAt,
        retention_policy_id: snapshot.retentionPolicyId, retention_policy_version: 1,
        eligibility_digest: eligibilityDigest, legal_hold: false, operational_hold: false,
        active_workflow_hold: false, ai_review_hold: false, cleanup_origin_state: null,
        cleanup_lease_token: null, cleanup_lease_expires_at: null,
        thumbnail_object_key: "derived/asset-1/thumb.webp",
        thumbnail_object_version_id: null, raw_disposed_at: new Date(),
        purge_manifest_id: null, expiry_eligible: true, cleanup_lease_available: true,
      }] })
      .mockResolvedValueOnce({ rows: [{
        replica_role: "primary", object_key: "locked/asset-1/canonical.webp", object_version_id: null,
      }] });
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      withTransaction: jest.fn(async (callback) => callback({ query })),
    };
    const repository = new PhotoMediaRetentionRepository(database as never);

    await expect(repository.claimPurgeManifest({
      manifestId: "44444444-4444-4444-8444-444444444444",
      manifestDigest,
      actorUserId: null,
      storageIdentity: { provider: "seaweedfs", jurisdiction: "onprem" },
    })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "manifest_stale" }),
    });
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).not.toContain("SET status = 'executing'");
    expect(sql).not.toContain("SET state = 'purge_pending'");
  });

  it("denies aggregate usage unless actor scope covers every company", async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [{ outside_scope: 1 }] }) };
    const repository = new PhotoMediaRetentionRepository(database as never);
    await expect(repository.getUsageForecast([
      "11111111-1111-4111-8111-111111111111",
    ])).rejects.toThrow("full company scope");
    expect(String(database.query.mock.calls[0]?.[0])).toContain("ops.company");
  });

  it("reads the provider-neutral usage scope", async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PhotoMediaRetentionRepository(database as never);
    await repository.getUsageForecast();
    const sql = database.query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("usage.usage_scope = 'photo-media-v1'");
    expect(sql).not.toContain("usage.usage_scope = 'r2-eu'");
  });
});
