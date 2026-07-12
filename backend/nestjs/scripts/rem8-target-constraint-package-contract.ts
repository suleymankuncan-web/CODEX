import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "./staging-remediation-diagnostic-contract";

export const CANDIDATE_FUNCTION_SIGNATURE =
  "ops.target_distribution_employee_ids_unique_v1(jsonb)" as const;
export const CANDIDATE_CONSTRAINT_NAME =
  "ck_target_distribution_employee_ids_unique_v1" as const;

export type Rem8TargetConstraintSql = {
  addConstraint: string;
  createFunction: string;
  rollback: string;
  validateConstraint: string;
};

export type Rem8TargetConstraintPackage = {
  addLock: "access_exclusive";
  constraintName: typeof CANDIDATE_CONSTRAINT_NAME;
  digests: {
    addConstraint: string;
    createFunction: string;
    rollback: string;
    validateConstraint: string;
  };
  functionSignature: typeof CANDIDATE_FUNCTION_SIGNATURE;
  indexStrategy: "not_applicable_no_index_candidate";
  sql: Rem8TargetConstraintSql;
  validateLock: "share_update_exclusive";
};

const packageRoot = join(
  __dirname,
  "..",
  "..",
  "..",
  "db",
  "constraint-packages",
  "rem8-target-duplicate-v1",
);

// Trace: FR-01..04, FR-17; NFR-04, NFR-05; AC-01, AC-08; EC-01..06.
export function loadRem8TargetConstraintPackage(): Rem8TargetConstraintPackage {
  return validateRem8TargetConstraintPackage({
    addConstraint: readFileSync(join(packageRoot, "002_add_constraint_not_valid.sql"), "utf8"),
    createFunction: readFileSync(join(packageRoot, "001_create_function.sql"), "utf8"),
    rollback: readFileSync(join(packageRoot, "rollback.sql"), "utf8"),
    validateConstraint: readFileSync(join(packageRoot, "003_validate_constraint.sql"), "utf8"),
  });
}

export function validateRem8TargetConstraintPackage(
  sql: Rem8TargetConstraintSql,
): Rem8TargetConstraintPackage {
  if (/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i.test(sql.createFunction)) {
    fail("candidate_function_replace_refused");
  }
  const complete = Object.values(sql).join("\n");
  if (/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(complete)) fail("candidate_index_refused");
  if (/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO)\b/i.test(complete)) {
    fail("candidate_sql_scope_violation");
  }
  requireFragments(sql.createFunction, [
    "CREATE FUNCTION ops.target_distribution_employee_ids_unique_v1(allocation JSONB)",
    "RETURNS BOOLEAN",
    "LANGUAGE SQL",
    "IMMUTABLE",
    "STRICT",
    "PARALLEL SAFE",
    "SET search_path = pg_catalog",
    "pg_catalog.jsonb_array_elements(allocation)",
    "pg_catalog.lower(entry.item ->> 'employeeId')",
    "HAVING pg_catalog.count(*) > 1",
  ], "candidate_function_mismatch");
  if (statementCount(sql.createFunction) !== 1) fail("candidate_function_mismatch");

  if (!/\bNOT\s+VALID\s*;/i.test(sql.addConstraint)) fail("candidate_not_valid_required");
  requireFragments(sql.addConstraint, [
    "ALTER TABLE ops.target_distribution_request",
    `ADD CONSTRAINT ${CANDIDATE_CONSTRAINT_NAME}`,
    "CHECK (ops.target_distribution_employee_ids_unique_v1(allocation_json))",
    "NOT VALID",
  ], "candidate_constraint_mismatch");
  if (statementCount(sql.addConstraint) !== 1) fail("candidate_constraint_mismatch");

  requireFragments(sql.validateConstraint, [
    "ALTER TABLE ops.target_distribution_request",
    `VALIDATE CONSTRAINT ${CANDIDATE_CONSTRAINT_NAME}`,
  ], "candidate_validation_mismatch");
  if (statementCount(sql.validateConstraint) !== 1) fail("candidate_validation_mismatch");

  const dropConstraint = sql.rollback.indexOf(
    `DROP CONSTRAINT ${CANDIDATE_CONSTRAINT_NAME}`,
  );
  const dropFunction = sql.rollback.indexOf(
    "DROP FUNCTION ops.target_distribution_employee_ids_unique_v1(JSONB)",
  );
  if (dropConstraint < 0 || dropFunction <= dropConstraint || statementCount(sql.rollback) !== 2) {
    fail("candidate_rollback_mismatch");
  }

  return {
    addLock: "access_exclusive",
    constraintName: CANDIDATE_CONSTRAINT_NAME,
    digests: {
      addConstraint: sha256Hex(sql.addConstraint),
      createFunction: sha256Hex(sql.createFunction),
      rollback: sha256Hex(sql.rollback),
      validateConstraint: sha256Hex(sql.validateConstraint),
    },
    functionSignature: CANDIDATE_FUNCTION_SIGNATURE,
    indexStrategy: "not_applicable_no_index_candidate",
    sql,
    validateLock: "share_update_exclusive",
  };
}

function requireFragments(value: string, fragments: string[], error: string) {
  if (fragments.some((fragment) => !value.includes(fragment))) fail(error);
}

function statementCount(value: string) {
  return value
    .replace(/\$function\$[\s\S]*?\$function\$/g, "")
    .split(";")
    .filter((item) => item.trim()).length;
}

function fail(message: string): never {
  throw new Error(message);
}
