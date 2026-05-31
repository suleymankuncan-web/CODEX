import { Activity } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
} from './admin-surface-primitives'
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
    <AdminSurfaceSection
      actions={actions}
      badge={badge}
      description={description}
      eyebrow={eyebrow}
      testId={testId}
      title={title}
    >
      {children}
    </AdminSurfaceSection>
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
  const content = (
    <>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <div className="tw:min-w-0">
          <div className="tw:text-sm tw:font-medium tw:text-foreground">{item.title}</div>
          {item.meta ? <div className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{item.meta}</div> : null}
        </div>
        {item.status ? <OperationsStatusBadge tone={item.tone}>{item.status}</OperationsStatusBadge> : null}
      </div>
      {item.reason ? <p className="tw:m-0 tw:text-xs tw:leading-5 tw:text-muted-foreground">{item.reason}</p> : null}
      {item.body ? <div className="tw:mt-1">{item.body}</div> : null}
      {item.footer ? (
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-xs tw:text-muted-foreground">
          <span>{item.footer}</span>
          <Activity aria-hidden="true" size={14} />
        </div>
      ) : null}
    </>
  )
  const className = cn(
    'tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:text-left tw:shadow-xs',
    item.href && 'tw:transition-colors tw:hover:bg-muted/50',
  )

  if (item.href) {
    return (
      <Link className={className} data-testid="operations-queue-row" to={item.href}>
        {content}
      </Link>
    )
  }

  return (
    <div className={className} data-testid="operations-queue-row">
      {content}
    </div>
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
