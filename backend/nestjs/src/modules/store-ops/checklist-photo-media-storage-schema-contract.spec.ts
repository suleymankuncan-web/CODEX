import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("checklist photo media storage recovery schema", () => {
  const root = join(__dirname, "../../../../..");
  const migration = readFileSync(
    join(root, "db/migrations/063_checklist_photo_media_storage_recovery_v1.sql"),
    "utf8",
  );
  const schema = readFileSync(join(root, "db/schema.sql"), "utf8");
  const smoke = readFileSync(
    join(root, "db/preflight/checklist-photo-media-storage-recovery-v1-smoke.sql"),
    "utf8",
  );
  const rollback = readFileSync(
    join(root, "db/preflight/checklist-photo-media-storage-recovery-v1-rollback.sql"),
    "utf8",
  );
  const maintenanceScript = readFileSync(
    join(root, "backend/nestjs/scripts/photo-media-maintenance.ts"),
    "utf8",
  );
  const uploadController = readFileSync(
    join(root, "backend/nestjs/src/modules/store-ops/web/photo-media-storage.controller.ts"),
    "utf8",
  );

  it.each([migration, schema])("requires a verified recovery replica before ready", (sql) => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ops\.media_asset_replica/);
    expect(sql).toMatch(/replica_role IN \('primary', 'recovery'\)/);
    expect(sql).toMatch(/replica_state IN \('pending', 'copying', 'verified', 'failed', 'deleted_tombstone'\)/);
    expect(sql).toMatch(/guard_media_asset_ready_recovery/);
    expect(sql).toMatch(/replica_role = 'recovery'/);
    expect(sql).toMatch(/replica_state = 'verified'/);
    expect(sql).toMatch(/canonical_sha256/);
  });

  it("keeps private opaque replica keys and immutable verified proof", () => {
    expect(migration).toMatch(/ck_media_asset_replica_object_key_private/);
    expect(migration).toMatch(/guard_verified_media_asset_replica/);
    expect(migration).toMatch(/Verified media asset replica proof is immutable/);
  });

  it.each([migration, schema])("stores sanitized immutable reconciliation receipts", (sql) => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS audit.photo_media_reconciliation_run");
    expect(sql).toContain("manifest_digest CHAR(64) NOT NULL");
    expect(sql).toContain("trg_photo_media_reconciliation_run_append_only");
    expect(sql).not.toMatch(/photo_media_reconciliation_run[\s\S]{0,800}object_key/i);
  });

  it("proves disposable forward invariants and refuses unsafe rollback", () => {
    expect(smoke).toContain("recovery_required_before_ready was not enforced");
    expect(smoke).toContain("verified_replica_immutable was not enforced");
    expect(smoke).toContain("reconciliation_receipt_append_only was not enforced");
    expect(smoke).toContain("ROLLBACK;");
    expect(rollback).toContain("Pre-use rollback refused");
    expect(rollback).toContain("photo_media_reconciliation_run");
    expect(rollback).toContain("063_checklist_photo_media_storage_recovery_v1.sql");
  });

  it("runs retryable cleanup before fail-closed reconciliation", () => {
    const reconciliation = maintenanceScript.indexOf("maintenance.reconcile()");
    expect(maintenanceScript.indexOf("cleanupReadyRawDisposals")).toBeLessThan(reconciliation);
    expect(maintenanceScript.indexOf("cleanupStalePartials")).toBeLessThan(reconciliation);
    expect(maintenanceScript.indexOf("cleanupExpired")).toBeLessThan(reconciliation);
  });

  it("acquires the process buffer guard before route-scoped multipart parsing", () => {
    const guard = uploadController.indexOf("new PhotoMediaUploadBufferGuardInterceptor()");
    const multipart = uploadController.indexOf("FileInterceptor(\"file\"");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(multipart);
  });
});
