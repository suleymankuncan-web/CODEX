import type { HrExportRow, HrPackageRow } from '../infrastructure/incentive-hr-handoff.repository';
export const incentivePositionNames: Record<string, string> = {
  STORE_MANAGER: 'Mağaza Müdürü', ASSISTANT_MANAGER: 'Mağaza Müdür Yardımcısı',
  SENIOR_SALES_CONSULTANT: 'Uzman Satış Danışmanı', SALES_ASSOCIATE: 'Satış Danışmanı',
  CASHIER: 'Kasa Sorumlusu', STOCKROOM: 'Depo Sorumlusu',
};
/** Notes and exclusions come only from immutable approval context. */
export function incentiveWorkbookComment(row: HrExportRow, pack: HrPackageRow | undefined) {
  const comments = [row.reason_note?.trim(), pack?.submission_note?.trim() ? `Paket notu: ${pack.submission_note.trim()}` : null];
  if (row.raw_baseline != null && row.proposed_amount != null) {
    // Use the archived proposal delta, without recalculating a payment.
    const cents = (value: string) => BigInt(value.replace('.', ''));
    const delta = cents(row.proposed_amount) - cents(row.raw_baseline);
    const digits = (delta < 0n ? -delta : delta).toString().padStart(3, '0');
    comments.push(`Tutar değişikliği: ${delta < 0n ? '-' : '+'}${digits.slice(0, -2)}.${digits.slice(-2)} TL`);
  }
  return comments.filter(Boolean).join('\n');
}
export function incentiveExcludedWorkbookRows(packages: HrPackageRow[]) {
  return packages.flatMap(pack => (pack.frozen_participation ?? []).flatMap(participation => participation.exclusions.map(person => {
    const store = pack.store_details?.find(item => item.storeId === participation.storeId);
    const comment = ['Prime dahil değildir', person.reasonNote, pack.submission_note?.trim() ? `Paket notu: ${pack.submission_note.trim()}` : null].filter(Boolean).join('\n');
    // No authoritative per-person amounts are archived for excluded personnel.
    return [pack.manager_name, store?.storeName ?? participation.storeId, person.displayName,
      incentivePositionNames[person.positionCode] ?? person.positionCode, null, null, null, null, null, null, 0, 0, comment];
  })));
}
