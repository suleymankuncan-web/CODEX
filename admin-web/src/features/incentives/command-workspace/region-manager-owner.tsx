import { useMemo, useState, type KeyboardEvent } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { actionToast } from '@/lib/action-toast'
import {
  createStoreSalesTargetIncentiveRegionCorrection,
  markStoreSalesTargetIncentiveReview,
  submitStoreSalesTargetIncentiveRegionPackage,
  voidStoreSalesTargetIncentiveRegionCorrection,
  type SalesTargetIncentiveWorkspaceResponse,
} from '../api'
import { IncentiveCorrectionDrawer } from './correction-drawer'
import { filterIncentiveWorkspace } from './model'
import { ReadOnlyCorrectionDrawer } from './read-only-correction-drawer'
import { IncentiveSubmitDialog } from './submit-dialog'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import { IncentiveWorkspaceScaffold } from './workspace-scaffold'

type Translate = ReturnType<typeof useLocalization>['t']
type Selection = { store: IncentiveStore; row: IncentiveRow; opener: HTMLButtonElement }

export function RegionManagerIncentivesOwner(input: {
  workspace: IncentiveWorkspace
  queryKey: QueryKey
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  locale: AppLocale
  t: Translate
}) {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [tab, setTab] = useState<'stores' | 'corrections' | 'rates'>('stores')
  const tabCounts = useMemo(() => {
    const stores = input.workspace.regions.flatMap((region) => region.stores)
    return {
      stores: stores.length,
      corrections: stores.flatMap((store) => store.rows).filter((row) => row.correction !== null).length,
    }
  }, [input.workspace.regions])

  const updateWorkspace = (updater: (workspace: IncentiveWorkspace) => IncentiveWorkspace) => {
    queryClient.setQueryData<SalesTargetIncentiveWorkspaceResponse>(input.queryKey, (current) => (
      current ? { ...current, data: updater(current.data as IncentiveWorkspace) } : current
    ))
  }
  const invalidate = () => queryClient.invalidateQueries({ queryKey: input.queryKey, exact: true })

  const reviewMutation = useMutation({
    mutationFn: markStoreSalesTargetIncentiveReview,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: input.queryKey, exact: true })
      const previous = queryClient.getQueryData<SalesTargetIncentiveWorkspaceResponse>(input.queryKey)
      updateWorkspace((workspace) => mapStore(workspace, variables.storeId, (store) => ({
        ...store,
        review: {
          ...store.review,
          status: variables.reviewStatus,
          reviewedAt: variables.reviewStatus === 'reviewed' ? new Date().toISOString() : null,
        },
      })))
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(input.queryKey, context.previous)
      actionToast.error(error, input.t('storeIncentives.command.reviewSaveError'))
    },
    onSuccess: () => actionToast.success(input.t('storeIncentives.command.reviewSaved')),
    onSettled: invalidate,
  })

  const correctionMutation = useMutation({
    mutationFn: createStoreSalesTargetIncentiveRegionCorrection,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: input.queryKey, exact: true })
      const previous = queryClient.getQueryData<SalesTargetIncentiveWorkspaceResponse>(input.queryKey)
      updateWorkspace((workspace) => mapRow(workspace, variables.storeId, variables.employeeId, variables.participantType, (row) => ({
        ...row,
        finalAmount: variables.finalAmount,
        signedDifferenceAmount: row.calculatedAmount === null
          ? null
          : subtractMoney(variables.finalAmount, row.calculatedAmount),
        status: row.calculatedAmount === null ? row.status : 'corrected',
      })))
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(input.queryKey, context.previous)
      actionToast.error(error, input.t('storeIncentives.command.correctionSaveError'))
    },
    onSuccess: () => { setSelection(null); actionToast.success(input.t('storeIncentives.command.correctionSaved')) },
    onSettled: invalidate,
  })

  const voidMutation = useMutation({
    mutationFn: voidStoreSalesTargetIncentiveRegionCorrection,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: input.queryKey, exact: true })
      const previous = queryClient.getQueryData<SalesTargetIncentiveWorkspaceResponse>(input.queryKey)
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(input.queryKey, context.previous)
      actionToast.error(error, input.t('storeIncentives.command.correctionVoidError'))
    },
    onSuccess: () => { setSelection(null); actionToast.info(input.t('storeIncentives.command.correctionVoided')) },
    onSettled: invalidate,
  })

  const submitMutation = useMutation({
    mutationFn: submitStoreSalesTargetIncentiveRegionPackage,
    onError: (error) => actionToast.error(error, input.t('storeIncentives.command.submitError')),
    onSuccess: () => { setSubmitOpen(false); actionToast.success(input.t('storeIncentives.command.submitSaved')) },
    onSettled: invalidate,
  })
  const pendingStoreIds = useMemo(() => new Set(reviewMutation.isPending ? [reviewMutation.variables?.storeId ?? ''] : []), [reviewMutation.isPending, reviewMutation.variables])
  const correctionPending = correctionMutation.isPending || voidMutation.isPending
  const writesReady = !input.isUpdating && input.period === input.workspace.period

  return (
    <>
      <IncentiveWorkspaceScaffold
        {...input}
        actions={(
          <div className="incentive-submit-cluster">
            <Button disabled={!writesReady || !input.workspace.capabilities.canSubmitPackage} onClick={() => setSubmitOpen(true)}>
              <Send aria-hidden="true" data-icon="inline-start" />
              {input.t('storeIncentives.regionManagerSubmit')}
            </Button>
            <small>{input.t('storeIncentives.command.submitHint', { count: input.workspace.regions.flatMap((region) => region.stores).filter((store) => store.review.status === 'pending_review').length })}</small>
          </div>
        )}
        tabs={(
          <div
            aria-label={input.t('storeIncentives.command.workspaceSections')}
            className="incentive-workspace-tabs"
            onKeyDown={(event) => moveTabFocus(event, tab, setTab)}
            role="tablist"
          >
            {([
              ['stores', input.t('storeIncentives.command.storeChecks'), tabCounts.stores],
              ['corrections', input.t('storeIncentives.command.corrections'), tabCounts.corrections],
              ['rates', input.t('storeIncentives.command.rateTables'), null],
            ] as const).map(([value, label]) => (
              <Button
                aria-controls="incentive-workspace-panel"
                aria-selected={tab === value}
                data-tab-value={value}
                id={`incentive-workspace-tab-${value}`}
                key={value}
                onClick={() => setTab(value)}
                role="tab"
                size="sm"
                tabIndex={tab === value ? 0 : -1}
                variant={tab === value ? 'secondary' : 'ghost'}
              >{label}{value !== 'rates' ? <span className="incentive-tab-count">{value === 'stores' ? tabCounts.stores : tabCounts.corrections}</span> : null}</Button>
            ))}
          </div>
        )}
        sectionHeader={<h2 className="tw:sr-only">{input.t('storeIncentives.command.storeChecks')}</h2>}
        renderContent={(workspace) => (
          <div aria-labelledby={`incentive-workspace-tab-${tab}`} id="incentive-workspace-panel" role="tabpanel">
            {tab === 'rates'
              ? <RateTables workspace={workspace} locale={input.locale} t={input.t} />
              : (
            <IncentiveWorkspaceHierarchy
              locale={input.locale}
              interactionLocked={!writesReady}
              onOpenRow={(store, row, opener) => { if (writesReady) setSelection({ store, row, opener }) }}
              onReviewStore={(store) => { if (writesReady) reviewMutation.mutate({
                period: workspace.period,
                storeId: store.storeId,
                reviewStatus: store.review.status === 'reviewed' ? 'pending_review' : 'reviewed',
              }) }}
              pendingStoreIds={pendingStoreIds}
              readOnly={false}
              t={input.t}
              workspace={tab === 'corrections' ? filterIncentiveWorkspace(workspace, { search: '', status: 'corrected' }) : workspace}
            />
              )}
          </div>
        )}
      />
      {selection && selection.store.capabilities.canCreateCorrection ? <IncentiveCorrectionDrawer
        key={`${selection.store.storeId}:${selection.row.employeeId}:${selection.row.participantType}`}
        locale={input.locale}
        onClose={() => {
          if (correctionPending) return
          const opener = selection.opener
          setSelection(null)
          requestAnimationFrame(() => opener.focus())
        }}
        onSave={(value) => correctionMutation.mutate({
          period: input.workspace.period,
          storeId: value.store.storeId,
          employeeId: value.row.employeeId,
          participantType: value.row.participantType,
          finalAmount: value.finalAmount,
          reasonNote: value.reasonNote,
        })}
        onVoid={(value) => voidMutation.mutate({ period: input.workspace.period, correctionId: value.correctionId })}
        pending={correctionPending}
        selection={selection}
        t={input.t}
        workspace={input.workspace}
      /> : selection ? <ReadOnlyCorrectionDrawer
        locale={input.locale}
        onClose={() => {
          const opener = selection.opener
          setSelection(null)
          requestAnimationFrame(() => opener.focus())
        }}
        selection={selection}
        t={input.t}
      /> : null}
      {submitOpen ? <IncentiveSubmitDialog
        locale={input.locale}
        onOpenChange={setSubmitOpen}
        onSubmit={(value) => submitMutation.mutate({ period: input.workspace.period, ...value })}
        open={submitOpen}
        pending={submitMutation.isPending}
        t={input.t}
        workspace={input.workspace}
      /> : null}
    </>
  )
}

const workspaceTabs = ['stores', 'corrections', 'rates'] as const

function moveTabFocus(
  event: KeyboardEvent<HTMLDivElement>,
  current: (typeof workspaceTabs)[number],
  select: (tab: (typeof workspaceTabs)[number]) => void,
) {
  const key = event.key
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
  event.preventDefault()
  const tablist = event.currentTarget
  const currentIndex = workspaceTabs.indexOf(current)
  const nextIndex = key === 'Home'
    ? 0
    : key === 'End'
      ? workspaceTabs.length - 1
      : (currentIndex + (key === 'ArrowRight' ? 1 : -1) + workspaceTabs.length) % workspaceTabs.length
  const next = workspaceTabs[nextIndex]
  if (!next) return
  select(next)
  requestAnimationFrame(() => {
    tablist.querySelector<HTMLButtonElement>(`[data-tab-value="${next}"]`)?.focus()
  })
}

function RateTables(input: { workspace: IncentiveWorkspace; locale: AppLocale; t: Translate }) {
  if (input.workspace.rateMetadata.status !== 'resolved') return <div className="incentive-command-empty">{input.t('storeIncentives.command.rateSectionUnavailable')}</div>
  return (
    <div className="incentive-rate-table-grid">
      {input.workspace.rateMetadata.tables.map((table) => (
        <section key={`${table.audience}:${table.version}`}>
          <header><b>{input.t(table.audience === 'manager' ? 'storeIncentives.command.managerAudience' : 'storeIncentives.command.personnelAudience')}</b><small>{table.version}</small></header>
          {table.brackets.map((bracket) => (
            <div key={bracket.displayLabel}><span>{bracket.displayLabel}</span><strong>{new Intl.NumberFormat(input.locale === 'tr' ? 'tr-TR' : 'en-US', { style: 'percent', minimumFractionDigits: 2 }).format(Number(bracket.rate))}</strong></div>
          ))}
        </section>
      ))}
    </div>
  )
}

function mapStore(workspace: IncentiveWorkspace, storeId: string, mapper: (store: IncentiveStore) => IncentiveStore): IncentiveWorkspace {
  return { ...workspace, regions: workspace.regions.map((region) => ({ ...region, stores: region.stores.map((store) => store.storeId === storeId ? mapper(store) : store) })) }
}

function mapRow(workspace: IncentiveWorkspace, storeId: string, employeeId: string, participantType: IncentiveRow['participantType'], mapper: (row: IncentiveRow) => IncentiveRow): IncentiveWorkspace {
  return mapStore(workspace, storeId, (store) => ({ ...store, rows: store.rows.map((row) => row.employeeId === employeeId && row.participantType === participantType ? mapper(row) : row) }))
}

function subtractMoney(left: string, right: string) {
  const leftCents = toCents(left)
  const rightCents = toCents(right)
  const value = leftCents - rightCents
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`
}

function toCents(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return 0n
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
}
