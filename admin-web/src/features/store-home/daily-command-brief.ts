import type { StorePersona } from '../../app/store-navigation'
import type { TranslationKey } from '../localization/dictionary'
import {
  buildReadOnlyStoreActionCandidates,
} from '../store-actions/candidates'
import type { WorkflowInboxItem } from '../workflow/contracts'

type BriefMetricSource = {
  metricValue: string
} | null

export type DailyCommandBriefItem = {
  id: string
  titleKey: TranslationKey
  copyKey: TranslationKey
  href: string
  sourceLabelKey: TranslationKey
  value: string
  priority: number
}

export function buildDailyCommandBriefItems(input: {
  checklistSummary: BriefMetricSource
  canUseWorkflowInbox: boolean
  pendingValue: string
  persona: StorePersona
  workflowItems: readonly WorkflowInboxItem[]
  workflowLoading: boolean
}): DailyCommandBriefItem[] {
  const items: DailyCommandBriefItem[] = []
  const workflowItems = input.canUseWorkflowInbox ? input.workflowItems : []
  const actionCandidates = buildReadOnlyStoreActionCandidates(workflowItems)

  if (input.canUseWorkflowInbox) {
    items.push({
      id: 'store-actions',
      titleKey: 'storeHome.nav.tasks',
      copyKey: 'storeHome.dailyBrief.actionCopy',
      href: '/store/tasks',
      sourceLabelKey: 'storeHome.nav.tasks',
      value: input.workflowLoading ? input.pendingValue : String(actionCandidates.length),
      priority: actionCandidates.length > 0 ? 10 : 40,
    })
  }

  if (input.checklistSummary && input.persona !== 'personnel') {
    items.push({
      id: 'checklists',
      titleKey: 'storeHome.nav.checklists',
      copyKey: 'storeHome.dailyBrief.checklistCopy',
      href: '/store/checklists',
      sourceLabelKey: 'storeHome.nav.checklists',
      value: input.checklistSummary.metricValue,
      priority: input.checklistSummary.metricValue === '0' ? 35 : 15,
    })
  }

  if (input.persona === 'storeManager') {
    items.push({
      id: 'approvals',
      titleKey: 'storeHome.nav.requestsApprovals',
      copyKey: 'storeHome.dailyBrief.approvalsCopy',
      href: '/store/approvals',
      sourceLabelKey: 'storeHome.nav.requestsApprovals',
      value: input.pendingValue,
      priority: 30,
    })
  }

  if (input.persona === 'personnel') {
    items.push(
      {
        id: 'my-performance',
        titleKey: 'storeHome.nav.myPerformance',
        copyKey: 'storeHome.dailyBrief.performanceCopy',
        href: '/store/me',
        sourceLabelKey: 'storeHome.nav.myPerformance',
        value: input.pendingValue,
        priority: 20,
      },
      {
        id: 'my-ranking',
        titleKey: 'storeHome.nav.myRanking',
        copyKey: 'storeHome.dailyBrief.rankingsCopy',
        href: '/store/rankings',
        sourceLabelKey: 'storeHome.nav.myRanking',
        value: input.pendingValue,
        priority: 25,
      },
    )
  }

  if (input.persona === 'regionManager') {
    items.push({
      id: 'kpi-summaries',
      titleKey: 'storeHome.nav.kpiSummaries',
      copyKey: 'storeHome.dailyBrief.kpiCopy',
      href: '/store/kpis',
      sourceLabelKey: 'storeHome.nav.kpiSummaries',
      value: input.pendingValue,
      priority: 25,
    })
  }

  items.push({
    id: 'announcements',
    titleKey: 'storeHome.nav.announcements',
    copyKey: 'storeHome.dailyBrief.feedCopy',
    href: '/store/feed',
    sourceLabelKey: 'storeHome.nav.announcements',
    value: input.pendingValue,
    priority: 50,
  })

  return items.toSorted((left, right) => left.priority - right.priority).slice(0, 3)
}
