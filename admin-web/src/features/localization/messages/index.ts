import { commonEn, commonTr } from './common'
import { competitionEn, competitionTr } from './competition'
import { storeMeEn, storeMeTr } from './store-me'
import { storeRankingsEn, storeRankingsTr } from './store-rankings'

const tr = {
  ...commonTr,
  ...competitionTr,
  ...storeMeTr,
  ...storeRankingsTr,
} as const

const en: Record<keyof typeof tr, string> = {
  ...commonEn,
  ...competitionEn,
  ...storeMeEn,
  ...storeRankingsEn,
}

export const messages = { tr, en } as const
