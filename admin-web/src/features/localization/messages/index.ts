import { commonEn, commonTr } from './common'
import { competitionEn, competitionTr } from './competition'
import { storeRankingsEn, storeRankingsTr } from './store-rankings'

const tr = {
  ...commonTr,
  ...competitionTr,
  ...storeRankingsTr,
} as const

const en: Record<keyof typeof tr, string> = {
  ...commonEn,
  ...competitionEn,
  ...storeRankingsEn,
}

export const messages = { tr, en } as const
