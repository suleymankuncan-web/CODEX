import { readFileSync } from "node:fs";
import { join } from "node:path";
import { personnelKpiScoreProfile } from "./application/kpi-config.contract";
import { officialPersonnelRankingMinimumNetSalesValue } from "./application/personnel-ranking-eligibility.contract";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const seedSql = readFileSync(join(projectRoot, "db", "seeds", "001_reference_seed.sql"), "utf8");
const keycloakRealm = JSON.parse(
  readFileSync(join(projectRoot, "infra", "keycloak", "store-ops-realm.json"), "utf8"),
) as {
  users?: Array<{
    username?: string;
    attributes?: Record<string, string[]>;
  }>;
};

const seededDemoStoreIds = [
  "00000000-0000-0000-0000-000000000100",
  "00000000-0000-0000-0000-000000000101",
];
const seededDemoEmployees = [
  {
    employeeId: "00000000-0000-0000-0000-000000000201",
    externalRef: "DEMO-EMP-201",
  },
  {
    employeeId: "00000000-0000-0000-0000-000000000202",
    externalRef: "DEMO-EMP-202",
  },
  {
    employeeId: "00000000-0000-0000-0000-000000000203",
    externalRef: "DEMO-EMP-203",
  },
  {
    employeeId: "00000000-0000-0000-0000-000000000204",
    externalRef: "DEMO-EMP-204",
  },
];
const seededPersonnelKpiCodes = ["TARGET_ACHIEVEMENT", "ATV", "UPT"];
const storeMeSmokeEmployeeId = "00000000-0000-0000-0000-000000000202";
const expectedPersonnelWeights = new Map([
  ["TARGET_ACHIEVEMENT", 40],
  ["ATV", 30],
  ["UPT", 30],
]);

describe("demo performance seed contract", () => {
  it("keeps Keycloak demo users backed by seeded employees and stores", () => {
    for (const username of ["store.manager", "store.personnel", "region.manager", "admin.operator"]) {
      const user = keycloakRealm.users?.find((candidate) => candidate.username === username);

      expect(user?.attributes?.employee_id?.[0]).toBeDefined();

      const employeeRef = user?.attributes?.employee_id?.[0] ?? "";
      const scopedStoreIds = [
        ...(user?.attributes?.store_ids ?? []),
        ...(user?.attributes?.read_store_ids ?? []),
        ...(user?.attributes?.assigned_store_ids ?? []),
      ];

      expect(seedSql).toContain(employeeRef);

      for (const storeId of scopedStoreIds) {
        expect(seedSql).toContain(storeId);
      }
    }
  });

  it("seeds the monthly personnel KPI rows required by /store/me smoke checks", () => {
    for (const storeId of seededDemoStoreIds) {
      expect(seedSql).toContain(storeId);
    }

    for (const employee of seededDemoEmployees) {
      expect(seedSql).toContain(employee.employeeId);
      expect(seedSql).toContain(employee.externalRef);
    }

    for (const kpiCode of seededPersonnelKpiCodes) {
      expect(seedSql).toContain(kpiCode);
    }

    expect(seedSql).toContain("demo_seed");
    expect(seedSql).toContain("DATE '2026-04-01'");
    expect(seedSql).toContain("DATE '2026-04-30'");
  });

  it("seeds live scoring references required by /store/me smoke checks", () => {
    expect(seedSql).toContain("demo_live_personnel_scoring_actual");
    expect(seedSql).toContain("INSERT INTO ops.target_distribution_request");
    expect(seedSql).toContain("demo_live_target_distribution_request");
    expect(seedSql).toContain("INSERT INTO ops.personnel_target_reference");
    expect(seedSql).toContain("demo_live_personnel_target_reference");

    for (const primitiveMetricCode of ["NET_SALES", "TICKET_COUNT", "ITEM_COUNT"]) {
      expect(seedSql).toContain(`'${primitiveMetricCode}',`);
    }
  });

  it("keeps the /store/me smoke employee eligible for official personnel ranking", () => {
    const netSalesMatch = seedSql.match(
      new RegExp(
        `\\('${storeMeSmokeEmployeeId}'::uuid,\\s*'[^']+'::uuid,\\s*'NET_SALES',\\s*([0-9.]+)\\)`,
      ),
    );

    expect(netSalesMatch).not.toBeNull();
    expect(Number(netSalesMatch?.[1])).toBeGreaterThanOrEqual(
      officialPersonnelRankingMinimumNetSalesValue,
    );
  });

  it("seeds closed daily ranking snapshots required by /store/rankings browser checks", () => {
    expect(seedSql).toContain("demo_closed_ranking_runs");
    expect(seedSql).toContain("rpt.snapshot_run");
    expect(seedSql).toContain("rpt.employee_performance_snapshot");
    expect(seedSql).toContain("rpt.employee_kpi_snapshot");

    for (const closureDate of ["2026-04-22", "2026-04-23", "2026-04-24"]) {
      expect(seedSql).toContain(`DATE '${closureDate}'`);
    }

    for (const employee of seededDemoEmployees) {
      expect(seedSql).toContain(employee.employeeId);
    }

    expect(seedSql).toContain("demo_closed_ranking_seed");
  });

  it("keeps target distribution action tables in the canonical schema", () => {
    expect(schemaSql).toContain("CREATE TABLE ops.target_distribution_request");
    expect(schemaSql).toContain("idx_target_distribution_request_scope_status");
  });

  it("keeps personnel scoring defaults aligned with the demo self-performance surface", () => {
    const weights = new Map(
      personnelKpiScoreProfile.metrics.map((metric) => [metric.code, metric.weightPercent]),
    );

    for (const [code, expectedWeight] of expectedPersonnelWeights) {
      expect(weights.get(code)).toBe(expectedWeight);
    }

    expect([...weights.values()].reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });
});
