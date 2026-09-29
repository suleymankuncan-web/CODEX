import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const migrationSql = readFileSync(join(root, "db/migrations/091_role_catalog_simplification_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/091_role_catalog_simplification_v1.rollback.sql"), "utf8");
const seedSql = readFileSync(join(root, "db/seeds/001_reference_seed.sql"), "utf8");

describe("role catalog simplification schema", () => {
  it("removes obsolete roles without auto-promoting assigned users", () => {
    expect(migrationSql).toContain("Removed roles still have user assignments");
    expect(migrationSql).toContain("'AUDITOR', 'INTEGRATION_ADMIN', 'SNAPSHOT_OPERATOR'");
    expect(migrationSql).toContain("'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER'");
    expect(migrationSql).toContain("WHERE super_role.role_code = 'SUPER_ADMIN'");
    expect(migrationSql).toContain("DELETE FROM ops.role");
  });

  it("provides a bounded rollback for the retired catalog", () => {
    expect(rollbackSql).toContain("IN ACCESS EXCLUSIVE MODE");
    expect(rollbackSql).toContain("'60000000-0000-0000-0000-000000000004', 'AUDITOR'");
    expect(rollbackSql).toContain("091_role_catalog_simplification_v1.sql");
  });

  it("keeps the schema-plus-seed path at seven roles with Super Admin VM grants", () => {
    for (const roleCode of [
      "SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER",
      "STORE_MANAGER", "STORE_PERSONNEL", "VISUAL_MERCHANDISER",
    ]) {
      expect(seedSql).toContain(`'${roleCode}'`);
    }
    for (const retiredRoleCode of ["INTEGRATION_ADMIN", "SNAPSHOT_OPERATOR", "VM_REFERENCE_PUBLISHER"]) {
      expect(seedSql).not.toContain(`'${retiredRoleCode}'`);
    }
    for (const permissionSuffix of ["021", "022", "023", "024", "025"]) {
      expect(seedSql).toContain(`'70000000-0000-0000-0000-000000000${permissionSuffix}'`);
    }
    expect(seedSql).toContain("Reads assigned store checklist and performance surfaces for VM pilot work");
    for (const permissionSuffix of ["001", "002", "004", "006"]) {
      expect(seedSql).toContain(
        `'60000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000${permissionSuffix}'`,
      );
    }
  });
});
