import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../features/auth/api'
import { canReadChecklistResults, hasAnyRole } from '../features/auth/authorization'
import {
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
} from '../features/checklists/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRoleAwareStoreNavigation,
  getStorePersonaLabelKey,
  resolveStorePersona,
  type StorePersona,
} from '../app/store-navigation'
import { getWorkflowInbox } from '../features/workflow/api'
import { resolveUserDisplayLabel } from '../lib/display-labels'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  buildStoreHomeCommandModel,
  countNumeric,
  formatStoreHomePeriod,
} from './store-home-command-model'
import { StoreHomeCommandView } from './store-home-command-view'
import { buildVisitPriorityHomeSummary } from './store-home-visit-priority'

type ChecklistHomeSummary = {
  actionLabel: string
  copy: string
  metricNote: string
  metricValue: string
  note: string
  title: string
  tone: 'attention' | 'ready'
}

function formatStoreScope(authSummary: AuthSessionSummary | null) {
  const assignedStoreCount = authSummary?.scopeSummary.assignedStoreCount ?? 0
  const storeCount =
    authSummary?.scopeSummary.storeCount ??
    authSummary?.user.readScope.storeIds.length ??
    authSummary?.user.scope.storeIds.length ??
    0

  return assignedStoreCount > 0 ? String(assignedStoreCount) : String(storeCount)
}

export function StoreHomePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const persona = resolveStorePersona(input.authSummary)
  const canManageChecklistVisits = hasAnyRole(input.authSummary, [
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
    'SUPER_ADMIN',
  ])
  const canUseWorkflowInbox = hasAnyRole(input.authSummary, [
    'STORE_MANAGER',
    'SUPER_ADMIN',
    'REPORT_VIEWER',
  ])
  const canReadChecklistInbox = canReadChecklistResults(input.authSummary)
  const checklistAcknowledgementsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    enabled: canReadChecklistInbox && persona !== 'personnel',
    ...transientQueryRetryOptions,
  })
  const mobileChecklistQuery = useQuery({
    queryKey: ['mobile-checklists-today'],
    queryFn: getMobileChecklistToday,
    enabled: canManageChecklistVisits && persona !== 'storeManager' && persona !== 'personnel',
    ...transientQueryRetryOptions,
  })
  const workflowInboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: canUseWorkflowInbox,
    ...transientQueryRetryOptions,
  })
  const navigation = getRoleAwareStoreNavigation(input.authSummary)
  const availablePaths = new Set(navigation.map((item) => item.path))
  const pendingValue = t('storeHome.valuePending')
  const readyValue = t('storeHome.command.ready')
  const storeScopeValue = formatStoreScope(input.authSummary)
  const workflowItems = workflowInboxQuery.data?.items ?? []
  const pendingWorkflowItems = workflowItems.filter((item) => item.inboxStatus === 'needs_attention')
  const pendingRequestsValue =
    canUseWorkflowInbox && !workflowInboxQuery.isError
      ? workflowInboxQuery.isLoading
        ? pendingValue
        : String(pendingWorkflowItems.length)
      : null
  const checklistSummary = buildChecklistHomeSummary({
    acknowledgementItems: checklistAcknowledgementsQuery.data?.items ?? [],
    isLoading: checklistAcknowledgementsQuery.isLoading || mobileChecklistQuery.isLoading,
    mobileToday: mobileChecklistQuery.data?.data ?? null,
    pendingValue,
    persona,
    storeScopeValue,
    t,
  })
  const visitPrioritySummary = canManageChecklistVisits && availablePaths.has('/store/checklists')
    ? buildVisitPriorityHomeSummary({
        acknowledgementItems: checklistAcknowledgementsQuery.data?.items ?? [],
        authSummary: input.authSummary,
        isUnavailable: mobileChecklistQuery.isError || checklistAcknowledgementsQuery.isError,
        isLoading: checklistAcknowledgementsQuery.isLoading || mobileChecklistQuery.isLoading,
        mobileToday: mobileChecklistQuery.data?.data ?? null,
        pendingValue,
        persona,
        t,
      })
    : null
  const checklistCount = countNumeric(checklistSummary?.metricValue)
  const requestCount =
    canUseWorkflowInbox && !workflowInboxQuery.isLoading && !workflowInboxQuery.isError
      ? pendingWorkflowItems.length
      : null
  const pendingWorkValue =
    checklistSummary && checklistSummary.metricValue !== pendingValue && requestCount !== null
      ? String(checklistCount + requestCount)
      : pendingValue
  const personaLabel = t(getStorePersonaLabelKey(persona))
  const identityLabel = resolveUserDisplayLabel(input.authSummary?.user, personaLabel)
  const periodLabel = formatStoreHomePeriod()
  const commandModel = buildStoreHomeCommandModel({
    availablePaths,
    checklistActionLabel: checklistSummary?.actionLabel ?? null,
    checklistCopy: checklistSummary?.copy ?? null,
    checklistMetricValue: checklistSummary?.metricValue ?? null,
    checklistTitle: checklistSummary?.title ?? null,
    checklistTone: checklistSummary?.tone ?? null,
    identityLabel,
    pendingRequestsValue,
    pendingValue,
    pendingWorkValue,
    periodLabel,
    persona,
    personaLabel,
    readyValue,
    storeScopeValue,
    visitPriorityActionLabel: visitPrioritySummary?.actionLabel ?? null,
    visitPriorityCopy: visitPrioritySummary?.copy ?? null,
    visitPriorityTitle: visitPrioritySummary?.title ?? null,
    visitPriorityValue: visitPrioritySummary?.value ?? null,
    icons: {
      alert: <AlertTriangle size={20} />,
      bell: <Bell size={20} />,
      checklist: <ClipboardCheck size={20} />,
      file: <FileText size={20} />,
      megaphone: <Megaphone size={20} />,
      shield: <ShieldCheck size={20} />,
      store: <Store size={20} />,
      target: <Target size={20} />,
      trending: <TrendingUp size={20} />,
      users: <UsersRound size={20} />,
      wallet: <WalletCards size={20} />,
    },
  })
  const refreshHome = () => {
    void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
    void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
    void queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] })
  }

  return <StoreHomeCommandView model={commandModel} onRefresh={refreshHome} />
}

function buildChecklistHomeSummary(input: {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  isLoading: boolean
  mobileToday: MobileChecklistToday | null
  pendingValue: string
  persona: StorePersona
  storeScopeValue: string
  t: ReturnType<typeof useLocalization>['t']
}): ChecklistHomeSummary | null {
  if (input.persona === 'personnel') return null

  const visibleAcknowledgementItems = getChecklistHomeAcknowledgementItemsForPersona(
    input.acknowledgementItems,
    input.persona,
  )
  const visibleMobileToday = getChecklistHomeMobileTodayForPersona(input.mobileToday, input.persona)
  const pendingAcknowledgements = visibleAcknowledgementItems.filter((item) => item.acknowledgement === null).length
  const acknowledgedCount = visibleAcknowledgementItems.filter((item) => item.acknowledgement !== null).length
  const activeDraftCount = visibleMobileToday?.activeInstances.length ?? 0
  const completedVisitCount = visibleMobileToday?.completedThisMonth.length ?? acknowledgedCount
  const pendingVisitCount = visibleMobileToday ? activeDraftCount : pendingAcknowledgements

  if (input.persona === 'storeManager') {
    const value = input.isLoading ? input.pendingValue : String(pendingAcknowledgements)
    return {
      actionLabel: input.t('storeHome.checklistCard.action'),
      copy: input.t('storeHome.checklistCard.storeCopy', { count: value }),
      metricNote: input.t('storeHome.checklistCard.storeMetricNote'),
      metricValue: value,
      note: input.t('storeHome.checklistCard.storeNote'),
      title: input.t('storeHome.checklistCard.storeTitle'),
      tone: pendingAcknowledgements > 0 ? 'attention' : 'ready',
    }
  }

  const value = input.isLoading ? input.pendingValue : String(pendingVisitCount)
  const completedValue = input.isLoading ? input.pendingValue : String(completedVisitCount)

  if (input.persona === 'visualMerchandiser') {
    return {
      actionLabel: input.t('storeHome.checklistCard.action'),
      copy: input.t('storeHome.checklistCard.vmCopy', {
        completed: completedValue,
        count: value,
        scope: input.storeScopeValue,
      }),
      metricNote: input.t('storeHome.checklistCard.vmMetricNote', { completed: completedValue }),
      metricValue: value,
      note: input.t('storeHome.checklistCard.vmNote'),
      title: input.t('storeHome.checklistCard.vmTitle'),
      tone: pendingVisitCount > 0 ? 'attention' : 'ready',
    }
  }

  return {
    actionLabel: input.t('storeHome.checklistCard.action'),
    copy: input.t('storeHome.checklistCard.regionCopy', {
      completed: completedValue,
      count: value,
      scope: input.storeScopeValue,
    }),
    metricNote: input.t('storeHome.checklistCard.regionMetricNote', { completed: completedValue }),
    metricValue: value,
    note: input.t('storeHome.checklistCard.regionNote'),
    title: input.t('storeHome.checklistCard.regionTitle'),
    tone: pendingVisitCount > 0 ? 'attention' : 'ready',
  }
}

function getChecklistHomeAcknowledgementItemsForPersona(
  items: ChecklistAcknowledgementItem[],
  persona: StorePersona,
) {
  if (persona === 'visualMerchandiser') {
    return items.filter((item) => item.templateType === 'VM_STORE_VISIT')
  }

  return items
}

function getChecklistHomeMobileTodayForPersona(
  mobileToday: MobileChecklistToday | null,
  persona: StorePersona,
): MobileChecklistToday | null {
  if (!mobileToday || persona !== 'visualMerchandiser') return mobileToday

  const vmTemplateIds = new Set<string>()
  const vmTemplates: MobileChecklistToday['templates'] = []

  for (const template of mobileToday.templates) {
    if (template.templateType !== 'VM_STORE_VISIT') continue
    vmTemplateIds.add(template.checklistTemplateId)
    vmTemplates.push(template)
  }

  return {
    ...mobileToday,
    templates: vmTemplates,
    activeInstances: mobileToday.activeInstances.filter((instance) =>
      vmTemplateIds.has(instance.checklistTemplateId),
    ),
    completedThisMonth: mobileToday.completedThisMonth.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
    pendingAcknowledgements: mobileToday.pendingAcknowledgements.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
    monthlySummaries: mobileToday.monthlySummaries.filter((item) =>
      vmTemplateIds.has(item.checklistTemplateId),
    ),
  }
}
