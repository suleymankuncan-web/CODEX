import { describe, expect, it } from 'vitest'

import type { StoreMasterItem } from '../features/integrations/api'
import { resolveStoreRegionManager } from './master-data-region-manager'

const store = {
  storeId: 'store-1',
  storeCode: 'IST-101',
  storeName: 'İstinyePark',
  storeType: 'company',
  status: 'active',
  kpiImportEnabled: true,
  regionId: 'region-1',
  regionName: 'İstanbul',
  regionManagerUserId: 'manager-1',
  regionManagerName: 'onprem.region-manager',
  updatedAt: '2026-08-28T10:00:00.000Z',
} as StoreMasterItem

describe('resolveStoreRegionManager', () => {
  it('prefers a human-readable lookup identity over a technical provider name', () => {
    expect(resolveStoreRegionManager(store, [{
      userId: 'manager-1',
      displayName: 'Eda Doğanay',
      email: 'eda.doganay@example.com',
      regionId: 'region-1',
      regionName: 'İstanbul',
    }])).toEqual({
      assigned: true,
      displayName: 'Eda Doğanay',
      email: 'eda.doganay@example.com',
    })
  })

  it('uses a neutral product fallback when only a technical identity is available', () => {
    expect(resolveStoreRegionManager(store, [{
      userId: 'different-manager',
      displayName: 'Yanlış Bölge Eşleşmesi',
      email: 'wrong@example.com',
      regionId: 'region-1',
      regionName: 'İstanbul',
    }])).toEqual({
      assigned: false,
      displayName: 'Bölge müdürü atanmamış',
      email: null,
    })
  })
})
