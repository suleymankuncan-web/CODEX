import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseService } from "./database.service";

export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
  failed: Array<{
    migrationName: string;
    errorMessage: string;
  }>;
};

export type MigrationStatusResult = {
  trackingTable: "present" | "missing";
  totalFiles: number;
  appliedCount: number;
  pending: string[];
  failed: Array<{
    migrationName: string;
    status: "failed";
    attemptCount: number;
    startedAt: Date | string | null;
    finishedAt: Date | string | null;
    durationMs: number | null;
    errorMessage: string | null;
  }>;
  checksumMismatches: string[];
};

type ExistingMigrationRow = {
  migration_checksum: string;
  status: "running" | "succeeded" | "failed";
};

type MigrationStatusRow = ExistingMigrationRow & {
  migration_name: string;
  attempt_count: number;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  duration_ms: number | null;
  error_message: string | null;
};

@Injectable()
export class MigrationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMigrationStatus(basePath = process.cwd()): Promise<MigrationStatusResult> {
    const migrationsPath = this.resolveMigrationsPath(basePath);
    const files = existsSync(migrationsPath)
      ? readdirSync(migrationsPath)
          .filter((file) => file.endsWith(".sql"))
          .sort()
      : [];
    const checksums = new Map(
      files.map((file) => [
        file,
        computeChecksum(readFileSync(join(migrationsPath, file), "utf8")),
      ]),
    );

    let rows: MigrationStatusRow[];
    try {
      const result = await this.databaseService.query<MigrationStatusRow>(`
        SELECT
          migration_name,
          migration_checksum,
          status,
          attempt_count,
          started_at,
          finished_at,
          duration_ms,
          error_message
        FROM audit.schema_migration
        ORDER BY migration_name ASC
      `);
      rows = result.rows;
    } catch (error) {
      if (isMissingMigrationTrackingTableError(error)) {
        return {
          appliedCount: 0,
          checksumMismatches: [],
          failed: [],
          pending: files,
          totalFiles: files.length,
          trackingTable: "missing",
        };
      }

      throw error;
    }

    const rowsByName = new Map(rows.map((row) => [row.migration_name, row]));
    const checksumMismatches = files.filter((file) => {
      const row = rowsByName.get(file);
      return row ? row.migration_checksum !== checksums.get(file) : false;
    });
    const pending = files.filter((file) => {
      const row = rowsByName.get(file);
      return !row || row.status === "running";
    });
    const appliedCount = files.filter((file) => {
      const row = rowsByName.get(file);
      return row?.status === "succeeded";
    }).length;
    const failed = rows
      .filter((row) => row.status === "failed")
      .map((row) => ({
        attemptCount: row.attempt_count,
        durationMs: row.duration_ms,
        errorMessage: row.error_message,
        finishedAt: row.finished_at,
        migrationName: row.migration_name,
        startedAt: row.started_at,
        status: "failed" as const,
      }));

    return {
      appliedCount,
      checksumMismatches,
      failed,
      pending,
      totalFiles: files.length,
      trackingTable: "present",
    };
  }

  async runMigrations(basePath = process.cwd()): Promise<MigrationRunResult> {
    const migrationsPath = this.resolveMigrationsPath(basePath);
    if (!existsSync(migrationsPath)) {
      return { applied: [], failed: [], skipped: [] };
    }

    await this.ensureTrackingTable();

    const files = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const result: MigrationRunResult = { applied: [], failed: [], skipped: [] };

    for (const file of files) {
      const rawSql = readFileSync(join(migrationsPath, file), "utf8");
      const sql = this.resolvePsqlIncludes(join(migrationsPath, file));
      const checksum = computeChecksum(rawSql);
      const existing = await this.findExistingMigration(file);

      if (existing?.status === "succeeded") {
        if (existing.migration_checksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${file}`);
        }

        result.skipped.push(file);
        continue;
      }

      const startedAt = Date.now();
      await this.markRunning(file, checksum);

      try {
        await this.databaseService.withTransaction(async (client) => {
          await client.query(sql);
        });
        await this.markSucceeded(file, checksum, Date.now() - startedAt);
        result.applied.push(file);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.markFailed(file, checksum, Date.now() - startedAt, errorMessage);
        result.failed.push({ errorMessage, migrationName: file });
        throw error;
      }
    }

    return result;
  }

  private resolveMigrationsPath(basePath: string): string {
    const candidates = [
      resolve(basePath, "db", "migrations"),
      resolve(basePath, "..", "db", "migrations"),
      resolve(basePath, "..", "..", "db", "migrations"),
    ];

    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  private async ensureTrackingTable(): Promise<void> {
    await this.databaseService.query(`
      CREATE SCHEMA IF NOT EXISTS audit;

      CREATE TABLE IF NOT EXISTS audit.schema_migration (
          migration_name TEXT PRIMARY KEY,
          migration_checksum TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
          attempt_count INTEGER NOT NULL DEFAULT 0,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          finished_at TIMESTAMPTZ,
          duration_ms INTEGER,
          applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migration_status
          ON audit.schema_migration (status, started_at DESC);
    `);
  }

  private async findExistingMigration(file: string): Promise<ExistingMigrationRow | null> {
    const result = await this.databaseService.query<ExistingMigrationRow>(
      `
        SELECT migration_checksum, status
        FROM audit.schema_migration
        WHERE migration_name = $1
      `,
      [file],
    );

    return result.rows[0] ?? null;
  }

  private async markRunning(file: string, checksum: string): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO audit.schema_migration (
          migration_name,
          migration_checksum,
          status,
          attempt_count,
          started_at,
          finished_at,
          duration_ms,
          error_message,
          updated_at
        )
        VALUES ($1, $2, 'running', 1, NOW(), NULL, NULL, NULL, NOW())
        ON CONFLICT (migration_name)
        DO UPDATE SET
          migration_checksum = EXCLUDED.migration_checksum,
          status = 'running',
          attempt_count = audit.schema_migration.attempt_count + 1,
          started_at = NOW(),
          finished_at = NULL,
          duration_ms = NULL,
          error_message = NULL,
          updated_at = NOW()
      `,
      [file, checksum],
    );
  }

  private async markSucceeded(
    file: string,
    checksum: string,
    durationMs: number,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE audit.schema_migration
        SET
          migration_checksum = $2,
          status = 'succeeded',
          finished_at = NOW(),
          duration_ms = $3,
          error_message = NULL,
          updated_at = NOW()
        WHERE migration_name = $1
      `,
      [file, checksum, durationMs],
    );
  }

  private async markFailed(
    file: string,
    checksum: string,
    durationMs: number,
    errorMessage: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE audit.schema_migration
        SET
          migration_checksum = $2,
          status = 'failed',
          finished_at = NOW(),
          duration_ms = $3,
          error_message = $4,
          updated_at = NOW()
        WHERE migration_name = $1
      `,
      [file, checksum, durationMs, errorMessage],
    );
  }

  private resolvePsqlIncludes(filePath: string): string {
    const raw = readFileSync(filePath, "utf8");
    return raw.replace(/^\\i\s+(.+)$/gm, (_match: string, relativePath: string) => {
      const includePath = resolve(dirname(filePath), relativePath.trim());
      return readFileSync(includePath, "utf8");
    });
  }
}

function computeChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function isMissingMigrationTrackingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "3F000";
}
