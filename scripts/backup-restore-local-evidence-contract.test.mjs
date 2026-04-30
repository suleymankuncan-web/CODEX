import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const evidence = readFileSync(
  "docs/plans/backup-restore-drill-local-evidence-2026-04-30.md",
  "utf8",
);
const currentState = readFileSync("current-state.md", "utf8");
const activeNextActions = readFileSync("docs/plans/active-next-actions.md", "utf8");
const debtLedger = readFileSync("docs/plans/project-debt-ledger.md", "utf8");
const migration037 = readFileSync(
  "db/migrations/037_mobile_checklist_today_v1.sql",
  "utf8",
);
const migrationSchemaContract = readFileSync(
  "backend/nestjs/src/shared/database/migration-schema-contract.spec.ts",
  "utf8",
);

test("backup restore local evidence keeps the no production boundary", () => {
  assert.match(evidence, /Production database was not used\./);
  assert.match(evidence, /No raw `DATABASE_URL`, password, token/);
  assert.match(evidence, /store_ops_drill_source/);
  assert.match(evidence, /store_ops_restore_drill/);
});

test("backup restore local evidence records concrete restore proof", () => {
  assert.match(evidence, /applied=42/);
  assert.match(evidence, /failed=0/);
  assert.match(evidence, /218864 bytes/);
  assert.match(evidence, /audit=3/);
  assert.match(evidence, /ops=39/);
  assert.match(evidence, /rpt=10/);
  assert.match(evidence, /stg=12/);
  assert.match(evidence, /migration_rows=42/);
  assert.match(evidence, /succeeded=42/);
});

test("mobile checklist migration remains idempotent against current schema baseline", () => {
  assert.match(
    migration037,
    /DROP CONSTRAINT IF EXISTS checklist_template_code_version_unique/,
  );
  assert.match(
    migrationSchemaContract,
    /keeps mobile checklist migration idempotent against the current schema baseline/,
  );
});

test("backup restore local evidence is linked from handoff and debt docs", () => {
  assert.match(currentState, /Backup Restore Local Drill Evidence/);
  assert.match(activeNextActions, /Backup Restore Local Drill Evidence V1/);
  assert.match(debtLedger, /Closed active debts: 73/);
  assert.match(debtLedger, /73\. Backup Restore Local Drill Evidence V1/);
});
