import { adminNavDefinitions } from '../../app/admin-navigation'
import type { TranslationKey } from '../localization/dictionary'

export const primaryPilotRoleCodes = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'REGION_MANAGER',
  'STORE_MANAGER',
  'STORE_PERSONNEL',
  'REPORT_VIEWER',
] as const

export const supportRoleCodes = [
  'INTEGRATION_ADMIN',
  'AUDITOR',
  'SNAPSHOT_OPERATOR',
  'VISUAL_MERCHANDISER',
] as const

export type PreviewShell = 'admin' | 'store'

export type RolePermissionPreviewRow = {
  id: string
  route: string
  labelKey: TranslationKey
  shell: PreviewShell
  allowedRoles: string[]
  scopeNoteKey: TranslationKey
  actionNoteKey: TranslationKey
}

const allPreviewRoleCodes = [...primaryPilotRoleCodes, ...supportRoleCodes]
const nonVisualMerchandiserStoreRouteRoles = allPreviewRoleCodes.filter(
  (roleCode) => roleCode !== 'VISUAL_MERCHANDISER',
)
const checklistReadRoleCodes = [
  'SUPER_ADMIN',
  'REGION_MANAGER',
  'STORE_MANAGER',
  'REPORT_VIEWER',
  'VISUAL_MERCHANDISER',
]
const storePerformanceRoleCodes = ['SUPER_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'STORE_PERSONNEL', 'REPORT_VIEWER']
const storeKpiRoleCodes = ['SUPER_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'REPORT_VIEWER']
const storeReportingRoleCodes = ['SUPER_ADMIN', 'REGION_MANAGER', 'REPORT_VIEWER', 'AUDITOR']
const targetRequestListRoleCodes = ['SUPER_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'REPORT_VIEWER']
const storeTaskReadRoleCodes = ['SUPER_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER', 'REPORT_VIEWER']
const storeCompetitionReadRoleCodes = ['STORE_MANAGER', 'STORE_PERSONNEL', 'REPORT_VIEWER']
const storeWorkforceReadRoleCodes = ['STORE_MANAGER', 'REGION_MANAGER', 'REPORT_VIEWER']

const adminRouteNotes: Record<string, Pick<RolePermissionPreviewRow, 'scopeNoteKey' | 'actionNoteKey'>> = {
  operations: {
    scopeNoteKey: 'authAdmin.previewScopeOperations',
    actionNoteKey: 'authAdmin.previewActionReadOnlyTelemetry',
  },
  dataQuality: {
    scopeNoteKey: 'authAdmin.previewScopeDataQuality',
    actionNoteKey: 'authAdmin.previewActionReadOnlyDataQuality',
  },
  integrations: {
    scopeNoteKey: 'authAdmin.previewScopeCompany',
    actionNoteKey: 'authAdmin.previewActionImportBoundary',
  },
  masterData: {
    scopeNoteKey: 'authAdmin.previewScopeCompany',
    actionNoteKey: 'authAdmin.previewActionMasterDataBoundary',
  },
  snapshots: {
    scopeNoteKey: 'authAdmin.previewScopeCompany',
    actionNoteKey: 'authAdmin.previewActionSnapshotBoundary',
  },
  inbox: {
    scopeNoteKey: 'authAdmin.previewScopeWorkflow',
    actionNoteKey: 'authAdmin.previewActionInboxRead',
  },
  feed: {
    scopeNoteKey: 'authAdmin.previewScopeAnnouncement',
    actionNoteKey: 'authAdmin.previewActionAnnouncementBoundary',
  },
  checklists: {
    scopeNoteKey: 'authAdmin.previewScopeChecklist',
    actionNoteKey: 'authAdmin.previewActionChecklistBoundary',
  },
  competitions: {
    scopeNoteKey: 'authAdmin.previewScopeCompetition',
    actionNoteKey: 'authAdmin.previewActionCompetitionBoundary',
  },
  reports: {
    scopeNoteKey: 'authAdmin.previewScopeReporting',
    actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
  },
  targets: {
    scopeNoteKey: 'authAdmin.previewScopeTarget',
    actionNoteKey: 'authAdmin.previewActionTargetBoundary',
  },
  kpiConfig: {
    scopeNoteKey: 'authAdmin.previewScopeRules',
    actionNoteKey: 'authAdmin.previewActionKpiConfigBoundary',
  },
  pilotFeedback: {
    scopeNoteKey: 'authAdmin.previewScopePilotFeedback',
    actionNoteKey: 'authAdmin.previewActionPilotFeedbackBoundary',
  },
  auth: {
    scopeNoteKey: 'authAdmin.previewScopeAuthAdmin',
    actionNoteKey: 'authAdmin.previewActionAuthMutationBoundary',
  },
  audit: {
    scopeNoteKey: 'authAdmin.previewScopeAudit',
    actionNoteKey: 'authAdmin.previewActionAuditRead',
  },
  session: {
    scopeNoteKey: 'authAdmin.previewScopeSession',
    actionNoteKey: 'authAdmin.previewActionSessionRead',
  },
}

const storePreviewRows: RolePermissionPreviewRow[] = [
  {
    id: 'store-root',
    route: '/store',
    labelKey: 'storeHome.nav.home',
    shell: 'store',
    allowedRoles: allPreviewRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeStoreShell',
    actionNoteKey: 'authAdmin.previewActionStoreRead',
  },
  {
    id: 'store-home',
    route: '/store/home',
    labelKey: 'storeHome.nav.home',
    shell: 'store',
    allowedRoles: nonVisualMerchandiserStoreRouteRoles,
    scopeNoteKey: 'authAdmin.previewScopeStoreShell',
    actionNoteKey: 'authAdmin.previewActionStoreRead',
  },
  {
    id: 'store-me',
    route: '/store/me',
    labelKey: 'storeHome.nav.myPerformance',
    shell: 'store',
    allowedRoles: ['STORE_MANAGER', 'STORE_PERSONNEL'],
    scopeNoteKey: 'authAdmin.previewScopeOwnPerformance',
    actionNoteKey: 'authAdmin.previewActionReadOnlyPerformance',
  },
  {
    id: 'store-personnel-performance',
    route: '/store/personnel/:employeeId',
    labelKey: 'storeHome.nav.myPerformance',
    shell: 'store',
    allowedRoles: storePerformanceRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeOwnPerformance',
    actionNoteKey: 'authAdmin.previewActionReadOnlyPerformance',
  },
  {
    id: 'store-rankings',
    route: '/store/rankings',
    labelKey: 'storeHome.nav.rankings',
    shell: 'store',
    allowedRoles: storePerformanceRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeRanking',
    actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
  },
  {
    id: 'store-approvals',
    route: '/store/approvals',
    labelKey: 'storeHome.nav.requestsApprovals',
    shell: 'store',
    allowedRoles: targetRequestListRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeTarget',
    actionNoteKey: 'authAdmin.previewActionAssignedStoreRequired',
  },
  {
    id: 'store-checklists',
    route: '/store/checklists',
    labelKey: 'storeHome.nav.checklists',
    shell: 'store',
    allowedRoles: checklistReadRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeChecklist',
    actionNoteKey: 'authAdmin.previewActionAssignedStoreRequired',
  },
  {
    id: 'store-tasks',
    route: '/store/tasks',
    labelKey: 'storeHome.nav.tasks',
    shell: 'store',
    allowedRoles: storeTaskReadRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeWorkflow',
    actionNoteKey: 'authAdmin.previewActionStoreActionBoundary',
  },
  {
    id: 'store-kpis',
    route: '/store/kpis',
    labelKey: 'storeHome.nav.storeKpis',
    shell: 'store',
    allowedRoles: storeKpiRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeStoreKpi',
    actionNoteKey: 'authAdmin.previewActionReadOnlyPerformance',
  },
  {
    id: 'store-feed',
    route: '/store/feed',
    labelKey: 'storeHome.nav.announcements',
    shell: 'store',
    allowedRoles: allPreviewRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeAnnouncement',
    actionNoteKey: 'authAdmin.previewActionAnnouncementBoundary',
  },
  {
    id: 'store-competitions',
    route: '/store/competitions',
    labelKey: 'storeHome.competitions',
    shell: 'store',
    allowedRoles: storeCompetitionReadRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeCompetition',
    actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
  },
  {
    id: 'store-incentives',
    route: '/store/incentives',
    labelKey: 'storeHome.storeIncentives',
    shell: 'store',
    allowedRoles: nonVisualMerchandiserStoreRouteRoles,
    scopeNoteKey: 'authAdmin.previewScopeStoreShell',
    actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
  },
  {
    id: 'store-settings',
    route: '/store/settings',
    labelKey: 'storeHome.nav.settings',
    shell: 'store',
    allowedRoles: allPreviewRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeStoreShell',
    actionNoteKey: 'authAdmin.previewActionStoreRead',
  },
  {
    id: 'store-targets',
    route: '/store/targets',
    labelKey: 'storeHome.nav.targets',
    shell: 'store',
    allowedRoles: targetRequestListRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeTarget',
    actionNoteKey: 'authAdmin.previewActionTargetBoundary',
  },
  {
    id: 'store-workforce',
    route: '/store/workforce',
    labelKey: 'storeHome.nav.workforce',
    shell: 'store',
    allowedRoles: storeWorkforceReadRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeCompany',
    actionNoteKey: 'authAdmin.previewActionAssignedStoreRequired',
  },
  {
    id: 'store-reports',
    route: '/store/reports',
    labelKey: 'storeHome.nav.reports',
    shell: 'store',
    allowedRoles: storeReportingRoleCodes,
    scopeNoteKey: 'authAdmin.previewScopeReporting',
    actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
  },
]

export function getRolePermissionPreviewRows(): RolePermissionPreviewRow[] {
  const adminRows = adminNavDefinitions.map((item): RolePermissionPreviewRow => {
    const notes = adminRouteNotes[item.id] ?? {
      scopeNoteKey: 'authAdmin.previewScopeCompany',
      actionNoteKey: 'authAdmin.previewActionReadOnlyReports',
    }

    return {
      id: `admin-${item.id}`,
      route: item.to,
      labelKey: item.labelKey,
      shell: 'admin',
      allowedRoles: item.roles ?? allPreviewRoleCodes,
      scopeNoteKey: notes.scopeNoteKey,
      actionNoteKey: notes.actionNoteKey,
    }
  })

  return [...adminRows, ...storePreviewRows]
}

export function getPreviewRoleOptions(lookupRoles: Array<{ roleCode: string; roleName: string }>) {
  const lookupByCode = new Map(lookupRoles.map((role) => [role.roleCode, role.roleName]))
  const orderedCodes = [...primaryPilotRoleCodes, ...supportRoleCodes]

  return orderedCodes.map((roleCode) => ({
    roleCode,
    roleName: lookupByCode.get(roleCode) ?? roleCode,
    primary: primaryPilotRoleCodes.includes(roleCode as (typeof primaryPilotRoleCodes)[number]),
  }))
}
