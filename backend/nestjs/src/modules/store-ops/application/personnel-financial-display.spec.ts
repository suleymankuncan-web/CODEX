import { createPersonnelDetailMapper } from './personnel-financial-display';
import { maskPersonnelRow } from './ranking-list.helpers';
import type { PersonnelRankingRow } from './ranking.contract';

const row = (employeeId: string, storeId = 'store-1') => ({
  employeeId, storeId, scoreValue: 70, visibility: 'detail', metrics: [],
}) as unknown as PersonnelRankingRow;
const period = { period_start: '2026-03-01', period_end: '2026-03-31' };

describe('personnel prim financial display', () => {
  it('binds verified prim facts by employee and store while preserving score and summary masking', async () => {
    const rows = [row('person-1'), row('person-2'), row('person-3')];
    const repository = { list: jest.fn(async () => [
      { store_id: 'store-1', employee_id: 'person-1', sale_amount: '1500', return_amount: '-500', net_amount: '1000' },
      { store_id: 'other-store', employee_id: 'person-2', sale_amount: '9999', return_amount: '-9999', net_amount: '0' },
      { store_id: 'store-1', employee_id: 'person-3', sale_amount: '1500', return_amount: '-500', net_amount: null },
    ]) };
    const mapper = await createPersonnelDetailMapper({
      repository: repository as never, period,
      access: { canSeeGlobalDetails: true, canSeeManagedStorePersonnelDetails: true },
      selectedRows: rows, managedRows: rows, currentEmployee: null,
      profileAccess: new Map([['person-1', true]]),
    });
    expect(mapper(rows[0]).sales).toEqual({ grossSales: '1500', signedReturns: '-500', netSales: '1000' });
    expect(mapper(rows[1]).sales).toBeNull();
    expect(mapper(rows[2]).sales).toBeNull();
    expect(rows.map(mapper).map(person => person.scoreValue)).toEqual(rows.map(person => person.scoreValue));
    expect(mapper(rows[0]).canOpenProfile).toBe(true);
    expect(maskPersonnelRow(mapper(rows[0]), 'summary')).not.toHaveProperty('sales');
    expect(repository.list).toHaveBeenCalledWith({ storeIds: ['store-1'], periodStart: '2026-03-01', throughDate: '2026-03-31' });
  });

  it('does not read summary-only scopes, but retains the existing current-person detail', async () => {
    const repository = { list: jest.fn(async () => []) };
    const input = {
      repository: repository as never, period,
      access: { canSeeGlobalDetails: false, canSeeManagedStorePersonnelDetails: false },
      selectedRows: [row('other', 'other-store')], managedRows: [row('managed', 'managed-store')],
      currentEmployee: null, profileAccess: new Map<string, boolean>(),
    };
    await createPersonnelDetailMapper(input);
    expect(repository.list).not.toHaveBeenCalled();
    await createPersonnelDetailMapper({ ...input, currentEmployee: row('self', 'self-store') });
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ storeIds: ['self-store'] }));
  });
});
