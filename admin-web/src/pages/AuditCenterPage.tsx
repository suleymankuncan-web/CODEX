import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowRight, DatabaseZap, Layers3, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  AdminOperationalBadge as AdminSurfaceBadge,
  AdminOperationalEmpty as AdminSurfaceEmpty,
  AdminOperationalHeader as AdminSurfaceHeader,
  AdminOperationalKeyGrid as AdminKeyValueGrid,
  AdminOperationalKeyValue as AdminKeyValue,
  AdminOperationalMetrics as AdminMetricStrip,
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalState as AdminStatePanel,
  type AdminOperationalTone as AdminSurfaceTone,
} from './admin-operational-primitives'
import { Button } from '../components/ui/button'
import {
  AuthLinkRow,
  AuthList,
  AuthMuted,
  AuthRowHead,
} from '../features/auth/AuthSurfacePrimitives'
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
import { formatDateTime, formatState, mapHealthTone } from '../lib/format'

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

  const users = useMemo(() => usersQuery.isError ? [] : usersQuery.data?.items ?? [], [usersQuery.isError, usersQuery.data?.items])
  const assignments = useMemo(
    () => assignmentsQuery.isError ? [] : assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.isError, assignmentsQuery.data?.items],
  )
  const batches = useMemo(() => importQuery.isError ? [] : importQuery.data?.items ?? [], [importQuery.isError, importQuery.data?.items])
  const runs = useMemo(() => snapshotQuery.isError ? [] : snapshotQuery.data?.items ?? [], [snapshotQuery.isError, snapshotQuery.data?.items])

  const userAuditQueries = useQueries({
    queries: users.slice(0, 2).map((user) => ({
      queryKey: ['audit-center-user-audit', user.userId, 1, 0],
      queryFn: () => getUserAudit(user.userId, { limit: 1, offset: 0 }),
      enabled: usersQuery.isSuccess,
    })),
  })
  const assignmentAuditQueries = useQueries({
    queries: assignments.slice(0, 2).map((assignment) => ({
      queryKey: ['audit-center-assignment-audit', assignment.assignmentId, 1, 0],
      queryFn: () => getRoleAssignmentAudit(assignment.assignmentId, { limit: 1, offset: 0 }),
      enabled: assignmentsQuery.isSuccess,
    })),
  })
  const recentTrace = useMemo<TraceItem[]>(() => {
    const items: TraceItem[] = []

    for (let index = 0; index < userAuditQueries.length; index += 1) {
      const query = userAuditQueries[index]
      if (!query || query.isError) {
        continue
      }
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
      if (!query || query.isError) {
        continue
      }
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('adminAudit.loadingTitle')} description={t('adminAudit.loadingCopy')} />
      </AdminSurfacePage>
    )
  }

  const primaryQueries = [usersQuery, assignmentsQuery, importQuery, snapshotQuery]
  const hasPrimaryError = primaryQueries.some((query) => query.isError)
  const isPrimaryRetrying = primaryQueries.some((query) => query.isError && query.isFetching)
  const traceLoading = [...userAuditQueries, ...assignmentAuditQueries].some((query) => query.isLoading)
  const traceQueries = [...userAuditQueries, ...assignmentAuditQueries]
  const hasTraceError = traceQueries.some((query) => query.isError)
  const isTraceRetrying = traceQueries.some((query) => query.isError && query.isFetching)

  function retryPrimaryQueries() {
    void Promise.all(primaryQueries.filter((query) => query.isError).map((query) => query.refetch()))
  }

  function retryTraceQueries() {
    void Promise.all(traceQueries.filter((query) => query.isError).map((query) => query.refetch()))
  }

  return (
    <AdminSurfacePage ariaLabel={t('adminAudit.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('adminAudit.heroEyebrow')}
        title={t('adminAudit.title')}
        description={t('adminAudit.heroCopy')}
        icon={<ShieldCheck size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone="accent">
              {t('adminAudit.users')}: {usersQuery.isError ? '—' : (usersQuery.data?.meta.total ?? users.length)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone="cyan">
              {t('adminAudit.assignments')}: {assignmentsQuery.isError ? '—' : (assignmentsQuery.data?.meta.total ?? assignments.length)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone="neutral">
              {t('adminAudit.operationalTrails')}: {importQuery.isError || snapshotQuery.isError ? '—' : batches.length + runs.length}
            </AdminSurfaceBadge>
          </>
        }
      />

      {hasPrimaryError ? (
        <AdminStatePanel
          title={t('adminAudit.partialDataTitle')}
          description={t('adminAudit.partialDataCopy')}
          tone="danger"
          action={
            <Button
              type="button"
              variant="outline"
              disabled={isPrimaryRetrying}
              onClick={retryPrimaryQueries}
            >
              <RefreshCw aria-hidden="true" size={16} />
              {isPrimaryRetrying ? t('adminAudit.retryingAction') : t('adminAudit.retryAction')}
            </Button>
          }
        />
      ) : null}

      <AdminMetricStrip
        items={[
          {
            id: 'audit-users',
            label: t('adminAudit.userAudit'),
            value: usersQuery.isError ? '—' : users.length,
            description: t('adminAudit.userAuditNote'),
            icon: <ShieldCheck size={18} />,
            tone: 'success',
          },
          {
            id: 'audit-assignments',
            label: t('adminAudit.assignmentAudit'),
            value: assignmentsQuery.isError ? '—' : assignments.length,
            description: t('adminAudit.assignmentAuditNote'),
            icon: <ShieldCheck size={18} />,
            tone: 'accent',
          },
          {
            id: 'audit-imports',
            label: t('adminAudit.importTraces'),
            value: importQuery.isError ? '—' : batches.length,
            description: t('adminAudit.importTracesNote'),
            icon: <DatabaseZap size={18} />,
            tone: 'warning',
          },
          {
            id: 'audit-snapshots',
            label: t('adminAudit.snapshotTraces'),
            value: snapshotQuery.isError ? '—' : runs.length,
            description: t('adminAudit.snapshotTracesNote'),
            icon: <Layers3 size={18} />,
            tone: 'danger',
          },
        ]}
      />

      <AuditRecentTracePanel
        recentTrace={recentTrace}
        traceError={hasTraceError}
        traceLoading={traceLoading}
        traceRetrying={isTraceRetrying}
        onRetry={retryTraceQueries}
      />

      <AuditSourceGrid
        users={users}
        assignments={assignments}
        batches={batches}
        runs={runs}
        unavailable={{
          assignments: assignmentsQuery.isError,
          batches: importQuery.isError,
          runs: snapshotQuery.isError,
          users: usersQuery.isError,
        }}
      />
    </AdminSurfacePage>
  )
}

function AuditRecentTracePanel(input: {
  recentTrace: TraceItem[]
  traceError: boolean
  traceLoading: boolean
  traceRetrying: boolean
  onRetry: () => void
}) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('adminAudit.recentTrace')}
      title={t('adminAudit.recentTraceTitle')}
      badge={
        <AdminSurfaceBadge tone={input.traceError ? 'warning' : input.traceLoading ? 'warning' : 'accent'}>
          {input.traceError
            ? t('adminAudit.incomplete')
            : input.traceLoading
              ? t('adminAudit.hydrating')
              : t('adminAudit.liveSlice')}
        </AdminSurfaceBadge>
      }
    >
      {input.traceError ? (
        <AdminStatePanel
          title={t('adminAudit.partialTraceTitle')}
          description={t('adminAudit.partialTraceCopy')}
          tone="warning"
          action={
            <Button
              type="button"
              variant="outline"
              disabled={input.traceRetrying}
              onClick={input.onRetry}
            >
              <RefreshCw aria-hidden="true" size={16} />
              {input.traceRetrying ? t('adminAudit.retryingAction') : t('adminAudit.retryAction')}
            </Button>
          }
        />
      ) : null}
      {input.recentTrace.length === 0 && !input.traceError ? (
        <AdminSurfaceEmpty copy={t('adminAudit.noTraceItems')} />
      ) : (
        <AuthList>
          {input.recentTrace.map((item) => (
            <AuthLinkRow key={item.id} to={item.href}>
              <AuthRowHead>
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{item.title}</strong>
                <AdminSurfaceBadge tone={toAdminTone(item.tone)}>
                  {formatDateTime(item.happenedAt, locale)}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">{item.subtitle}</p>
              <AdminKeyValueGrid className="tw:lg:grid-cols-2">
                <AdminKeyValue
                  label={t('adminAudit.correlationIdLabel')}
                  value={item.correlationId ?? t('adminAudit.correlationFallback')}
                />
                <AdminKeyValue label={t('adminAudit.traceTargetLabel')} value={item.href} />
              </AdminKeyValueGrid>
            </AuthLinkRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function AuditSourceGrid(input: {
  users: UserAccount[]
  assignments: RoleAssignment[]
  batches: NeedsActionItem[]
  runs: SnapshotNeedsActionItem[]
  unavailable: {
    users: boolean
    assignments: boolean
    batches: boolean
    runs: boolean
  }
}) {
  return (
    <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
      <AuditUsersPanel users={input.users} unavailable={input.unavailable.users} />
      <AuditAssignmentsPanel assignments={input.assignments} unavailable={input.unavailable.assignments} />
      <AuditImportBatchesPanel batches={input.batches} unavailable={input.unavailable.batches} />
      <AuditSnapshotRunsPanel runs={input.runs} unavailable={input.unavailable.runs} />
    </section>
  )
}

function AuditUsersPanel(input: { users: UserAccount[]; unavailable: boolean }) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('adminAudit.authUsers')}
      title={t('adminAudit.recentAccountAuditEntries')}
    >
      {input.unavailable ? (
        <AdminStatePanel title={t('adminAudit.sourceUnavailable')} tone="danger" />
      ) : input.users.length === 0 ? (
        <AdminSurfaceEmpty copy={t('adminAudit.noUserAccounts')} />
      ) : (
        <AuthList>
          {input.users.slice(0, 6).map((user) => (
            <AuthLinkRow key={user.userId} to={`/admin/audit/users/${user.userId}/audit`}>
              <AuthRowHead>
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{user.username}</strong>
                <AdminSurfaceBadge tone={user.isActive ? 'success' : 'danger'}>
                  {formatAuditActiveState(user.isActive, t)}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">{user.email}</p>
              <AuthMuted>
                {t('adminAudit.authProviderCreated', {
                  provider: user.authProvider,
                  date: formatDateTime(user.createdAt, locale),
                })}
              </AuthMuted>
            </AuthLinkRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function AuditAssignmentsPanel(input: { assignments: RoleAssignment[]; unavailable: boolean }) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('adminAudit.roleAssignments')}
      title={t('adminAudit.scopedAccessAuditTrails')}
    >
      {input.unavailable ? (
        <AdminStatePanel title={t('adminAudit.sourceUnavailable')} tone="danger" />
      ) : input.assignments.length === 0 ? (
        <AdminSurfaceEmpty copy={t('adminAudit.noRoleAssignments')} />
      ) : (
        <AuthList>
          {input.assignments.slice(0, 6).map((assignment) => (
            <AuthLinkRow
              key={assignment.assignmentId}
              to={`/admin/audit/role-assignments/${assignment.assignmentId}/audit`}
            >
              <AuthRowHead>
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{assignment.roleCode}</strong>
                <AdminSurfaceBadge tone={assignment.active ? 'success' : 'danger'}>
                  {formatAuditActiveState(assignment.active, t)}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {assignment.username} - {assignment.scopeType}
              </p>
              <AuthMuted>
                {t('adminAudit.createdAt', {
                  date: formatDateTime(assignment.createdAt, locale),
                })}
              </AuthMuted>
            </AuthLinkRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function AuditImportBatchesPanel(input: { batches: NeedsActionItem[]; unavailable: boolean }) {
  const { t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('adminAudit.importBatches')}
      title={t('adminAudit.batchAuditJumpList')}
    >
      {input.unavailable ? (
        <AdminStatePanel title={t('adminAudit.sourceUnavailable')} tone="danger" />
      ) : input.batches.length === 0 ? (
        <AdminSurfaceEmpty copy={t('adminAudit.noImportBatches')} />
      ) : (
        <AuthList>
          {input.batches.map((batch) => (
            <AuthLinkRow key={batch.batchId} to={`/admin/integrations/${batch.batchId}`}>
              <AuthRowHead>
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{batch.sourceCode} / {batch.entityType}</strong>
                <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(batch.healthState))}>
                  {formatAuditHealthState(batch.healthState, t)}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">{batch.actionReason}</p>
              <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:font-medium tw:text-primary">
                {t('adminAudit.openBatchDetailAndAudit')}
                <ArrowRight size={16} />
              </span>
            </AuthLinkRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function AuditSnapshotRunsPanel(input: { runs: SnapshotNeedsActionItem[]; unavailable: boolean }) {
  const { locale, t } = useLocalization()

  return (
    <AdminSurfaceSection
      eyebrow={t('adminAudit.snapshotRuns')}
      title={t('adminAudit.rerunDependencyTrace')}
    >
      {input.unavailable ? (
        <AdminStatePanel title={t('adminAudit.sourceUnavailable')} tone="danger" />
      ) : input.runs.length === 0 ? (
        <AdminSurfaceEmpty copy={t('adminAudit.noSnapshotRuns')} />
      ) : (
        <AuthList>
          {input.runs.map((run) => (
            <AuthLinkRow key={run.snapshotRunId} to={`/admin/snapshots/${run.snapshotRunId}`}>
              <AuthRowHead>
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">
                  {t('adminAudit.snapshotLabel', { type: run.snapshotType })}
                </strong>
                <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(run.healthState))}>
                  {formatAuditHealthState(run.healthState, t)}
                </AdminSurfaceBadge>
              </AuthRowHead>
              <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">{run.actionReason}</p>
              <AuthMuted>
                {t('adminAudit.snapshotStatus', {
                  date: formatDateTime(run.generatedAt, locale),
                  status: formatAuditRunStatus(run.runStatus, t),
                })}
              </AuthMuted>
            </AuthLinkRow>
          ))}
        </AuthList>
      )}
    </AdminSurfaceSection>
  )
}

function formatAuditActiveState(active: boolean, t: TranslateFunction) {
  return active ? t('adminAudit.active') : t('adminAudit.inactive')
}

function toAdminTone(tone: TraceItem['tone']): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  return tone
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
