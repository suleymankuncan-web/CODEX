export type MasterDataImpactEntityType = 'store' | 'personnel'

export type MasterDataImpactTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral'

export type MasterDataImpactModule = {
  module: string
  effect: string
  tone: MasterDataImpactTone
}

const storeImpactRules: Record<string, MasterDataImpactModule[]> = {
  regionId: [
    {
      module: 'KPI',
      effect: 'Mağaza bölge görünümünde farklı yönetici altında okunur.',
      tone: 'info',
    },
    {
      module: 'Hedefler',
      effect: 'Bölge müdürü onay ve takip listesi güncellenir.',
      tone: 'warning',
    },
    {
      module: 'Primler',
      effect: 'Bölge prim kontrol paketi yeni sorumluluğa göre yenilenir.',
      tone: 'warning',
    },
    {
      module: 'Raporlar',
      effect: 'Bölge raporu ve dışa aktarım kapsamı değişir.',
      tone: 'info',
    },
  ],
  storeType: [
    {
      module: 'Primler',
      effect: 'Şirket mağazası kuralı ve prim görünürlüğü etkilenir.',
      tone: 'warning',
    },
    {
      module: 'KPI',
      effect: 'Mağaza gruplama ve karşılaştırma dili güncellenir.',
      tone: 'info',
    },
    {
      module: 'Raporlar',
      effect: 'Mağaza türü bazlı filtre ve çıktı alanları etkilenir.',
      tone: 'info',
    },
  ],
  status: [
    {
      module: 'Rankings',
      effect: 'Aktif olmayan mağaza sıralama kapsamından çıkar.',
      tone: 'danger',
    },
    {
      module: 'Hedefler',
      effect: 'Açık hedef ve onay akışları yeniden değerlendirilir.',
      tone: 'warning',
    },
    {
      module: 'Norm Kadro',
      effect: 'Aktif personel ve norm görünümü güncellenir.',
      tone: 'warning',
    },
    {
      module: 'Raporlar',
      effect: 'Mağaza görünürlüğü ve dönem çıktıları etkilenir.',
      tone: 'info',
    },
  ],
  kpiImportEnabled: [
    {
      module: 'KPI',
      effect: 'KPI aktarım satırları bu mağaza için açılır veya kapanır.',
      tone: 'warning',
    },
    {
      module: 'Raporlar',
      effect: 'KPI kaynaklı dönem raporu kapsamı etkilenir.',
      tone: 'info',
    },
  ],
  externalStoreRef: [
    {
      module: 'İçe Aktarım',
      effect: 'Mağaza dış kaynak eşleşmesi ve satış aktarımı etkilenir.',
      tone: 'warning',
    },
    {
      module: 'KPI',
      effect: 'Mağaza KPI ve satış kaynak eşleşmesi güncellenir.',
      tone: 'warning',
    },
  ],
  storeManagerUserId: [
    {
      module: 'Hedefler',
      effect: 'Mağaza müdürü hedef dağıtım ve onay sorumluluğu değişir.',
      tone: 'warning',
    },
    {
      module: 'Görevler',
      effect: 'Mağaza müdürü aksiyon görünürlüğü güncellenir.',
      tone: 'info',
    },
    {
      module: 'Checklist',
      effect: 'Sonuç kabul ve mağaza takip sorumluluğu etkilenir.',
      tone: 'info',
    },
  ],
  storeManagerEmployeeId: [
    {
      module: 'Hedefler',
      effect: 'Mağaza müdürü hedef dağıtım ve onay sorumluluğu değişir.',
      tone: 'warning',
    },
    {
      module: 'Görevler',
      effect: 'Mağaza müdürü aksiyon görünürlüğü güncellenir.',
      tone: 'info',
    },
    {
      module: 'Checklist',
      effect: 'Sonuç kabul ve mağaza takip sorumluluğu etkilenir.',
      tone: 'info',
    },
  ],
}

const personnelImpactRules: Record<string, MasterDataImpactModule[]> = {
  externalEmployeeRef: [
    {
      module: 'Satış aktarımı',
      effect: 'Personel satış, KPI ve prim eşleşmesi güncellenir.',
      tone: 'warning',
    },
    {
      module: 'Rankings',
      effect: 'Personel sıralama ve performans satırı etkilenir.',
      tone: 'info',
    },
  ],
  sellerCode: [
    {
      module: 'Satış aktarımı',
      effect: 'Personel satış, KPI ve prim eşleşmesi güncellenir.',
      tone: 'warning',
    },
    {
      module: 'Rankings',
      effect: 'Personel sıralama ve performans satırı etkilenir.',
      tone: 'info',
    },
  ],
  positionId: [
    {
      module: 'Primler',
      effect: 'Prim oranı ve rol bazlı hakediş yorumu etkilenir.',
      tone: 'warning',
    },
    {
      module: 'Norm Kadro',
      effect: 'Pozisyon dengesi ve aktif kadro görünümü güncellenir.',
      tone: 'info',
    },
    {
      module: 'Hedefler',
      effect: 'Personel hedef dağılımı ve rol gruplaması etkilenir.',
      tone: 'info',
    },
  ],
  roleCode: [
    {
      module: 'Primler',
      effect: 'Prim oranı ve rol bazlı hakediş yorumu etkilenir.',
      tone: 'warning',
    },
    {
      module: 'Hedefler',
      effect: 'Personel hedef dağılımı ve rol gruplaması etkilenir.',
      tone: 'info',
    },
  ],
  employmentStatus: [
    {
      module: 'Norm Kadro',
      effect: 'Aktif personel sayısı ve eksik/fazla yorumu değişir.',
      tone: 'warning',
    },
    {
      module: 'Hedefler',
      effect: 'Personel hedef kapsamı yeniden hesaplanır.',
      tone: 'warning',
    },
    {
      module: 'Primler',
      effect: 'Hakediş görünürlüğü ve dönem kontrolü etkilenir.',
      tone: 'warning',
    },
  ],
  assignmentEndDate: [
    {
      module: 'Norm Kadro',
      effect: 'Aktif personel sayısı ve eksik/fazla yorumu değişir.',
      tone: 'warning',
    },
    {
      module: 'Raporlar',
      effect: 'Personel dönem kapsamı ve mağaza çıktıları etkilenir.',
      tone: 'info',
    },
  ],
  storeId: [
    {
      module: 'Hedefler',
      effect: 'Personel hedefi bağlı mağaza altında görünür.',
      tone: 'warning',
    },
    {
      module: 'Primler',
      effect: 'Hakediş bağlı mağazanın dönem paketine taşınır.',
      tone: 'warning',
    },
    {
      module: 'Raporlar',
      effect: 'Mağaza ve bölge raporu kapsamı değişir.',
      tone: 'info',
    },
  ],
}

export function getMasterDataImpactModules(input: {
  entityType: MasterDataImpactEntityType
  changedFields: Iterable<string>
}): MasterDataImpactModule[] {
  const ruleSet = input.entityType === 'store' ? storeImpactRules : personnelImpactRules
  const modules = new Map<string, MasterDataImpactModule>()

  for (const field of input.changedFields) {
    for (const item of ruleSet[field] ?? []) {
      if (!modules.has(item.module)) {
        modules.set(item.module, item)
      }
    }
  }

  return Array.from(modules.values())
}
