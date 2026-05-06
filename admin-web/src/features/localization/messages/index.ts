import { commonEn, commonTr } from './common'
import { competitionEn, competitionTr } from './competition'
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
  ...commonTr,
  ...competitionTr,
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
  ...commonEn,
  ...competitionEn,
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
