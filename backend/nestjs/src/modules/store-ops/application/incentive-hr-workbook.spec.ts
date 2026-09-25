import * as XLSX from "@e965/xlsx";
import { buildIncentiveHrWorkbook, sumHrMoney } from "./incentive-hr-workbook";
import { hrTestSnapshot } from "./incentive-hr-handoff.fixture";

describe("HR incentive Excel", () => {
  it("exports approved totals, names, original rates and notes without formula execution", () => {
    const snapshot = hrTestSnapshot();
    const workbook = XLSX.read(buildIncentiveHrWorkbook("2026-09", snapshot.packages, snapshot.rows), { type: "buffer" });
    expect(workbook.SheetNames).toEqual(["Müdür Özeti", "Personel Primleri"]);
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
});
