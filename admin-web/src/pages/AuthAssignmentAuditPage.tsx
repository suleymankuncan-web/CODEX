import { useState } from 'react'
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
import { getRoleAssignmentAudit } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'
import { resolveAuditBackLink } from './audit-navigation'

const AUDIT_PAGE_SIZE = 20

function describeDetails(details: Record<string, unknown> | undefined, nullValue: string) {
  if (!details) {
    return []
  }

  return Object.entries(details).map(([key, value]) => ({
    label: key,
    value: value === null || value === undefined ? nullValue : String(value),
  }))
}

function useScopedOffset(scopeKey: string) {
  const [page, setPage] = useState({ scopeKey, offset: 0 })
  const offset = page.scopeKey === scopeKey ? page.offset : 0
  const setOffset = (nextOffset: number) => setPage({ scopeKey, offset: nextOffset })

  return [offset, setOffset] as const
}

export function AuthAssignmentAuditPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const location = useLocation()
  const { locale, t } = useLocalization()
  const backLink = resolveAuditBackLink(location.pathname, t)
  const [offset, setOffset] = useScopedOffset(assignmentId ?? '')

  const auditQuery = useQuery({
    queryKey: ['auth-assignment-audit', assignmentId, AUDIT_PAGE_SIZE, offset],
    queryFn: () =>
      getRoleAssignmentAudit(assignmentId ?? '', {
        limit: AUDIT_PAGE_SIZE,
        offset,
      }),
    enabled: Boolean(assignmentId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === assignmentId ? previousData : undefined,
  })

  if (!assignmentId) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authAuditDetails.assignmentMissingTitle')}
          description={t('authAuditDetails.assignmentMissingCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (auditQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authAuditDetails.assignmentLoadingTitle')}
          description={t('authAuditDetails.assignmentLoadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  if (auditQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('authAuditDetails.assignmentErrorTitle')}
          description={getErrorMessage(auditQuery.error)}
          tone="danger"
          action={<AuthButton onClick={() => void auditQuery.refetch()}>Yeniden dene</AuthButton>}
        />
      </AdminSurfacePage>
    )
  }

  const items = auditQuery.data?.items ?? []
  const meta = auditQuery.data?.meta

  return (
    <AdminSurfacePage ariaLabel={t('authAuditDetails.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('authAuditDetails.heroEyebrow')}
        title={t('authAuditDetails.assignmentHeroTitle')}
        description={t('authAuditDetails.assignmentHeroCopy')}
      />

      <AuthButton asChild size="sm" variant="outline">
        <Link to={backLink.to}>
          <ArrowLeft size={16} />
          <span>{backLink.label}</span>
        </Link>
      </AuthButton>

      {items.length === 0 ? (
        <AdminSurfaceSection title={t('authAuditDetails.assignmentTimelineTitle')}>
          <div aria-busy={auditQuery.isFetching} className="tw:grid tw:gap-3">
            <AdminSurfaceEmpty copy={t('authAuditDetails.assignmentEmptyCopy')} />
            <AuditPagination isFetching={auditQuery.isFetching} meta={meta} offset={offset} onOffsetChange={setOffset} t={t} />
          </div>
        </AdminSurfaceSection>
      ) : (
        <AdminSurfaceSection
          eyebrow={t('authAuditDetails.timelineEyebrow')}
          title={t('authAuditDetails.assignmentTimelineTitle')}
        >
          <div aria-busy={auditQuery.isFetching} className="tw:grid tw:gap-3">
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
            <AuditPagination isFetching={auditQuery.isFetching} meta={meta} offset={offset} onOffsetChange={setOffset} t={t} />
          </div>
        </AdminSurfaceSection>
      )}
    </AdminSurfacePage>
  )
}

type AuditPaginationMeta = {
  count: number
  total: number
  limit: number
  offset: number
}

function AuditPagination(input: {
  isFetching: boolean
  meta: AuditPaginationMeta | undefined
  offset: number
  onOffsetChange: (offset: number) => void
  t: TranslateFunction
}) {
  if (!input.meta) {
    return null
  }

  const pageOffset = input.meta.offset ?? input.offset
  const pageLimit = Math.max(input.meta.limit, 1)
  const firstItem = input.meta.total === 0 ? 0 : pageOffset + 1
  const lastItem = Math.min(input.meta.total, pageOffset + input.meta.count)
  const canGoPrevious = pageOffset > 0
  const canGoNext = pageOffset + input.meta.count < input.meta.total

  return (
    <div className="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
      <AuthButton
        type="button"
        size="sm"
        variant="outline"
        aria-label={input.t('adminSnapshots.previous')}
        disabled={input.isFetching || !canGoPrevious}
        onClick={() => input.onOffsetChange(Math.max(0, pageOffset - pageLimit))}
      >
        {input.t('adminSnapshots.previous')}
      </AuthButton>
      <span className="tw:text-sm tw:text-muted-foreground">
        {firstItem}-{lastItem} / {input.meta.total}
      </span>
      <AuthButton
        type="button"
        size="sm"
        variant="outline"
        aria-label={input.t('adminSnapshots.next')}
        disabled={input.isFetching || !canGoNext}
        onClick={() => input.onOffsetChange(pageOffset + pageLimit)}
      >
        {input.t('adminSnapshots.next')}
      </AuthButton>
    </div>
  )
}
