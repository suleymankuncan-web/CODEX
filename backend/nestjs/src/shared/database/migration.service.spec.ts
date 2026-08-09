import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MigrationService } from "./migration.service";

type QueryCall = {
  sql: string;
  params: unknown[];
};

function createProjectWithMigrations(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "store-ops-migrations-"));
  const backendNestjs = join(root, "backend", "nestjs");
  const migrationsDir = join(root, "db", "migrations");
  mkdirSync(backendNestjs, { recursive: true });
  mkdirSync(migrationsDir, { recursive: true });

  for (const [fileName, sql] of Object.entries(files)) {
    writeFileSync(join(migrationsDir, fileName), sql, "utf8");
  }

  return { backendNestjs, migrationsDir, root };
}

function computeChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function createDatabaseMock(options?: {
  existingRows?: Record<string, { migration_checksum: string; status: string }>;
  failOnSql?: string;
}) {
  const calls: QueryCall[] = [];
  const rows = options?.existingRows ?? {};

  const databaseService = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });

      if (sql.includes("FROM audit.schema_migration") && params.length > 0) {
        const row = rows[String(params[0])];
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }

      if (sql.includes("FROM audit.schema_migration")) {
        return {
          rowCount: Object.keys(rows).length,
          rows: Object.entries(rows).map(([migration_name, row]) => ({
            attempt_count: 1,
            duration_ms: null,
            error_message:
              row.status === "failed" ? `Failed migration ${migration_name}` : null,
            finished_at: null,
            migration_name,
            ...row,
            started_at: null,
          })),
        };
      }

      if (options?.failOnSql && sql.includes(options.failOnSql)) {
        throw new Error("migration exploded password=secret token=abc123");
      }

      return { rowCount: 0, rows: [] };
    }),
    withTransaction: jest.fn(
      async (work: (client: { query: (sql: string) => Promise<unknown> }) => Promise<unknown>) =>
        work({
          query: async (sql: string) => {
            calls.push({ params: [], sql });
            if (options?.failOnSql && sql.includes(options.failOnSql)) {
              throw new Error("migration exploded password=secret token=abc123");
            }
            return { rowCount: 0, rows: [] };
          },
        }),
    ),
  };

  return { calls, databaseService };
}

describe("MigrationService", () => {
  it("finds workspace root migrations when basePath is backend/nestjs", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "CREATE TABLE example_one (id uuid);",
    });
    const { calls, databaseService } = createDatabaseMock();
    const service = new MigrationService(databaseService as never);

    const result = await service.runMigrations(project.backendNestjs);

    expect(result.applied).toEqual(["001_first.sql"]);
    expect(calls.some((call) => call.sql.includes("CREATE TABLE example_one"))).toBe(
      true,
    );
  });

  it("creates migration tracking schema before reading or writing migration records", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
    });
    const { calls, databaseService } = createDatabaseMock();
    const service = new MigrationService(databaseService as never);

    await service.runMigrations(project.backendNestjs);

    const bootstrapIndex = calls.findIndex(
      (call) =>
        call.sql.includes("CREATE SCHEMA IF NOT EXISTS audit") &&
        call.sql.includes("CREATE TABLE IF NOT EXISTS audit.schema_migration"),
    );
    const readIndex = calls.findIndex((call) =>
      call.sql.includes("FROM audit.schema_migration"),
    );
    const insertIndex = calls.findIndex((call) =>
      call.sql.includes("INSERT INTO audit.schema_migration"),
    );

    expect(bootstrapIndex).toBe(0);
    expect(readIndex).toBeGreaterThan(bootstrapIndex);
    expect(insertIndex).toBeGreaterThan(bootstrapIndex);
  });

  it("skips succeeded migrations when checksum matches", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
    });
    const checksum = computeChecksum("SELECT 1;");
    const { calls, databaseService } = createDatabaseMock({
      existingRows: {
        "001_first.sql": { migration_checksum: checksum, status: "succeeded" },
      },
    });
    const service = new MigrationService(databaseService as never);

    const result = await service.runMigrations(project.backendNestjs);

    expect(result.applied).toEqual([]);
    expect((result as { skipped?: string[] }).skipped).toEqual(["001_first.sql"]);
    expect(calls.some((call) => call.sql === "SELECT 1;")).toBe(false);
  });

  it("fails before running when an applied migration checksum changes", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
    });
    const { calls, databaseService } = createDatabaseMock({
      existingRows: {
        "001_first.sql": { migration_checksum: "old-checksum", status: "succeeded" },
      },
    });
    const service = new MigrationService(databaseService as never);

    await expect(service.runMigrations(project.backendNestjs)).rejects.toThrow(
      "Migration checksum mismatch for 001_first.sql",
    );
    expect(calls.some((call) => call.sql === "SELECT 1;")).toBe(false);
  });

  it("records failed migration status outside the migration transaction", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT will_fail;",
    });
    const { calls, databaseService } = createDatabaseMock({ failOnSql: "will_fail" });
    const service = new MigrationService(databaseService as never);

    await expect(service.runMigrations(project.backendNestjs)).rejects.toThrow(
      "migration exploded",
    );

    expect(calls.some((call) => call.sql.includes("status = 'failed'"))).toBe(true);
    expect(
      calls.some((call) =>
        call.params.includes("migration exploded password=[redacted] token=[redacted]"),
      ),
    ).toBe(true);
    expect(
      calls.some((call) =>
        call.params.some((param) => String(param).includes("abc123") || String(param).includes("secret")),
      ),
    ).toBe(
      false,
    );
  });

  it("reports migration status without executing pending SQL files", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
      "002_pending.sql": "CREATE TABLE should_not_run (id uuid);",
      "003_failed.sql": "SELECT will_not_run;",
    });
    const checksum = computeChecksum("SELECT 1;");
    const { calls, databaseService } = createDatabaseMock({
      existingRows: {
        "001_first.sql": { migration_checksum: checksum, status: "succeeded" },
        "003_failed.sql": {
          migration_checksum: "failed-checksum",
          status: "failed",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    const status = await service.getMigrationStatus(project.backendNestjs);

    expect(status.trackingTable).toBe("present");
    expect(status.totalFiles).toBe(3);
    expect(status.appliedCount).toBe(1);
    expect(status.pending).toEqual(["002_pending.sql"]);
    expect(status.failed).toEqual([
      expect.objectContaining({
        migrationName: "003_failed.sql",
        status: "failed",
      }),
    ]);
    expect(status.checksumMismatches).toEqual(["003_failed.sql"]);
    expect(status.unknownApplied).toEqual([]);
    expect(status.unexpectedTracked).toEqual([]);
    expect(calls.some((call) => call.sql.includes("should_not_run"))).toBe(false);
    expect(calls.some((call) => call.sql.includes("will_not_run"))).toBe(false);
  });

  it("reports succeeded tracking rows whose migration file is missing", async () => {
    const project = createProjectWithMigrations({
      "001_current.sql": "SELECT 1;",
    });
    const { databaseService } = createDatabaseMock({
      existingRows: {
        "001_current.sql": {
          migration_checksum: computeChecksum("SELECT 1;"),
          status: "succeeded",
        },
        "000_deleted.sql": {
          migration_checksum: "historical-checksum",
          status: "succeeded",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    const status = await service.getMigrationStatus(project.backendNestjs);

    expect(status.unknownApplied).toEqual(["000_deleted.sql"]);
    expect(status.unexpectedTracked).toEqual(["000_deleted.sql"]);
  });

  it("reports running tracking rows whose migration file is missing", async () => {
    const project = createProjectWithMigrations({
      "001_current.sql": "SELECT 1;",
    });
    const { databaseService } = createDatabaseMock({
      existingRows: {
        "001_current.sql": {
          migration_checksum: computeChecksum("SELECT 1;"),
          status: "succeeded",
        },
        "002_deleted_running.sql": {
          migration_checksum: "historical-checksum",
          status: "running",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    const status = await service.getMigrationStatus(project.backendNestjs);

    expect(status.unknownApplied).toEqual([]);
    expect(status.unexpectedTracked).toEqual(["002_deleted_running.sql"]);
    expect(status.running).toEqual(["002_deleted_running.sql"]);
  });

  it("reports tracked migrations left in a running state", async () => {
    const project = createProjectWithMigrations({
      "001_running.sql": "SELECT 1;",
    });
    const { databaseService } = createDatabaseMock({
      existingRows: {
        "001_running.sql": {
          migration_checksum: computeChecksum("SELECT 1;"),
          status: "running",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    const status = await service.getMigrationStatus(project.backendNestjs, {
      requireMigrationTree: true,
    });

    expect(status.running).toEqual(["001_running.sql"]);
  });

  it("can fail closed for a missing migration tree without changing the default", async () => {
    const root = mkdtempSync(join(tmpdir(), "store-ops-no-migrations-"));
    const { databaseService } = createDatabaseMock();
    const service = new MigrationService(databaseService as never);

    await expect(service.runMigrations(root)).resolves.toEqual({
      applied: [],
      failed: [],
      skipped: [],
    });
    await expect(
      service.runMigrations(root, { requireMigrationTree: true }),
    ).rejects.toThrow("Migration tree is missing");
    await expect(
      service.getMigrationStatus(root, { requireMigrationTree: true }),
    ).rejects.toThrow("Migration tree is missing");
  });

  it("keeps the immutable wrapper checksum while strict-local executes resolved include content", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "\\i ../schema.sql",
    });
    writeFileSync(join(project.root, "db", "schema.sql"), "SELECT 1;", "utf8");
    const wrapperChecksum = computeChecksum("\\i ../schema.sql");
    const firstDatabase = createDatabaseMock();
    const firstService = new MigrationService(firstDatabase.databaseService as never);
    await firstService.runMigrations(project.backendNestjs, {
      requireMigrationTree: true,
    });
    expect(
      firstDatabase.calls.some((call) =>
        call.params.includes(wrapperChecksum),
      ),
    ).toBe(true);
    expect(firstDatabase.calls.some((call) => call.sql === "SELECT 1;")).toBe(
      true,
    );

    writeFileSync(join(project.root, "db", "schema.sql"), "SELECT 2;", "utf8");
    const { databaseService } = createDatabaseMock({
      existingRows: {
        "001_first.sql": {
          migration_checksum: wrapperChecksum,
          status: "succeeded",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    await expect(
      service.getMigrationStatus(project.backendNestjs, {
        requireMigrationTree: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ checksumMismatches: [] }),
    );
  });

  it("preserves hosted checksum compatibility for include wrappers", async () => {
    const wrapper = "\\i ../schema.sql";
    const project = createProjectWithMigrations({ "001_first.sql": wrapper });
    writeFileSync(join(project.root, "db", "schema.sql"), "SELECT changed;", "utf8");
    const { databaseService } = createDatabaseMock({
      existingRows: {
        "001_first.sql": {
          migration_checksum: computeChecksum(wrapper),
          status: "succeeded",
        },
      },
    });
    const service = new MigrationService(databaseService as never);

    await expect(service.runMigrations(project.backendNestjs)).resolves.toEqual({
      applied: [],
      failed: [],
      skipped: ["001_first.sql"],
    });
  });
});
