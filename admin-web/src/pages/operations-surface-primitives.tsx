import type { ReactNode } from 'react'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import { ArrowUpRight, Info } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '../components/ui/alert'
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
    <AdminSurfaceSection
      className="operations-signal-panel"
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
    <div className="operations-queue-list">
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
      <div className="operations-queue-heading">
        <div className="tw:min-w-0">
          <div className="operations-queue-title">{item.title}</div>
          {item.meta ? <div className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{item.meta}</div> : null}
        </div>
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
          {item.status ? <OperationsStatusBadge tone={item.tone}>{item.status}</OperationsStatusBadge> : null}
          {item.href ? <ArrowUpRight size={16} aria-hidden="true" /> : null}
        </div>
      </div>
      {item.reason ? <p className="tw:m-0 tw:text-xs tw:leading-5 tw:text-muted-foreground">{item.reason}</p> : null}
      {item.body ? <div className="tw:mt-2">{item.body}</div> : null}
      {item.footer ? <p className="tw:mt-2 tw:text-xs tw:text-muted-foreground">{item.footer}</p> : null}
    </>
  )
  return item.href ? (
    <Link className="operations-queue-row" data-testid="operations-queue-row" to={item.href}>{content}</Link>
  ) : (
    <article className="operations-queue-row" data-testid="operations-queue-row">{content}</article>
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
    <Alert
      className={cn(
        'tw:rounded-lg tw:border tw:p-3 tw:text-sm',
        tone === 'warning' && 'tw:border-warning/25 tw:bg-warning-soft tw:text-warning-foreground',
        tone === 'danger' && 'tw:border-destructive/25 tw:bg-destructive/10 tw:text-destructive',
        tone !== 'warning' && tone !== 'danger' && 'tw:border-border tw:bg-background/60 tw:text-muted-foreground',
      )}
    >
      <Info aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
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
