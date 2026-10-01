import { appendIncentiveHrContext } from "./incentive-hr-workbook-context";
import * as XLSX from "@e965/xlsx";
import type { HrExportRow, HrPackageRow } from "../infrastructure/incentive-hr-handoff.repository";

const positions: Record<string, string> = { STORE_MANAGER: "Mağaza Müdürü", ASSISTANT_MANAGER: "Mağaza Müdür Yardımcısı", SENIOR_SALES_CONSULTANT: "Uzman Satış Danışmanı", SALES_ASSOCIATE: "Satış Danışmanı", CASHIER: "Kasa Sorumlusu", STOCKROOM: "Depo Sorumlusu" };

export function sumHrMoney(values: string[]) {
  const cents = values.reduce((total, value) => total + BigInt(value.replace(".", "")), 0n);
  const digits = (cents < 0n ? -cents : cents).toString().padStart(3, "0");
  return `${cents < 0n ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function buildIncentiveHrWorkbook(period: string, packages: HrPackageRow[], rows: HrExportRow[]) {
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ["Dönem", "Bölge Müdürü", "Mağaza", "Personel", "Toplam Prim (TL)", "Onay Tarihi"],
    ...packages.map(item => {
      const people = rows.filter(row => row.package_id === item.package_id);
      return [period, item.manager_name, item.store_ids.length, people.length, Number(sumHrMoney(people.map(row => row.final_amount))), item.reviewed_at ?? ""];
    }),
    [period, "GENEL TOPLAM", new Set(packages.flatMap(item => item.store_ids)).size, rows.length, Number(sumHrMoney(rows.map(row => row.final_amount))), ""],
  ]);
  summary["!cols"] = [14, 26, 12, 12, 22, 28].map(wch => ({ wch }));
  const detail = XLSX.utils.aoa_to_sheet([
    ["Dönem", "Bölge Müdürü", "Mağaza Kodu", "Mağaza", "Personel", "Pozisyon", "Hedef (TL)", "Net Satış (TL)", "HG %", "Hesaplama Oranı", "Hesaplanan Prim (TL)", "Final Prim (TL)", "Düzeltme Notu", "Değişim Öncesi Prim (TL)", "Değişim Tutarı (TL)", "Toplam Satış (TL)", "İade Tutarı (TL)"],
    ...rows.map(row => [period, packages.find(item => item.package_id === row.package_id)?.manager_name ?? "", row.store_code, row.store_name, row.display_name ?? "—", positions[row.position_code] ?? row.position_code,
      nullableNumber(row.target_amount), nullableNumber(row.actual_sales_amount), nullableNumber(row.achievement_pct), nullableNumber(row.applied_rate), Number(row.payable_amount), Number(row.final_amount), row.reason_note ?? "", nullableNumber(row.raw_baseline ?? null), row.raw_baseline != null && row.proposed_amount != null ? Number(sumHrMoney([row.proposed_amount,row.raw_baseline.startsWith("-") ? row.raw_baseline.slice(1) : `-${row.raw_baseline}`])) : null, nullableNumber(row.gross_sales ?? null), nullableNumber(row.signed_returns ?? null)]),
  ]);
  detail["!cols"] = [14, 26, 18, 30, 26, 28, 20, 20, 12, 14, 22, 22, 50, 24, 24, 24, 24].map(wch => ({ wch }));
  detail["!autofilter"] = { ref: `A1:Q${rows.length + 1}` };
  // Text stays a string cell (including leading '='), never an Excel formula.
  for (let index = 2; index <= rows.length + 1; index++) {
    for (const column of ["G", "H", "K", "L", "N", "O", "P", "Q"]) if (detail[`${column}${index}`]) detail[`${column}${index}`].z = '#,##0.00';
    if (detail[`J${index}`]) detail[`J${index}`].z = '0.00%';
    if (detail[`I${index}`]) detail[`I${index}`].z = '0.00';
  }
  for (let index = 2; index <= packages.length + 2; index++) summary[`E${index}`].z = '#,##0.00';
  XLSX.utils.book_append_sheet(workbook, summary, "Müdür Özeti");
  XLSX.utils.book_append_sheet(workbook, detail, "Personel Primleri");
  const proof = XLSX.utils.aoa_to_sheet([
    ["Dönem", "Onay Süreci", "Şirket Onay Kaydı", "Revizyon", "Mühür"],
    ...packages.map(item => [period, item.approval_origin === "company_cycle" ? "Genel Müdür final onayı" : item.approval_origin === "legacy_approved" ? "Önceki süreçte onaylanmış kayıt" : "Belirtilmemiş",
      item.final_cycle_id ?? "", item.final_revision_no ?? "", item.final_seal_hash ?? ""]),
  ]);
  proof["!cols"] = [14, 36, 40, 12, 68].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, proof, "Onay Kaydı");
  appendIncentiveHrContext(workbook,period,packages);
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function nullableNumber(value: string | null) { return value === null ? null : Number(value); }
