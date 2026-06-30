import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock3, Download, GitBranch, RefreshCcw, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { downloadCsv } from '../lib/download-csv'
import {
  getSnapshotRunAudit,
  getSnapshotRunDependencies,
  getSnapshotRunDetail,
  getSnapshotRunLineage,
  rerunSnapshotRun,
  type SnapshotRunDependencies,
  type SnapshotRunDetail,
} from '../features/snapshots/api'
import {
  formatSnapshotState,
  formatSnapshotType,
  mapSnapshotSurfaceTone,
} from '../features/snapshots/snapshot-surface-semantics'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import {
  AdminKeyValue as KeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import {
  AdminOperationalHeader,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalSection,
} from './admin-operational-primitives'

function formatCheckStatus(input: 'pass' | 'fail', t: TranslateFunction) {
  return input === 'pass' ? t('adminSnapshots.check.pass') : t('adminSnapshots.check.fail')
}

export function SnapshotRunDetailPage() {
  const { locale, t } = useLocalization()
  const params = useParams()
  const snapshotRunId = params.snapshotRunId ?? ''
  const [feedback, setFeedback] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['snapshot-run-detail', snapshotRunId],
    queryFn: () => getSnapshotRunDetail(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const dependenciesQuery = useQuery({
    queryKey: ['snapshot-run-dependencies', snapshotRunId],
    queryFn: () => getSnapshotRunDependencies(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const lineageQuery = useQuery({
    queryKey: ['snapshot-run-lineage', snapshotRunId],
    queryFn: () => getSnapshotRunLineage(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const auditQuery = useQuery({
    queryKey: ['snapshot-run-audit', snapshotRunId],
    queryFn: () => getSnapshotRunAudit(snapshotRunId),
    enabled: Boolean(snapshotRunId),
  })
  const rerunMutation = useMutation({
    mutationFn: rerunSnapshotRun,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-detail', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-dependencies', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-lineage', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-run-audit', snapshotRunId] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })

  if (!snapshotRunId) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('adminSnapshots.detailMissingTitle')}
          description={t('adminSnapshots.detailMissingCopy')}
        />
      </AdminOperationalPage>
    )
  }

  if (detailQuery.isLoading) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          isLoading
          title={t('adminSnapshots.detailLoadingTitle')}
          description={t('adminSnapshots.detailLoadingCopy')}
        />
      </AdminOperationalPage>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('adminSnapshots.detailUnavailableTitle')}
          description={getErrorMessage(detailQuery.error)}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  const detail = detailQuery.data
  const dependencies = dependenciesQuery.data
  const lineage = lineageQuery.data
  const auditItems = auditQuery.data?.items ?? []
  const totalRows =
    detail.cards.workforceRows +
    detail.cards.kpiRows +
    detail.cards.checklistRows +
    detail.cards.turnoverRows

  return (
    <AdminOperationalPage ariaLabel={t('adminSnapshots.detailTitle', { type: formatSnapshotType(detail.snapshotRun.snapshotType, t) })}>
      <Button asChild className="tw:w-fit" variant="outline">
        <Link to="/admin/snapshots">
          <ArrowLeft aria-hidden="true" />
          {t('adminSnapshots.backToOperations')}
        </Link>
      </Button>

      <AdminOperationalHeader
        eyebrow={t('adminSnapshots.detailEyebrow')}
        title={t('adminSnapshots.detailTitle', { type: formatSnapshotType(detail.snapshotRun.snapshotType, t) })}
        description={t('adminSnapshots.detailCopy', {
          runId: detail.snapshotRun.snapshotRunId,
          state: formatSnapshotState(detail.snapshotRun.healthState, t),
        })}
        icon={<Sparkles size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone={mapSnapshotSurfaceTone(detail.snapshotRun.healthState)}>
              {formatSnapshotState(detail.snapshotRun.healthState, t)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone={mapSnapshotSurfaceTone(detail.snapshotRun.runStatus)}>
              {formatSnapshotState(detail.snapshotRun.runStatus, t)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone={detail.canRerun ? 'accent' : 'neutral'}>
              {t('adminSnapshots.canRerun')}: {detail.canRerun ? t('adminSnapshots.yes') : t('adminSnapshots.no')}
            </AdminSurfaceBadge>
          </>
        }
      />

      {feedback ? <AdminStatePanel title={feedback} tone="accent" /> : null}

      <AdminOperationalMetrics
        items={[
          {
            id: 'rows',
            label: t('adminSnapshots.totalReportRows'),
            value: String(totalRows),
            icon: <Sparkles size={18} />,
            tone: 'cyan',
          },
          {
            id: 'can-rerun',
            label: t('adminSnapshots.canRerun'),
            value: detail.canRerun ? t('adminSnapshots.yes') : t('adminSnapshots.no'),
            icon: <RefreshCcw size={18} />,
            tone: detail.canRerun ? 'accent' : 'neutral',
          },
          {
            id: 'rerun-allowed',
            label: t('adminSnapshots.rerunAllowed'),
            value: detail.rerunAllowed ? t('adminSnapshots.yes') : t('adminSnapshots.no'),
            icon: <Clock3 size={18} />,
            tone: detail.rerunAllowed ? 'success' : 'warning',
          },
          {
            id: 'kpi-config',
            label: t('adminSnapshots.kpiConfig'),
            value: formatSnapshotKpiConfigVersion(detail.snapshotRun.kpiConfigVersion, t),
            icon: <GitBranch size={18} />,
            tone: 'neutral',
          },
        ]}
      />

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
        <SnapshotRunSummaryPanel detail={detail} />

        <SnapshotDependenciesPanel
          canRerun={detail.canRerun}
          dependencies={dependencies}
          isRerunPending={rerunMutation.isPending}
          onRerun={() => rerunMutation.mutate(snapshotRunId)}
          snapshotRunId={snapshotRunId}
        />
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
        <SnapshotOutputVolumePanel detail={detail} totalRows={totalRows} />

        <AdminOperationalSection
          eyebrow={t('adminSnapshots.lineageEyebrow')}
          title={t('adminSnapshots.lineageTitle')}
        >
          {lineage ? (
            <div className="tw:grid tw:gap-3">
              <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                  <strong className="tw:text-sm tw:font-medium">{t('adminSnapshots.parent')}</strong>
                  <GitBranch aria-hidden="true" />
                </div>
                <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">
                  {lineage.parent
                    ? `${formatSnapshotType(lineage.parent.snapshotType, t)} · ${formatSnapshotState(lineage.parent.runStatus, t)} · ${lineage.parent.snapshotRunId}`
                    : t('adminSnapshots.noParentRun')}
                </p>
              </div>
              <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                  <strong className="tw:text-sm tw:font-medium">{t('adminSnapshots.children')}</strong>
                  <Sparkles aria-hidden="true" />
                </div>
                {lineage.children.length ? (
                  <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-1 tw:text-sm tw:text-muted-foreground">
                    {lineage.children.map((child) => (
                      <span key={child.snapshotRunId}>
                        {formatSnapshotType(child.snapshotType, t)} · {formatSnapshotState(child.runStatus, t)} · {child.snapshotRunId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">{t('adminSnapshots.noRerunChildren')}</p>
                )}
              </div>
            </div>
          ) : (
            <AdminSurfaceEmpty copy={t('adminSnapshots.dependencyLoading')} />
          )}
        </AdminOperationalSection>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
        <AdminOperationalSection
          eyebrow={t('adminSnapshots.failurePostureEyebrow')}
          title={t('adminSnapshots.failurePostureTitle')}
        >
          <AdminKeyValueGrid className="tw:lg:grid-cols-2">
            <KeyValue
              label={t('adminSnapshots.failureReason')}
              value={detail.failureReason ?? t('adminSnapshots.noFailureReason')}
            />
            <KeyValue
              label={t('adminSnapshots.latestRerunTitle')}
              value={detail.latestRerunSnapshotRunId ?? t('adminSnapshots.noRerunCreated')}
            />
            <KeyValue
              label={t('adminSnapshots.rerunCount', { count: detail.rerunCount })}
              value={String(detail.rerunCount)}
            />
          </AdminKeyValueGrid>
        </AdminOperationalSection>

        <AdminOperationalSection
          eyebrow={t('adminSnapshots.auditTimelineEyebrow')}
          title={t('adminSnapshots.auditTimelineTitle')}
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsv({
                  filename: `snapshot-audit-${snapshotRunId}.csv`,
                  columns: ['eventLogId', 'occurredAt', 'actorUserId', 'correlationId', 'eventType'],
                  rows: auditItems.map((event) => [
                    event.eventLogId,
                    event.occurredAt,
                    event.actorUserId,
                    event.correlationId,
                    event.eventType,
                  ]),
                })
              }
              disabled={auditItems.length === 0}
            >
              <Download aria-hidden="true" />
              {t('adminSnapshots.exportAudit')}
            </Button>
          }
        >
          {auditItems.length === 0 ? (
            <AdminSurfaceEmpty copy={t('adminSnapshots.noAuditEntries')} />
          ) : (
            <div className="tw:grid tw:gap-3">
              {auditItems.map((event) => (
                <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3" key={event.eventLogId}>
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
                    <strong className="tw:text-sm tw:font-medium">{event.eventType}</strong>
                    <span className="tw:text-xs tw:text-muted-foreground">{formatDateTime(event.occurredAt, locale)}</span>
                  </div>
                  <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">
                    {t('adminSnapshots.actor', { actor: event.actorUserId ?? t('adminSnapshots.system') })} ·{' '}
                    {t('adminSnapshots.correlation', { correlation: event.correlationId ?? t('adminSnapshots.notAvailable') })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </AdminOperationalSection>
      </div>
    </AdminOperationalPage>
  )
}

function SnapshotRunSummaryPanel(input: { detail: SnapshotRunDetail }) {
  const { locale, t } = useLocalization()
  const { snapshotRun } = input.detail

  return (
    <AdminOperationalSection
      eyebrow={t('adminSnapshots.executionStateEyebrow')}
      title={t('adminSnapshots.runSummary')}
    >
      <AdminKeyValueGrid className="tw:lg:grid-cols-2">
        {[
          [t('adminSnapshots.runStatus'), formatSnapshotState(snapshotRun.runStatus, t)],
          [t('adminSnapshots.healthState'), formatSnapshotState(snapshotRun.healthState, t)],
          [t('adminSnapshots.period'), `${formatDate(snapshotRun.periodStart, locale)} - ${formatDate(snapshotRun.periodEnd, locale)}`],
          [t('adminSnapshots.kpiConfigVersion'), formatSnapshotKpiConfigVersion(snapshotRun.kpiConfigVersion, t)],
          [t('adminSnapshots.generatedAt'), formatDateTime(snapshotRun.generatedAt, locale)],
          [t('adminSnapshots.startedAt'), snapshotRun.startedAt ? formatDateTime(snapshotRun.startedAt, locale) : t('adminSnapshots.notStarted')],
          [t('adminSnapshots.finishedAt'), snapshotRun.finishedAt ? formatDateTime(snapshotRun.finishedAt, locale) : t('adminSnapshots.notFinished')],
        ].map(([label, value]) => (
          <KeyValue key={label} label={label} value={value} />
        ))}
      </AdminKeyValueGrid>
    </AdminOperationalSection>
  )
}

function SnapshotDependenciesPanel(input: {
  canRerun: boolean
  dependencies: SnapshotRunDependencies | undefined
  isRerunPending: boolean
  onRerun: () => void
  snapshotRunId: string
}) {
  const { t } = useLocalization()

  return (
    <AdminOperationalSection
      eyebrow={t('adminSnapshots.rerunGovernanceEyebrow')}
      title={t('adminSnapshots.dependenciesTitle')}
      actions={
        <>
          <Button
            type="button"
            onClick={input.onRerun}
            disabled={!input.canRerun || input.isRerunPending}
          >
            <RefreshCcw aria-hidden="true" />
            {input.isRerunPending ? t('adminSnapshots.rerunning') : t('adminSnapshots.rerunSnapshot')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadCsv({
                filename: `snapshot-dependency-checks-${input.snapshotRunId}.csv`,
                columns: ['code', 'status', 'message'],
                rows: (input.dependencies?.checks ?? []).map((check) => [
                  check.code,
                  check.status,
                  check.message,
                ]),
              })
            }
            disabled={!input.dependencies?.checks.length}
          >
            <Download aria-hidden="true" />
            {t('adminSnapshots.exportChecks')}
          </Button>
        </>
      }
    >
      {input.dependencies ? (
        <div className="tw:grid tw:gap-3">
          {input.dependencies.checks.map((check) => (
            <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3" key={check.code}>
              <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
                <strong className="tw:text-sm tw:font-medium">{check.code}</strong>
                <AdminSurfaceBadge tone={check.status === 'pass' ? 'success' : 'danger'}>
                  {formatCheckStatus(check.status, t)}
                </AdminSurfaceBadge>
              </div>
              <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">{check.message}</p>
            </div>
          ))}
          {input.dependencies.rerunBlockedReason ? (
            <AdminStatePanel
              title={t('adminSnapshots.rerunBlocked')}
              description={input.dependencies.rerunBlockedReason}
              tone="warning"
            />
          ) : null}
        </div>
      ) : (
        <AdminSurfaceEmpty copy={t('adminSnapshots.dependencyLoading')} />
      )}
    </AdminOperationalSection>
  )
}

function SnapshotOutputVolumePanel(input: { detail: SnapshotRunDetail; totalRows: number }) {
  const { t } = useLocalization()
  const total = Math.max(input.totalRows, 1)

  return (
    <AdminOperationalSection
      eyebrow={t('adminSnapshots.outputVolumeEyebrow')}
      title={t('adminSnapshots.materializedSlices')}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('adminSnapshots.materializedSlices')}</TableHead>
            <TableHead className="tw:text-right">{t('adminSnapshots.reportRows')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <OutputVolumeRow label={t('adminSnapshots.workforceRows')} tone="success" value={input.detail.cards.workforceRows} total={total} />
          <OutputVolumeRow label={t('adminSnapshots.kpiRows')} tone="accent" value={input.detail.cards.kpiRows} total={total} />
          <OutputVolumeRow label={t('adminSnapshots.checklistRows')} tone="warning" value={input.detail.cards.checklistRows} total={total} />
          <OutputVolumeRow label={t('adminSnapshots.turnoverRows')} tone="danger" value={input.detail.cards.turnoverRows} total={total} />
        </TableBody>
      </Table>
    </AdminOperationalSection>
  )
}

function OutputVolumeRow(input: { label: string; tone: AdminSurfaceTone; value: number; total: number }) {
  const percent = input.total > 0 ? Math.round((input.value / input.total) * 100) : 0

  return (
    <TableRow>
      <TableCell>
        <div className="tw:grid tw:gap-2">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-sm">
            <span className="tw:text-muted-foreground">{input.label}</span>
            <span className="tw:font-medium">{percent}%</span>
          </div>
          <Progress className={progressToneClass(input.tone)} value={percent} aria-label={input.label} />
        </div>
      </TableCell>
      <TableCell className="tw:text-right tw:font-medium">{input.value}</TableCell>
    </TableRow>
  )
}

function formatSnapshotKpiConfigVersion(input: {
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
} | null | undefined, t: TranslateFunction) {
  if (input?.state === 'versioned' && input.versionNo) {
    return `v${input.versionNo}`
  }

  return t('adminSnapshots.preGovernanceSnapshot')
}

function progressToneClass(tone: AdminSurfaceTone) {
  if (tone === 'success') return 'tw:[&_[data-slot=progress-indicator]]:bg-emerald-500'
  if (tone === 'accent') return 'tw:[&_[data-slot=progress-indicator]]:bg-violet-500'
  if (tone === 'warning') return 'tw:[&_[data-slot=progress-indicator]]:bg-amber-500'
  if (tone === 'danger') return 'tw:[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (tone === 'cyan') return 'tw:[&_[data-slot=progress-indicator]]:bg-cyan-500'
  return 'tw:[&_[data-slot=progress-indicator]]:bg-slate-400'
}
