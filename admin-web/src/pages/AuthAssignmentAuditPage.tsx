import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EmptyState, KeyValue, ScreenState } from '../components/dashboard-primitives'
import { getRoleAssignmentAudit } from '../features/auth/api'
import { formatDateTime, getErrorMessage } from '../lib/format'
import { resolveAuditBackLink } from './audit-navigation'

function describeDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return []
  }

  return Object.entries(details).map(([key, value]) => ({
    label: key,
    value: value === null || value === undefined ? 'null' : String(value),
  }))
}

export function AuthAssignmentAuditPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const location = useLocation()
  const backLink = resolveAuditBackLink(location.pathname)

  const auditQuery = useQuery({
    queryKey: ['auth-assignment-audit', assignmentId],
    queryFn: () => getRoleAssignmentAudit(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })

  if (!assignmentId) {
    return <ScreenState title="Assignment audit context missing" copy="Choose a role assignment before opening audit detail." tone="error" />
  }

  if (auditQuery.isLoading) {
    return <ScreenState title="Loading assignment audit" copy="Pulling scope lifecycle events for the selected role assignment." />
  }

  if (auditQuery.isError) {
    return <ScreenState title="Assignment audit unavailable" copy={getErrorMessage(auditQuery.error)} tone="error" />
  }

  const items = auditQuery.data?.items ?? []

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Auth Audit</div>
          <h2 className="hero-title">Role assignment audit trail.</h2>
          <p className="hero-copy">
            This timeline shows the grant and deactivation history for the selected scoped assignment.
          </p>
        </div>
      </section>

      <Link className="back-link" to={backLink.to}>
        <ArrowLeft size={16} />
        <span>{backLink.label}</span>
      </Link>

      {items.length === 0 ? (
        <section className="panel">
          <EmptyState copy="No audit events were returned for this role assignment." />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Audit timeline</div>
              <h3>Assignment events</h3>
            </div>
          </div>
          <div className="timeline">
            {items.map((item) => (
              <article className="timeline-item" key={item.eventLogId}>
                <span className="timeline-dot" />
                <div className="stacked-row-head">
                  <strong>{item.eventType}</strong>
                  <span className="queue-subtitle">{formatDateTime(item.occurredAt)}</span>
                </div>
                <p>
                  Actor: {item.actorUserId ?? 'system'} | Module: {item.metadata.sourceContext?.module ?? 'n/a'} | Operation:{' '}
                  {item.metadata.sourceContext?.operation ?? 'n/a'}
                </p>
                <div className="key-grid">
                  <KeyValue label="Event log id" value={item.eventLogId} />
                  <KeyValue label="Correlation id" value={item.correlationId ?? 'n/a'} />
                  <KeyValue label="Changed fields" value={(item.metadata.changedFields ?? []).join(', ') || 'none'} />
                  {describeDetails(item.metadata.details).map((detail) => (
                    <KeyValue key={`${item.eventLogId}:${detail.label}`} label={detail.label} value={detail.value} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
