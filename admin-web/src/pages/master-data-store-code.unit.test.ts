import { describe, expect, test } from 'vitest'
import type { StoreMasterItem } from '../features/integrations/api'
import { mergeStoreMasterPatch } from './master-data-bootstrap-model'
import { buildStoreMasterUpdateInput, validateStoreMasterDrafts } from './master-data-store-transition'

const store = {
  storeId: 'store-1',
  storeCode: 'SM150',
  storeName: 'Çorum AHL Park',
  storeType: 'company',
  status: 'active',
  kpiImportEnabled: true,
  regionId: 'region-1',
  regionName: 'Karadeniz',
  regionManagerUserId: null,
  regionManagerName: null,
  contactEmails: [],
  ingestStatus: 'ready',
  matchedSourceCount: 1,
  activeSourceCount: 1,
  lastSuccessfulKpiDate: null,
  updatedAt: '2026-09-28T08:00:00Z',
} satisfies StoreMasterItem

describe('store master code draft', () => {
  test('shows the new code while preserving the stable store identity', () => {
    const effective = mergeStoreMasterPatch(store, { storeCode: 'FM702' }, undefined)
    expect(effective.storeId).toBe(store.storeId)
    expect(effective.storeCode).toBe('FM702')
    expect(store.storeCode).toBe('SM150')
  })

  test('requires the effective date when changing ownership type', () => {
    const stores = new Map([[store.storeId, store]])
    expect(validateStoreMasterDrafts([[store.storeId, { storeType: 'franchise' }]], stores, undefined))
      .toContain('geçerli geçmiş/bugün tarihini')
    expect(validateStoreMasterDrafts([[store.storeId, {
      storeCode: 'FM702', storeType: 'franchise', storeTypeEffectiveOn: '2026-09-15',
    }]], stores, undefined)).toBeNull()
  })

  test('sends a dated code and type change while retaining store UUID', () => {
    expect(buildStoreMasterUpdateInput(store, {
      storeCode: 'FM702', storeType: 'franchise', storeTypeEffectiveOn: '2026-09-15',
    }, undefined)).toEqual(expect.objectContaining({
      storeId: 'store-1', storeCode: 'FM702', storeType: 'franchise',
      storeTypeEffectiveOn: '2026-09-15', expectedUpdatedAt: store.updatedAt,
    }))
  })

  test('sends contact email changes while preserving KPI scope', () => {
    expect(buildStoreMasterUpdateInput(store, {
      kpiImportEnabled: false,
      contactEmails: [{ emailAddress: 'store@example.com', label: null, isPrimary: true }],
    }, undefined)).toEqual(expect.objectContaining({
      storeId: 'store-1',
      kpiImportEnabled: false,
      contactEmails: [{ emailAddress: 'store@example.com', isPrimary: true }],
    }))
  })
})
