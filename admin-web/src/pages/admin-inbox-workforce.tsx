import { useLocalization } from '../features/localization/useLocalization'
import type { OffboardingRequest, SellerCodeRequest, SellerCodeReference } from '../features/workforce/api'
import { Button } from '../components/ui/button'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { AdminKeyValue as KeyValue, AdminKeyValueGrid, AdminStatePanel, AdminSurfaceEmpty as EmptyState } from './admin-surface-primitives'
import { StatusBadge as StatusPill } from '../components/ui/status-badge'
import { InboxRecords } from './admin-inbox-records'
import { getErrorMessage } from '../lib/format'

export function SellerCodeQueuePanel(input: {
  approvePending: boolean
  rejectPending: boolean
  drafts: Record<string, string>
  returnNotes: Record<string, string>
  requests: SellerCodeRequest[]
  reference: SellerCodeReference | undefined
  referenceError: Error | null
  referenceLoading: boolean
  requestsError: Error | null
  requestsLoading: boolean
  onApprove: (requestId: string, sellerCode: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onDraftChange: (requestId: string, value: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  onRetry: () => void
}) {
  const { t } = useLocalization()
  return <section aria-label={t('adminInbox.sellerQueueAria')} className="admin-inbox-queue">
    <div className="admin-inbox-queue-heading"><h2>{t('adminInbox.sellerQueueTitle')}</h2><p>{t('adminInbox.sellerQueueCopy')}</p></div>
    {input.referenceLoading || input.requestsLoading ? <AdminStatePanel title={t('adminInbox.loadingSellerRequests')} isLoading />
      : input.referenceError || input.requestsError ? <InboxQueueError error={input.referenceError ?? input.requestsError} onRetry={input.onRetry} />
      : <>
        <div className="admin-inbox-reference"><span>{t('adminInbox.lastFranchiseCode')} <strong>{input.reference?.lastSellerCode ?? t('adminInbox.noFmCode')}</strong></span><span>{t('adminInbox.nextPreview')} <strong>{input.reference?.nextSellerCodePreview ?? t('adminInbox.notAvailable')}</strong></span></div>
        {input.requests.length ? <InboxRecords title={t('adminInbox.sellerQueueTitle')} records={input.requests.map(item => ({
          id: item.requestId,
          title: `${item.firstName} ${item.lastName}`.trim(),
          store: item.storeName,
          summary: item.positionName,
          status: <StatusPill tone="warning">{t('adminInbox.status.pendingHrApproval')}</StatusPill>,
          detail: <SellerCodeRequestRow item={item} approvePending={input.approvePending} rejectPending={input.rejectPending} draftCode={input.drafts[item.requestId] ?? item.requestedSellerCode ?? input.reference?.nextSellerCodePreview ?? ''} returnNote={input.returnNotes[item.requestId] ?? ''} onApprove={input.onApprove} onReject={input.onReject} onDraftChange={input.onDraftChange} onReturnNoteChange={input.onReturnNoteChange} />,
        }))} /> : <EmptyState title={t('adminInbox.noSellerRequestsTitle')} copy={t('adminInbox.noSellerRequestsCopy')} />}
      </>}
  </section>
}

export function OffboardingQueuePanel(input: {
  approvePending: boolean
  rejectPending: boolean
  error: Error | null
  loading: boolean
  requests: OffboardingRequest[]
  returnNotes: Record<string, string>
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  onRetry: () => void
}) {
  const { t } = useLocalization()
  return <section aria-label={t('adminInbox.offboardingQueueAria')} className="admin-inbox-queue">
    <div className="admin-inbox-queue-heading"><h2>{t('adminInbox.offboardingQueueTitle')}</h2><p>{t('adminInbox.offboardingQueueCopy')}</p></div>
    {input.loading ? <AdminStatePanel title={t('adminInbox.loadingOffboardingRequests')} isLoading />
      : input.error ? <InboxQueueError error={input.error} onRetry={input.onRetry} />
      : input.requests.length ? <InboxRecords title={t('adminInbox.offboardingQueueTitle')} records={input.requests.map(item => ({
        id: item.requestId,
        title: item.displayName,
        store: item.storeName,
        summary: `${item.externalEmployeeRef ?? t('adminInbox.noSellerCode')} · ${item.terminationDate}`,
        status: <StatusPill tone="warning">{t('adminInbox.status.pendingHrApproval')}</StatusPill>,
        detail: <OffboardingRequestRow item={item} approvePending={input.approvePending} rejectPending={input.rejectPending} returnNote={input.returnNotes[item.requestId] ?? ''} onApprove={input.onApprove} onReject={input.onReject} onReturnNoteChange={input.onReturnNoteChange} />,
      }))} /> : <EmptyState title={t('adminInbox.noOffboardingRequestsTitle')} copy={t('adminInbox.noOffboardingRequestsCopy')} />}
  </section>
}

export function InboxQueueError(input: { error: unknown; onRetry: () => void }) {
  const { t } = useLocalization()
  return <div className="admin-inbox-queue-error"><AdminStatePanel title={t('adminInbox.unavailableTitle')} description={getErrorMessage(input.error)} tone="danger" /><Button variant="outline" onClick={input.onRetry}>{t('adminInbox.retry')}</Button></div>
}
function SellerCodeRequestRow(input: {
  approvePending: boolean
  draftCode: string
  item: SellerCodeRequest
  onApprove: (requestId: string, sellerCode: string) => void
  onDraftChange: (requestId: string, value: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  rejectPending: boolean
  returnNote: string
}) {
  const { t } = useLocalization()
  const displayName = `${input.item.firstName} ${input.item.lastName}`.trim()

  return (
    <FieldGroup className="admin-inbox-review">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
            {t('adminInbox.referenceLine', {
              storeName: input.item.storeName,
              storeType: input.item.storeType,
              reference: input.item.lastReferenceSellerCode ?? t('adminInbox.none'),
            })}
          </p>
        </div>
        <StatusPill tone="warning">{t('adminInbox.status.pendingHrApproval')}</StatusPill>
      </div>

      <AdminKeyValueGrid className="tw:grid-cols-2 tw:sm:grid-cols-2 tw:lg:grid-cols-2">
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName} />
        <KeyValue label={t('adminInbox.nationalIdLast4')} value={input.item.nationalIdLast4} />
        <KeyValue label={t('adminInbox.phone')} value={input.item.phoneNumber} />
        <KeyValue label={t('adminInbox.hireDate')} value={input.item.hireDate} />
      </AdminKeyValueGrid>

      <div className="tw:grid tw:gap-3  tw:md:items-end">
        <Field>
          <FieldLabel htmlFor={`seller-code-${input.item.requestId}`}>{t('adminInbox.sellerCodeField')}</FieldLabel>
          <Input
            id={`seller-code-${input.item.requestId}`}
            aria-label={t('adminInbox.sellerCodeInputAria', { displayName })}
            value={input.draftCode}
            onChange={(event) => input.onDraftChange(input.item.requestId, event.target.value)}
          />
        </Field>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.manualControl')}</span>
          <Button
            type="button"
            disabled={input.approvePending || input.rejectPending || !input.draftCode.trim()}
            onClick={() => input.onApprove(input.item.requestId, input.draftCode.trim())}
          >
            {t('adminInbox.approveSellerCode')}
          </Button>
        </div>
      </div>

      <div className="tw:grid tw:gap-3  tw:md:items-end">
        <Field>
          <FieldLabel htmlFor={`return-note-${input.item.requestId}`}>{t('adminInbox.returnNote')}</FieldLabel>
          <Textarea
            id={`return-note-${input.item.requestId}`}
            aria-label={t('adminInbox.returnNoteForAria', { displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </Field>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.storeCorrection')}</span>
          <Button
            type="button"
            variant="outline"
            disabled={input.approvePending || input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnSellerCode')}
          </Button>
        </div>
      </div>
    </FieldGroup>
  )
}

function OffboardingRequestRow(input: {
  approvePending: boolean
  item: OffboardingRequest
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reviewNote: string) => void
  onReturnNoteChange: (requestId: string, value: string) => void
  rejectPending: boolean
  returnNote: string
}) {
  const { t } = useLocalization()

  return (
    <FieldGroup className="admin-inbox-review">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
            {input.item.storeName} / {input.item.externalEmployeeRef ?? t('adminInbox.noSellerCode')}
          </p>
        </div>
        <StatusPill tone="warning">{t('adminInbox.status.pendingHrApproval')}</StatusPill>
      </div>

      <AdminKeyValueGrid className="tw:grid-cols-2 tw:sm:grid-cols-2 tw:lg:grid-cols-2">
        <KeyValue label={t('adminInbox.position')} value={input.item.positionName ?? t('adminInbox.noPosition')} />
        <KeyValue label={t('adminInbox.exitDate')} value={input.item.terminationDate} />
        <KeyValue label={t('adminInbox.reason')} value={input.item.terminationReason} />
        <KeyValue label={t('adminInbox.requestNote')} value={input.item.requestReason ?? t('adminInbox.noNote')} />
      </AdminKeyValueGrid>

      <div className="tw:grid tw:gap-3  tw:lg:items-end">
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.manualControl')}</span>
          <Button
            type="button"
            disabled={input.approvePending || input.rejectPending}
            onClick={() => input.onApprove(input.item.requestId)}
          >
            {t('adminInbox.approveOffboarding')}
          </Button>
        </div>
        <Field>
          <FieldLabel htmlFor={`return-note-${input.item.requestId}`}>{t('adminInbox.returnNote')}</FieldLabel>
          <Textarea
            id={`return-note-${input.item.requestId}`}
            aria-label={t('adminInbox.returnNoteForAria', { displayName: input.item.displayName })}
            rows={2}
            value={input.returnNote}
            onChange={(event) => input.onReturnNoteChange(input.item.requestId, event.target.value)}
          />
        </Field>
        <div className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
          <span>{t('adminInbox.storeCorrection')}</span>
          <Button
            type="button"
            variant="outline"
            disabled={input.approvePending || input.rejectPending || !input.returnNote.trim()}
            onClick={() => input.onReject(input.item.requestId, input.returnNote.trim())}
          >
            {t('adminInbox.returnOffboarding')}
          </Button>
        </div>
      </div>
    </FieldGroup>
  )
}
