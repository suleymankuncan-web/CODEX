import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslationKey } from '../features/localization/dictionary'

export type StorePersona = 'personnel' | 'storeManager' | 'regionManager' | 'visualMerchandiser'

export type StoreNavIconId =
  | 'approvals'
  | 'checklist'
  | 'feed'
  | 'home'
  | 'kpi'
  | 'me'
  | 'rankings'
  | 'reports'
  | 'settings'
  | 'targets'
  | 'tasks'

export type StoreNavigationItem = {
  id: string
  labelKey: TranslationKey
  path: string
  icon: StoreNavIconId
  end?: boolean
}

const adminLandingRoles = new Set([
  'AUDITOR',
  'HR_ADMIN',
  'INTEGRATION_ADMIN',
  'REPORT_VIEWER',
  'SNAPSHOT_OPERATOR',
  'SUPER_ADMIN',
])

const vmBroadRoles = new Set([
  'HR_ADMIN',
  'REGION_MANAGER',
  'STORE_MANAGER',
  'STORE_PERSONNEL',
  'SUPER_ADMIN',
])

function roleSet(authSummary: AuthSessionSummary | null) {
  return new Set(authSummary?.user.roleCodes ?? [])
}

export function hasAdminLandingRole(authSummary: AuthSessionSummary | null) {
  const roles = roleSet(authSummary)
  return Array.from(adminLandingRoles).some((role) => roles.has(role))
}

export function isStoreVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
  const roles = roleSet(authSummary)
  return roles.has('VISUAL_MERCHANDISER') && !Array.from(vmBroadRoles).some((role) => roles.has(role))
}

export function resolveStorePersona(authSummary: AuthSessionSummary | null): StorePersona {
  const roles = roleSet(authSummary)

  if (isStoreVisualMerchandiserOnly(authSummary)) {
    return 'visualMerchandiser'
  }

  if (roles.has('REGION_MANAGER') || hasAdminLandingRole(authSummary)) {
    return 'regionManager'
  }

  const assignedStoreIds =
    authSummary?.user.actionScope.assignedStoreIds ??
    authSummary?.user.assignedStoreIds ??
    []

  if (roles.has('STORE_MANAGER') || assignedStoreIds.length > 0) {
    return 'storeManager'
  }

  return 'personnel'
}

const personnelNavigation: StoreNavigationItem[] = [
  {
    id: 'home',
    labelKey: 'storeHome.nav.home',
    path: '/store/home',
    icon: 'home',
    end: true,
  },
  {
    id: 'me',
    labelKey: 'storeHome.nav.myPerformance',
    path: '/store/me',
    icon: 'me',
  },
  {
    id: 'rankings',
    labelKey: 'storeHome.nav.myRanking',
    path: '/store/rankings',
    icon: 'rankings',
  },
  {
    id: 'feed',
    labelKey: 'storeHome.nav.announcements',
    path: '/store/feed',
    icon: 'feed',
  },
]

const managerNavigation: StoreNavigationItem[] = [
  {
    id: 'home',
    labelKey: 'storeHome.nav.home',
    path: '/store/home',
    icon: 'home',
    end: true,
  },
  {
    id: 'kpis',
    labelKey: 'storeHome.nav.storeKpis',
    path: '/store/kpis',
    icon: 'kpi',
  },
  {
    id: 'rankings',
    labelKey: 'storeHome.nav.rankings',
    path: '/store/rankings',
    icon: 'rankings',
  },
  {
    id: 'approvals',
    labelKey: 'storeHome.nav.requestsApprovals',
    path: '/store/approvals',
    icon: 'approvals',
  },
  {
    id: 'tasks',
    labelKey: 'storeHome.nav.tasks',
    path: '/store/tasks',
    icon: 'tasks',
  },
  {
    id: 'feed',
    labelKey: 'storeHome.nav.announcements',
    path: '/store/feed',
    icon: 'feed',
  },
]

const regionManagerNavigation: StoreNavigationItem[] = [
  {
    id: 'home',
    labelKey: 'storeHome.nav.home',
    path: '/store/home',
    icon: 'home',
    end: true,
  },
  {
    id: 'rankings',
    labelKey: 'storeHome.nav.rankings',
    path: '/store/rankings',
    icon: 'rankings',
  },
  {
    id: 'kpis',
    labelKey: 'storeHome.nav.kpiSummaries',
    path: '/store/kpis',
    icon: 'kpi',
  },
  {
    id: 'checklists',
    labelKey: 'storeHome.nav.checklists',
    path: '/store/checklists',
    icon: 'checklist',
  },
  {
    id: 'approvals',
    labelKey: 'storeHome.nav.requestsApprovals',
    path: '/store/approvals',
    icon: 'approvals',
  },
  {
    id: 'targets',
    labelKey: 'storeHome.nav.targets',
    path: '/store/targets',
    icon: 'targets',
  },
  {
    id: 'reports',
    labelKey: 'storeHome.nav.reports',
    path: '/store/reports',
    icon: 'reports',
  },
  {
    id: 'feed',
    labelKey: 'storeHome.nav.announcements',
    path: '/store/feed',
    icon: 'feed',
  },
]

const visualMerchandiserNavigation: StoreNavigationItem[] = [
  {
    id: 'checklists',
    labelKey: 'storeHome.nav.checklists',
    path: '/store/checklists',
    icon: 'checklist',
  },
  {
    id: 'feed',
    labelKey: 'storeHome.nav.announcements',
    path: '/store/feed',
    icon: 'feed',
  },
]

export function getStoreNavigation(persona: StorePersona) {
  if (persona === 'visualMerchandiser') return visualMerchandiserNavigation
  if (persona === 'regionManager') return regionManagerNavigation
  if (persona === 'storeManager') return managerNavigation
  return personnelNavigation
}

export function getStorePersonaLabelKey(persona: StorePersona): TranslationKey {
  if (persona === 'visualMerchandiser') return 'storeHome.persona.visualMerchandiser'
  if (persona === 'regionManager') return 'storeHome.persona.regionManager'
  if (persona === 'storeManager') return 'storeHome.persona.storeManager'
  return 'storeHome.persona.personnel'
}
