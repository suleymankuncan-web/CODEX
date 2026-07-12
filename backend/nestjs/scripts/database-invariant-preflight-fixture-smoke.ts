import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { mapCheckResult, type CheckRow } from "./database-invariant-preflight-core";
import { validateDiagnosticQueryResult } from "./staging-remediation-diagnostic-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";

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
  "ORG-03": 3,
  "ORG-04": 4,
  "TARGET-01": 1,
  "TARGET-02": 2,
  "TARGET-03": 1,
};

async function main() {
  const connectionString = readDisposableDatabaseUrl();
  const preflightQuery = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "database-invariant-preflight-v1.sql"),
    "utf8",
  );
  const remediationDiagnosticQuery = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-diagnostic-v1.sql"),
    "utf8",
  );
  const remediationInvariantV2Query = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-invariant-v2.sql"),
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
    // Trace: FR-DIAG-01..07; AC-01, AC-02; EC-01, EC-04, EC-08.
    const diagnosticRows = await client.query<{ diagnostic: unknown }>(remediationDiagnosticQuery);
    const diagnostic = validateDiagnosticQueryResult(diagnosticRows.rows[0]?.diagnostic);
    const diagnosticFamilyTotals = Object.fromEntries(
      diagnostic.familyTotals.map((item) => [item.family, item.hitCount]),
    );
    if (JSON.stringify(diagnosticFamilyTotals) !== JSON.stringify({
      "ASSIGN-01": 1,
      "ORG-02": 2,
      "ORG-04": 4,
      "TARGET-02": 2,
    })) {
      throw new Error("fixture_diagnostic_bucket_counts_mismatch");
    }

    fixturePhase = "invariant_v2_query";
    const invariantRows = await client.query<{ invariant: unknown }>(remediationInvariantV2Query);
    const invariantV2 = validateInvariantV2QueryResult(invariantRows.rows[0]?.invariant);
    const invariantV2FamilyTotals = Object.fromEntries(
      invariantV2.familyTotals.map((item) => [item.family, item.hitCount]),
    );
    if (JSON.stringify(invariantV2FamilyTotals) !== JSON.stringify({
      "ASSIGN-01": 1,
      "ORG-02": 2,
      "ORG-04": 3,
      "TARGET-02": 1,
    })) {
      throw new Error("fixture_v2_family_counts_mismatch");
    }
    const expectedBridge = {
      "ASSIGN-01": [1, 1, 1, 0, 0],
      "ORG-02": [2, 2, 2, 0, 0],
      "ORG-04": [4, 3, 2, 2, 1],
      "TARGET-02": [2, 1, 1, 1, 0],
    } as const;
    if (invariantV2.bridge.some((item) => {
      const expected = expectedBridge[item.family];
      return JSON.stringify([
        item.v1HitCount,
        item.v2HitCount,
        item.carriedForwardCount,
        item.revisedValidCount,
        item.v2NewCount,
      ]) !== JSON.stringify(expected);
    })) {
      throw new Error("fixture_v2_bridge_mismatch");
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
      diagnosticFamilyTotals,
      invariantV2FamilyTotals,
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
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("database_url_missing");
  const parsed = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("invalid_database_protocol");
  }
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

  INSERT INTO ops.region (region_id, company_id, region_code, region_name)
  VALUES ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
    'PREFLIGHT_RC', 'Preflight RC');

  INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
  VALUES ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001', 'PREFLIGHT_STORE_2', 'Preflight Store 2', 'company');

  INSERT INTO ops.position (position_id, company_id, position_code, position_name)
  VALUES ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
    'PREFLIGHT_POSITION_2', 'Preflight Position 2');

  INSERT INTO ops.employee (employee_id, company_id, first_name, last_name, hire_date, employment_type)
  VALUES ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
    'Fixture', 'Employee Two', DATE '2025-01-01', 'full_time');

  INSERT INTO ops.user_account (user_id, username, email)
  VALUES ('70000000-0000-4000-8000-000000000002', 'preflight_manager', 'preflight_manager');

  INSERT INTO ops.user_role_assignment
    (user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id, start_at)
  SELECT
    '90000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000002',
    role_id,
    'store',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    TIMESTAMPTZ '2026-07-01 00:00:00+00'
  FROM ops.role
  WHERE role_code = 'REGION_MANAGER';

  INSERT INTO ops.target_distribution_request
    (target_distribution_request_id, company_id, region_id, store_id, request_month, target_label,
      total_target_value, allocation_count, request_status, allocation_json, submitted_by_user_id)
  VALUES ('a0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
    DATE '2026-07-01', 'pilot_imported_personnel_targets', 100, 1, 'approved', '[]'::jsonb,
    'preflight-fixture');

  INSERT INTO ops.personnel_target_reference
    (personnel_target_reference_id, source_request_id, company_id, region_id, store_id, employee_id,
      period_start, period_end, target_value, status, approved_by_user_id, approved_at)
  VALUES ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002',
    DATE '2026-07-01', DATE '2026-07-31', 100, 'approved',
    '70000000-0000-4000-8000-000000000002', TIMESTAMPTZ '2026-07-01 00:00:00+00');

  INSERT INTO ops.kpi_actual
    (kpi_actual_id, kpi_id, scope_type, company_id, region_id, store_id, period_type,
      period_start, period_end, actual_value, source_type)
  SELECT 'c0000000-0000-4000-8000-000000000001', kpi_id, 'store',
    '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002', 'monthly', DATE '2026-07-01', DATE '2026-07-31',
    10, 'preflight_fixture'
  FROM ops.kpi_definition
  ORDER BY kpi_id
  LIMIT 1;

  INSERT INTO ops.workforce_norm_plan
    (norm_plan_id, company_id, region_id, store_id, position_id, period_start, period_end,
      planned_headcount, planned_fte, approved_by, approved_at)
  VALUES
    ('d0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002', DATE '2026-01-01', DATE '2026-01-31', 5, 5,
      '70000000-0000-4000-8000-000000000002', TIMESTAMPTZ '2026-01-01 00:00:00+00'),
    ('d0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002', DATE '2026-07-01', DATE '2026-07-31', 5, 5,
      '70000000-0000-4000-8000-000000000002', TIMESTAMPTZ '2026-07-01 00:00:00+00');
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
    "fixture_diagnostic_bucket_counts_mismatch",
    "fixture_rollback_failed",
    "fixture_v2_bridge_mismatch",
    "fixture_v2_family_counts_mismatch",
    "fixture_violation_counts_mismatch",
    "invalid_database_protocol",
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
