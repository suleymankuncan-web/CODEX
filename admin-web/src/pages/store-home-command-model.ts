import type { ReactNode } from 'react'
import type { To } from 'react-router-dom'
import type { StorePersona } from '../app/store-navigation'

export type StoreHomeCommandTone = 'plum' | 'cyan' | 'mint' | 'amber' | 'rose'

export type StoreHomeCommandFilter = 'all' | 'critical' | 'approval' | 'announcement'

export type StoreHomeCommandMetric = {
  id: string
  label: string
  value: string
  note: string
  tone: StoreHomeCommandTone
  icon: ReactNode
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
  routeLabel: string
  tone: StoreHomeCommandTone
  icon: ReactNode
  priority: number
  filter: Exclude<StoreHomeCommandFilter, 'all'>
  testId?: string
}

export type StoreHomeCommandAnnouncement = {
  id: string
  label: string
  copy: string
  time: string
}

export type StoreHomeCommandQuickLink = {
  id: string
  label: string
  value: string
  href: To
  tone: StoreHomeCommandTone
  icon: ReactNode
}

export type StoreHomeCommandModel = {
  persona: StorePersona
  personaLabel: string
  identityLabel: string
  periodLabel: string
  todayTitle: string
  todayNote: string
  metrics: StoreHomeCommandMetric[]
  priorities: StoreHomeCommandPriority[]
  announcements: StoreHomeCommandAnnouncement[]
  quickLinks: StoreHomeCommandQuickLink[]
}

export type StoreHomeCommandBuilderInput = {
  availablePaths: ReadonlySet<string>
  checklistActionLabel: string | null
  checklistCopy: string | null
  checklistMetricValue: string | null
  checklistTitle: string | null
  checklistTone: 'attention' | 'ready' | null
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
  pendingWorkValue: string
  periodLabel: string
  persona: StorePersona
  personaLabel: string
  readyValue: string
  storeScopeValue: string
  visitPriorityActionLabel: string | null
  visitPriorityCopy: string | null
  visitPriorityTitle: string | null
  visitPriorityValue: string | null
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

export function buildStoreHomeCommandModel(input: StoreHomeCommandBuilderInput): StoreHomeCommandModel {
  const priorities: StoreHomeCommandPriority[] = []

  if (
    (input.persona === 'regionManager' || input.persona === 'storeManager' || input.persona === 'admin') &&
    input.availablePaths.has('/store/targets')
  ) {
    const pendingTargets = countNumeric(input.pendingRequestsValue)
    priorities.push({
      id: 'target-approval',
      source: 'Hedefler',
      title: input.persona === 'regionManager'
        ? 'Hedef kararlarını kontrol et'
        : 'Mağaza hedef dağılımını takip et',
      detail: 'Mağaza hedefleri ve personel dağılımları hedefler sayfasında karara bağlanır.',
      meta: input.periodLabel,
      status: pendingTargets > 0 ? 'Karar bekliyor' : 'Hazır',
      cta: 'Hedefleri aç',
      href: '/store/targets',
      routeLabel: 'Hedefler',
      tone: pendingTargets > 0 ? 'amber' : 'mint',
      icon: input.icons.target,
      priority: 10,
      filter: 'approval',
    })
  }

  if (input.checklistMetricValue !== null && input.availablePaths.has('/store/checklists')) {
    const needsAttention = input.checklistTone === 'attention'
    priorities.push({
      id: 'checklists',
      source: 'Checklist',
      title: input.checklistTitle ?? 'Checklist akışını kontrol et',
      detail: input.checklistCopy ?? 'Checklist sonuçları ve bekleyen kabul işlemleri checklist sayfasında izlenir.',
      meta: input.checklistMetricValue,
      status: needsAttention ? 'Bekliyor' : 'Hazır',
      cta: input.checklistActionLabel ?? 'Checklistleri aç',
      href: '/store/checklists',
      routeLabel: 'Checklistler',
      tone: needsAttention ? 'cyan' : 'mint',
      icon: input.icons.checklist,
      priority: 20,
      filter: 'approval',
      testId: 'store-home-checklist-card',
    })
  }

  if (
    input.persona === 'regionManager' &&
    input.visitPriorityValue !== null &&
    input.availablePaths.has('/store/checklists')
  ) {
    const visitPriorityCount = countNumeric(input.visitPriorityValue)
    const visitPriorityPending = visitPriorityCount === 0 && !/^\d+$/.test(input.visitPriorityValue)
    priorities.push({
      id: 'visit-priority',
      source: 'Ziyaret planı',
      title: input.visitPriorityTitle ?? 'Öncelikli mağazaları incele',
      detail: input.visitPriorityCopy ?? 'Ziyaret öncelikleri checklist sayfasındaki plan görünümünde izlenir.',
      meta: input.visitPriorityValue,
      status: visitPriorityPending ? 'Bekliyor' : visitPriorityCount > 0 ? 'Planla' : 'Hazır',
      cta: input.visitPriorityActionLabel ?? 'Planı aç',
      href: '/store/checklists?canvasView=plan',
      routeLabel: 'Checklistler',
      tone: visitPriorityPending || visitPriorityCount > 0 ? 'amber' : 'mint',
      icon: input.icons.store,
      priority: 25,
      filter: visitPriorityPending || visitPriorityCount > 0 ? 'critical' : 'approval',
      testId: 'store-home-visit-priority-card',
    })
  }

  if (input.availablePaths.has('/store/tasks') && input.persona !== 'personnel' && input.persona !== 'visualMerchandiser') {
    const pendingTasks = countNumeric(input.pendingWorkValue)
    const taskValuePending = pendingTasks === 0 && !/^\d+$/.test(input.pendingWorkValue)
    priorities.push({
      id: 'tasks',
      source: 'Görevler',
      title: taskValuePending
        ? 'Görev verisi bekleniyor'
        : pendingTasks > 0
          ? 'Açık görevler takipte'
          : 'Görev akışı hazır',
      detail: 'Açık aksiyonlar ve tamamlanan süreçler görevler sayfasında izlenir.',
      meta: input.pendingWorkValue,
      status: taskValuePending ? 'Bekliyor' : pendingTasks > 0 ? 'Takipte' : 'Hazır',
      cta: 'Görevleri aç',
      href: '/store/tasks',
      routeLabel: 'Görevler',
      tone: taskValuePending ? 'amber' : pendingTasks > 0 ? 'rose' : 'mint',
      icon: input.icons.bell,
      priority: 30,
      filter: taskValuePending || pendingTasks > 0 ? 'critical' : 'approval',
    })
  }

  if (input.availablePaths.has('/store/incentives') && input.persona !== 'personnel' && input.persona !== 'visualMerchandiser') {
    priorities.push({
      id: 'incentives',
      source: 'Primler',
      title: input.persona === 'regionManager'
        ? 'Prim paketi kontrol ekranı'
        : 'Prim hakedişini takip et',
      detail: 'Prim hakedişleri ve dönem kontrolü primler sayfasında okunur.',
      meta: input.periodLabel,
      status: 'Kontrol',
      cta: 'Primleri aç',
      href: '/store/incentives',
      routeLabel: 'Primler',
      tone: 'plum',
      icon: input.icons.wallet,
      priority: 40,
      filter: 'approval',
    })
  }

  if (input.availablePaths.has('/store/workforce') && input.persona !== 'personnel' && input.persona !== 'visualMerchandiser') {
    priorities.push({
      id: 'workforce',
      source: 'Norm Kadro',
      title: 'Norm kadro görünümü',
      detail: 'Aktif personel, norm dengesi ve eksik süreleri norm kadro sayfasında izlenir.',
      meta: input.storeScopeValue,
      status: 'İzle',
      cta: 'Norm kadroyu aç',
      href: '/store/workforce',
      routeLabel: 'Norm Kadro',
      tone: 'amber',
      icon: input.icons.users,
      priority: 50,
      filter: 'critical',
    })
  }

  if (input.persona === 'personnel' && input.availablePaths.has('/store/me')) {
    priorities.push({
      id: 'performance',
      source: 'Benim Performansım',
      title: 'Kişisel performansını takip et',
      detail: 'KPI, sıralama ve kişisel performans detayları kendi sayfasında görünür.',
      meta: 'KPI',
      status: 'Hazır',
      cta: 'Performansı aç',
      href: '/store/me',
      routeLabel: 'Benim Performansım',
      tone: 'cyan',
      icon: input.icons.trending,
      priority: 10,
      filter: 'approval',
    })
  }

  if (input.availablePaths.has('/store/feed')) {
    priorities.push({
      id: 'announcements',
      source: 'Duyurular',
      title: 'Duyuru akışını kontrol et',
      detail: 'Sabit ve son gönderiler duyurular sayfasında görünür.',
      meta: 'Bugün',
      status: 'Açık',
      cta: 'Duyuruları aç',
      href: '/store/feed',
      routeLabel: 'Duyurular',
      tone: 'plum',
      icon: input.icons.megaphone,
      priority: 90,
      filter: 'announcement',
    })
  }

  const sortedPriorities = [...priorities].sort((left, right) => left.priority - right.priority)
  const criticalCount = sortedPriorities.filter((priority) => priority.tone === 'rose' || priority.tone === 'amber').length
  const pendingApprovalValue =
    input.pendingRequestsValue ??
    (input.checklistTone === 'attention' ? input.checklistMetricValue ?? '0' : '0')
  const quickLinks: StoreHomeCommandQuickLink[] = []

  if (input.availablePaths.has('/store/kpis')) {
    quickLinks.push({
      id: 'kpis',
      label: 'KPI özetleri',
      value: input.readyValue,
      href: '/store/kpis',
      icon: input.icons.trending,
      tone: 'cyan',
    })
  }

  if (input.availablePaths.has('/store/reports')) {
    quickLinks.push({
      id: 'reports',
      label: 'Raporlar',
      value: input.readyValue,
      href: '/store/reports',
      icon: input.icons.file,
      tone: 'mint',
    })
  }

  if (input.availablePaths.has('/store/feed')) {
    quickLinks.push({
      id: 'feed',
      label: 'Duyurular',
      value: 'Aç',
      href: '/store/feed',
      icon: input.icons.megaphone,
      tone: 'plum',
    })
  }

  return {
    persona: input.persona,
    personaLabel: input.personaLabel,
    identityLabel: input.identityLabel,
    periodLabel: input.periodLabel,
    todayTitle: 'Bugün',
    todayNote: sortedPriorities[0]?.title ?? 'Bugün bekleyen iş yok',
    metrics: [
      {
        id: 'urgent',
        label: 'Acil iş',
        value: String(criticalCount),
        note: 'Bugün karar bekliyor',
        tone: criticalCount > 0 ? 'rose' : 'mint',
        icon: input.icons.alert,
      },
      {
        id: 'pending',
        label: 'Onay bekleyen',
        value: pendingApprovalValue,
        note: 'Hedef ve checklist',
        tone: countNumeric(pendingApprovalValue) > 0 ? 'amber' : 'mint',
        icon: input.icons.shield,
      },
      {
        id: 'stores',
        label: input.persona === 'regionManager' ? 'Takipte mağaza' : 'Yetkili mağaza',
        value: input.persona === 'regionManager' ? (input.visitPriorityValue ?? input.storeScopeValue) : input.storeScopeValue,
        note: input.persona === 'regionManager' ? 'Bölge portföyü' : 'Mağaza kapsamı',
        tone: 'cyan',
        icon: input.icons.store,
      },
      {
        id: 'feed',
        label: 'Duyurular',
        value: input.availablePaths.has('/store/feed') ? 'Hazır' : 'Yok',
        note: 'Sabit ve son gönderiler',
        tone: 'plum',
        icon: input.icons.megaphone,
      },
    ],
    priorities: sortedPriorities,
    announcements: input.availablePaths.has('/store/feed')
      ? [
          {
            id: 'feed-entry',
            label: 'Duyuru',
            copy: 'Duyurular sayfasında sabit ve son gönderiler görünür.',
            time: 'Bugün',
          },
        ]
      : [],
    quickLinks,
  }
}
