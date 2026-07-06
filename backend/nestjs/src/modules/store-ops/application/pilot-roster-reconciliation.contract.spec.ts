import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildRosterReconciliationDryRun,
  classifyEmployeeCode,
  classifyRole,
  classifySpecialStore,
  normalizeRosterReconciliationRow,
  type RawRosterReconciliationInput,
} from "./pilot-roster-reconciliation.contract";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "059_pilot_roster_reconciliation_staging.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("pilot roster reconciliation contract", () => {
  it("keeps reconciliation staging isolated from product table writes", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS stg.roster_reconciliation_input");
      expect(sql).toContain("source_kind TEXT NOT NULL");
      expect(sql).toContain("source_period TEXT NOT NULL DEFAULT ''");
      expect(sql).toContain("raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB");
      expect(sql).toContain("normalized_store_key TEXT NOT NULL DEFAULT ''");
      expect(sql).toContain("normalized_employee_key TEXT NOT NULL DEFAULT ''");
      expect(sql).toContain("UNIQUE (source_file, source_sheet, source_kind, source_period, row_number)");
      expect(sql).toContain("idx_roster_reconciliation_period_kind");
      expect(sql).toContain("idx_roster_reconciliation_status");
      expect(sql).not.toContain("INSERT INTO ops.store");
      expect(sql).not.toContain("INSERT INTO ops.employee");
      expect(sql).not.toContain("UPDATE ops.store");
      expect(sql).not.toContain("UPDATE ops.employee");
    }
  });

  it("classifies source code families, roles, and temporary store names", () => {
    expect(classifyEmployeeCode("FM34501")).toBe("dealer_fm");
    expect(classifyEmployeeCode("DNMSL4693")).toBe("company_or_operator");
    expect(classifyEmployeeCode("4139")).toBe("company_or_operator");
    expect(classifyEmployeeCode("")).toBe("missing");

    expect(classifyRole("MAĞAZA MÜDÜRÜ")).toBe("store_manager");
    expect(classifyRole("MAĞAZA MÜDÜR YARDIMCISI")).toBe("assistant_manager");
    expect(classifyRole("Kasiyer")).toBe("cashier");
    expect(classifyRole("Moda Danışmanı")).toBe("sales_personnel");

    expect(classifySpecialStore("Eyüp Axis Pop Up")).toBe("pop_up");
    expect(classifySpecialStore("Merkez Garaj")).toBe("garage");
    expect(classifySpecialStore("Sezon Çadır")).toBe("tent");
  });

  it("marks risky source mismatches as review required", () => {
    expect(
      normalizeRosterReconciliationRow({
        sourceFile: "yeni.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "current_roster",
        rowNumber: 1,
        rawStoreName: "Balıkesir 10 Burda AVM",
        rawEmployeeCode: "FM123",
        rawEmployeeName: "Demo Personel",
      }).matchStatus,
    ).toBe("review_required");

    expect(
      normalizeRosterReconciliationRow({
        sourceFile: "lis.xlsx",
        sourceSheet: "Sayfa1",
        sourceKind: "dealer_roster",
        rowNumber: 1,
        rawStoreName: "Bayi Mağaza",
        rawEmployeeCode: "4139",
        rawEmployeeName: "Demo Personel",
      }).matchNotes,
    ).toContain("dealer_file_non_fm_code");
  });

  it("summarizes active roster, target matches, leavers, managers, and cashiers", () => {
    const rows: RawRosterReconciliationInput[] = [
      {
        sourceFile: "yeni.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "current_roster",
        rowNumber: 14,
        rawStoreName: "Alanya Akdeniz Park AVM",
        rawEmployeeCode: "4139",
        rawEmployeeName: "Önder Sağıroğlu",
        rawPositionName: "MAĞAZA MÜDÜRÜ",
      },
      {
        sourceFile: "yeni.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "current_roster",
        rowNumber: 15,
        rawStoreName: "Alanya Akdeniz Park AVM",
        rawEmployeeCode: "4207",
        rawEmployeeName: "Zinet Yağmur",
        rawPositionName: "MODA DANIŞMANI",
      },
      {
        sourceFile: "yeni.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "current_roster",
        rowNumber: 16,
        rawStoreName: "Alanya Akdeniz Park AVM",
        rawEmployeeCode: "4801",
        rawEmployeeName: "Kasa Sorumlusu",
        rawPositionName: "Kasiyer",
      },
      {
        sourceFile: "HaziranAyı Peronel Hedefleri.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "target",
        sourcePeriod: "2026-06",
        rowNumber: 2,
        rawStoreName: "Alanya Akdeniz Park",
        rawEmployeeName: "Zinet Yağmur",
        targetAmount: 1000000,
      },
      {
        sourceFile: "Mayıs Ayı Peronel Hedefleri.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "target",
        sourcePeriod: "2026-05",
        rowNumber: 2,
        rawStoreName: "Alanya Akdeniz Park",
        rawEmployeeName: "Ayrılmış Personel",
        targetAmount: 800000,
      },
      {
        sourceFile: "HaziranAyı Peronel Hedefleri.xlsx",
        sourceSheet: "Sheet",
        sourceKind: "target",
        sourcePeriod: "2026-06",
        rowNumber: 3,
        rawStoreName: "Eyüp Axis Pop Up",
        rawEmployeeName: "Geçici Personel",
        targetAmount: 500000,
      },
      {
        sourceFile: "Mayıs personel.xlsx",
        sourceSheet: "Export",
        sourceKind: "sales_kpi",
        sourcePeriod: "2026-05",
        rowNumber: 4,
        rawStoreName: "Alanya Akdeniz Park AVM",
        rawEmployeeName: "Satışta Var Ayrılmış",
        netSalesAmount: 120000,
      },
      {
        sourceFile: "Mayıs personel.xlsx",
        sourceSheet: "Export",
        sourceKind: "sales_kpi",
        sourcePeriod: "2026-05",
        rowNumber: 5,
        rawStoreName: "Dış Mağaza",
        rawEmployeeName: "Dış Personel",
        netSalesAmount: 120000,
      },
    ];

    const summary = buildRosterReconciliationDryRun(rows);

    expect(summary.totals.activeCompanyRoster).toBe(3);
    expect(summary.totals.storeManagers).toBe(1);
    expect(summary.totals.cashiers).toBe(1);
    expect(summary.totals.targetRows).toBe(3);
    expect(summary.totals.matchedTargets).toBe(1);
    expect(summary.totals.monthlyLeavers).toBe(1);
    expect(summary.sections.riskyMatches.some((row) => row.rawStoreName === "Eyüp Axis Pop Up"))
      .toBe(true);
  });
});
