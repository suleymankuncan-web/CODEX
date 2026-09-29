import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(join(root, "db/migrations/092_user_permission_assignment_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/092_user_permission_assignment_v1.rollback.sql"), "utf8");
const roleAssignmentRepositorySource = readFileSync(
  join(root, "backend/nestjs/src/modules/auth/auth-role-assignment-command.repository.ts"), "utf8",
);
const accessLifecycleRepositorySource = readFileSync(
  join(root, "backend/nestjs/src/modules/auth/access-lifecycle.repository.ts"), "utf8",
);

describe("user permission assignment schema", () => {
  it("persists allow-only, role-bound, non-overlapping scoped grants", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("ops.user_permission_assignment");
      expect(sql).toContain("effective_range TSTZRANGE");
      expect(sql).toContain("EXCLUDE USING gist");
      expect(sql).toContain("trg_user_permission_assignment_guard");
      expect(sql).toContain("ck_user_permission_approval_separation");
      expect(sql).toContain("ck_user_permission_no_self_grant");
      expect(sql).toContain("trg_role_permission_capability_guard");
      expect(sql).toContain("trg_user_permission_revocation_guard");
      expect(sql).toContain("trg_super_role_assignment_capability_guard");
      expect(sql).toContain("INCENTIVE_SALES_DIRECTOR_APPROVAL");
      expect(sql).toContain("INCENTIVE_GENERAL_MANAGER_APPROVAL");
    }
  });

  it("fails rollback after capability evidence exists", () => {
    expect(rollbackSql).toContain("cannot be rolled back after user capability grants exist");
    expect(rollbackSql).toContain("to_regclass('ops.user_permission_assignment')");
    expect(rollbackSql).toContain("092_user_permission_assignment_v1.sql");
  });

  it("revokes linked capabilities when roles or accounts close", () => {
    expect(roleAssignmentRepositorySource).toContain("Role assignment deactivated");
    expect(roleAssignmentRepositorySource).toContain("Super Admin assignment activated");
    expect(accessLifecycleRepositorySource).toContain("UPDATE ops.user_permission_assignment");
    expect(accessLifecycleRepositorySource).toContain("Account deactivated:");
  });
});
