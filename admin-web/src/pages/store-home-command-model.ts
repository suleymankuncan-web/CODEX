import type { ReactNode } from 'react'
import type { To } from 'react-router'
import type { StorePersona } from '../app/store-navigation'

export type StoreHomeCommandTone = 'plum' | 'cyan' | 'mint' | 'amber' | 'rose' | 'neutral'
export type StoreHomeCommandFilter = 'all' | 'attention' | 'checklist' | 'request' | 'visit'
export type StoreHomeDataState = 'ready' | 'loading' | 'unavailable'

export type StoreHomeCommandMetric = {
  id: string
  label: string
  value: string
  note: string
  tone: StoreHomeCommandTone
  icon: ReactNode
  filter?: Exclude<StoreHomeCommandFilter, 'all'>
}

export type StoreHomeCommandPriority = {
  id: string
  source: string
  title: string
  detail: string
  meta: string
  status: string
  cta: string
  href: To
  tone: StoreHomeCommandTone
  icon: ReactNode
  category?: Exclude<StoreHomeCommandFilter, 'all' | 'attention'>
  needsAttention?: boolean
  state?: StoreHomeDataState
  routeLabel?: string
  priority?: number
  filter?: 'critical' | 'approval' | 'announcement'
  testId?: string
}

export type StoreHomeCommandQuickLink = {
  id: string
  label: string
  href: To
  icon: ReactNode
  value?: string
  tone?: StoreHomeCommandTone
}

export type StoreHomeCommandModel = {
  persona: StorePersona
  personaLabel: string
  identityLabel: string
  periodLabel: string
  metrics: StoreHomeCommandMetric[]
  priorities: StoreHomeCommandPriority[]
  quickLinks: StoreHomeCommandQuickLink[]
  hasPartialData?: boolean
  scopeValue?: string
  todayTitle?: string
  todayNote?: string
  announcements?: Array<{ id: string; label: string; copy: string; time: string }>
}

export type StoreHomeCommandBuilderInput = {
  availablePaths: ReadonlySet<string>
  checklistActionLabel: string | null
  checklistCopy: string | null
  checklistMetricValue: string | null
  checklistTitle: string | null
  checklistTone: 'attention' | 'ready' | 'unavailable' | null
  checklistUnavailable: boolean
  icons: {
    alert: ReactNode
    bell: ReactNode
    checklist: ReactNode
    file: ReactNode
    megaphone: ReactNode
    shield: ReactNode
    store: ReactNode
    target: ReactNode
    trending: ReactNode
    users: ReactNode
    wallet: ReactNode
  }
  identityLabel: string
  pendingRequestsValue: string | null
  pendingValue: string
  periodLabel: string
  persona: StorePersona
  personaLabel: string
  storeScopeValue: string
  visitPriorityActionLabel: string | null
  visitPriorityCopy: string | null
  visitPriorityTitle: string | null
  visitPriorityValue: string | null
  visitUnavailable: boolean
  workflowUnavailable: boolean
}

export function countNumeric(value: string | null | undefined) {
  if (!value) return 0
  return /^\d+$/.test(value) ? Number(value) : 0
}

export function formatStoreHomePeriod(date = new Date()) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function resolveState(value: string, pendingValue: string, unavailable: boolean): StoreHomeDataState {
  if (unavailable) return 'unavailable'
  return value === pendingValue ? 'loading' : 'ready'
}

function buildQuickLinks(input: StoreHomeCommandBuilderInput): StoreHomeCommandQuickLink[] {
  const candidates: Array<StoreHomeCommandQuickLink & { path: string }> = [
    { id: 'kpis', label: 'KPI özeti', href: '/store/kpis', path: '/store/kpis', icon: input.icons.trending },
    { id: 'checklists', label: 'Checklist', href: '/store/checklists', path: '/store/checklists', icon: input.icons.checklist },
    { id: 'approvals', label: 'Talep Merkezi', href: '/store/approvals', path: '/store/approvals', icon: input.icons.shield },
    { id: 'tasks', label: 'Görevler', href: '/store/tasks', path: '/store/tasks', icon: input.icons.bell },
    { id: 'targets', label: 'Hedefler', href: '/store/targets', path: '/store/targets', icon: input.icons.target },
    { id: 'incentives', label: 'Primler', href: '/store/incentives', path: '/store/incentives', icon: input.icons.wallet },
    { id: 'workforce', label: 'Norm Kadro', href: '/store/workforce', path: '/store/workforce', icon: input.icons.users },
    { id: 'reports', label: 'Raporlar', href: '/store/reports', path: '/store/reports', icon: input.icons.file },
    { id: 'performance', label: 'Performansım', href: '/store/me', path: '/store/me', icon: input.icons.trending },
    { id: 'rankings', label: 'Sıralama', href: '/store/rankings', path: '/store/rankings', icon: input.icons.trending },
    { id: 'feed', label: 'Duyurular', href: '/store/feed', path: '/store/feed', icon: input.icons.megaphone },
  ]

  return candidates
    .filter((item) => input.availablePaths.has(item.path))
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: item.icon,
    }))
}

export function buildStoreHomeCommandModel(input: StoreHomeCommandBuilderInput): StoreHomeCommandModel {
  const priorities: StoreHomeCommandPriority[] = []
  const metrics: StoreHomeCommandMetric[] = []
  const quickLinks = buildQuickLinks(input)

  if (input.checklistMetricValue !== null && input.availablePaths.has('/store/checklists')) {
    const state = resolveState(input.checklistMetricValue, input.pendingValue, input.checklistUnavailable)
    const count = countNumeric(input.checklistMetricValue)
    const needsAttention = state === 'ready' && count > 0
    const value = state === 'unavailable' ? '—' : input.checklistMetricValue

    priorities.push({
      id: 'checklists',
      source: 'Checklist',
      title: state === 'unavailable' ? 'Checklist özeti açılamadı' : input.checklistTitle ?? 'Checklist durumunu kontrol et',
      detail: state === 'unavailable' ? 'Bu bilgi şu anda görüntülenemiyor.' : state === 'loading' ? 'Checklist özeti yükleniyor.' : input.checklistCopy ?? 'Bekleyen checklist işlerini inceleyin.',
      meta: value,
      status: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Açılamadı' : needsAttention ? 'Bekliyor' : 'Tamam',
      cta: input.checklistActionLabel ?? 'Checklistleri aç',
      href: '/store/checklists',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'amber' : 'mint',
      icon: input.icons.checklist,
      category: 'checklist',
      needsAttention,
      state,
      testId: 'store-home-checklist-card',
    })
    metrics.push({
      id: 'checklist',
      label: 'Checklist',
      value,
      note: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Bilgi alınamadı' : needsAttention ? 'İşlem bekliyor' : 'Bekleyen yok',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'amber' : 'mint',
      icon: input.icons.checklist,
      filter: 'checklist',
    })
  }

  if (input.pendingRequestsValue !== null && input.availablePaths.has('/store/approvals')) {
    const state = resolveState(input.pendingRequestsValue, input.pendingValue, input.workflowUnavailable)
    const count = countNumeric(input.pendingRequestsValue)
    const needsAttention = state === 'ready' && count > 0
    const value = state === 'unavailable' ? '—' : input.pendingRequestsValue

    priorities.push({
      id: 'requests',
      source: 'Talep Merkezi',
      title: state === 'unavailable' ? 'Talep özeti açılamadı' : state === 'loading' ? 'Talep özeti yükleniyor' : needsAttention ? 'Karar bekleyen talepler var' : 'Bekleyen talep yok',
      detail: state === 'unavailable' ? 'Bu bilgi şu anda görüntülenemiyor.' : state === 'loading' ? 'Bekleyen talepler kontrol ediliyor.' : needsAttention ? `${count} talep inceleme bekliyor.` : 'Talep akışında bekleyen işlem bulunmuyor.',
      meta: value,
      status: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Açılamadı' : needsAttention ? 'Karar bekliyor' : 'Tamam',
      cta: 'Talepleri aç',
      href: '/store/approvals',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'rose' : 'mint',
      icon: input.icons.shield,
      category: 'request',
      needsAttention,
      state,
    })
    metrics.push({
      id: 'requests',
      label: 'Bekleyen talepler',
      value,
      note: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Bilgi alınamadı' : needsAttention ? 'Karar bekliyor' : 'Bekleyen yok',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'rose' : 'mint',
      icon: input.icons.shield,
      filter: 'request',
    })
  }

  if (input.visitPriorityValue !== null && input.availablePaths.has('/store/checklists')) {
    const state = resolveState(input.visitPriorityValue, input.pendingValue, input.visitUnavailable)
    const count = countNumeric(input.visitPriorityValue)
    const needsAttention = state === 'ready' && count > 0
    const value = state === 'unavailable' ? '—' : input.visitPriorityValue

    priorities.push({
      id: 'visit-priority',
      source: 'Ziyaret planı',
      title: state === 'unavailable' ? 'Ziyaret özeti açılamadı' : input.visitPriorityTitle ?? 'Ziyaret önceliklerini kontrol et',
      detail: state === 'unavailable' ? 'Bu bilgi şu anda görüntülenemiyor.' : input.visitPriorityCopy ?? 'Öncelikli mağazaları ziyaret planına ekleyin.',
      meta: value,
      status: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Açılamadı' : needsAttention ? 'Planlama gerekli' : 'Tamam',
      cta: input.visitPriorityActionLabel ?? 'Ziyaret planını aç',
      href: '/store/checklists?canvasView=plan',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'amber' : 'mint',
      icon: input.icons.store,
      category: 'visit',
      needsAttention,
      state,
      testId: 'store-home-visit-priority-card',
    })
    metrics.push({
      id: 'visits',
      label: 'Öncelikli mağaza',
      value,
      note: state === 'loading' ? 'Yükleniyor' : state === 'unavailable' ? 'Bilgi alınamadı' : needsAttention ? 'Planlama gerekli' : 'Öncelik yok',
      tone: state !== 'ready' ? 'neutral' : needsAttention ? 'amber' : 'mint',
      icon: input.icons.store,
      filter: 'visit',
    })
  }

  const attentionCount = priorities.filter((item) => item.needsAttention).length
  const hasPartialData = priorities.some((item) => item.state === 'unavailable')
  const hasLoadingData = priorities.some((item) => item.state === 'loading')
  metrics.unshift({
    id: 'attention',
    label: 'Dikkat bekleyen',
    value: hasPartialData ? '—' : hasLoadingData ? input.pendingValue : String(attentionCount),
    note: hasPartialData ? 'Bilgi eksik' : hasLoadingData ? 'Yükleniyor' : attentionCount > 0 ? 'Bugünün gündemi' : 'Gündem temiz',
    tone: hasPartialData || hasLoadingData ? 'neutral' : attentionCount > 0 ? 'rose' : 'mint',
    icon: input.icons.alert,
    filter: 'attention',
  })

  metrics.push({
    id: 'scope',
    label: input.persona === 'regionManager' ? 'Bölge mağazaları' : input.persona === 'storeManager' ? 'Mağaza kapsamı' : 'Yetkili mağaza',
    value: input.storeScopeValue,
    note: input.persona === 'regionManager' ? 'Sorumlu olduğunuz mağazalar' : 'Görüntüleme kapsamı',
    tone: 'cyan',
    icon: input.icons.store,
  })

  return {
    persona: input.persona,
    personaLabel: input.personaLabel,
    identityLabel: input.identityLabel,
    periodLabel: input.periodLabel,
    metrics: metrics.slice(0, 4),
    priorities,
    quickLinks,
    hasPartialData,
    scopeValue: input.storeScopeValue,
  }
}
