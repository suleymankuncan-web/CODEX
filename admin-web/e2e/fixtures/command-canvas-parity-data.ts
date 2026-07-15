export type CommandCanvasParityStoreFixture = {
  storeId: string
  storeName: string
  regionName: string
  managerName: string | null
}

export function createCommandCanvasParityStores(count = 36): CommandCanvasParityStoreFixture[] {
  return Array.from({ length: count }, (_, index) => ({
    storeId: `parity-store-${String(index + 1).padStart(2, '0')}`,
    storeName: index === 2
      ? 'İstanbul Uluslararası Operasyon ve Deneyim Merkezi Çok Uzun Mağaza Adı'
      : `Parity Mağaza ${String(index + 1).padStart(2, '0')}`,
    regionName: `Parity Bölge ${(index % 4) + 1}`,
    managerName: index === 4 ? null : `Parity Yönetici ${String(index + 1).padStart(2, '0')}`,
  }))
}

export function paginateCommandCanvasFixtures<T>(input: {
  rows: T[]
  cursor: string | null
  pageSize: number
}) {
  const start = input.cursor ? Number(input.cursor) : 0
  const items = input.rows.slice(start, start + input.pageSize)
  const nextOffset = start + items.length

  return {
    items,
    nextCursor: nextOffset < input.rows.length ? String(nextOffset) : null,
    total: input.rows.length,
  }
}

export const commandCanvasPartialDataFixture = {
  status: 'partial' as const,
  unavailableSection: 'secondary-summary',
  warningCode: 'fixture_section_unavailable',
}
