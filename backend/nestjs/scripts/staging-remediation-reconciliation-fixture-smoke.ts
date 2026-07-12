import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import type { CheckRow } from "./database-invariant-preflight-core";
import { sha256Hex } from "./staging-remediation-diagnostic-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";
import {
  fixtureCompanyIds,
  fixtureSql,
} from "./staging-remediation-row-authority-classifier-fixture-smoke";
import {
  buildReconciliationAuthorityResult,
  buildReconciliationResult,
} from "./staging-remediation-reconciliation-contract";
import { verifyTargetDuplicateApplicationContract } from "./staging-remediation-reconciliation-source-contract";

let fixturePhase = "configuration";
const root = join(__dirname, "..", "..", "..");

// Trace: FR-01..10, FR-13; NFR-01, NFR-02, NFR-04; AC-01, AC-08; EC-01..09, EC-11.
async function main() {
  const connectionString = readDisposableDatabaseUrl();
  const invariantV1Query = readFileSync(
    join(root, "db", "preflight", "database-invariant-preflight-v1.sql"),
    "utf8",
  );
  const invariantV2Query = readFileSync(
    join(root, "db", "preflight", "staging-remediation-invariant-v2.sql"),
    "utf8",
  );
  const classifierQuery = readFileSync(
    join(root, "db", "preflight", "staging-remediation-row-authority-classifier-v1.sql"),
    "utf8",
  );
  const applicationSourcePath = join(
    __dirname,
    "..",
    "src",
    "modules",
    "store-ops",
    "application",
    "target-distribution.service.ts",
  );
  const applicationProof = verifyTargetDuplicateApplicationContract(
    readFileSync(applicationSourcePath, "utf8"),
    readFileSync(applicationSourcePath.replace(/\.ts$/, ".spec.ts"), "utf8"),
  );
  const pool = new Pool({ connectionString, max: 1, ssl: false });
  fixturePhase = "connect";
  const client = await pool.connect();

  try {
    fixturePhase = "fixture_insert";
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    await client.query(fixtureSql);

    fixturePhase = "reconciliation_query";
    const v1Rows = await client.query<CheckRow>(invariantV1Query);
    const v2Rows = await client.query<{ invariant: unknown }>(invariantV2Query);
    const v2 = validateInvariantV2QueryResult(v2Rows.rows[0]?.invariant);
    const authorityRows = await client.query<{ authority_classifier: unknown }>(classifierQuery);
    const authority = buildReconciliationAuthorityResult(
      authorityRows.rows[0]?.authority_classifier,
      v2,
    );
    const result = buildReconciliationResult(
      v1Rows.rows,
      v2,
      authority,
      applicationProof.sourceDigest,
      {
        authorityClassifierV1: sha256Hex(classifierQuery),
        invariantV1: sha256Hex(invariantV1Query),
        invariantV2: sha256Hex(invariantV2Query),
      },
    );
    const states = Object.fromEntries(result.families.map((family) => [family.family, family.state]));
    if (JSON.stringify(states) !== JSON.stringify({
      "TARGET-02": "eligible_zero",
      "ORG-02": "blocked",
      "ORG-04": "blocked",
      "ASSIGN-01": "blocked",
    })) {
      throw new Error("fixture_terminal_states_mismatch");
    }
    if (result.overallState !== "target_eligible_other_families_blocked") {
      throw new Error("fixture_overall_state_mismatch");
    }

    fixturePhase = "rollback_verification";
    await client.query("ROLLBACK");
    const residue = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM ops.company WHERE company_id = ANY($1::uuid[])",
      [fixtureCompanyIds],
    );
    if (residue.rows[0]?.count !== "0") throw new Error("fixture_rollback_failed");

    process.stdout.write(`${JSON.stringify({
      event: "staging_remediation_reconciliation.fixture_smoke_completed",
      overallState: result.overallState,
      rolledBack: true,
      states,
      targetClass: "disposable",
    })}\n`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function readDisposableDatabaseUrl() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("database_url_missing");
  const parsed = new URL(raw);
  if (!(parsed.protocol === "postgres:" || parsed.protocol === "postgresql:")) {
    throw new Error("invalid_database_protocol");
  }
  if (!(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
    throw new Error("non_local_fixture_target_refused");
  }
  if (!/^store_ops_fresh_migration_smoke_preflight(?:_[a-z0-9_]+)?$/.test(parsed.pathname.slice(1))) {
    throw new Error("non_disposable_fixture_database_refused");
  }
  return raw;
}

void main().catch((error) => {
  const allowed = new Set([
    "database_url_missing",
    "fixture_overall_state_mismatch",
    "fixture_rollback_failed",
    "fixture_terminal_states_mismatch",
    "invalid_database_protocol",
    "non_disposable_fixture_database_refused",
    "non_local_fixture_target_refused",
    "production_refused",
  ]);
  process.stderr.write(`${JSON.stringify({
    error: error instanceof Error && allowed.has(error.message) ? error.message : "fixture_smoke_failed",
    event: "staging_remediation_reconciliation.fixture_smoke_failed",
    phase: fixturePhase,
  })}\n`);
  process.exitCode = 1;
});
