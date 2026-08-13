import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OnPremMigrationStatusService,
  assertSanitizedMigrationStatus,
  computeMigrationTreeDigest,
  summarizeMigrationStatus,
} from "./migration-status.service";

function createTree() {
  const root = mkdtempSync(join(tmpdir(), "hr-axis-migration-status-"));
  mkdirSync(join(root, "db", "migrations"), { recursive: true });
  writeFileSync(join(root, "db", "migrations", "001_first.sql"), "SELECT 1;", "utf8");
  return root;
}

const baseStatus = {
  trackingTable: "present" as const,
  totalFiles: 1,
  appliedCount: 1,
  pending: [] as string[],
  failed: [] as never[],
  running: [] as string[],
  checksumMismatches: [] as string[],
  unknownApplied: [] as string[],
  unexpectedTracked: [] as string[],
};

describe("OnPremMigrationStatusService", () => {
  it("summarizes clean status without migration names or checksums", () => {
    const result = summarizeMigrationStatus("synthetic", baseStatus, "A".repeat(64));
    expect(result).toEqual({
      schemaVersion: 1,
      dataClass: "synthetic",
      status: "clean",
      trackingTable: "present",
      total: 1,
      applied: 1,
      pending: 0,
      failed: 0,
      orphan: 0,
      checksum: "valid",
      migrationTreeDigest: "a".repeat(64),
    });
    expect(JSON.stringify(result)).not.toMatch(/001_first|SELECT 1|postgres|database|url/i);
  });

  it("distinguishes fresh, pending, failed, and incompatible database state", () => {
    const fresh = summarizeMigrationStatus("synthetic", {
      ...baseStatus,
      trackingTable: "missing",
      appliedCount: 0,
      pending: ["001_first.sql"],
    }, "b".repeat(64));
    expect(fresh.status).toBe("fresh");

    expect(summarizeMigrationStatus("synthetic", {
      ...baseStatus,
      appliedCount: 0,
      pending: ["001_first.sql"],
    }, "b".repeat(64)).status).toBe("pending");

    expect(summarizeMigrationStatus("synthetic", {
      ...baseStatus,
      failed: [{ migrationName: "001_first.sql", status: "failed", attemptCount: 1, startedAt: null, finishedAt: null, durationMs: null, errorMessage: "secret" }],
    }, "b".repeat(64)).status).toBe("failed");

    expect(summarizeMigrationStatus("synthetic", {
      ...baseStatus,
      unexpectedTracked: ["000_orphan.sql"],
    }, "b".repeat(64)).status).toBe("incompatible");
  });

  it("computes the same digest for equivalent ordering and includes resolved SQL", () => {
    const root = createTree();
    const directory = join(root, "db", "migrations");
    const first = computeMigrationTreeDigest(directory, ["001_first.sql"]);
    const second = computeMigrationTreeDigest(directory, ["001_first.sql"]);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("reads the migration tree and delegates only to read-only status", async () => {
    const root = createTree();
    const getMigrationStatus = jest.fn().mockResolvedValue({
      ...baseStatus,
      trackingTable: "missing",
      totalFiles: 1,
      appliedCount: 0,
      pending: ["001_first.sql"],
    });
    const service = new OnPremMigrationStatusService(
      { dataClass: "synthetic" } as never,
      { getMigrationStatus } as never,
    );
    await expect(service.getStatus(root)).resolves.toEqual(expect.objectContaining({ status: "fresh" }));
    expect(getMigrationStatus).toHaveBeenCalledWith(root, { requireMigrationTree: true });
  });

  it("rejects a non-sanitized status shape", () => {
    expect(() => assertSanitizedMigrationStatus({
      ...summarizeMigrationStatus("synthetic", baseStatus, "a".repeat(64)),
      migrationName: "hidden",
    } as never)).toThrow("schema mismatch");
  });
});
