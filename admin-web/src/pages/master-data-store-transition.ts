import type { StoreMasterItem, StoreMasterLookups } from '../features/integrations/api'
import {
  mergeStoreMasterPatch,
  normalizeStoreStatus,
  normalizeStoreType,
  type StoreMasterPatch,
} from './master-data-bootstrap-model'

export function validateStoreMasterDrafts(
  entries: Array<[string, StoreMasterPatch]>,
  storesById: Map<string, StoreMasterItem>,
  lookups: StoreMasterLookups | undefined,
): string | null {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  for (const [storeId, patch] of entries) {
    const record = storesById.get(storeId)
    if (!record) return 'Mağaza kaydı yenilendi; sayfayı tazeleyin.'
    const effective = mergeStoreMasterPatch(record, patch, lookups)
    if (!effective.regionId) return 'Zorunlu alanları tamamlayın.'
    if (patch.storeCode !== undefined && !/^[A-Z][A-Z0-9_-]{1,79}$/.test(effective.storeCode)) {
      return 'Mağaza kodu büyük harfle başlamalı; yalnız harf, rakam, _ ve - kullanılabilir.'
    }
    if (patch.storeType !== undefined && patch.storeType !== record.storeType) {
      const date = patch.storeTypeEffectiveOn
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date > today) {
        return 'Mağaza tipi değişiminde geçerli geçmiş/bugün tarihini girin.'
      }
    }
  }
  return null
}

export function buildStoreMasterUpdateInput(
  record: StoreMasterItem,
  patch: StoreMasterPatch,
  lookups: StoreMasterLookups | undefined,
) {
  const effective = mergeStoreMasterPatch(record, patch, lookups)
  return {
    storeId: record.storeId,
    ...(patch.storeCode !== undefined ? { storeCode: effective.storeCode } : {}),
    ...(patch.storeType !== undefined && patch.storeType !== record.storeType
      ? { storeTypeEffectiveOn: patch.storeTypeEffectiveOn } : {}),
    storeType: normalizeStoreType(effective.storeType),
    regionId: effective.regionId!,
    status: normalizeStoreStatus(effective.status),
    kpiImportEnabled: effective.kpiImportEnabled,
    ...(record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {}),
  }
}
