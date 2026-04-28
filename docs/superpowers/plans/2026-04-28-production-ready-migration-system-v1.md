# Production-Ready Migration System V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing SQL migration flow safe for production by adding migration tracking, checksum drift protection, failed-run evidence, a CLI runner, and a production guard for the HTTP migration endpoint.

**Architecture:** Keep the current NestJS + `pg` + raw SQL approach. Add an `audit.schema_migration` metadata table, make `MigrationService` idempotent, and keep migration execution outside normal user-facing API flows in production. Do not add an ORM or replace existing SQL migrations.

**Tech Stack:** NestJS 11, TypeScript, PostgreSQL, `pg`, Jest, SQL migration files under `db/migrations`.

---

## Scope

This plan only covers migration safety.

In scope:

- track applied migration files
- store checksum/hash for each resolved migration SQL file
- skip already-applied migrations when checksum matches
- reject already-applied migrations when checksum changed
- record failed migrations with error messages
- resolve the actual workspace root `db/migrations` directory when backend is started from `backend/nestjs`
- disable the HTTP migration endpoint in production
- add a CLI migration runner for local/CI/CD use
- add tests and env inventory/docs alignment

Out of scope:

- mobile refresh token/session implementation
- CORS/rate limiting
- API versioning
- social/feed expansion
- norm kadro implementation
- rewriting existing migrations
- destructive database changes

## Current Risk To Fix

Current service:

- `backend/nestjs/src/shared/database/migration.service.ts`
- runs every `.sql` file in sorted order
- has no tracking table
- has no checksum guard
- has no failure evidence table
- resolves migrations from `resolve(basePath, "..", "db", "migrations")`

Important path issue:

- When backend runs from `<workspace-root>\backend\nestjs`, current code looks for `backend\db\migrations`.
- Actual migrations live at `<workspace-root>\db\migrations`.
- V1 must resolve both workspace-root and backend/nestjs execution paths.

## File Structure

Create:

- `db/migrations/035_schema_migration_tracking.sql`
- `backend/nestjs/src/shared/database/migration.service.spec.ts`
- `backend/nestjs/src/shared/database/migrations.controller.spec.ts`
- `backend/nestjs/src/shared/database/migration-cli-contract.spec.ts`
- `backend/nestjs/scripts/run-migrations.ts`

Modify:

- `db/schema.sql`
- `backend/nestjs/src/shared/database/migration.service.ts`
- `backend/nestjs/src/shared/database/migrations.controller.ts`
- `backend/nestjs/src/shared/app-config.service.ts`
- `backend/nestjs/src/shared/app-config.service.spec.ts`
- `backend/nestjs/.env.example`
- `backend/nestjs/package.json`
- `docs/plans/environment-variable-inventory.md`
- `docs/plans/deployment-runbook-skeleton.md`
- `docs/plans/production-environment-readiness-checklist.md`

Do not modify:

- Existing migration files `001` through `034`
- Business tables other than adding migration tracking metadata
- Store/personnel/checklist/competition logic

## Target Metadata Table

Use `audit.schema_migration`.

SQL shape:

```sql
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
```

Behavior rules:

- If migration is missing from `audit.schema_migration`, run it.
- If migration exists with `status='succeeded'` and checksum matches, skip it.
- If migration exists with `status='succeeded'` and checksum differs, fail before running anything else.
- If migration exists with `status='failed'`, allow retry and increment `attempt_count`.
- Before running a migration, write or update row to `running`.
- If migration succeeds, update row to `succeeded`.
- If migration fails, update row to `failed`, store `error_message`, then rethrow.
- Do not record failed status inside the same transaction that rolls back the migration SQL.

## Return Contract

`MigrationService.runMigrations()` should return:

```ts
export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
  failed: Array<{
    migrationName: string;
    errorMessage: string;
  }>;
};
```

V1 can keep existing `applied` callers compatible by returning `applied`, but add `skipped` and `failed`.

## Task 1: Add Red Tests For Migration Path, Tracking, Skip, Drift, Failure

**Files:**

- Create: `backend/nestjs/src/shared/database/migration.service.spec.ts`
- Modify later: `backend/nestjs/src/shared/database/migration.service.ts`

- [ ] **Step 1: Write the failing migration service tests**

Create `backend/nestjs/src/shared/database/migration.service.spec.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

  return { root, backendNestjs, migrationsDir };
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
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (options?.failOnSql && sql.includes(options.failOnSql)) {
        throw new Error("migration exploded");
      }

      return { rows: [], rowCount: 0 };
    }),
    withTransaction: jest.fn(async (work: (client: { query: (sql: string) => Promise<unknown> }) => Promise<unknown>) =>
      work({
        query: async (sql: string) => {
          calls.push({ sql, params: [] });
          if (options?.failOnSql && sql.includes(options.failOnSql)) {
            throw new Error("migration exploded");
          }
          return { rows: [], rowCount: 0 };
        },
      }),
    ),
  };

  return { databaseService, calls };
}

describe("MigrationService", () => {
  it("finds workspace root migrations when basePath is backend/nestjs", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "CREATE TABLE example_one (id uuid);",
    });
    const { databaseService, calls } = createDatabaseMock();
    const service = new MigrationService(databaseService as never);

    const result = await service.runMigrations(project.backendNestjs);

    expect(result.applied).toEqual(["001_first.sql"]);
    expect(calls.some((call) => call.sql.includes("CREATE TABLE example_one"))).toBe(true);
  });

  it("skips succeeded migrations when checksum matches", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
    });
    const checksum = MigrationService.computeChecksumForTest("SELECT 1;");
    const { databaseService, calls } = createDatabaseMock({
      existingRows: {
        "001_first.sql": { migration_checksum: checksum, status: "succeeded" },
      },
    });
    const service = new MigrationService(databaseService as never);

    const result = await service.runMigrations(project.backendNestjs);

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(["001_first.sql"]);
    expect(calls.some((call) => call.sql === "SELECT 1;")).toBe(false);
  });

  it("fails before running when an applied migration checksum changes", async () => {
    const project = createProjectWithMigrations({
      "001_first.sql": "SELECT 1;",
    });
    const { databaseService, calls } = createDatabaseMock({
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
    const { databaseService, calls } = createDatabaseMock({ failOnSql: "will_fail" });
    const service = new MigrationService(databaseService as never);

    await expect(service.runMigrations(project.backendNestjs)).rejects.toThrow(
      "migration exploded",
    );

    expect(calls.some((call) => call.sql.includes("status = 'failed'"))).toBe(true);
    expect(calls.some((call) => call.params.includes("migration exploded"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration.service.spec.ts --runInBand
```

Expected:

- FAIL because `MigrationService.computeChecksumForTest` does not exist.
- FAIL because existing service returns no `skipped`.
- FAIL because existing service does not track status.
- The path test may also fail because current service does not find root `db/migrations` from `backend/nestjs`.

## Task 2: Add Canonical Schema And Migration Tracking SQL

**Files:**

- Create: `db/migrations/035_schema_migration_tracking.sql`
- Modify: `db/schema.sql`
- Test: `backend/nestjs/src/shared/database/migration-schema-contract.spec.ts`

- [ ] **Step 1: Write schema contract test**

Create `backend/nestjs/src/shared/database/migration-schema-contract.spec.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "035_schema_migration_tracking.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("migration tracking schema contract", () => {
  it("keeps schema migration tracking in canonical schema and migration file", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS audit.schema_migration");
      expect(sql).toContain("migration_name TEXT PRIMARY KEY");
      expect(sql).toContain("migration_checksum TEXT NOT NULL");
      expect(sql).toContain("status TEXT NOT NULL");
      expect(sql).toContain("attempt_count INTEGER NOT NULL DEFAULT 0");
      expect(sql).toContain("error_message TEXT");
      expect(sql).toContain("idx_schema_migration_status");
    }
  });
});
```

- [ ] **Step 2: Run the red schema contract test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration-schema-contract.spec.ts --runInBand
```

Expected:

- FAIL because `035_schema_migration_tracking.sql` does not exist and canonical schema has no `audit.schema_migration`.

- [ ] **Step 3: Add tracking table to `db/schema.sql`**

Add after `CREATE TABLE audit.entity_change_log` or near other audit tables:

```sql
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
```

Add comment near existing table comments:

```sql
COMMENT ON TABLE audit.schema_migration IS 'Tracks SQL migration execution, checksums, status, and failure evidence.';
```

- [ ] **Step 4: Add migration file**

Create `db/migrations/035_schema_migration_tracking.sql`:

```sql
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

COMMENT ON TABLE audit.schema_migration IS 'Tracks SQL migration execution, checksums, status, and failure evidence.';
```

- [ ] **Step 5: Run schema contract test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration-schema-contract.spec.ts --runInBand
```

Expected:

- PASS.

## Task 3: Implement Idempotent Migration Tracking

**Files:**

- Modify: `backend/nestjs/src/shared/database/migration.service.ts`
- Test: `backend/nestjs/src/shared/database/migration.service.spec.ts`

- [ ] **Step 1: Replace MigrationService with tracking implementation**

Use this structure in `migration.service.ts`:

```ts
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

type ExistingMigrationRow = {
  migration_checksum: string;
  status: "running" | "succeeded" | "failed";
};

@Injectable()
export class MigrationService {
  constructor(private readonly databaseService: DatabaseService) {}

  static computeChecksumForTest(sql: string): string {
    return computeChecksum(sql);
  }

  async runMigrations(basePath = process.cwd()): Promise<MigrationRunResult> {
    const migrationsPath = this.resolveMigrationsPath(basePath);
    if (!migrationsPath) {
      return { applied: [], skipped: [], failed: [] };
    }

    await this.ensureTrackingTable();

    const files = readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const result: MigrationRunResult = { applied: [], skipped: [], failed: [] };

    for (const file of files) {
      const sql = this.resolvePsqlIncludes(join(migrationsPath, file));
      const checksum = computeChecksum(sql);
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
        result.failed.push({ migrationName: file, errorMessage });
        throw error;
      }
    }

    return result;
  }

  private resolveMigrationsPath(basePath: string): string | null {
    const candidates = [
      resolve(basePath, "db", "migrations"),
      resolve(basePath, "..", "db", "migrations"),
      resolve(basePath, "..", "..", "db", "migrations"),
    ];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
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
```

- [ ] **Step 2: Run migration service tests**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration.service.spec.ts --runInBand
```

Expected:

- PASS.

## Task 4: Disable HTTP Migration Endpoint In Production

**Files:**

- Modify: `backend/nestjs/src/shared/app-config.service.ts`
- Modify: `backend/nestjs/src/shared/app-config.service.spec.ts`
- Modify: `backend/nestjs/src/shared/database/migrations.controller.ts`
- Create: `backend/nestjs/src/shared/database/migrations.controller.spec.ts`
- Modify: `backend/nestjs/.env.example`
- Modify: `docs/plans/environment-variable-inventory.md`

- [ ] **Step 1: Add AppConfig tests**

Append to `backend/nestjs/src/shared/app-config.service.spec.ts`:

```ts
it("allows HTTP migration endpoint by default only outside production", () => {
  expect(createConfig({ NODE_ENV: "development" }).httpMigrationEndpointEnabled).toBe(true);
  expect(createConfig({ NODE_ENV: "production" }).httpMigrationEndpointEnabled).toBe(false);
});

it("allows disabling HTTP migration endpoint explicitly outside production", () => {
  expect(
    createConfig({
      NODE_ENV: "development",
      MIGRATIONS_HTTP_ENABLED: "false",
    }).httpMigrationEndpointEnabled,
  ).toBe(false);
});

it("does not allow enabling HTTP migration endpoint in production", () => {
  expect(
    createConfig({
      NODE_ENV: "production",
      MIGRATIONS_HTTP_ENABLED: "true",
    }).httpMigrationEndpointEnabled,
  ).toBe(false);
});
```

- [ ] **Step 2: Run AppConfig red test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/app-config.service.spec.ts --runInBand
```

Expected:

- FAIL because `httpMigrationEndpointEnabled` does not exist.

- [ ] **Step 3: Implement config getter**

Add to `AppConfigService`:

```ts
  get httpMigrationEndpointEnabled(): boolean {
    if (this.isProduction) {
      return false;
    }

    return this.readString("MIGRATIONS_HTTP_ENABLED", "true") !== "false";
  }
```

- [ ] **Step 4: Add controller tests**

Create `backend/nestjs/src/shared/database/migrations.controller.spec.ts`:

```ts
import { NotFoundException } from "@nestjs/common";
import { MigrationsController } from "./migrations.controller";

describe("MigrationsController", () => {
  it("runs migrations when HTTP endpoint is enabled", async () => {
    const migrationService = {
      runMigrations: jest.fn().mockResolvedValue({
        applied: ["001.sql"],
        skipped: [],
        failed: [],
      }),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: true } as never,
    );

    await expect(controller.runMigrations()).resolves.toEqual({
      applied: ["001.sql"],
      skipped: [],
      failed: [],
    });
    expect(migrationService.runMigrations).toHaveBeenCalledWith(process.cwd());
  });

  it("hides HTTP migration endpoint when disabled", async () => {
    const migrationService = {
      runMigrations: jest.fn(),
    };
    const controller = new MigrationsController(
      migrationService as never,
      { httpMigrationEndpointEnabled: false } as never,
    );

    await expect(controller.runMigrations()).rejects.toBeInstanceOf(NotFoundException);
    expect(migrationService.runMigrations).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run controller red test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migrations.controller.spec.ts --runInBand
```

Expected:

- FAIL because controller constructor does not accept `AppConfigService`.

- [ ] **Step 6: Implement production guard in controller**

Modify `backend/nestjs/src/shared/database/migrations.controller.ts`:

```ts
import { Controller, NotFoundException, Post } from "@nestjs/common";
import { RequireRoles } from "../../modules/auth/decorators/roles.decorator";
import { RequireScope } from "../../modules/auth/decorators/scope.decorator";
import { AppConfigService } from "../app-config.service";
import { MigrationService } from "./migration.service";

@Controller("admin/migrations")
@RequireScope("authenticated")
@RequireRoles("SUPER_ADMIN")
export class MigrationsController {
  constructor(
    private readonly migrationService: MigrationService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Post("run")
  async runMigrations() {
    if (!this.appConfigService.httpMigrationEndpointEnabled) {
      throw new NotFoundException("Migration endpoint is disabled");
    }

    return this.migrationService.runMigrations(process.cwd());
  }
}
```

- [ ] **Step 7: Update env example**

Add to `backend/nestjs/.env.example`:

```text
MIGRATIONS_HTTP_ENABLED=true
```

- [ ] **Step 8: Update env inventory**

Add `MIGRATIONS_HTTP_ENABLED` to `docs/plans/environment-variable-inventory.md` as backend runtime variable:

```markdown
| `MIGRATIONS_HTTP_ENABLED` | `true` outside production, forced disabled in production | Enables the legacy HTTP migration endpoint only for local/non-production controlled use. Production must use CLI/CI migration execution. |
```

- [ ] **Step 9: Run config and controller tests**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/app-config.service.spec.ts src/shared/database/migrations.controller.spec.ts --runInBand
```

Expected:

- PASS.

## Task 5: Add CLI Migration Runner

**Files:**

- Create: `backend/nestjs/scripts/run-migrations.ts`
- Modify: `backend/nestjs/package.json`
- Create: `backend/nestjs/src/shared/database/migration-cli-contract.spec.ts`
- Modify: `docs/plans/deployment-runbook-skeleton.md`
- Modify: `docs/plans/production-environment-readiness-checklist.md`

- [ ] **Step 1: Add CLI contract test**

Create `backend/nestjs/src/shared/database/migration-cli-contract.spec.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("migration CLI contract", () => {
  it("exposes db:migrate package script and uses MigrationService without starting HTTP", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const script = readFileSync(
      join(process.cwd(), "scripts", "run-migrations.ts"),
      "utf8",
    );

    expect(packageJson.scripts["db:migrate"]).toBe("ts-node scripts/run-migrations.ts");
    expect(script).toContain("NestFactory.createApplicationContext");
    expect(script).toContain("MigrationService");
    expect(script).toContain("runMigrations");
    expect(script).not.toContain("create(AppModule)");
    expect(script).not.toContain("listen(");
  });
});
```

- [ ] **Step 2: Run CLI red test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration-cli-contract.spec.ts --runInBand
```

Expected:

- FAIL because `scripts/run-migrations.ts` and `db:migrate` do not exist.

- [ ] **Step 3: Create CLI runner**

Create `backend/nestjs/scripts/run-migrations.ts`:

```ts
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { MigrationService } from "../src/shared/database/migration.service";

async function main() {
  const logger = new Logger("MigrationCli");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const migrationService = app.get(MigrationService);
    const result = await migrationService.runMigrations(process.cwd());
    logger.log(JSON.stringify({ event: "migration.completed", ...result }));
  } catch (error) {
    logger.error(
      JSON.stringify({
        event: "migration.failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
```

- [ ] **Step 4: Add package script**

Modify `backend/nestjs/package.json`:

```json
"db:migrate": "ts-node scripts/run-migrations.ts"
```

Place it near existing operational scripts:

```json
"start:workers": "ts-node src/workers.ts",
"db:migrate": "ts-node scripts/run-migrations.ts",
"build": "nest build"
```

- [ ] **Step 5: Update deployment runbook**

In `docs/plans/deployment-runbook-skeleton.md`, replace placeholder migration command with:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd run db:migrate
```

Add rule:

```markdown
- Production migrations must be run through `npm.cmd run db:migrate` or the approved CI/CD step, not through `/api/admin/migrations/run`.
```

- [ ] **Step 6: Update production readiness checklist**

In `docs/plans/production-environment-readiness-checklist.md`, add:

```markdown
- [ ] `npm.cmd run db:migrate` is the approved migration execution command.
- [ ] `/api/admin/migrations/run` is disabled in production by `MIGRATIONS_HTTP_ENABLED=false` or production default behavior.
- [ ] `audit.schema_migration` contains succeeded records for applied migration files.
```

- [ ] **Step 7: Run CLI contract test**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration-cli-contract.spec.ts --runInBand
```

Expected:

- PASS.

## Task 6: Add Root/Backend Verification And Guard Against Env Drift

**Files:**

- Modify: `docs/plans/environment-variable-inventory.md`
- Modify: `backend/nestjs/.env.example`
- Test existing: `scripts/deployment-runbook-contract.test.mjs`
- Test existing: `backend/nestjs/src/shared/app-config.service.spec.ts`

- [ ] **Step 1: Run root script tests**

Run:

```powershell
cd "<workspace-root>"
npm.cmd run test:scripts
```

Expected:

- PASS.
- If it fails, update inventory/examples/runbook text until drift guard is satisfied.

- [ ] **Step 2: Run backend targeted tests**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd test -- src/shared/database/migration.service.spec.ts src/shared/database/migration-schema-contract.spec.ts src/shared/database/migrations.controller.spec.ts src/shared/database/migration-cli-contract.spec.ts src/shared/app-config.service.spec.ts --runInBand
```

Expected:

- PASS.

- [ ] **Step 3: Run backend release gate**

Run:

```powershell
cd "<workspace-root>\backend\nestjs"
npm.cmd run check:release
```

Expected:

- ESLint passes.
- Jest passes.
- Nest build passes.
- `npm audit --omit=dev` reports 0 vulnerabilities.

- [ ] **Step 4: Run root release gate**

Run:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Expected:

- Root script tests pass.
- Backend release passes.
- Frontend release passes.

## Task 7: Update Project Planning Notes

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Update `current-state.md`**

Add a short section:

```markdown
## Son Production-Ready Migration System V1

28 Nisan 2026 itibariyla migration sistemi production hazirligi icin guvenli hale getirildi.

Eklenenler:

- `audit.schema_migration` tracking tablosu.
- migration checksum drift guard.
- failed migration status/error evidence.
- backend/nestjs calisma yolundan root `db/migrations` cozumleme.
- production ortaminda HTTP migration endpoint guard.
- CLI migration runner: `npm.cmd run db:migrate`.

Dogrulama:

- Backend targeted migration tests passed.
- Backend release gate passed.
- Root release gate passed.

Siradaki mantikli adim: Production security gate V1 planina gecmek: CORS, rate limit, request logging, error response standardi ve mobile auth/session kararlarini koddan once netlestirmek.
```

- [ ] **Step 2: Update `docs/plans/active-next-actions.md`**

Add `Completed: Production-Ready Migration System V1` near the completed backend/data section.

Set recommended next move:

```markdown
Recommended local candidate:

- Plan Production Security Gate V1: CORS, rate limiting, request logging, error response standard, and mobile auth/session decision points.
```

- [ ] **Step 3: Update `docs/plans/project-debt-ledger.md`**

Increment closed active debt by 1 only after implementation and release verification pass.

Add:

```markdown
Production-Ready Migration System V1 is implemented. SQL migrations are tracked in `audit.schema_migration`, checksum drift is rejected, failed runs are recorded, the HTTP migration endpoint is disabled in production, and `npm.cmd run db:migrate` is the approved CLI/CI migration path.
```

Do not mark as closed until code and root release verification pass.

## Acceptance Criteria

- `MigrationService` finds migrations from the active `backend/nestjs` working directory.
- `audit.schema_migration` exists in canonical schema and migration file.
- Already-succeeded matching migrations are skipped.
- Already-succeeded changed migrations fail before execution.
- Failed migration stores `status='failed'` and `error_message`.
- Production HTTP migration endpoint returns `404`.
- CLI command `npm.cmd run db:migrate` exists.
- Root release gate passes.
- Existing migrations `001` through `034` are not rewritten.

## Rollback Plan

If implementation causes test or runtime risk:

- Revert code changes in `MigrationService`, `MigrationsController`, `AppConfigService`, CLI script, and docs.
- Keep existing migration files untouched.
- If `035_schema_migration_tracking.sql` has been applied in a non-production DB, leaving `audit.schema_migration` is safe because it is metadata-only and does not affect business tables.
- Do not drop the table in production without an explicit DBA/operator decision.

## CODEX Honest View

This is the right first production-hardening task. It is not flashy, but it prevents the most dangerous class of backend failure: silent schema drift and repeated uncontrolled migration execution.

The current project has enough business modules now that database changes must become auditable. Migration tracking should land before mobile auth/session, CORS/rate limit, or any social/gamification expansion.

## Execution Order

1. Task 1: red tests for service behavior.
2. Task 2: schema and migration tracking table.
3. Task 3: idempotent MigrationService.
4. Task 4: HTTP endpoint production guard.
5. Task 5: CLI runner.
6. Task 6: verification.
7. Task 7: planning notes.

Commit recommendation:

```powershell
git add backend/nestjs/src/shared/database backend/nestjs/src/shared/app-config.service.ts backend/nestjs/src/shared/app-config.service.spec.ts backend/nestjs/scripts/run-migrations.ts backend/nestjs/package.json backend/nestjs/.env.example db/schema.sql db/migrations/035_schema_migration_tracking.sql docs/plans current-state.md
git commit -m "chore: harden migration execution"
```
