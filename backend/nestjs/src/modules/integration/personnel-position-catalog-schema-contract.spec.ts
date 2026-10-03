import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(__dirname, "../../../../..");

describe("personnel position catalog contract", () => {
  it("migrates the five Turkish retail positions and remaps legacy demo assignments", () => {
    const migration = readFileSync(
      resolve(repositoryRoot, "db/migrations/073_personnel_position_catalog_tr_v1.sql"),
      "utf8",
    );

    for (const label of [
      "Mağaza Müdürü",
      "Mağaza Müdür Yardımcısı",
      "Uzman Satış Danışmanı",
      "Satış Danışmanı",
      "Kasa Sorumlusu",
    ]) {
      expect(migration).toContain(label);
    }
    expect(migration).toContain("'DEMO_STORE_MANAGER'");
    expect(migration).toContain("'DEMO_STORE_PERSONNEL'");
  });

  it("repairs late-created company catalogs without rewriting personnel or access assignments", () => {
    const migration = readFileSync(
      resolve(repositoryRoot, "db/migrations/104_personnel_position_catalog_repair_v1.sql"),
      "utf8",
    );
    for (const [code, label] of [
      ["STORE_MANAGER", "Mağaza Müdürü"],
      ["ASSISTANT_MANAGER", "Mağaza Müdür Yardımcısı"],
      ["SENIOR_SALES_CONSULTANT", "Uzman Satış Danışmanı"],
      ["SALES_ASSOCIATE", "Satış Danışmanı"],
      ["CASHIER", "Kasa Sorumlusu"],
      ["WAREHOUSE_SUPERVISOR", "Depo Sorumlusu"],
    ]) {
      expect(migration).toContain(`'${code}', '${label}'`);
    }
    expect(migration).toContain("FROM ops.company company");
    expect(migration).toContain("ON CONFLICT (company_id, position_code)");
    expect(migration).not.toMatch(/\b(?:DELETE|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/\b(?:UPDATE|INSERT INTO)\s+ops\.(?:employee|employee_assignment_history|user_role_assignment|user_action_store_assignment)\b/i);
  });

  it("limits personnel lookup choices to the canonical catalog", () => {
    const repository = readFileSync(
      resolve(
        repositoryRoot,
        "backend/nestjs/src/modules/integration/infrastructure/personnel-master-read.repository.ts",
      ),
      "utf8",
    );

    for (const code of [
      "STORE_MANAGER",
      "ASSISTANT_MANAGER",
      "SENIOR_SALES_CONSULTANT",
      "SALES_ASSOCIATE",
      "CASHIER",
      "WAREHOUSE_SUPERVISOR",
    ]) {
      expect(repository).toContain(`'${code}'`);
    }
    expect(repository).not.toContain("'DEMO_STORE_MANAGER'");
  });
});
