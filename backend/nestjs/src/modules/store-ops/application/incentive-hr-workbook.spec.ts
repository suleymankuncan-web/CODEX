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
  it("includes frozen package notes, signed returns, exact change amount and separately excluded personnel",()=>{
    const snapshot=hrTestSnapshot();snapshot.packages[0]={...snapshot.packages[0],submission_note:"=Literal BM note",
      store_details:[{storeId:"store-a",storeCode:"S1",storeName:"Store",target:"2000000",gross:"2050000",returns:"-100000",net:"1950000",achievement:"97.5"}],
      frozen_participation:[{storeId:"store-a",finalSnapshotId:"snapshot",participationRevisionNo:1,exclusions:[{employeeId:"person",displayName:"Excluded",positionCode:"SALES_ASSOCIATE",reasonNote:"=Literal exclusion"}]}]};
    snapshot.rows[0]={...snapshot.rows[0],raw_baseline:"1650.00",proposed_amount:"1800.25",gross_sales:"120000.00",signed_returns:"-10000.00"};
    const book=XLSX.read(buildIncentiveHrWorkbook("2026-09",snapshot.packages,snapshot.rows),{type:"buffer"});
    expect(book.Sheets["Personel Primleri"].O2.v).toBe(150.25);expect(book.Sheets["Personel Primleri"].P2.v).toBe(120000);expect(book.Sheets["Personel Primleri"].Q2.v).toBe(-10000);
    expect(book.Sheets["Mağaza Özeti"].H2.v).toBe(1950000);expect(book.Sheets["Prime Dahil Değildir"].H2.v).toBe(0);
    for(const [sheet,cell] of [["Paket Notları","C2"],["Prime Dahil Değildir","G2"]]) {expect(book.Sheets[sheet][cell].t).toBe("s");expect(book.Sheets[sheet][cell].f).toBeUndefined();}
  });
  it("adds money in cents without binary rounding drift", () => {
    expect(sumHrMoney(["0.10", "0.20", "-0.01"])).toBe("0.29");
    expect(sumHrMoney([])).toBe("0.00");
    expect(sumHrMoney(["-1.25"])).toBe("-1.25");
  });
  it("exports frozen signed net and zero payment without reusing gross sales", () => {
    const snapshot = hrTestSnapshot();
    snapshot.rows[0] = { ...snapshot.rows[0], actual_sales_amount: "-20000.1234", achievement_pct: "-20.0001",
      applied_rate: "0.0000", payable_amount: "0.00", final_amount: "0.00" };
    const workbook = XLSX.read(buildIncentiveHrWorkbook("2026-09", snapshot.packages, snapshot.rows), { type: "buffer" });
    const detail = workbook.Sheets["Personel Primleri"];
    expect(detail.H2.v).toBe(-20000.1234); expect(detail.I2.v).toBe(-20.0001);
    expect(detail.K2.v).toBe(0); expect(detail.L2.v).toBe(0);
    expect(workbook.Sheets["Müdür Özeti"].E3.v).toBe(0);
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
