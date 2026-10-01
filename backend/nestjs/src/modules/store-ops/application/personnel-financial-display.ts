import type { StorePositiveSellersReadRepository } from '../infrastructure/store-positive-sellers-read.repository';
import type { RankingAccess } from './ranking-access.policy';
import type { PersonnelRankingRow } from './ranking.contract';

/** Detail amounts reuse accepted prim V2 facts, never all ledger returns for a person. */
export async function createPersonnelDetailMapper(input: {
  repository?: StorePositiveSellersReadRepository;
  period: { period_start: string; period_end: string };
  access: Pick<RankingAccess, 'canSeeGlobalDetails' | 'canSeeManagedStorePersonnelDetails'>;
  selectedRows: PersonnelRankingRow[];
  managedRows: PersonnelRankingRow[];
  currentEmployee: PersonnelRankingRow | null;
  profileAccess: Map<string, boolean>;
}) {
  const detailRows = [
    ...(input.access.canSeeGlobalDetails ? input.selectedRows : []),
    ...(input.access.canSeeManagedStorePersonnelDetails ? input.managedRows : []),
    ...(input.currentEmployee ? [input.currentEmployee] : []),
  ];
  const storeIds = [...new Set(detailRows.flatMap(row => row.storeId ? [row.storeId] : []))];
  const financialRows = input.repository && storeIds.length
    ? await input.repository.list({ storeIds, periodStart: input.period.period_start, throughDate: input.period.period_end })
    : [];
  const financialByPersonStore = new Map(financialRows.filter(row => row.employee_id && row.net_amount !== null)
    .map(row => [`${row.employee_id}|${row.store_id}`, row]));
  return (row: PersonnelRankingRow): PersonnelRankingRow => {
    const financial = financialByPersonStore.get(`${row.employeeId}|${row.storeId}`);
    return {
      ...row,
      canOpenProfile: input.profileAccess.get(row.employeeId) ?? false,
      sales: financial ? { grossSales: financial.sale_amount, signedReturns: financial.return_amount, netSales: financial.net_amount } : null,
    };
  };
}
