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
} from '../features/auth/api'
import { getNeedsAction } from '../features/integrations/api'
import { getSnapshotNeedsAction } from '../features/snapshots/api'
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
        subtitle: `auth user audit - actor ${event.actorUserId ?? 'system'}`,
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
        subtitle: `assignment audit - ${assignment.roleCode} / ${assignment.scopeType}`,
        correlationId: event.correlationId,
        href: `/admin/audit/role-assignments/${assignment.assignmentId}/audit`,
        tone: 'warning',
      })
    }

    for (const batch of batches.slice(0, 2)) {
      items.push({
        id: batch.batchId,
        happenedAt: batch.startedAt,
        title: `import ${batch.healthState}`,
        subtitle: `${batch.sourceCode} / ${batch.entityType} - ${batch.actionReason}`,
        correlationId: null,
        href: `/admin/integrations/${batch.batchId}`,
        tone: mapHealthTone(batch.healthState),
      })
    }

    for (const run of runs.slice(0, 2)) {
      items.push({
        id: run.snapshotRunId,
        happenedAt: run.generatedAt,
        title: `snapshot ${run.healthState}`,
        subtitle: `${run.snapshotType} - ${run.actionReason}`,
        correlationId: null,
        href: `/admin/snapshots/${run.snapshotRunId}`,
        tone: mapHealthTone(run.healthState),
      })
    }

    return items.sort((left, right) => right.happenedAt.localeCompare(left.happenedAt)).slice(0, 6)
  }, [assignmentAuditQueries, assignments, batches, runs, userAuditQueries, users])

  const isLoading =
    usersQuery.isLoading ||
    assignmentsQuery.isLoading ||
    importQuery.isLoading ||
    snapshotQuery.isLoading

  if (isLoading) {
    return <ScreenState title="Loading audit center" copy="Collecting the main audit entry points across auth and operations." />
  }

  const firstError = [usersQuery, assignmentsQuery, importQuery, snapshotQuery].find((query) => query.isError)
  if (firstError?.isError) {
    return <ScreenState title="Audit center unavailable" copy={getErrorMessage(firstError.error)} tone="error" />
  }

  const traceLoading = [...userAuditQueries, ...assignmentAuditQueries].some((query) => query.isLoading)

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Audit Center</div>
          <h2 className="hero-title">One control room for every traceable decision surface.</h2>
          <p className="hero-copy">
            There is no single backend-wide audit feed yet, so this screen gathers the most important
            entry points: auth lifecycle, import batches, and snapshot runs.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Users" value={String(usersQuery.data?.meta.total ?? users.length)} />
          <MetricAccent label="Assignments" value={String(assignmentsQuery.data?.meta.total ?? assignments.length)} />
          <MetricAccent label="Operational trails" value={String(batches.length + runs.length)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="User audit" value={users.length} note="Open account lifecycle trails" icon={<ShieldCheck size={18} />} tone="calm" />
        <MetricCard title="Assignment audit" value={assignments.length} note="Review scoped access changes" icon={<ShieldCheck size={18} />} tone="accent" />
        <MetricCard title="Import traces" value={batches.length} note="Jump into batch-level audit logs" icon={<DatabaseZap size={18} />} tone="warning" />
        <MetricCard title="Snapshot traces" value={runs.length} note="Inspect rerun and dependency audit" icon={<Layers3 size={18} />} tone="danger" />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Recent trace</div>
            <h3>Latest visible events across auth and operations</h3>
          </div>
          <StatusPill tone={traceLoading ? 'warning' : 'accent'}>
            {traceLoading ? 'Hydrating' : 'Live slice'}
          </StatusPill>
        </div>

        {recentTrace.length === 0 ? (
          <EmptyState copy="No trace items were available yet. Open auth, import, or snapshot detail views to inspect full timelines." />
        ) : (
          <div className="stacked-table">
            {recentTrace.map((item) => (
              <Link className="stacked-row audit-link-row" key={item.id} to={item.href}>
                <div className="stacked-row-head">
                  <strong>{item.title}</strong>
                  <StatusPill tone={item.tone}>{formatDateTime(item.happenedAt)}</StatusPill>
                </div>
                <p>{item.subtitle}</p>
                <span className="queue-subtitle">
                  correlation {item.correlationId ?? 'detail-only or n/a'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="audit-source-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Auth users</div>
              <h3>Recent account audit entries</h3>
            </div>
          </div>
          {users.length === 0 ? (
            <EmptyState copy="No user accounts are currently available." />
          ) : (
            <div className="stacked-table">
              {users.slice(0, 6).map((user) => (
                <Link className="stacked-row audit-link-row" key={user.userId} to={`/admin/audit/users/${user.userId}/audit`}>
                  <div className="stacked-row-head">
                    <strong>{user.username}</strong>
                    <StatusPill tone={user.isActive ? 'calm' : 'danger'}>
                      {user.isActive ? 'active' : 'inactive'}
                    </StatusPill>
                  </div>
                  <p>{user.email}</p>
                  <span className="queue-subtitle">
                    auth provider {user.authProvider} - created {formatDateTime(user.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Role assignments</div>
              <h3>Scoped access audit trails</h3>
            </div>
          </div>
          {assignments.length === 0 ? (
            <EmptyState copy="No role assignments are currently available." />
          ) : (
            <div className="stacked-table">
              {assignments.slice(0, 6).map((assignment) => (
                <Link
                  className="stacked-row audit-link-row"
                  key={assignment.assignmentId}
                  to={`/admin/audit/role-assignments/${assignment.assignmentId}/audit`}
                >
                  <div className="stacked-row-head">
                    <strong>{assignment.roleCode}</strong>
                    <StatusPill tone={assignment.active ? 'calm' : 'danger'}>
                      {assignment.active ? 'active' : 'inactive'}
                    </StatusPill>
                  </div>
                  <p>{assignment.username} - {assignment.scopeType}</p>
                  <span className="queue-subtitle">created {formatDateTime(assignment.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Import batches</div>
              <h3>Batch audit jump list</h3>
            </div>
          </div>
          {batches.length === 0 ? (
            <EmptyState copy="No import batches are waiting in the needs-action queue." />
          ) : (
            <div className="stacked-table">
              {batches.map((batch) => (
                <Link className="stacked-row audit-link-row" key={batch.batchId} to={`/admin/integrations/${batch.batchId}`}>
                  <div className="stacked-row-head">
                    <strong>{batch.sourceCode} / {batch.entityType}</strong>
                    <StatusPill tone={mapHealthTone(batch.healthState)}>{formatState(batch.healthState)}</StatusPill>
                  </div>
                  <p>{batch.actionReason}</p>
                  <span className="queue-footer">
                    Open batch detail and audit
                    <ArrowRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Snapshot runs</div>
              <h3>Rerun and dependency trace</h3>
            </div>
          </div>
          {runs.length === 0 ? (
            <EmptyState copy="No snapshot runs are waiting in the needs-action queue." />
          ) : (
            <div className="stacked-table">
              {runs.map((run) => (
                <Link className="stacked-row audit-link-row" key={run.snapshotRunId} to={`/admin/snapshots/${run.snapshotRunId}`}>
                  <div className="stacked-row-head">
                    <strong>{run.snapshotType} snapshot</strong>
                    <StatusPill tone={mapHealthTone(run.healthState)}>{formatState(run.healthState)}</StatusPill>
                  </div>
                  <p>{run.actionReason}</p>
                  <span className="queue-subtitle">
                    {formatDateTime(run.generatedAt)} - status {run.runStatus}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>
    </section>
  )
}
