import * as XLSX from '@e965/xlsx';
import type { HrExportRow, HrPackageRow } from '../infrastructure/incentive-hr-handoff.repository';
import { incentiveExcludedWorkbookRows, incentivePositionNames, incentiveWorkbookComment } from './incentive-hr-workbook-context';

export const incentiveWorkbookHeaders = ['Bölge Müdürü', 'Mağaza', 'İlgili Kişi', 'Pozisyon', 'Hedef', 'Toplam Satış', 'Toplam İade',
  'Net Satış', 'HG%', 'Hakediş Oranı', 'Hesaplanan Tutar', 'Final Tutar', 'Yorum'];

export function sumHrMoney(values: string[]) {
  const cents = values.reduce((total, value) => total + BigInt(value.replace('.', '')), 0n);
  const digits = (cents < 0n ? -cents : cents).toString().padStart(3, '0');
  return `${cents < 0n ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function buildIncentiveHrWorkbook(period: string, packages: HrPackageRow[], rows: HrExportRow[]) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('incentive_workbook_period_invalid');
  const values = rows.map(row => {
    const pack = packages.find(item => item.package_id === row.package_id && item.company_id === row.company_id);
    const achievement = nullableNumber(row.achievement_pct);
    return [pack?.manager_name ?? '', row.store_name, row.display_name ?? '—', incentivePositionNames[row.position_code] ?? row.position_code,
      nullableNumber(row.target_amount), nullableNumber(row.gross_sales), nullableNumber(row.signed_returns), nullableNumber(row.actual_sales_amount),
      achievement === null ? null : achievement / 100, nullableNumber(row.applied_rate), Number(row.payable_amount), Number(row.final_amount),
      incentiveWorkbookComment(row, pack)];
  });
  const excluded = incentiveExcludedWorkbookRows(packages);
  const detail = XLSX.utils.aoa_to_sheet([incentiveWorkbookHeaders, ...values, ...excluded]);
  detail['!cols'] = [26, 30, 26, 28, 20, 20, 20, 20, 12, 16, 22, 22, 70].map(wch => ({ wch }));
  const lastRow = 1 + values.length + excluded.length;
  detail['!autofilter'] = { ref: `A1:M${lastRow}` };
  for (let index = 2; index <= lastRow; index++) {
    for (const column of ['E', 'F', 'G', 'H', 'K', 'L']) if (detail[`${column}${index}`]) detail[`${column}${index}`].z = '#,##0.00';
    for (const column of ['I', 'J']) if (detail[`${column}${index}`]) detail[`${column}${index}`].z = '0.00%';
  }
  // AOA text stays literal string cells, including leading '='; it never becomes a formula.
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, detail, 'Personel Primleri');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}
function nullableNumber(value: string | null | undefined) { return value == null ? null : Number(value); }
