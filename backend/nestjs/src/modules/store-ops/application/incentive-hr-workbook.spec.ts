import * as XLSX from "@e965/xlsx";
import { buildIncentiveHrWorkbook, sumHrMoney } from "./incentive-hr-workbook";
import { hrTestSnapshot } from "./incentive-hr-handoff.fixture";

describe("HR incentive Excel", () => {
  it("exports approved totals, names, original rates and notes without formula execution", () => {
    const snapshot = hrTestSnapshot();
    const workbook = XLSX.read(buildIncentiveHrWorkbook("2026-09", snapshot.packages, snapshot.rows), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Müdür Özeti", "Personel Primleri", "Onay Kaydı"]);
    const summary = workbook.Sheets["Müdür Özeti"];
    const detail = workbook.Sheets["Personel Primleri"];
    expect(summary.C3.v).toBe(2); // Includes the submitted store with no personnel.
    expect(summary.E3.v).toBe(1800.25);
    expect(detail.B2.v).toBe("Ayşe Demir");
    expect(detail.J2.v).toBe(0.015);
    expect(detail.K2.v).toBe(1650);
    expect(detail.L2.v).toBe(1800.25);
    for (const key of ["E2", "M2"]) {
      expect(detail[key].t).toBe("s");
      expect(detail[key].f).toBeUndefined();
      expect(detail[key].v).toMatch(/^=/);
    }
  });
  it("adds money in cents without binary rounding drift", () => {
    expect(sumHrMoney(["0.10", "0.20", "-0.01"])).toBe("0.29");
    expect(sumHrMoney([])).toBe("0.00");
    expect(sumHrMoney(["-1.25"])).toBe("-1.25");
  });
  it.each(["company_cycle", "legacy_approved"] as const)("exports %s approval origin without fabricating a seal", approval_origin => {
    const snapshot = hrTestSnapshot();
    snapshot.packages[0] = { ...snapshot.packages[0], approval_origin,
      ...(approval_origin === "company_cycle" ? { final_cycle_id: "synthetic-cycle", final_revision_no: 2, final_seal_hash: "a".repeat(64) } : {}) };
    const workbook = XLSX.read(buildIncentiveHrWorkbook("2026-09", snapshot.packages, snapshot.rows), { type: "buffer" });
    const proof = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Onay Kaydı"], { header: 1 });
    expect(proof[1]).toEqual(["2026-09", approval_origin === "company_cycle" ? "Genel Müdür final onayı" : "Önceki süreçte onaylanmış kayıt",
      approval_origin === "company_cycle" ? "synthetic-cycle" : "", approval_origin === "company_cycle" ? 2 : "", approval_origin === "company_cycle" ? "a".repeat(64) : ""]);
  });
  it("exports an all-excluded package with its stores and zero payment total", () => {
    const snapshot = hrTestSnapshot();
    const workbook = XLSX.read(buildIncentiveHrWorkbook("2026-09", snapshot.packages, []), { type: "buffer" });
    expect(workbook.Sheets["Müdür Özeti"].E3.v).toBe(0);
    expect(workbook.Sheets["Müdür Özeti"].C3.v).toBe(2);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["Personel Primleri"])).toEqual([]);
  });
});
