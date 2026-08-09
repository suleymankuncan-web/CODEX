import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { PG_POOL } from "../shared/database/database.constants";
import {
  MigrationService,
  resolveMigrationSql,
} from "../shared/database/migration.service";

const MIGRATION_LOCK_ID = "hr-axis:onprem:migrations:v1";

const APPLY_RUNTIME_GRANTS_SQL = `
DO $runtime_grants$
DECLARE
  application_schema TEXT;
BEGIN
  EXECUTE format(
    'REVOKE CREATE ON DATABASE %I FROM PUBLIC, hr_axis_api, hr_axis_worker',
    current_database()
  );

  FOR application_schema IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname NOT LIKE 'pg_%'
      AND nspname <> 'information_schema'
    ORDER BY nspname
  LOOP
    EXECUTE format(
      'REVOKE CREATE ON SCHEMA %I FROM PUBLIC, hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'GRANT USAGE ON SCHEMA %I TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA %I FROM hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC',
      application_schema
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO hr_axis_api, hr_axis_worker',
      application_schema
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO hr_axis_api, hr_axis_worker',
      application_schema
    );
  END LOOP;

  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON audit.schema_migration
    FROM hr_axis_api, hr_axis_worker;
  GRANT SELECT ON audit.schema_migration TO hr_axis_api, hr_axis_worker;
END
$runtime_grants$;
`;

@Injectable()
export class OnPremMigrationRunnerService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly migrations: MigrationService,
  ) {}

  async run(basePath = process.cwd()) {
    const migrationsPath = resolveMigrationTree(basePath);
    if (!migrationsPath) {
      throw new Error("on-prem migration tree is missing");
    }

    const files = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    if (files.length === 0) {
      throw new Error("on-prem migration tree is missing");
    }

    const client = await this.pool.connect();
    let locked = false;
    let executionError: unknown;
    let outcome:
      | {
          appliedCount: number;
          failedCount: number;
          migrationTreeDigest: string;
          skippedCount: number;
        }
      | undefined;
    try {
      const identity = await client.query<{ role_name: string }>(
        "SELECT CURRENT_USER AS role_name",
      );
      if (identity.rows[0]?.role_name !== "hr_axis_migrator") {
        throw new Error("on-prem migrator database role identity mismatch");
      }
      await client.query(
        "SELECT pg_advisory_lock(hashtextextended($1, 0))",
        [MIGRATION_LOCK_ID],
      );
      locked = true;
      const preflight = await this.migrations.getMigrationStatus(basePath, {
        requireMigrationTree: true,
      });
      assertSafeMigrationPreflight(preflight);
      const result = await this.migrations.runMigrations(basePath, {
        requireMigrationTree: true,
      });
      await client.query(APPLY_RUNTIME_GRANTS_SQL);

      outcome = {
        appliedCount: result.applied.length,
        failedCount: result.failed.length,
        migrationTreeDigest: computeMigrationTreeDigest(migrationsPath, files),
        skippedCount: result.skipped.length,
      };
    } catch (error) {
      executionError = error;
    }

    let unlockError: unknown;
    try {
      if (locked) {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked",
          [MIGRATION_LOCK_ID],
        );
      }
    } catch (error) {
      unlockError = error;
    } finally {
      client.release(unlockError instanceof Error ? unlockError : undefined);
    }

    if (executionError) throw executionError;
    if (unlockError) {
      throw new Error("on-prem migration advisory unlock failed", {
        cause: unlockError,
      });
    }
    if (!outcome) throw new Error("on-prem migration produced no outcome");
    return outcome;
  }
}

function assertSafeMigrationPreflight(status: {
  checksumMismatches: string[];
  failed: unknown[];
  running: string[];
  trackingTable: "present" | "missing";
  unexpectedTracked: string[];
  unknownApplied: string[];
}): void {
  if (status.trackingTable === "missing") {
    return;
  }

  const reasons = [
    status.unexpectedTracked.length > 0 || status.unknownApplied.length > 0
      ? "unexpected tracking rows"
      : undefined,
    status.checksumMismatches.length > 0 ? "checksum mismatch" : undefined,
    status.failed.length > 0 ? "failed migration" : undefined,
    status.running.length > 0 ? "running migration" : undefined,
  ].filter((reason): reason is string => Boolean(reason));

  if (reasons.length > 0) {
    throw new Error(`On-prem migration preflight failed: ${reasons.join(", ")}`);
  }
}

function resolveMigrationTree(basePath: string): string | undefined {
  const candidates = [
    resolve(basePath, "db", "migrations"),
    resolve(basePath, "..", "db", "migrations"),
    resolve(basePath, "..", "..", "db", "migrations"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function computeMigrationTreeDigest(directory: string, files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(resolveMigrationSql(join(directory, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
