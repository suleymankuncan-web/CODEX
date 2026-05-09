import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  ClipboardList,
  DatabaseZap,
  Fingerprint,
  KeyRound,
  Layers3,
  Megaphone,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trophy,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslationKey } from '../features/localization/dictionary'
import { hasAnyRole } from './shell-state'

export type NavDefinition = {
  to: string
  icon: LucideIcon
  labelKey: TranslationKey
  roles?: string[]
}

export const adminNavDefinitions: NavDefinition[] = [
  {
    to: '/admin/integrations',
    icon: DatabaseZap,
    labelKey: 'adminShell.nav.integrations',
    roles: ['SUPER_ADMIN', 'INTEGRATION_ADMIN'],
  },
  {
    to: '/admin/master-data',
    icon: DatabaseZap,
    labelKey: 'adminShell.nav.masterData',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'INTEGRATION_ADMIN'],
  },
  {
    to: '/admin/snapshots',
    icon: Layers3,
    labelKey: 'adminShell.nav.snapshots',
    roles: ['SUPER_ADMIN', 'SNAPSHOT_OPERATOR'],
  },
  {
    to: '/admin/inbox',
    icon: Bell,
    labelKey: 'adminShell.nav.inbox',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER', 'HR_ADMIN'],
  },
  {
    to: '/admin/feed',
    icon: Megaphone,
    labelKey: 'adminShell.nav.feed',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REGION_MANAGER'],
  },
  {
    to: '/admin/checklists',
    icon: ClipboardList,
    labelKey: 'adminShell.nav.checklists',
    roles: ['SUPER_ADMIN', 'HR_ADMIN'],
  },
  {
    to: '/admin/competitions',
    icon: Trophy,
    labelKey: 'adminShell.nav.competitions',
    roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'],
  },
  {
    to: '/admin/reports',
    icon: BarChart3,
    labelKey: 'adminShell.nav.reports',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER'],
  },
  {
    to: '/admin/targets',
    icon: Target,
    labelKey: 'adminShell.nav.targets',
    roles: ['SUPER_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'],
  },
  {
    to: '/admin/kpi-config',
    icon: SlidersHorizontal,
    labelKey: 'adminShell.nav.kpiConfig',
    roles: ['SUPER_ADMIN'],
  },
  {
    to: '/admin/auth',
    icon: ShieldCheck,
    labelKey: 'adminShell.nav.auth',
    roles: ['SUPER_ADMIN'],
  },
  {
    to: '/admin/audit',
    icon: Fingerprint,
    labelKey: 'adminShell.nav.audit',
    roles: ['SUPER_ADMIN', 'AUDITOR'],
  },
  {
    to: '/admin/session',
    icon: KeyRound,
    labelKey: 'adminShell.nav.session',
  },
]

export function isNavAllowed(item: NavDefinition, authSummary: AuthSessionSummary | null) {
  if (!item.roles) {
    return true
  }

  return hasAnyRole(authSummary?.user.roleCodes ?? [], item.roles)
}
