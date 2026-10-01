import * as XLSX from '@e965/xlsx';
import { buildIncentiveHrWorkbook, sumHrMoney } from './incentive-hr-workbook';
import { hrTestSnapshot } from './incentive-hr-handoff.fixture';
const headers = ['Bölge Müdürü', 'Mağaza', 'İlgili Kişi', 'Pozisyon', 'Hedef', 'Toplam Satış', 'Toplam İade',
  'Net Satış', 'HG%', 'Hakediş Oranı', 'Hesaplanan Tutar', 'Final Tutar', 'Yorum'];
describe('HR single-sheet incentive Excel', () => {
  it('exports exactly the requested columns and approved amounts as literal cells', () => {
    const snapshot = hrTestSnapshot();
    const book = XLSX.read(buildIncentiveHrWorkbook('2026-09', snapshot.packages, snapshot.rows), { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Personel Primleri']); const sheet = book.Sheets['Personel Primleri'];
    expect(sheet['!ref']).toBe('A1:M2'); expect(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })[0]).toEqual(headers);
    expect(sheet.A2.v).toBe('Ayşe Demir'); expect(sheet.B2.v).toBe('Test Mağaza'); expect(sheet.D2.v).toBe('Satış Danışmanı');
    expect(sheet.E2.v).toBe(100000); expect(sheet.H2.v).toBe(110000); expect(sheet.I2.v).toBe(1.1); expect(sheet.J2.v).toBe(0.015);
    expect(sheet.K2.v).toBe(1650); expect(sheet.L2.v).toBe(1800.25);
    for (const key of ['C2', 'M2']) { expect(sheet[key].t).toBe('s'); expect(sheet[key].f).toBeUndefined(); expect(sheet[key].v).toMatch(/^=/); }
  });
  it('keeps archived sales, adjustment, notes and excluded people in the same sheet', () => {
    const snapshot = hrTestSnapshot(); snapshot.packages[0] = { ...snapshot.packages[0], submission_note: '=Literal BM note',
      store_details: [{ storeId: 'store-a', storeCode: 'S1', storeName: 'Store', target: '2000000', gross: '2050000', returns: '-100000', net: '1950000', achievement: '97.5' }],
      frozen_participation: [{ storeId: 'store-a', finalSnapshotId: 'snapshot', participationRevisionNo: 1,
        exclusions: [{ employeeId: 'person', displayName: '=Excluded', positionCode: 'SALES_ASSOCIATE', reasonNote: '=Literal exclusion' }] }] };
    snapshot.rows[0] = { ...snapshot.rows[0], raw_baseline: '1650.00', proposed_amount: '1800.25', gross_sales: '120000.00', signed_returns: '-10000.00' };
    const book = XLSX.read(buildIncentiveHrWorkbook('2026-09', snapshot.packages, snapshot.rows), { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Personel Primleri']); const sheet = book.Sheets['Personel Primleri'];
    expect(sheet.F2.v).toBe(120000); expect(sheet.G2.v).toBe(-10000); expect(sheet.H2.v).toBe(110000);
    expect(sheet.M2.v).toContain('Tutar değişikliği: +150.25 TL'); expect(sheet.M2.v).toContain('Paket notu: =Literal BM note');
    expect(sheet.B3.v).toBe('Store'); expect(sheet.C3.v).toBe('=Excluded'); expect(sheet.D3.v).toBe('Satış Danışmanı');
    expect(sheet.K3.v).toBe(0); expect(sheet.L3.v).toBe(0); expect(sheet.M3.v).toContain('Prime dahil değildir'); expect(sheet.M3.v).toContain('=Literal exclusion');
    expect(sheet.F3?.v).toBeUndefined(); expect(sheet.H3?.v).toBeUndefined();
    for (const key of ['M2', 'C3', 'M3']) { expect(sheet[key].t).toBe('s'); expect(sheet[key].f).toBeUndefined(); }
  });
  it('adds money in cents without binary rounding drift', () => {
    expect(sumHrMoney(['0.10', '0.20', '-0.01'])).toBe('0.29'); expect(sumHrMoney([])).toBe('0.00'); expect(sumHrMoney(['-1.25'])).toBe('-1.25');
  });
  it('exports signed net and negative HG with zero approved payment', () => {
    const snapshot = hrTestSnapshot(); snapshot.rows[0] = { ...snapshot.rows[0], actual_sales_amount: '-20000.1234', achievement_pct: '-20.0001',
      applied_rate: '0.0000', payable_amount: '0.00', final_amount: '0.00' };
    const sheet = XLSX.read(buildIncentiveHrWorkbook('2026-09', snapshot.packages, snapshot.rows), { type: 'buffer' }).Sheets['Personel Primleri'];
    expect(sheet.H2.v).toBe(-20000.1234); expect(sheet.I2.v).toBeCloseTo(-0.200001); expect(sheet.K2.v).toBe(0); expect(sheet.L2.v).toBe(0);
  });
  it.each(['company_cycle', 'legacy_approved'] as const)('preserves %s payment without inventing unavailable sales', approval_origin => {
    const snapshot = hrTestSnapshot(); snapshot.packages[0] = { ...snapshot.packages[0], approval_origin };
    const book = XLSX.read(buildIncentiveHrWorkbook('2026-09', snapshot.packages, snapshot.rows), { type: 'buffer' });
    expect(book.SheetNames).toEqual(['Personel Primleri']); const sheet = book.Sheets['Personel Primleri'];
    expect(sheet.F2?.v).toBeUndefined(); expect(sheet.G2?.v).toBeUndefined(); expect(sheet.K2.v).toBe(1650); expect(sheet.L2.v).toBe(1800.25);
  });
  it('retains a fully excluded package with zero-payment person rows', () => {
    const snapshot = hrTestSnapshot(); snapshot.packages[0].frozen_participation = [{ storeId: 'store-a', finalSnapshotId: 'snapshot', participationRevisionNo: 1,
      exclusions: [{ employeeId: 'excluded', displayName: 'Excluded Person', positionCode: 'CASHIER', reasonNote: 'Outside prim' }] }];
    const sheet = XLSX.read(buildIncentiveHrWorkbook('2026-09', snapshot.packages, []), { type: 'buffer' }).Sheets['Personel Primleri'];
    expect(sheet.C2.v).toBe('Excluded Person'); expect(sheet.D2.v).toBe('Kasa Sorumlusu'); expect(sheet.K2.v).toBe(0); expect(sheet.L2.v).toBe(0);
    expect(sheet.M2.v).toContain('Prime dahil değildir');
  });
});
