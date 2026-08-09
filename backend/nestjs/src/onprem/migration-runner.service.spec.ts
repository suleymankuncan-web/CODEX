import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OnPremMigrationRunnerService } from "./migration-runner.service";

function createMigrationTree() {
  const root = mkdtempSync(join(tmpdir(), "hr-axis-onprem-migrate-"));
  const migrations = join(root, "db", "migrations");
  mkdirSync(migrations, { recursive: true });
  writeFileSync(join(migrations, "001_first.sql"), "SELECT 1;", "utf8");
  return root;
}

describe("OnPremMigrationRunnerService", () => {
  it("fails before database access when the migration tree is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "hr-axis-no-migrations-"));
    const connect = jest.fn();
    const runner = new OnPremMigrationRunnerService(
      { connect } as never,
      { getMigrationStatus: jest.fn(), runMigrations: jest.fn() } as never,
    );

    await expect(runner.run(root)).rejects.toThrow("migration tree is missing");
    expect(connect).not.toHaveBeenCalled();
  });

  it("serializes migration execution and applies fixed least-privilege grants", async () => {
    const root = createMigrationTree();
    const query = jest.fn().mockResolvedValue({
      rows: [{ role_name: "hr_axis_migrator", unlocked: true }],
    });
    const release = jest.fn();
    const runMigrations = jest.fn().mockResolvedValue({
      applied: ["001_first.sql"],
      failed: [],
      skipped: [],
    });
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release }) } as never,
      {
        getMigrationStatus: jest.fn().mockResolvedValue({
          checksumMismatches: [],
          failed: [],
          running: [],
          trackingTable: "missing",
          unexpectedTracked: [],
          unknownApplied: [],
        }),
        runMigrations,
      } as never,
    );

    await expect(runner.run(root)).resolves.toEqual(
      expect.objectContaining({ appliedCount: 1, failedCount: 0, skippedCount: 0 }),
    );
    expect(query.mock.calls[0][0]).toEqual(
      expect.stringContaining("CURRENT_USER AS role_name"),
    );
    expect(query.mock.calls[1]).toEqual([
      expect.stringContaining("pg_advisory_lock"),
      ["hr-axis:onprem:migrations:v1"],
    ]);
    expect(runMigrations).toHaveBeenCalledWith(root, {
      requireMigrationTree: true,
    });
    expect(query.mock.calls[2][0]).toEqual(
      expect.stringContaining("GRANT USAGE ON SCHEMA"),
    );
    expect(query.mock.calls[2][0]).toContain("hr_axis_api");
    expect(query.mock.calls[2][0]).toContain("hr_axis_worker");
    expect(query.mock.calls[2][0]).toContain("ALTER DEFAULT PRIVILEGES");
    expect(query.mock.calls[2][0]).toContain(
      "REVOKE UPDATE ON ALL SEQUENCES",
    );
    expect(query.mock.calls[2][0]).not.toMatch(
      /GRANT[^;]*UPDATE[^;]*SEQUENCES/i,
    );
    expect(query.mock.calls[3]).toEqual([
      expect.stringContaining("pg_advisory_unlock"),
      ["hr-axis:onprem:migrations:v1"],
    ]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("always releases the advisory lock after a migration failure", async () => {
    const root = createMigrationTree();
    const query = jest.fn().mockResolvedValue({
      rows: [{ role_name: "hr_axis_migrator", unlocked: true }],
    });
    const release = jest.fn();
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release }) } as never,
      {
        getMigrationStatus: jest.fn().mockResolvedValue({
          checksumMismatches: [],
          failed: [],
          running: [],
          trackingTable: "missing",
          unexpectedTracked: [],
          unknownApplied: [],
        }),
        runMigrations: jest.fn().mockRejectedValue(new Error("migration failed")),
      } as never,
    );

    await expect(runner.run(root)).rejects.toThrow("migration failed");
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("pg_advisory_unlock"),
      ["hr-axis:onprem:migrations:v1"],
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("always discards and releases the client when advisory unlock fails", async () => {
    const root = createMigrationTree();
    const unlockError = new Error("connection lost during unlock");
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ role_name: "hr_axis_migrator" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(unlockError);
    const release = jest.fn();
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release }) } as never,
      {
        getMigrationStatus: jest.fn().mockResolvedValue({
          checksumMismatches: [],
          failed: [],
          running: [],
          trackingTable: "missing",
          unexpectedTracked: [],
          unknownApplied: [],
        }),
        runMigrations: jest.fn().mockRejectedValue(new Error("migration failed")),
      } as never,
    );

    await expect(runner.run(root)).rejects.toThrow("migration failed");
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("pg_advisory_unlock"),
      ["hr-axis:onprem:migrations:v1"],
    );
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(unlockError);
  });

  it("binds the tree digest to transitive include content", async () => {
    const root = createMigrationTree();
    const migration = join(root, "db", "migrations", "001_first.sql");
    const schema = join(root, "db", "schema.sql");
    writeFileSync(migration, "\\i ../schema.sql", "utf8");
    writeFileSync(schema, "SELECT 1;", "utf8");
    const query = jest.fn().mockResolvedValue({
      rows: [{ role_name: "hr_axis_migrator", unlocked: true }],
    });
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release: jest.fn() }) } as never,
      {
        getMigrationStatus: jest.fn().mockResolvedValue({
          checksumMismatches: [],
          failed: [],
          running: [],
          trackingTable: "missing",
          unexpectedTracked: [],
          unknownApplied: [],
        }),
        runMigrations: jest.fn().mockResolvedValue({
          applied: ["001_first.sql"],
          failed: [],
          skipped: [],
        }),
      } as never,
    );

    const first = await runner.run(root);
    writeFileSync(schema, "SELECT 2;", "utf8");
    const second = await runner.run(root);

    expect(second.migrationTreeDigest).not.toBe(first.migrationTreeDigest);
  });

  it.each([
    ["unexpected tracking rows", { unexpectedTracked: ["000_deleted.sql"] }],
    ["checksum mismatch", { checksumMismatches: ["001_first.sql"] }],
    ["failed migration", { failed: [{ migrationName: "001_first.sql" }] }],
    ["running migration", { running: ["001_first.sql"] }],
  ])("rejects %s before migration mutation", async (_label, override) => {
    const root = createMigrationTree();
    const query = jest.fn().mockResolvedValue({
      rows: [{ role_name: "hr_axis_migrator", unlocked: true }],
    });
    const release = jest.fn();
    const runMigrations = jest.fn();
    const getMigrationStatus = jest.fn().mockResolvedValue({
      checksumMismatches: [],
      failed: [],
      running: [],
      trackingTable: "present",
      unexpectedTracked: [],
      unknownApplied: [],
      ...override,
    });
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release }) } as never,
      { getMigrationStatus, runMigrations } as never,
    );

    await expect(runner.run(root)).rejects.toThrow("preflight failed");
    expect(getMigrationStatus).toHaveBeenCalledWith(root, {
      requireMigrationTree: true,
    });
    expect(runMigrations).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("GRANT USAGE ON SCHEMA")),
    ).toBe(false);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("pg_advisory_unlock"),
      ["hr-axis:onprem:migrations:v1"],
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rejects a swapped runtime login before locking or migration mutation", async () => {
    const root = createMigrationTree();
    const query = jest.fn().mockResolvedValue({ rows: [{ role_name: "hr_axis_api" }] });
    const release = jest.fn();
    const runMigrations = jest.fn();
    const runner = new OnPremMigrationRunnerService(
      { connect: jest.fn().mockResolvedValue({ query, release }) } as never,
      { getMigrationStatus: jest.fn(), runMigrations } as never,
    );

    await expect(runner.run(root)).rejects.toThrow(
      "on-prem migrator database role identity mismatch",
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(runMigrations).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
