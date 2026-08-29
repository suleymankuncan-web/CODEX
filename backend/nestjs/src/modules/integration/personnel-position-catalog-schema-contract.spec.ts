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
    ]) {
      expect(repository).toContain(`'${code}'`);
    }
    expect(repository).not.toContain("'DEMO_STORE_MANAGER'");
  });
});
