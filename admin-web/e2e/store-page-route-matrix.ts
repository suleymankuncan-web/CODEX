import { storeRouteDefinitions, type StoreRouteId } from '../src/app/store-route-registry'
import { employeeIds, type StoreContractPersona } from './store-page-contract-fixtures'

export type StoreRouteContractExpectation = {
  id: StoreRouteId
  path: string
  persona: StoreContractPersona
  visibleText: RegExp | string
}

type RouteContract = {
  persona: StoreContractPersona
  visibleText: RegExp | string
}

const routeContractById = {
  approvals: { persona: 'regionManager', visibleText: /Talep Merkezi|Onay/i },
  checklists: { persona: 'regionManager', visibleText: /Checklistler/i },
  competitions: { persona: 'storeManager', visibleText: /Turnuva|Yarışma|Competition/i },
  feed: { persona: 'regionManager', visibleText: /Duyurular|Paylaş/i },
  home: { persona: 'regionManager', visibleText: /Ana Sayfa|Günlük Operasyon/i },
  incentives: { persona: 'regionManager', visibleText: /Prim Kontrol Sayfası|Primler/i },
  kpis: { persona: 'regionManager', visibleText: /Bölge Performansı|KPI/i },
  me: { persona: 'storePersonnel', visibleText: /Performans Kartı Oluştur|Performans skoru/i },
  personnel: { persona: 'regionManager', visibleText: /Performans skoru|Türkiye/i },
  rankings: { persona: 'regionManager', visibleText: /Türkiye Sıralaması|Türkiye mağaza sıralaması/i },
  reports: { persona: 'regionManager', visibleText: /Raporlar/i },
  settings: { persona: 'storeManager', visibleText: /Ayarlar|Profil/i },
  targets: { persona: 'regionManager', visibleText: /Hedefler/i },
  tasks: { persona: 'regionManager', visibleText: /Görevler/i },
  workforce: { persona: 'regionManager', visibleText: /Norm Kadro/i },
} satisfies Record<StoreRouteId, RouteContract>

export const storeRouteContractExpectations: StoreRouteContractExpectation[] =
  storeRouteDefinitions.map((route) => ({
    id: route.id,
    path: route.id === 'personnel' ? `/store/personnel/${employeeIds[0]}` : route.path,
    ...routeContractById[route.id],
  }))
