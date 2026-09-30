import type { Page } from './test-fixtures'
import type { StoreReturnRow, StoreReturnsLedger } from '../src/features/returns/api'

export function returnRow(overrides: Partial<StoreReturnRow> = {}): StoreReturnRow {
  return {
    returnId: 'synthetic-return-1', businessDate: '2026-06-15', direction: 'received', category: 'in_store',
    personnelCode: 'SYN-SELLER', employeeId: 'synthetic-seller', displayName: 'Norm Satıcısı',
    receivingStoreCode: 'SYN-MALL', receivingStoreName: 'Mall of İstanbul', originalStoreCode: 'SYN-MALL', originalStoreName: 'Mall of İstanbul',
    signedAmount: '-20.00', invoiceCount: 1, ...overrides,
  }
}

export function returnsLedger(overrides: Partial<StoreReturnsLedger> = {}): StoreReturnsLedger {
  return {
    storeId: 'synthetic-store', periodStart: '2026-06-01', periodEnd: '2026-06-30', timezone: 'Europe/Istanbul',
    totals: { receivedSignedAmount: '-650.00', receivedInvoiceCount: 3, externalSignedAmount: '-100.00', netSales: '1950.00' },
    coverage: { expectedDays: 30, coveredDays: 30, missingDates: [], status: 'complete', unresolvedRows: 0 },
    rows: [returnRow()], page: { total: 1, limit: 50, offset: 0 }, ...overrides,
  }
}

export async function routeReturns(page: Page, input: { inside?: StoreReturnRow[]; other?: StoreReturnRow[]; ledger?: Partial<StoreReturnsLedger> } = {}) {
  const reads: URL[] = []
  await page.route('**/api/reports/store-returns?**', async route => {
    const url = new URL(route.request().url())
    reads.push(url)
    const allRows = url.searchParams.get('category') === 'other' ? input.other ?? [] : input.inside ?? [returnRow()]
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const ledger = returnsLedger({ ...input.ledger,
      storeId: url.searchParams.get('storeId')!, periodStart: url.searchParams.get('periodStart')!, periodEnd: url.searchParams.get('periodEnd')!,
      rows: allRows.slice(offset, offset + 50), page: { total: allRows.length, limit: 50, offset },
    })
    await route.fulfill({ json: { data: ledger } })
  })
  return reads
}
