import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { EmptyState, KeyValue, ScreenState } from '../components/dashboard-primitives'
import { getActionStoreAssignmentAudit } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'
import { resolveAuditBackLink } from './audit-navigation'

function describeDetails(details: Record<string, unknown> | undefined, nullValue: string) {
  if (!details) {
    return []
  }

  return Object.entries(details).map(([key, value]) => ({
    label: key,
    value: value === null || value === undefined ? nullValue : String(value),
  }))
}

export function AuthActionStoreAssignmentAuditPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const location = useLocation()
  const { locale, t } = useLocalization()
  const backLink = resolveAuditBackLink(location.pathname, t)

  const auditQuery = useQuery({
    queryKey: ['auth-action-store-assignment-audit', assignmentId],
    queryFn: () => getActionStoreAssignmentAudit(assignmentId ?? ''),
    enabled: Boolean(assignmentId),
  })

  if (!assignmentId) {
    return (
      <ScreenState
        title={t('authAuditDetails.actionStoreMissingTitle')}
        copy={t('authAuditDetails.actionStoreMissingCopy')}
        tone="error"
      />
    )
  }

  if (auditQuery.isLoading) {
    return (
      <ScreenState
        title={t('authAuditDetails.actionStoreLoadingTitle')}
        copy={t('authAuditDetails.actionStoreLoadingCopy')}
      />
    )
  }

  if (auditQuery.isError) {
    return <ScreenState title={t('authAuditDetails.actionStoreErrorTitle')} copy={getErrorMessage(auditQuery.error)} tone="error" />
  }

  const items = auditQuery.data?.items ?? []

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('authAuditDetails.heroEyebrow')}</div>
          <h2 className="hero-title">{t('authAuditDetails.actionStoreHeroTitle')}</h2>
          <p className="hero-copy">{t('authAuditDetails.actionStoreHeroCopy')}</p>
        </div>
      </section>

      <Link className="back-link" to={backLink.to}>
        <ArrowLeft size={16} />
        <span>{backLink.label}</span>
      </Link>

      {items.length === 0 ? (
        <section className="panel">
          <EmptyState copy={t('authAuditDetails.actionStoreEmptyCopy')} />
        </section>
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authAuditDetails.timelineEyebrow')}</div>
              <h3>{t('authAuditDetails.actionStoreTimelineTitle')}</h3>
            </div>
          </div>
          <div className="timeline">
            {items.map((item) => (
              <article className="timeline-item" key={item.eventLogId}>
                <span className="timeline-dot" />
                <div className="stacked-row-head">
                  <strong>{item.eventType}</strong>
                  <span className="queue-subtitle">{formatDateTime(item.occurredAt, locale)}</span>
                </div>
                <p>
                  {t('authAuditDetails.actorLine', {
                    actor: item.actorUserId ?? t('authAuditDetails.systemActor'),
                    module: item.metadata.sourceContext?.module ?? t('authAuditDetails.notAvailable'),
                    operation: item.metadata.sourceContext?.operation ?? t('authAuditDetails.notAvailable'),
                  })}
                </p>
                <div className="key-grid">
                  <KeyValue label={t('authAuditDetails.eventLogId')} value={item.eventLogId} />
                  <KeyValue label={t('authAuditDetails.correlationId')} value={item.correlationId ?? t('authAuditDetails.notAvailable')} />
                  <KeyValue label={t('authAuditDetails.changedFields')} value={(item.metadata.changedFields ?? []).join(', ') || t('authAuditDetails.none')} />
                  {describeDetails(item.metadata.details, t('authAuditDetails.nullValue')).map((detail) => (
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
