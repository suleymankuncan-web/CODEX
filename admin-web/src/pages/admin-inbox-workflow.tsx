import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import { StatusBadge, type StatusBadgeTone } from '../components/ui/status-badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useLocalization } from '../features/localization/useLocalization'
import type { TranslationKey } from '../features/localization/dictionary'
import { WorkflowInboxDetail } from '../features/workflow/WorkflowInboxDetail'
import type { WorkflowInboxItem } from '../features/workflow/contracts'
import { formatDateTime, formatState } from '../lib/format'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { AdminKeyValue, AdminKeyValueGrid, AdminSurfaceEmpty } from './admin-surface-primitives'
import { InboxRecords } from './admin-inbox-records'

const statusKeys: Record<WorkflowInboxItem['inboxStatus'], TranslationKey> = {
  needs_attention: 'storeTasks.inboxStatus.needs_attention',
  completed: 'storeTasks.inboxStatus.completed',
  informational: 'storeTasks.inboxStatus.informational',
}
const statusTones: Record<WorkflowInboxItem['inboxStatus'], StatusBadgeTone> = {
  needs_attention: 'warning', completed: 'success', informational: 'info',
}
const typeKeys: Record<WorkflowInboxItem['itemType'], TranslationKey> = {
  approval: 'storeTasks.itemType.approval', acknowledgement: 'storeTasks.itemType.acknowledgement',
  task: 'storeTasks.itemType.task', notification: 'storeTasks.itemType.notification',
}
const sourceKeys: Record<WorkflowInboxItem['sourceType'], TranslationKey> = {
  target_distribution_request: 'storeTasks.sourceType.target_distribution_request',
  checklist_receipt: 'storeTasks.sourceType.checklist_receipt',
  kpi_exception: 'storeTasks.sourceType.kpi_exception',
  store_action_plan: 'storeTasks.sourceType.store_action_plan',
}
const urgencyKeys: Record<WorkflowInboxItem['urgency'], TranslationKey> = {
  high: 'storeTasks.urgency.high', medium: 'storeTasks.urgency.medium', low: 'storeTasks.urgency.low',
}
const actorRoleKeys: Partial<Record<string, TranslationKey>> = {
  REGION_APPROVER: 'storeTasks.role.REGION_APPROVER',
  REPORT_VIEWER: 'storeTasks.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeTasks.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeTasks.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeTasks.role.SUPER_ADMIN',
}

export function AdminInboxWorkflow(input: { items: WorkflowInboxItem[] }) {
  const { t, locale } = useLocalization()
  const [status, setStatus] = useState('all')
  const items = input.items.filter(item => status === 'all' || item.inboxStatus === status)
  return <section className="admin-inbox-queue" aria-label={t('adminInbox.adminQueueTitle')}>
    <div className="admin-inbox-queue-heading"><h2>{t('adminInbox.adminQueueTitle')}</h2></div>
    {input.items.length ? <InboxRecords title={t('adminInbox.adminQueueTitle')} toolbar={
      <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label={t('adminInbox.status')}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
        <SelectItem value="all">{t('adminInbox.allStatuses')}</SelectItem>
        {Object.entries(statusKeys).map(([value, key]) => <SelectItem key={value} value={value}>{t(key)}</SelectItem>)}
      </SelectGroup></SelectContent></Select>
    } records={items.map(item => ({
      id: `${item.sourceType}:${item.sourceId}`,
      title: item.title,
      store: normalizeDisplayLabel(item.storeName, t('storeTasks.unknownStore')),
      summary: `${t(typeKeys[item.itemType])} · ${t(urgencyKeys[item.urgency])} · ${item.needsAttentionAt ? formatDateTime(item.needsAttentionAt, locale) : t('storeTasks.now')}`,
      status: <StatusBadge tone={statusTones[item.inboxStatus]}>{t(statusKeys[item.inboxStatus])}</StatusBadge>,
      detail: <WorkflowReview item={item} />,
    }))} /> : <AdminSurfaceEmpty title={t('adminInbox.emptyQueueTitle')} copy={t('adminInbox.emptyQueueCopy')} />}
  </section>
}

function WorkflowReview({ item }: { item: WorkflowInboxItem }) {
  const { t, locale } = useLocalization()
  const actorRoleKey = actorRoleKeys[item.actorRole]
  return <div className="admin-inbox-review">
    <div className="tw:flex tw:flex-wrap tw:gap-2"><StatusBadge tone={statusTones[item.inboxStatus]}>{t(statusKeys[item.inboxStatus])}</StatusBadge><StatusBadge tone={item.urgency === 'high' ? 'danger' : item.urgency === 'medium' ? 'warning' : 'neutral'}>{t(urgencyKeys[item.urgency])}</StatusBadge></div>
    <p>{item.summary}</p>
    <AdminKeyValueGrid className="tw:grid-cols-2 tw:sm:grid-cols-2 tw:lg:grid-cols-2">
      <AdminKeyValue label={t('storeTasks.workType')} value={t(typeKeys[item.itemType])} />
      <AdminKeyValue label={t('adminInbox.source')} value={t(sourceKeys[item.sourceType])} />
      <AdminKeyValue label={t('storeTasks.actorRole')} value={actorRoleKey ? t(actorRoleKey) : formatState(item.actorRole)} />
      <AdminKeyValue label={t('storeTasks.actionTime')} value={item.needsAttentionAt ? formatDateTime(item.needsAttentionAt, locale) : t('storeTasks.now')} />
    </AdminKeyValueGrid>
    {item.historyPreview ? <p className="tw:text-sm tw:text-muted-foreground">{item.historyPreview}</p> : null}
    <WorkflowInboxDetail item={item} />
    <Button asChild><Link to={item.deepLink}>{item.primaryActionLabel}</Link></Button>
  </div>
}
