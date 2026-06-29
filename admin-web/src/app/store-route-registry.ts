import type { AuthSessionSummary } from '../features/auth/api'
import {
  canListTargetDistributionRequests,
  canOpenStoreChecklists,
  canOpenStoreWorkforce,
  getAssignedStoreTypes,
  hasAnyRole,
} from '../features/auth/authorization'
import type { TranslationKey } from '../features/localization/dictionary'

export type StorePersona =
  | 'admin'
  | 'personnel'
  | 'storeManager'
  | 'regionManager'
  | 'visualMerchandiser'

export type StoreRouteId =
  | 'approvals'
  | 'checklists'
  | 'competitions'
  | 'feed'
  | 'home'
  | 'incentives'
  | 'kpis'
  | 'me'
  | 'personnel'
  | 'rankings'
  | 'reports'
  | 'settings'
  | 'targets'
  | 'tasks'
  | 'workforce'

export type StoreNavIconId =
  | 'approvals'
  | 'checklist'
  | 'competitions'
  | 'feed'
  | 'home'
  | 'incentives'
  | 'kpi'
  | 'me'
  | 'rankings'
  | 'reports'
  | 'settings'
  | 'targets'
  | 'tasks'
  | 'workforce'

export type StoreNavigationItem = {
  id: StoreRouteId
  labelKey: TranslationKey
  path: string
  icon: StoreNavIconId
  end?: boolean
}

export type StoreRouteDefinition = {
  id: StoreRouteId
  path: string
  routePath: string
  aliases?: string[]
  nav?: Omit<StoreNavigationItem, 'id' | 'path'>
  allowVisualMerchandiser?: boolean
  modulePreload: () => Promise<unknown>
  access: (authSummary: AuthSessionSummary | null) => boolean
  match?: (pathname: string) => boolean
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

const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN']
const storeReportingRoles = ['SUPER_ADMIN', 'REPORT_VIEWER', 'AUDITOR', 'REGION_MANAGER']
const storeCompetitionRoles = ['STORE_PERSONNEL', 'STORE_MANAGER']
const storeTasksRoles = ['STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']
const storeTargetsRoles = ['STORE_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER']
const storeKpiRoles = ['STORE_MANAGER', 'REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']

function roleSet(authSummary: AuthSessionSummary | null) {
  return new Set(authSummary?.user.roleCodes ?? [])
}

function hasAdminLandingRole(authSummary: AuthSessionSummary | null) {
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

  if (roles.has('REGION_MANAGER')) {
    return 'regionManager'
  }

  if (hasAdminLandingRole(authSummary)) {
    return 'admin'
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

export function canOpenCompanyStoreIncentives(authSummary: AuthSessionSummary | null) {
  if (hasAnyRole(authSummary, ['REGION_MANAGER'])) {
    return true
  }

  if (!hasAnyRole(authSummary, ['STORE_MANAGER'])) {
    return false
  }

  return getAssignedStoreTypes(authSummary).includes('company')
}

export function canOpenStoreIncentives(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary, ['STORE_MANAGER', 'REGION_MANAGER']) &&
    canOpenCompanyStoreIncentives(authSummary)
}

const authenticated = (authSummary: AuthSessionSummary | null) => authSummary !== null

export const storeRouteDefinitions: StoreRouteDefinition[] = [
  {
    id: 'home',
    path: '/store/home',
    routePath: '/store/home',
    aliases: ['/store'],
    nav: {
      labelKey: 'storeHome.nav.home',
      icon: 'home',
      end: true,
    },
    modulePreload: () => import('../pages/StoreHomePage'),
    access: authenticated,
  },
  {
    id: 'checklists',
    path: '/store/checklists',
    routePath: '/store/checklists',
    nav: {
      labelKey: 'storeHome.nav.checklists',
      icon: 'checklist',
    },
    allowVisualMerchandiser: true,
    modulePreload: () => import('../pages/StoreChecklistsPage'),
    access: (authSummary) =>
      resolveStorePersona(authSummary) !== 'personnel' &&
      canOpenStoreChecklists(authSummary),
  },
  {
    id: 'tasks',
    path: '/store/tasks',
    routePath: '/store/tasks',
    nav: {
      labelKey: 'storeHome.nav.tasks',
      icon: 'tasks',
    },
    modulePreload: () => import('../pages/StoreTasksPage'),
    access: (authSummary) => hasAnyRole(authSummary, storeTasksRoles),
  },
  {
    id: 'kpis',
    path: '/store/kpis',
    routePath: '/store/kpis',
    nav: {
      labelKey: 'storeHome.nav.storeKpis',
      icon: 'kpi',
    },
    modulePreload: () => import('../pages/StoreKpiHighlightsPage'),
    access: (authSummary) => hasAnyRole(authSummary, storeKpiRoles),
  },
  {
    id: 'me',
    path: '/store/me',
    routePath: '/store/me',
    nav: {
      labelKey: 'storeHome.nav.myPerformance',
      icon: 'me',
    },
    modulePreload: () => import('../pages/StoreMyPerformancePage'),
    access: (authSummary) => hasAnyRole(authSummary, ['STORE_PERSONNEL', 'STORE_MANAGER']),
  },
  {
    id: 'personnel',
    path: '/store/personnel/:employeeId',
    routePath: '/store/personnel/:employeeId',
    modulePreload: () => import('../pages/StorePersonnelPerformancePage'),
    access: authenticated,
    match: (pathname) => pathname.startsWith('/store/personnel/'),
  },
  {
    id: 'rankings',
    path: '/store/rankings',
    routePath: '/store/rankings',
    nav: {
      labelKey: 'storeHome.nav.rankings',
      icon: 'rankings',
    },
    modulePreload: () => import('../pages/StoreRankingsPage'),
    access: (authSummary) => hasAnyRole(authSummary, rankingRoles),
  },
  {
    id: 'feed',
    path: '/store/feed',
    routePath: '/store/feed',
    nav: {
      labelKey: 'storeHome.nav.announcements',
      icon: 'feed',
    },
    allowVisualMerchandiser: true,
    modulePreload: () => import('../pages/StoreFeedPage'),
    access: authenticated,
  },
  {
    id: 'competitions',
    path: '/store/competitions',
    routePath: '/store/competitions',
    nav: {
      labelKey: 'storeHome.nav.competitions',
      icon: 'competitions',
    },
    modulePreload: () => import('../pages/StoreCompetitionsPage'),
    access: (authSummary) => hasAnyRole(authSummary, storeCompetitionRoles),
  },
  {
    id: 'approvals',
    path: '/store/approvals',
    routePath: '/store/approvals',
    nav: {
      labelKey: 'storeHome.nav.requestsApprovals',
      icon: 'approvals',
    },
    modulePreload: () => import('../pages/StoreApprovalsPage'),
    access: (authSummary) => canListTargetDistributionRequests(authSummary),
  },
  {
    id: 'incentives',
    path: '/store/incentives',
    routePath: '/store/incentives',
    nav: {
      labelKey: 'storeHome.nav.incentives',
      icon: 'incentives',
    },
    modulePreload: () => import('../pages/StoreIncentivesPage'),
    access: canOpenStoreIncentives,
  },
  {
    id: 'settings',
    path: '/store/settings',
    routePath: '/store/settings',
    nav: {
      labelKey: 'storeHome.nav.settings',
      icon: 'settings',
    },
    allowVisualMerchandiser: true,
    modulePreload: () => import('../pages/StoreSettingsPage'),
    access: authenticated,
  },
  {
    id: 'targets',
    path: '/store/targets',
    routePath: '/store/targets',
    nav: {
      labelKey: 'storeHome.nav.targets',
      icon: 'targets',
    },
    modulePreload: () => import('../pages/StoreTargetsPage'),
    access: (authSummary) =>
      hasAnyRole(authSummary, storeTargetsRoles) &&
      canListTargetDistributionRequests(authSummary),
  },
  {
    id: 'workforce',
    path: '/store/workforce',
    routePath: '/store/workforce',
    nav: {
      labelKey: 'storeHome.nav.workforce',
      icon: 'workforce',
    },
    modulePreload: () => import('../pages/StoreWorkforcePage'),
    access: (authSummary) => canOpenStoreWorkforce(authSummary),
  },
  {
    id: 'reports',
    path: '/store/reports',
    routePath: '/store/reports',
    nav: {
      labelKey: 'storeHome.nav.reports',
      icon: 'reports',
    },
    modulePreload: () => import('../pages/StoreReportsPage'),
    access: (authSummary) => hasAnyRole(authSummary, storeReportingRoles),
  },
]

const navigationByPersona: Record<StorePersona, StoreRouteId[]> = {
  admin: [
    'home',
    'rankings',
    'kpis',
    'checklists',
    'approvals',
    'targets',
    'incentives',
    'workforce',
    'tasks',
    'reports',
    'feed',
    'settings',
  ],
  personnel: ['home', 'me', 'rankings', 'feed', 'settings'],
  storeManager: [
    'home',
    'kpis',
    'rankings',
    'approvals',
    'targets',
    'incentives',
    'workforce',
    'tasks',
    'checklists',
    'feed',
    'settings',
  ],
  regionManager: [
    'home',
    'rankings',
    'kpis',
    'checklists',
    'approvals',
    'targets',
    'incentives',
    'workforce',
    'tasks',
    'reports',
    'feed',
    'settings',
  ],
  visualMerchandiser: ['checklists', 'feed', 'settings'],
}

const routeById = new Map(storeRouteDefinitions.map((route) => [route.id, route]))

function toNavigationItem(route: StoreRouteDefinition): StoreNavigationItem | null {
  if (!route.nav) return null

  return {
    id: route.id,
    labelKey: route.nav.labelKey,
    path: route.path,
    icon: route.nav.icon,
    ...(route.nav.end === undefined ? {} : { end: route.nav.end }),
  }
}

export function getStoreRouteDefinitions() {
  return storeRouteDefinitions
}

export function getStoreRouteDefinition(id: StoreRouteId) {
  return routeById.get(id)
}

export function findStoreRouteDefinition(pathname: string) {
  return storeRouteDefinitions.find((route) =>
    route.path === pathname ||
    route.aliases?.includes(pathname) ||
    route.match?.(pathname),
  ) ?? null
}

export function isStoreRouteAllowed(
  route: StoreRouteDefinition | StoreRouteId,
  authSummary: AuthSessionSummary | null,
) {
  const definition = typeof route === 'string' ? getStoreRouteDefinition(route) : route
  return definition?.access(authSummary) ?? false
}

export function getStoreNavigation(persona: StorePersona) {
  return navigationByPersona[persona]
    .map((id) => {
      const route = getStoreRouteDefinition(id)
      return route ? toNavigationItem(route) : null
    })
    .filter((item): item is StoreNavigationItem => item !== null)
}

export function getRoleAwareStoreNavigation(authSummary: AuthSessionSummary | null) {
  const persona = resolveStorePersona(authSummary)
  return getStoreNavigation(persona).filter((item) =>
    isStoreRouteAllowed(item.id, authSummary),
  )
}

export function getStorePersonaLabelKey(persona: StorePersona): TranslationKey {
  if (persona === 'admin') return 'storeHome.persona.admin'
  if (persona === 'visualMerchandiser') return 'storeHome.persona.visualMerchandiser'
  if (persona === 'regionManager') return 'storeHome.persona.regionManager'
  if (persona === 'storeManager') return 'storeHome.persona.storeManager'
  return 'storeHome.persona.personnel'
}

export function getFirstAllowedStorePath(authSummary: AuthSessionSummary | null) {
  return getRoleAwareStoreNavigation(authSummary)[0]?.path ?? '/store/home'
}

export function getStoreLandingPath(authSummary: AuthSessionSummary | null) {
  const persona = resolveStorePersona(authSummary)

  if (persona === 'visualMerchandiser') {
    return isStoreRouteAllowed('checklists', authSummary) ? '/store/checklists' : getFirstAllowedStorePath(authSummary)
  }

  if (persona === 'personnel' && isStoreRouteAllowed('me', authSummary)) {
    return '/store/me'
  }

  return getFirstAllowedStorePath(authSummary)
}
