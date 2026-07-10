import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { mapCheckResult, type CheckRow } from "./database-invariant-preflight-core";

const fixtureCompanyIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
];
let fixturePhase = "configuration";

const expectedViolationCounts: Record<string, number> = {
  "ASSIGN-01": 1,
  "AUTH-01": 1,
  "AUTH-02": 1,
  "KEY-01": 0,
  "ORG-01": 1,
  "ORG-02": 2,
  "ORG-03": 2,
  "ORG-04": 2,
  "TARGET-01": 1,
  "TARGET-02": 1,
  "TARGET-03": 1,
};

async function main() {
  const connectionString = readDisposableDatabaseUrl();
  const preflightQuery = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "database-invariant-preflight-v1.sql"),
    "utf8",
  );
  const pool = new Pool({ connectionString, max: 1, ssl: false });
  fixturePhase = "connect";
  const client = await pool.connect();

  try {
    fixturePhase = "fixture_insert";
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    await client.query(fixtureSql);

    fixturePhase = "preflight_query";
    const checks = await client.query<CheckRow>(preflightQuery);
    const results = checks.rows.map((row) => mapCheckResult(row, {
      candidateKeys: {
        regionCompositeUniquePresent: false,
        storeCompositeUniquePresent: false,
      },
      targetClass: "disposable",
    }));
    const actual = Object.fromEntries(results.map((result) => [result.checkId, result.violationCount]));
    if (JSON.stringify(actual) !== JSON.stringify(expectedViolationCounts)) {
      throw new Error("fixture_violation_counts_mismatch");
    }

    fixturePhase = "rollback_verification";
    await client.query("ROLLBACK");
    const residue = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM ops.company WHERE company_id = ANY($1::uuid[])",
      [fixtureCompanyIds],
    );
    if (residue.rows[0]?.count !== "0") throw new Error("fixture_rollback_failed");

    process.stdout.write(`${JSON.stringify({
      event: "database_invariant_preflight.fixture_smoke_completed",
      results: actual,
      rolledBack: true,
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
  if (process.env.NODE_ENV === "production") throw new Error("production_refused");
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("database_url_missing");
  const parsed = new URL(raw);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("non_local_fixture_target_refused");
  }
  if (!/^store_ops_fresh_migration_smoke_preflight(?:_[a-z0-9_]+)?$/.test(parsed.pathname.slice(1))) {
    throw new Error("non_disposable_fixture_database_refused");
  }
  return raw;
}

const fixtureSql = `
  INSERT INTO ops.company (company_id, company_code, company_name)
  VALUES
    ('10000000-0000-4000-8000-000000000001', 'PREFLIGHT_A', 'Preflight A'),
    ('10000000-0000-4000-8000-000000000002', 'PREFLIGHT_B', 'Preflight B');

  INSERT INTO ops.region (region_id, company_id, region_code, region_name)
  VALUES
    ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'PREFLIGHT_RA', 'Preflight RA'),
    ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'PREFLIGHT_RB', 'Preflight RB');

  INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
  VALUES ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002', 'PREFLIGHT_STORE', 'Preflight Store', 'company');

  INSERT INTO ops.position (position_id, company_id, position_code, position_name)
  VALUES ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    'PREFLIGHT_POSITION', 'Preflight Position');

  INSERT INTO ops.employee (employee_id, company_id, first_name, last_name, hire_date, employment_type)
  VALUES ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
    'Fixture', 'Employee', DATE '2025-01-01', 'full_time');

  INSERT INTO ops.employee_assignment_history
    (assignment_id, employee_id, store_id, region_id, position_id, start_date, end_date,
      is_primary_assignment, assignment_status)
  VALUES
    ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001', DATE '2026-01-01', DATE '2026-01-31', TRUE, 'active'),
    ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001', DATE '2026-01-15', NULL, TRUE, 'active');

  INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type)
  VALUES ('80000000-0000-4000-8000-000000000001', 'PREFLIGHT_REGION_ROLE', 'Preflight Region Role', 'region');

  INSERT INTO ops.user_account (user_id, username, email)
  VALUES ('70000000-0000-4000-8000-000000000001', 'preflight_fixture', 'preflight_fixture');

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id)
  VALUES
    ('90000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000001', 'store', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
    ('90000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001',
      '80000000-0000-4000-8000-000000000001', 'region', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');

  INSERT INTO ops.target_distribution_request
    (target_distribution_request_id, company_id, region_id, store_id, request_month, target_label,
      total_target_value, allocation_count, allocation_json, submitted_by_user_id)
  VALUES
    ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
      DATE '2026-07-01', 'Duplicate allocation fixture', 100, 1,
      '[{"employeeId":"50000000-0000-4000-8000-000000000001"},{"employeeId":"50000000-0000-4000-8000-000000000001"}]'::jsonb,
      'preflight-fixture'),
    ('a0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
      DATE '2026-07-01', 'Malformed allocation fixture', 100, 0, '{}'::jsonb, 'preflight-fixture');
`;

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    error: classifyFixtureError(error),
    event: "database_invariant_preflight.fixture_smoke_failed",
    phase: fixturePhase,
  })}\n`);
  process.exitCode = 1;
});

function classifyFixtureError(error: unknown) {
  if (error instanceof Error && [
    "database_url_missing",
    "fixture_rollback_failed",
    "fixture_violation_counts_mismatch",
    "non_disposable_fixture_database_refused",
    "non_local_fixture_target_refused",
    "production_refused",
  ].includes(error.message)) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (/^[0-9A-Z]{5}$/.test(code)) return `postgres_${code}`;
  }
  return "fixture_smoke_failed";
}
