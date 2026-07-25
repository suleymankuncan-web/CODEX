import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router'
import {
  AdminOperationalEmpty as AdminSurfaceEmpty,
  AdminOperationalHeader as AdminSurfaceHeader,
  AdminOperationalKeyGrid as AdminKeyValueGrid,
  AdminOperationalKeyValue as AdminKeyValue,
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalState as AdminStatePanel,
} from './admin-operational-primitives'
import {
  AuthButton,
  AuthMuted,
  AuthRowHead,
  AuthTimeline,
  AuthTimelineItem,
} from '../features/auth/AuthSurfacePrimitives'
import { getUserAudit } from '../features/auth/api'
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

export function AuthUserAuditPage() {
  const { userId } = useParams<{ userId: string }>()
  const location = useLocation()
  const { locale, t } = useLocalization()
  const backLink = resolveAuditBackLink(location.pathname, t)

  const auditQuery = useQuery({
    queryKey: ['auth-user-audit', userId],
    queryFn: () => getUserAudit(userId ?? ''),
    enabled: Boolean(userId),
  })

  if (!userId) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authAuditDetails.userMissingTitle')}
          description={t('authAuditDetails.userMissingCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (auditQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
        title={t('authAuditDetails.userLoadingTitle')}
          description={t('authAuditDetails.userLoadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  if (auditQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authAuditDetails.userErrorTitle')}
          description={getErrorMessage(auditQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const items = auditQuery.data?.items ?? []

  return (
    <AdminSurfacePage ariaLabel={t('authAuditDetails.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('authAuditDetails.heroEyebrow')}
        title={t('authAuditDetails.userHeroTitle')}
        description={t('authAuditDetails.userHeroCopy')}
      />

      <AuthButton asChild size="sm" variant="outline">
        <Link to={backLink.to}>
          <ArrowLeft size={16} />
          <span>{backLink.label}</span>
        </Link>
      </AuthButton>

      {items.length === 0 ? (
        <AdminSurfaceSection title={t('authAuditDetails.userTimelineTitle')}>
          <AdminSurfaceEmpty copy={t('authAuditDetails.userEmptyCopy')} />
        </AdminSurfaceSection>
      ) : (
        <AdminSurfaceSection
          eyebrow={t('authAuditDetails.timelineEyebrow')}
          title={t('authAuditDetails.userTimelineTitle')}
        >
          <AuthTimeline>
            {items.map((item) => (
              <AuthTimelineItem key={item.eventLogId}>
                <AuthRowHead>
                  <strong className="tw:text-sm tw:font-medium tw:text-foreground">{item.eventType}</strong>
                  <AuthMuted>{formatDateTime(item.occurredAt, locale)}</AuthMuted>
                </AuthRowHead>
                <p className="tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {t('authAuditDetails.actorLine', {
                    actor: item.actorUserId ?? t('authAuditDetails.systemActor'),
                    module: item.metadata.sourceContext?.module ?? t('authAuditDetails.notAvailable'),
                    operation: item.metadata.sourceContext?.operation ?? t('authAuditDetails.notAvailable'),
                  })}
                </p>
                <AdminKeyValueGrid>
                  <AdminKeyValue label={t('authAuditDetails.eventLogId')} value={item.eventLogId} />
                  <AdminKeyValue label={t('authAuditDetails.correlationId')} value={item.correlationId ?? t('authAuditDetails.notAvailable')} />
                  <AdminKeyValue label={t('authAuditDetails.changedFields')} value={(item.metadata.changedFields ?? []).join(', ') || t('authAuditDetails.none')} />
                  {describeDetails(item.metadata.details, t('authAuditDetails.nullValue')).map((detail) => (
                    <AdminKeyValue key={`${item.eventLogId}:${detail.label}`} label={detail.label} value={detail.value} />
                  ))}
                </AdminKeyValueGrid>
              </AuthTimelineItem>
            ))}
          </AuthTimeline>
        </AdminSurfaceSection>
      )}
    </AdminSurfacePage>
  )
}
