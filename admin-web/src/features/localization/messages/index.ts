import { adminAuditEn, adminAuditTr } from './admin-audit'
import { adminChecklistsEn, adminChecklistsTr } from './admin-checklists'
import { authAuditDetailsEn, authAuditDetailsTr } from './auth-audit-details'
import { authCatalogEn, authCatalogTr } from './auth-catalog'
import { authFlowEn, authFlowTr } from './auth-flow'
import { adminFeedEn, adminFeedTr } from './admin-feed'
import { adminInboxEn, adminInboxTr } from './admin-inbox'
import { adminIntegrationsEn, adminIntegrationsTr } from './admin-integrations'
import { adminKpiConfigEn, adminKpiConfigTr } from './admin-kpi-config'
import { adminMasterDataEn, adminMasterDataTr } from './admin-master-data'
import { adminShellEn, adminShellTr } from './admin-shell'
import { adminSnapshotsEn, adminSnapshotsTr } from './admin-snapshots'
import { adminTargetsEn, adminTargetsTr } from './admin-targets'
import { commonEn, commonTr } from './common'
import { competitionEn, competitionTr } from './competition'
import { reportsChecklistsEn, reportsChecklistsTr } from './reports-checklists'
import { reportsKpisEn, reportsKpisTr } from './reports-kpis'
import { reportsSummaryEn, reportsSummaryTr } from './reports-summary'
import { reportsSnapshotRunsEn, reportsSnapshotRunsTr } from './reports-snapshot-runs'
import { reportsTurnoverEn, reportsTurnoverTr } from './reports-turnover'
import { reportsWorkforceEn, reportsWorkforceTr } from './reports-workforce'
import { sessionReadinessEn, sessionReadinessTr } from './session-readiness'
import { storeApprovalsEn, storeApprovalsTr } from './store-approvals'
import { storeChecklistsEn, storeChecklistsTr } from './store-checklists'
import { storeCompetitionsEn, storeCompetitionsTr } from './store-competitions'
import { storeFeedEn, storeFeedTr } from './store-feed'
import { storeHomeEn, storeHomeTr } from './store-home'
import { storeIncentivesEn, storeIncentivesTr } from './store-incentives'
import { storeKpisEn, storeKpisTr } from './store-kpis'
import { storeMeEn, storeMeTr } from './store-me'
import { storeRankingsEn, storeRankingsTr } from './store-rankings'
import { storeTasksEn, storeTasksTr } from './store-tasks'

const tr = {
  ...adminAuditTr,
  ...adminChecklistsTr,
  ...authAuditDetailsTr,
  ...authCatalogTr,
  ...authFlowTr,
  ...adminFeedTr,
  ...adminInboxTr,
  ...adminIntegrationsTr,
  ...adminKpiConfigTr,
  ...adminMasterDataTr,
  ...adminShellTr,
  ...adminSnapshotsTr,
  ...adminTargetsTr,
  ...commonTr,
  ...competitionTr,
  ...reportsChecklistsTr,
  ...reportsKpisTr,
  ...reportsSummaryTr,
  ...reportsSnapshotRunsTr,
  ...reportsTurnoverTr,
  ...reportsWorkforceTr,
  ...sessionReadinessTr,
  ...storeApprovalsTr,
  ...storeChecklistsTr,
  ...storeCompetitionsTr,
  ...storeFeedTr,
  ...storeHomeTr,
  ...storeIncentivesTr,
  ...storeKpisTr,
  ...storeMeTr,
  ...storeRankingsTr,
  ...storeTasksTr,
} as const

const en: Record<keyof typeof tr, string> = {
  ...adminAuditEn,
  ...adminChecklistsEn,
  ...authAuditDetailsEn,
  ...authCatalogEn,
  ...authFlowEn,
  ...adminFeedEn,
  ...adminInboxEn,
  ...adminIntegrationsEn,
  ...adminKpiConfigEn,
  ...adminMasterDataEn,
  ...adminShellEn,
  ...adminSnapshotsEn,
  ...adminTargetsEn,
  ...commonEn,
  ...competitionEn,
  ...reportsChecklistsEn,
  ...reportsKpisEn,
  ...reportsSummaryEn,
  ...reportsSnapshotRunsEn,
  ...reportsTurnoverEn,
  ...reportsWorkforceEn,
  ...sessionReadinessEn,
  ...storeApprovalsEn,
  ...storeChecklistsEn,
  ...storeCompetitionsEn,
  ...storeFeedEn,
  ...storeHomeEn,
  ...storeIncentivesEn,
  ...storeKpisEn,
  ...storeMeEn,
  ...storeRankingsEn,
  ...storeTasksEn,
}

export const messages = { tr, en } as const
