import type { AuthSessionSummary } from '../features/auth/api'
import {
  canListTargetDistributionRequests,
  canOpenStoreChecklists,
  hasAnyRole,
} from '../features/auth/authorization'
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

type StoreNavigationItem = {
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

function hasAdminLandingRole(authSummary: AuthSessionSummary | null) {
  const roles = roleSet(authSummary)
  return Array.from(adminLandingRoles).some((role) => roles.has(role))
}

function isStoreVisualMerchandiserOnly(authSummary: AuthSessionSummary | null) {
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

  if (roles.has('STORE_MANAGER')) {
    return 'storeManager'
  }

  if (roles.has('STORE_PERSONNEL')) {
    return 'personnel'
  }

  if (assignedStoreIds.length > 0) {
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
    id: 'targets',
    labelKey: 'storeHome.nav.targets',
    path: '/store/targets',
    icon: 'targets',
  },
  {
    id: 'tasks',
    labelKey: 'storeHome.nav.tasks',
    path: '/store/tasks',
    icon: 'tasks',
  },
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
    id: 'tasks',
    labelKey: 'storeHome.nav.tasks',
    path: '/store/tasks',
    icon: 'tasks',
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

const settingsNavigationItem: StoreNavigationItem = {
  id: 'settings',
  labelKey: 'storeHome.nav.settings',
  path: '/store/settings',
  icon: 'settings',
}

export function getStoreNavigation(persona: StorePersona) {
  if (persona === 'visualMerchandiser') return [...visualMerchandiserNavigation, settingsNavigationItem]
  if (persona === 'regionManager') return [...regionManagerNavigation, settingsNavigationItem]
  if (persona === 'storeManager') return [...managerNavigation, settingsNavigationItem]
  return [...personnelNavigation, settingsNavigationItem]
}

function isStoreNavigationItemAllowed(
  item: StoreNavigationItem,
  authSummary: AuthSessionSummary | null,
) {
  switch (item.id) {
    case 'home':
    case 'feed':
      return true
    case 'me':
      return hasAnyRole(authSummary, ['STORE_PERSONNEL', 'STORE_MANAGER'])
    case 'rankings':
      return hasAnyRole(authSummary, ['STORE_PERSONNEL', 'STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN'])
    case 'kpis':
      return hasAnyRole(authSummary, ['STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])
    case 'checklists':
      return canOpenStoreChecklists(authSummary)
    case 'approvals':
      return canListTargetDistributionRequests(authSummary)
    case 'tasks':
      return hasAnyRole(authSummary, ['STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])
    case 'targets':
      return hasAnyRole(authSummary, ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'])
    case 'reports':
      return hasAnyRole(authSummary, ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'STORE_MANAGER', 'REGION_MANAGER'])
    case 'settings':
      return authSummary !== null
    default:
      return false
  }
}

export function getRoleAwareStoreNavigation(authSummary: AuthSessionSummary | null) {
  const persona = resolveStorePersona(authSummary)
  return getStoreNavigation(persona).filter((item) =>
    isStoreNavigationItemAllowed(item, authSummary),
  )
}

export function getStorePersonaLabelKey(persona: StorePersona): TranslationKey {
  if (persona === 'visualMerchandiser') return 'storeHome.persona.visualMerchandiser'
  if (persona === 'regionManager') return 'storeHome.persona.regionManager'
  if (persona === 'storeManager') return 'storeHome.persona.storeManager'
  return 'storeHome.persona.personnel'
}
