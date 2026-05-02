import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const workspaceRoot = join(import.meta.dirname, "..");
const seedSql = readFileSync(
  join(workspaceRoot, "db", "seeds", "001_reference_seed.sql"),
  "utf8",
);
const migrationSql = readdirSync(join(workspaceRoot, "db", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .map((file) =>
    readFileSync(join(workspaceRoot, "db", "migrations", file), "utf8"),
  )
  .join("\n");

test("default Power BI KPI source is present for Excel export upload", () => {
  for (const sql of [seedSql, migrationSql]) {
    assert.match(sql, /power-bi-kpi/i);
    assert.match(sql, /power_bi/i);
    assert.match(sql, /closed_period/i);
  }
});
