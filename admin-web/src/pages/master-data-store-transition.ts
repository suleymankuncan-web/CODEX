import type { StoreMasterItem, StoreMasterLookups } from '../features/integrations/api'
import {
  mergeStoreMasterPatch,
  normalizeStoreStatus,
  normalizeStoreType,
  type StoreMasterPatch,
} from './master-data-bootstrap-model'

type StoreContactEmailDraft = { emailAddress: string; label?: string | null; isPrimary: boolean }

export function validateStoreContactEmails(emails: StoreContactEmailDraft[]): string | null {
  if (emails.length > 10) return 'Bir mağazada en fazla 10 e-posta adresi olabilir.'
  if (emails.length === 0) return null
  if (emails.filter((email) => email.isPrimary).length !== 1) return 'Tam olarak bir e-posta adresini birincil seçin.'
  const normalized = new Set<string>()
  for (const email of emails) {
    const address = email.emailAddress.trim().toLowerCase()
    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return 'Geçerli mağaza e-posta adresleri girin.'
    if (normalized.has(address)) return 'Aynı mağaza e-posta adresi birden fazla kez kullanılamaz.'
    normalized.add(address)
    if ((email.label?.trim().length ?? 0) > 80) return 'E-posta etiketi en fazla 80 karakter olabilir.'
  }
  return null
}

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
    const contactError = validateStoreContactEmails(effective.contactEmails)
    if (contactError) return contactError
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
    ...(patch.contactEmails !== undefined ? { contactEmails: effective.contactEmails.map((email) => ({ emailAddress: email.emailAddress, isPrimary: email.isPrimary, ...(email.label ? { label: email.label } : {}) })) } : {}),
    ...(record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {}),
  }
}
