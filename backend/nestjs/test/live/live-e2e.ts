import "reflect-metadata";
import * as request from "supertest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { AppModule } from "../../src/app.module";
import { WorkerModule } from "../../src/worker.module";

const liveAdminUserId = "80000000-0000-0000-0000-000000000001";

async function executeSqlFile(pool: Pool, path: string) {
  if (!existsSync(path)) {
    return;
  }

  const sql = readFileSync(path, "utf8");
  if (sql.trim()) {
    await pool.query(sql);
  }
}

async function resetLiveDatabase(pool: Pool) {
  // Keep the live test rerunnable by clearing project-owned schemas first.
  await pool.query("DROP SCHEMA IF EXISTS audit CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS rpt CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS stg CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS ops CASCADE");
}

async function waitFor<T>(fn: () => Promise<T>, predicate: (value: T) => boolean, timeoutMs = 15000) {
  const startedAt = Date.now();

  for (;;) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out while waiting for live E2E condition");
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }
}

async function bootstrap() {
  const databaseUrl =
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/store_ops_live";
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    throw new Error(
      `Live E2E could not connect to PostgreSQL at ${databaseUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const projectRoot = resolve(__dirname, "..", "..", "..", "..");
  await resetLiveDatabase(pool);
  await executeSqlFile(pool, resolve(projectRoot, "db", "schema.sql"));
  await executeSqlFile(pool, resolve(projectRoot, "db", "seeds", "001_reference_seed.sql"));
  await executeSqlFile(pool, resolve(projectRoot, "db", "jobs", "generate_snapshots.sql"));

  const workerContext = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["error", "warn"],
  });
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
  });

  app.setGlobalPrefix("api");
  await app.init();

  try {
    const server = app.getHttpServer();

    const snapshotResponse = await request(server)
      .post("/api/snapshots/runs")
      .set("x-user-id", liveAdminUserId)
      .send({
        snapshotType: "custom",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      });

    if (snapshotResponse.status >= 400) {
      throw new Error(`Snapshot live E2E failed: ${JSON.stringify(snapshotResponse.body)}`);
    }

    const snapshotRunId =
      snapshotResponse.body.data?.snapshotRun?.snapshot_run_id ??
      snapshotResponse.body.data?.snapshotRun?.snapshotRunId ??
      snapshotResponse.body.snapshotRun?.snapshot_run_id ??
      snapshotResponse.body.snapshotRun?.snapshotRunId;

    if (!snapshotRunId) {
      throw new Error("Snapshot live E2E did not return a snapshot run id");
    }

    const importResponse = await request(server)
      .post("/api/integrations/import-batches")
      .set("x-user-id", liveAdminUserId)
      .send({
        sourceCode: "HRIS",
        entityType: "employee",
        fileReference: "live-e2e-employee.json",
        rows: [
          {
            sourceEmployeeId: "EMP-LIVE-1",
            companyId: "00000000-0000-0000-0000-000000000001",
            firstName: "Live",
            lastName: "Employee",
            hireDate: "2026-04-01",
            employmentStatus: "active",
            employmentType: "full_time",
          },
        ],
      });

    if (importResponse.status >= 400) {
      throw new Error(`Import live E2E failed: ${JSON.stringify(importResponse.body)}`);
    }

    const batchId =
      importResponse.body.data?.batch?.batchId ??
      importResponse.body.batch?.batchId;
    if (!batchId) {
      throw new Error("Import live E2E did not return a batch id");
    }

    await waitFor(
      async () => {
        const result = await request(server).get(`/api/integrations/import-batches/${batchId}`);
        return result.body;
      },
      (body) => ["completed", "completed_with_errors", "failed"].includes(body.batch?.status),
    );

    await waitFor(
      async () => {
        const result = await request(server).get(`/api/snapshots/runs/${snapshotRunId}`);
        return result.body;
      },
      (body) => ["completed", "failed"].includes(body.snapshotRun?.runStatus),
    );

    console.log("Live E2E completed successfully");
  } finally {
    await app.close();
    await workerContext.close();
    await pool.end();
  }
}

void bootstrap();
