import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("company daily returns V2 canonical schema mirror", () => {
  it("retains the complete return persistence section of migration 096", () => {
    const schema = readFileSync(resolve(process.cwd(), "../../db/schema.sql"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "../../db/migrations/096_store_aware_kpi_returns_v2.sql"), "utf8");
    const marker = "ALTER TABLE ops.company_daily_kpi_component_outcome\n    ADD COLUMN IF NOT EXISTS return_attribution_version";
    const section = migration.slice(migration.indexOf(marker)).trim();
    const start = schema.indexOf(marker);
    expect(migration.indexOf(marker)).toBeGreaterThanOrEqual(0);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(schema.slice(start, start + section.length)).toBe(section);
  });
});
