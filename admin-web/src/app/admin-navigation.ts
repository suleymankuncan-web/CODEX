import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  CircleDollarSign,
  DatabaseZap,
  Fingerprint,
  KeyRound,
  Layers3,
  Megaphone,
  MessageSquareWarning,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trophy,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslationKey } from '../features/localization/dictionary'
import { hasAnyRole } from './shell-state'

export type NavDefinition = {
  id: AdminNavIconId
  to: string
  icon: LucideIcon
  labelKey: TranslationKey
  roles?: string[]
  section: 'primary' | 'secondary' | 'utility'
}

type AdminNavIconId =
  | 'audit'
  | 'auth'
  | 'checklists'
  | 'competitions'
  | 'dataQuality'
  | 'feed'
  | 'inbox'
  | 'incentives'
  | 'integrations'
  | 'kpiConfig'
  | 'masterData'
  | 'operations'
  | 'pilotFeedback'
  | 'reports'
  | 'session'
  | 'snapshots'
  | 'targets'

export const adminNavDefinitions: NavDefinition[] = [
  {
    id: 'inbox',
    to: '/admin/inbox',
    icon: Bell,
    labelKey: 'adminShell.nav.inbox',
    roles: ['SUPER_ADMIN', 'HR_ADMIN'],
    section: 'primary',
  },
  {
    id: 'masterData',
    to: '/admin/master-data',
    icon: DatabaseZap,
    labelKey: 'adminShell.nav.masterData',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
    section: 'primary',
  },
  {
    id: 'auth',
    to: '/admin/auth',
    icon: ShieldCheck,
    labelKey: 'adminShell.nav.auth',
    roles: ['SUPER_ADMIN'],
    section: 'primary',
  },
  {
    id: 'kpiConfig',
    to: '/admin/kpi-config',
    icon: SlidersHorizontal,
    labelKey: 'adminShell.nav.kpiConfig',
    roles: ['SUPER_ADMIN'],
    section: 'primary',
  },
  {
    id: 'checklists',
    to: '/admin/checklists',
    icon: ClipboardList,
    labelKey: 'adminShell.nav.checklists',
    roles: ['SUPER_ADMIN', 'HR_ADMIN'],
    section: 'primary',
  },
  {
    id: 'targets',
    to: '/admin/targets',
    icon: Target,
    labelKey: 'adminShell.nav.targets',
    roles: ['SUPER_ADMIN', 'REGION_MANAGER'],
    section: 'primary',
  },
  {
    id: 'incentives',
    to: '/admin/incentives',
    icon: CircleDollarSign,
    labelKey: 'adminShell.nav.incentives',
    roles: ['SUPER_ADMIN'],
    section: 'primary',
  },
  {
    id: 'reports',
    to: '/admin/reports',
    icon: BarChart3,
    labelKey: 'adminShell.nav.reports',
    roles: ['SUPER_ADMIN'],
    section: 'primary',
  },
  {
    id: 'feed',
    to: '/admin/feed',
    icon: Megaphone,
    labelKey: 'adminShell.nav.feed',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'],
    section: 'primary',
  },
  {
    id: 'competitions',
    to: '/admin/competitions',
    icon: Trophy,
    labelKey: 'adminShell.nav.competitions',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'],
    section: 'primary',
  },
  {
    id: 'operations',
    to: '/admin/operations',
    icon: Activity,
    labelKey: 'adminShell.nav.operations',
    roles: ['SUPER_ADMIN'],
    section: 'secondary',
  },
  {
    id: 'dataQuality',
    to: '/admin/data-quality',
    icon: DatabaseZap,
    labelKey: 'adminShell.nav.dataQuality',
    roles: ['SUPER_ADMIN'],
    section: 'secondary',
  },
  {
    id: 'integrations',
    to: '/admin/integrations',
    icon: DatabaseZap,
    labelKey: 'adminShell.nav.integrations',
    roles: ['SUPER_ADMIN', 'INTEGRATION_ADMIN'],
    section: 'secondary',
  },
  {
    id: 'snapshots',
    to: '/admin/snapshots',
    icon: Layers3,
    labelKey: 'adminShell.nav.snapshots',
    roles: ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'],
    section: 'secondary',
  },
  {
    id: 'pilotFeedback',
    to: '/admin/pilot-feedback',
    icon: MessageSquareWarning,
    labelKey: 'adminShell.nav.pilotFeedback',
    roles: ['SUPER_ADMIN'],
    section: 'secondary',
  },
  {
    id: 'audit',
    to: '/admin/audit',
    icon: Fingerprint,
    labelKey: 'adminShell.nav.audit',
    roles: ['SUPER_ADMIN', 'AUDITOR'],
    section: 'secondary',
  },
  {
    id: 'session',
    to: '/admin/session',
    icon: KeyRound,
    labelKey: 'adminShell.nav.session',
    roles: [
      'SUPER_ADMIN',
      'INTEGRATION_ADMIN',
      'HR_ADMIN',
      'SNAPSHOT_OPERATOR',
      'REGION_MANAGER',
      'AUDITOR',
      'STORE_MANAGER',
      'STORE_PERSONNEL',
      'VISUAL_MERCHANDISER',
    ],
    section: 'utility',
  },
]

export function groupAdminNavigation(items: NavDefinition[]) {
  return {
    primary: items.filter((item) => item.section === 'primary'),
    secondary: items.filter((item) => item.section === 'secondary'),
    utility: items.filter((item) => item.section === 'utility'),
  }
}

export function isNavAllowed(item: NavDefinition, authSummary: AuthSessionSummary | null) {
  if (!item.roles) {
    return true
  }

  return hasAnyRole(authSummary?.user.roleCodes ?? [], item.roles)
}
