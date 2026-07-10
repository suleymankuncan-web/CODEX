import { adminAuditEn, adminAuditTr } from './admin-audit'
import { adminChecklistsEn, adminChecklistsTr } from './admin-checklists'
import { authAuditDetailsEn, authAuditDetailsTr } from './auth-audit-details'
import { authAdminEn, authAdminTr } from './auth-admin'
import { authCatalogEn, authCatalogTr } from './auth-catalog'
import { authFlowEn, authFlowTr } from './auth-flow'
import { adminFeedEn, adminFeedTr } from './admin-feed'
import { adminInboxEn, adminInboxTr } from './admin-inbox'
import { adminIncentivesEn, adminIncentivesTr } from './admin-incentives'
import { adminIntegrationsEn, adminIntegrationsTr } from './admin-integrations'
import { adminKpiConfigEn, adminKpiConfigTr } from './admin-kpi-config'
import { adminMasterDataEn, adminMasterDataTr } from './admin-master-data'
import { adminOperationsCapacityEn, adminOperationsCapacityTr } from './admin-operations-capacity'
import { adminOperationsEn, adminOperationsTr } from './admin-operations'
import { adminShellEn, adminShellTr } from './admin-shell'
import { adminSnapshotsEn, adminSnapshotsTr } from './admin-snapshots'
import { adminTargetsEn, adminTargetsTr } from './admin-targets'
import { commonEn, commonTr } from './common'
import { competitionAdminUxEn, competitionAdminUxTr } from './competition-admin-ux'
import { competitionEn, competitionTr } from './competition'
import { dataQualityEn, dataQualityTr } from './data-quality'
import { importBatchDetailEn, importBatchDetailTr } from './import-batch-detail'
import { pilotFeedbackEn, pilotFeedbackTr } from './pilot-feedback'
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
import { storeReportsEn, storeReportsTr } from './store-reports'
import { storeSettingsEn, storeSettingsTr } from './store-settings'
import { storeTasksEn, storeTasksTr } from './store-tasks'
import { storeUtilityEn, storeUtilityTr } from './store-utility'
import { storeWorkforceEn, storeWorkforceTr } from './store-workforce'

const tr = {
  ...adminAuditTr,
  ...adminChecklistsTr,
  ...authAuditDetailsTr,
  ...authAdminTr,
  ...authCatalogTr,
  ...authFlowTr,
  ...adminFeedTr,
  ...adminInboxTr,
  ...adminIncentivesTr,
  ...adminIntegrationsTr,
  ...adminKpiConfigTr,
  ...adminMasterDataTr,
  ...adminOperationsCapacityTr,
  ...adminOperationsTr,
  ...adminShellTr,
  ...adminSnapshotsTr,
  ...adminTargetsTr,
  ...commonTr,
  ...competitionAdminUxTr,
  ...competitionTr,
  ...dataQualityTr,
  ...importBatchDetailTr,
  ...pilotFeedbackTr,
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
  ...storeReportsTr,
  ...storeSettingsTr,
  ...storeTasksTr,
  ...storeUtilityTr,
  ...storeWorkforceTr,
} as const

const en: Record<keyof typeof tr, string> = {
  ...adminAuditEn,
  ...adminChecklistsEn,
  ...authAuditDetailsEn,
  ...authAdminEn,
  ...authCatalogEn,
  ...authFlowEn,
  ...adminFeedEn,
  ...adminInboxEn,
  ...adminIncentivesEn,
  ...adminIntegrationsEn,
  ...adminKpiConfigEn,
  ...adminMasterDataEn,
  ...adminOperationsCapacityEn,
  ...adminOperationsEn,
  ...adminShellEn,
  ...adminSnapshotsEn,
  ...adminTargetsEn,
  ...commonEn,
  ...competitionAdminUxEn,
  ...competitionEn,
  ...dataQualityEn,
  ...importBatchDetailEn,
  ...pilotFeedbackEn,
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
  ...storeReportsEn,
  ...storeSettingsEn,
  ...storeTasksEn,
  ...storeUtilityEn,
  ...storeWorkforceEn,
}

export const messages = { tr, en } as const
