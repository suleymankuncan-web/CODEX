import type { ReactNode } from 'react'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
} from './admin-surface-primitives'
import {
  AdminOperationalRow,
  AdminOperationalSection,
} from './admin-operational-primitives'
import { cn } from '../lib/utils'
import { toAdminSurfaceTone, type OperationsTone } from './operations-surface-tones'

type OperationsQueueItem = {
  body?: ReactNode | undefined
  footer?: ReactNode | undefined
  href?: string | undefined
  id: string
  meta?: ReactNode | undefined
  reason?: ReactNode | undefined
  status?: ReactNode | undefined
  title: ReactNode
  tone?: OperationsTone | undefined
}

function OperationsStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: OperationsTone | undefined
}) {
  return <AdminSurfaceBadge tone={toAdminSurfaceTone(tone)}>{children}</AdminSurfaceBadge>
}

function OperationsPanel({
  actions,
  badge,
  children,
  description,
  eyebrow,
  testId,
  title,
}: {
  actions?: ReactNode | undefined
  badge?: ReactNode | undefined
  children: ReactNode
  description?: ReactNode | undefined
  eyebrow?: ReactNode | undefined
  testId?: string | undefined
  title: ReactNode
}) {
  return (
    <AdminOperationalSection
      actions={actions}
      badge={badge}
      description={description}
      testId={testId}
      title={
        <span>
          {eyebrow ? <span className="tw:mr-2 tw:text-xs tw:font-medium tw:text-muted-foreground">{eyebrow}</span> : null}
          {title}
        </span>
      }
    >
      {children}
    </AdminOperationalSection>
  )
}

function OperationsQueueList({
  emptyCopy,
  header,
  items,
  status,
}: {
  emptyCopy?: ReactNode | undefined
  header?: ReactNode | undefined
  items: OperationsQueueItem[]
  status?: ReactNode | undefined
}) {
  return (
    <div className="tw:grid tw:gap-2">
      {header || status ? (
        <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
          {header ? <div className="tw:text-sm tw:font-medium tw:text-foreground">{header}</div> : <span />}
          {status}
        </div>
      ) : null}
      {items.length === 0 ? (
        emptyCopy ? <AdminSurfaceEmpty copy={emptyCopy} /> : null
      ) : (
        items.map((item) => <OperationsQueueRow item={item} key={item.id} />)
      )}
    </div>
  )
}

function OperationsQueueRow({ item }: { item: OperationsQueueItem }) {
  return (
    <AdminOperationalRow
      href={item.href}
      meta={item.meta}
      status={item.status ? <OperationsStatusBadge tone={item.tone}>{item.status}</OperationsStatusBadge> : null}
      testId="operations-queue-row"
      title={item.title}
      tone={item.tone}
    >
      {item.reason ? <p className="tw:m-0 tw:text-xs tw:leading-5 tw:text-muted-foreground">{item.reason}</p> : null}
      {item.body ? <div className="tw:mt-2">{item.body}</div> : null}
      {item.footer ? <p className="tw:mt-2 tw:text-xs tw:text-muted-foreground">{item.footer}</p> : null}
    </AdminOperationalRow>
  )
}

function OperationsInlineState({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: OperationsTone | undefined
}) {
  return (
    <div
      className={cn(
        'tw:rounded-lg tw:border tw:p-3 tw:text-sm',
        tone === 'warning' && 'tw:border-amber-200 tw:bg-amber-50/70 tw:text-amber-900',
        tone === 'danger' && 'tw:border-rose-200 tw:bg-rose-50/70 tw:text-rose-900',
        tone !== 'warning' && tone !== 'danger' && 'tw:border-border tw:bg-background/60 tw:text-muted-foreground',
      )}
    >
      {children}
    </div>
  )
}

export {
  AdminKeyValue as OperationsKeyValue,
  AdminKeyValueGrid as OperationsKeyValueGrid,
  OperationsInlineState,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
}

export type { OperationsTone }
