import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("REM-8 TARGET observation SQL contract", () => {
  const root = join(__dirname, "..", "..", "..");
  const observation = readFileSync(join(
    root, "db", "preflight", "rem8-target-constraint-observation-v1.sql",
  ), "utf8");
  const plan = readFileSync(join(
    root, "db", "preflight", "rem8-target-constraint-plan-v1.sql",
  ), "utf8");

  // Trace: FR-05..08; NFR-01..03, NFR-07; AC-02, AC-03; EC-05..10, EC-16.
  it("is read-only, aggregate-only, current-database scoped, and catalog-bound", () => {
    const complete = `${observation}\n${plan}`;
    expect(complete).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|COPY|CALL|DO)\b/i);
    expect(observation).toContain("activity.datname = pg_catalog.current_database()");
    expect(observation).toContain("lock.relation");
    expect(observation).toContain("idx_personnel_target_reference_active_unique");
    expect(observation).toContain("ck_target_distribution_employee_ids_unique_v1");
    expect(observation).not.toMatch(/["']pid["']/i);
    expect(plan).not.toMatch(/\bANALYZE\b/i);
  });

  it("checks pilot duplicates across the exact active unique-index key", () => {
    const pilotBlock = observation.slice(
      observation.indexOf("pilot_duplicate_groups AS"),
      observation.indexOf("non_array_rows AS"),
    );
    expect(pilotBlock).toContain("reference.employee_id");
    expect(pilotBlock).toContain("reference.period_start");
    expect(pilotBlock).toContain("reference.period_end");
    expect(pilotBlock).toContain("reference.target_type");
    expect(pilotBlock).not.toContain("source_request_id");
    expect(pilotBlock).toContain("reference.status = 'approved'");
    expect(pilotBlock).toContain("HAVING COUNT(*) > 1");
  });
});
