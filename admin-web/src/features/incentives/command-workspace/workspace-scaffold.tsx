import { useMemo, useState, type ReactNode } from 'react'
import { ClipboardCheck, Clock3, PenLine, RotateCcw, Search, Store, UsersRound, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CommandCanvasFilterBar,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasMonthYearPicker,
  CommandCanvasPage,
  CommandCanvasPageHeader,
  CommandCanvasPartialDataNotice,
} from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { buildIncentiveMetrics, filterIncentiveWorkspace } from './model'
import { formatIncentiveMoney, formatIncentivePeriod } from './format'
import type { IncentiveStatusFilter, IncentiveWorkspace } from './types'
import './workspace.css'

type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveWorkspaceScaffold(input: {
  workspace: IncentiveWorkspace
  locale: AppLocale
  t: Translate
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  actions?: ReactNode
  tabs?: ReactNode
  sectionHeader?: ReactNode
  renderContent: (workspace: IncentiveWorkspace) => ReactNode
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<IncentiveStatusFilter>('all')
  const metrics = useMemo(() => buildIncentiveMetrics(input.workspace), [input.workspace])
  const filtered = useMemo(
    () => filterIncentiveWorkspace(input.workspace, { search, status }),
    [input.workspace, search, status],
  )
  const viewer = input.workspace.view === 'report_viewer'
  const partial = input.backgroundError !== null || Object.values(input.workspace.sections)
    .some((section) => section.status === 'unavailable')
  const toggleStatus = (next: IncentiveStatusFilter) => setStatus((current) => current === next ? 'all' : next)

  return (
    <CommandCanvasPage ariaLabelledBy="store-incentives-command-title" className={`incentive-command-page ${viewer ? 'is-report-viewer' : 'is-region-manager'}`}>
      <CommandCanvasPageHeader
        titleId="store-incentives-command-title"
        eyebrow={input.t('storeIncentives.command.eyebrow')}
        title={input.t(viewer ? 'storeIncentives.command.viewerTitle' : 'storeIncentives.command.regionTitle')}
        description={input.t(
          viewer ? 'storeIncentives.command.viewerDescription' : 'storeIncentives.command.regionDescription',
          { period: formatIncentivePeriod(input.workspace.period, input.locale) },
        )}
        actions={(
          <>
            <CommandCanvasMonthYearPicker
              ariaLabel={input.t('storeIncentives.regionManagerSelectPeriod')}
              locale={input.locale}
              onValueChange={input.onPeriodChange}
              value={input.period}
            />
            {input.actions}
          </>
        )}
      />

      <CommandCanvasMetricRail ariaLabel={input.t('storeIncentives.regionManagerSummaryAria')}>
        <CommandCanvasMetricFilter
          active={status === 'earning'}
          icon={<WalletCards size={16} />}
          label={input.t(viewer ? 'storeIncentives.command.companyTotal' : 'storeIncentives.command.periodTotal')}
          note={input.t('storeIncentives.command.finalColumn')}
          onClick={() => toggleStatus('earning')}
          tone="plum"
          value={formatIncentiveMoney(metrics.finalTotal, input.locale)}
        />
        <CommandCanvasMetricFilter
          active={!viewer && status === 'pending_review'}
          icon={viewer ? <UsersRound size={16} /> : <Clock3 size={16} />}
          label={input.t(viewer ? 'storeIncentives.command.regionManagers' : 'storeIncentives.command.pendingReview')}
          note={viewer ? input.t('storeIncentives.command.viewerSection') : input.t('storeIncentives.command.stores')}
          onClick={() => { if (!viewer) toggleStatus('pending_review') }}
          tone="amber"
          value={String(viewer ? metrics.regionCount : metrics.pendingReviewCount)}
        />
        <CommandCanvasMetricFilter
          active={!viewer && status === 'corrected'}
          icon={viewer ? <Store size={16} /> : <PenLine size={16} />}
          label={input.t(viewer ? 'storeIncentives.command.stores' : 'storeIncentives.command.corrections')}
          note={input.t(viewer ? 'storeIncentives.command.storeColumn' : 'storeIncentives.regionManagerCorrectionNote')}
          onClick={() => { if (!viewer) toggleStatus('corrected') }}
          tone="cyan"
          value={String(viewer ? metrics.storeCount : metrics.correctionCount)}
        />
        <CommandCanvasMetricFilter
          active={!viewer && status === 'reviewed'}
          icon={<ClipboardCheck size={16} />}
          label={input.t('storeIncentives.command.storeReview')}
          note={input.t('storeIncentives.command.reviewed')}
          onClick={() => { if (!viewer) toggleStatus('reviewed') }}
          tone="mint"
          value={`${metrics.reviewedStoreCount}/${metrics.storeCount}`}
        />
      </CommandCanvasMetricRail>

      {partial ? (
        <CommandCanvasPartialDataNotice
          title={input.t('storeIncentives.command.partialTitle')}
          description={input.t('storeIncentives.command.partialCopy')}
        />
      ) : null}

      <div className="incentive-command-workbench">
        <CommandCanvasFilterBar
          search={(
            <div className="incentive-command-search">
              <Search aria-hidden="true" size={16} />
              <Input
                aria-label={input.t('storeIncentives.command.search')}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={input.t('storeIncentives.command.search')}
                value={search}
              />
            </div>
          )}
          controls={(
            <Select value={status} onValueChange={(value) => setStatus(value as IncentiveStatusFilter)}>
              <SelectTrigger aria-label={input.t('storeIncentives.command.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{input.t('storeIncentives.command.allStatuses')}</SelectItem>
                <SelectItem value="pending_review">{input.t('storeIncentives.command.pending')}</SelectItem>
                <SelectItem value="reviewed">{input.t('storeIncentives.command.reviewed')}</SelectItem>
                <SelectItem value="corrected">{input.t('storeIncentives.command.corrected')}</SelectItem>
                <SelectItem value="earning">{input.t('storeIncentives.command.earning')}</SelectItem>
              </SelectContent>
            </Select>
          )}
          actions={(
            <Button
              aria-label={input.t('storeIncentives.command.clear')}
              onClick={() => { setSearch(''); setStatus('all') }}
              size="sm"
              variant="ghost"
            >
              <RotateCcw data-icon="inline-start" />
              {input.t('storeIncentives.command.clear')}
            </Button>
          )}
          isUpdating={input.isUpdating}
          updatingLabel={input.t('storeIncentives.command.updating')}
        />
        {input.tabs}
        {input.sectionHeader}
        {input.workspace.regions.length === 0
          ? (
            <div className="incentive-command-empty-state">
              <h2>{input.t('storeIncentives.command.emptyTitle')}</h2>
              <p>{input.t('storeIncentives.command.emptyCopy')}</p>
            </div>
          )
          : filtered.regions.length > 0
          ? input.renderContent(filtered)
          : <div className="incentive-command-empty">{input.t('storeIncentives.command.noMatch')}</div>}
      </div>
    </CommandCanvasPage>
  )
}
