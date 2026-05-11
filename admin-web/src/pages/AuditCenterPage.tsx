import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowRight, DatabaseZap, Layers3, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import {
  getRoleAssignmentAudit,
  getRoleAssignments,
  getUserAccounts,
  getUserAudit,
  type RoleAssignment,
  type UserAccount,
} from '../features/auth/api'
import { getNeedsAction, type NeedsActionItem } from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getSnapshotNeedsAction, type SnapshotNeedsActionItem } from '../features/snapshots/api'
import { formatDateTime, formatState, getErrorMessage, mapHealthTone } from '../lib/format'

type TraceItem = {
  id: string
  happenedAt: string
  title: string
  subtitle: string
  correlationId: string | null
  href: string
  tone: 'calm' | 'accent' | 'warning' | 'danger' | 'neutral'
}

export function AuditCenterPage() {
  const { t } = useLocalization()
  const usersQuery = useQuery({
    queryKey: ['audit-center-users'],
    queryFn: () => getUserAccounts(),
  })
  const assignmentsQuery = useQuery({
    queryKey: ['audit-center-assignments'],
    queryFn: () => getRoleAssignments(),
  })
  const importQuery = useQuery({
    queryKey: ['audit-center-imports'],
    queryFn: () => getNeedsAction({ limit: 6, offset: 0 }),
  })
  const snapshotQuery = useQuery({
    queryKey: ['audit-center-snapshots'],
    queryFn: () => getSnapshotNeedsAction({ limit: 6, offset: 0 }),
  })

  const users = useMemo(() => usersQuery.data?.items ?? [], [usersQuery.data?.items])
  const assignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data?.items],
  )
  const batches = useMemo(() => importQuery.data?.items ?? [], [importQuery.data?.items])
  const runs = useMemo(() => snapshotQuery.data?.items ?? [], [snapshotQuery.data?.items])

  const userAuditQueries = useQueries({
    queries: users.slice(0, 2).map((user) => ({
      queryKey: ['audit-center-user-audit', user.userId],
      queryFn: () => getUserAudit(user.userId),
      enabled: usersQuery.isSuccess,
    })),
  })
  const assignmentAuditQueries = useQueries({
    queries: assignments.slice(0, 2).map((assignment) => ({
      queryKey: ['audit-center-assignment-audit', assignment.assignmentId],
      queryFn: () => getRoleAssignmentAudit(assignment.assignmentId),
      enabled: assignmentsQuery.isSuccess,
    })),
  })
  const recentTrace = useMemo<TraceItem[]>(() => {
    const items: TraceItem[] = []

    for (let index = 0; index < userAuditQueries.length; index += 1) {
      const query = userAuditQueries[index]
      const user = users[index]
      const event = query.data?.items?.[0]
      if (!event || !user) {
        continue
      }

      items.push({
        id: event.eventLogId,
        happenedAt: event.occurredAt,
        title: event.eventType,
        subtitle: t('adminAudit.authUserAuditSubtitle', {
          actor: event.actorUserId ?? t('adminAudit.systemActor'),
        }),
        correlationId: event.correlationId,
        href: `/admin/audit/users/${user.userId}/audit`,
        tone: 'accent',
      })
    }

    for (let index = 0; index < assignmentAuditQueries.length; index += 1) {
      const query = assignmentAuditQueries[index]
      const assignment = assignments[index]
      const event = query.data?.items?.[0]
      if (!event || !assignment) {
        continue
      }

      items.push({
        id: event.eventLogId,
        happenedAt: event.occurredAt,
        title: event.eventType,
        subtitle: t('adminAudit.assignmentAuditSubtitle', {
          roleCode: assignment.roleCode,
          scopeType: assignment.scopeType,
        }),
        correlationId: event.correlationId,
        href: `/admin/audit/role-assignments/${assignment.assignmentId}/audit`,
        tone: 'warning',
      })
    }

    for (const batch of batches.slice(0, 2)) {
      items.push({
        id: batch.batchId,
        happenedAt: batch.startedAt,
        title: t('adminAudit.importTraceTitle', {
          state: formatAuditHealthState(batch.healthState, t),
        }),
        subtitle: t('adminAudit.importTraceSubtitle', {
          source: batch.sourceCode,
          entity: batch.entityType,
          reason: batch.actionReason,
        }),
        correlationId: null,
        href: `/admin/integrations/${batch.batchId}`,
        tone: mapHealthTone(batch.healthState),
      })
    }

    for (const run of runs.slice(0, 2)) {
      items.push({
        id: run.snapshotRunId,
        happenedAt: run.generatedAt,
        title: t('adminAudit.snapshotTraceTitle', {
          state: formatAuditHealthState(run.healthState, t),
        }),
        subtitle: t('adminAudit.snapshotTraceSubtitle', {
          type: run.snapshotType,
          reason: run.actionReason,
        }),
        correlationId: null,
        href: `/admin/snapshots/${run.snapshotRunId}`,
        tone: mapHealthTone(run.healthState),
      })
    }

    return items.sort((left, right) => right.happenedAt.localeCompare(left.happenedAt)).slice(0, 6)
  }, [assignmentAuditQueries, assignments, batches, runs, t, userAuditQueries, users])

  const isLoading =
    usersQuery.isLoading ||
    assignmentsQuery.isLoading ||
    importQuery.isLoading ||
    snapshotQuery.isLoading

  if (isLoading) {
    return <ScreenState title={t('adminAudit.loadingTitle')} copy={t('adminAudit.loadingCopy')} />
  }

  const firstError = [usersQuery, assignmentsQuery, importQuery, snapshotQuery].find((query) => query.isError)
  if (firstError?.isError) {
    return <ScreenState title={t('adminAudit.errorTitle')} copy={getErrorMessage(firstError.error)} tone="error" />
  }

  const traceLoading = [...userAuditQueries, ...assignmentAuditQueries].some((query) => query.isLoading)

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminAudit.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminAudit.title')}</h2>
          <p className="hero-copy">{t('adminAudit.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminAudit.users')} value={String(usersQuery.data?.meta.total ?? users.length)} />
          <MetricAccent label={t('adminAudit.assignments')} value={String(assignmentsQuery.data?.meta.total ?? assignments.length)} />
          <MetricAccent label={t('adminAudit.operationalTrails')} value={String(batches.length + runs.length)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('adminAudit.userAudit')} value={users.length} note={t('adminAudit.userAuditNote')} icon={<ShieldCheck size={18} />} tone="calm" />
        <MetricCard title={t('adminAudit.assignmentAudit')} value={assignments.length} note={t('adminAudit.assignmentAuditNote')} icon={<ShieldCheck size={18} />} tone="accent" />
        <MetricCard title={t('adminAudit.importTraces')} value={batches.length} note={t('adminAudit.importTracesNote')} icon={<DatabaseZap size={18} />} tone="warning" />
        <MetricCard title={t('adminAudit.snapshotTraces')} value={runs.length} note={t('adminAudit.snapshotTracesNote')} icon={<Layers3 size={18} />} tone="danger" />
      </section>

      <AuditRecentTracePanel recentTrace={recentTrace} traceLoading={traceLoading} />

      <AuditSourceGrid users={users} assignments={assignments} batches={batches} runs={runs} />
    </section>
  )
}

function AuditRecentTracePanel(input: { recentTrace: TraceItem[]; traceLoading: boolean }) {
  const { locale, t } = useLocalization()

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminAudit.recentTrace')}</div>
          <h3>{t('adminAudit.recentTraceTitle')}</h3>
        </div>
        <StatusPill tone={input.traceLoading ? 'warning' : 'accent'}>
          {input.traceLoading ? t('adminAudit.hydrating') : t('adminAudit.liveSlice')}
        </StatusPill>
      </div>

      {input.recentTrace.length === 0 ? (
        <EmptyState copy={t('adminAudit.noTraceItems')} />
      ) : (
        <div className="stacked-table">
          {input.recentTrace.map((item) => (
            <Link className="stacked-row audit-link-row" key={item.id} to={item.href}>
              <div className="stacked-row-head">
                <strong>{item.title}</strong>
                <StatusPill tone={item.tone}>{formatDateTime(item.happenedAt, locale)}</StatusPill>
              </div>
              <p>{item.subtitle}</p>
              <span className="queue-subtitle">
                {t('adminAudit.correlation', {
                  correlationId: item.correlationId ?? t('adminAudit.correlationFallback'),
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function AuditSourceGrid(input: {
  users: UserAccount[]
  assignments: RoleAssignment[]
  batches: NeedsActionItem[]
  runs: SnapshotNeedsActionItem[]
}) {
  return (
    <section className="audit-source-grid">
      <AuditUsersPanel users={input.users} />
      <AuditAssignmentsPanel assignments={input.assignments} />
      <AuditImportBatchesPanel batches={input.batches} />
      <AuditSnapshotRunsPanel runs={input.runs} />
    </section>
  )
}

function AuditUsersPanel(input: { users: UserAccount[] }) {
  const { locale, t } = useLocalization()

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminAudit.authUsers')}</div>
          <h3>{t('adminAudit.recentAccountAuditEntries')}</h3>
        </div>
      </div>
      {input.users.length === 0 ? (
        <EmptyState copy={t('adminAudit.noUserAccounts')} />
      ) : (
        <div className="stacked-table">
          {input.users.slice(0, 6).map((user) => (
            <Link className="stacked-row audit-link-row" key={user.userId} to={`/admin/audit/users/${user.userId}/audit`}>
              <div className="stacked-row-head">
                <strong>{user.username}</strong>
                <StatusPill tone={user.isActive ? 'calm' : 'danger'}>
                  {formatAuditActiveState(user.isActive, t)}
                </StatusPill>
              </div>
              <p>{user.email}</p>
              <span className="queue-subtitle">
                {t('adminAudit.authProviderCreated', {
                  provider: user.authProvider,
                  date: formatDateTime(user.createdAt, locale),
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}

function AuditAssignmentsPanel(input: { assignments: RoleAssignment[] }) {
  const { locale, t } = useLocalization()

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminAudit.roleAssignments')}</div>
          <h3>{t('adminAudit.scopedAccessAuditTrails')}</h3>
        </div>
      </div>
      {input.assignments.length === 0 ? (
        <EmptyState copy={t('adminAudit.noRoleAssignments')} />
      ) : (
        <div className="stacked-table">
          {input.assignments.slice(0, 6).map((assignment) => (
            <Link
              className="stacked-row audit-link-row"
              key={assignment.assignmentId}
              to={`/admin/audit/role-assignments/${assignment.assignmentId}/audit`}
            >
              <div className="stacked-row-head">
                <strong>{assignment.roleCode}</strong>
                <StatusPill tone={assignment.active ? 'calm' : 'danger'}>
                  {formatAuditActiveState(assignment.active, t)}
                </StatusPill>
              </div>
              <p>{assignment.username} - {assignment.scopeType}</p>
              <span className="queue-subtitle">
                {t('adminAudit.createdAt', {
                  date: formatDateTime(assignment.createdAt, locale),
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}

function AuditImportBatchesPanel(input: { batches: NeedsActionItem[] }) {
  const { t } = useLocalization()

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminAudit.importBatches')}</div>
          <h3>{t('adminAudit.batchAuditJumpList')}</h3>
        </div>
      </div>
      {input.batches.length === 0 ? (
        <EmptyState copy={t('adminAudit.noImportBatches')} />
      ) : (
        <div className="stacked-table">
          {input.batches.map((batch) => (
            <Link className="stacked-row audit-link-row" key={batch.batchId} to={`/admin/integrations/${batch.batchId}`}>
              <div className="stacked-row-head">
                <strong>{batch.sourceCode} / {batch.entityType}</strong>
                <StatusPill tone={mapHealthTone(batch.healthState)}>
                  {formatAuditHealthState(batch.healthState, t)}
                </StatusPill>
              </div>
              <p>{batch.actionReason}</p>
              <span className="queue-footer">
                {t('adminAudit.openBatchDetailAndAudit')}
                <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}

function AuditSnapshotRunsPanel(input: { runs: SnapshotNeedsActionItem[] }) {
  const { locale, t } = useLocalization()

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('adminAudit.snapshotRuns')}</div>
          <h3>{t('adminAudit.rerunDependencyTrace')}</h3>
        </div>
      </div>
      {input.runs.length === 0 ? (
        <EmptyState copy={t('adminAudit.noSnapshotRuns')} />
      ) : (
        <div className="stacked-table">
          {input.runs.map((run) => (
            <Link className="stacked-row audit-link-row" key={run.snapshotRunId} to={`/admin/snapshots/${run.snapshotRunId}`}>
              <div className="stacked-row-head">
                <strong>{t('adminAudit.snapshotLabel', { type: run.snapshotType })}</strong>
                <StatusPill tone={mapHealthTone(run.healthState)}>
                  {formatAuditHealthState(run.healthState, t)}
                </StatusPill>
              </div>
              <p>{run.actionReason}</p>
              <span className="queue-subtitle">
                {t('adminAudit.snapshotStatus', {
                  date: formatDateTime(run.generatedAt, locale),
                  status: formatAuditRunStatus(run.runStatus, t),
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}

function formatAuditActiveState(active: boolean, t: TranslateFunction) {
  return active ? t('adminAudit.active') : t('adminAudit.inactive')
}

function formatAuditHealthState(state: string, t: TranslateFunction) {
  if (state === 'healthy') return t('adminAudit.healthState.healthy')
  if (state === 'completed') return t('adminAudit.healthState.completed')
  if (state === 'failed') return t('adminAudit.healthState.failed')
  if (state === 'in_progress' || state === 'processing') {
    return t('adminAudit.healthState.inProgress')
  }
  if (state === 'blocked') return t('adminAudit.healthState.blocked')
  if (state === 'retry_ready' || state === 'ready') return t('adminAudit.healthState.retryReady')
  if (state === 'needs_action') return t('adminAudit.healthState.needsAction')
  if (state === 'stuck') return t('adminAudit.healthState.stuck')
  if (state === 'queued') return t('adminAudit.healthState.queued')
  if (state === 'pending') return t('adminAudit.healthState.pending')

  return formatState(state)
}

function formatAuditRunStatus(status: string, t: TranslateFunction) {
  if (status === 'completed') return t('adminAudit.runStatus.completed')
  if (status === 'failed') return t('adminAudit.runStatus.failed')
  if (status === 'running' || status === 'processing') return t('adminAudit.runStatus.running')
  if (status === 'queued') return t('adminAudit.runStatus.queued')
  if (status === 'pending') return t('adminAudit.runStatus.pending')

  return formatState(status)
}
