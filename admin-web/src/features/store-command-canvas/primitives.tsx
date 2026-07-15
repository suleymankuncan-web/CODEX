import type { ComponentProps, ReactNode } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogContent } from '@/components/ui/dialog'
import { SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  MonthYearPeriodPicker,
  type MonthYearPeriodPickerProps,
} from './month-year-picker'
import './foundation.css'

export type CommandCanvasTone = 'plum' | 'mint' | 'amber' | 'rose' | 'cyan' | 'neutral'

export function CommandCanvasPage(input: {
  children: ReactNode
  ariaLabelledBy: string
  className?: string
}) {
  return (
    <section
      aria-labelledby={input.ariaLabelledBy}
      className={cn('command-canvas-page', input.className)}
      data-command-canvas-page
    >
      {input.children}
    </section>
  )
}

export function CommandCanvasPageHeader(input: {
  title: string
  titleId: string
  description: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <header className="command-canvas-page-header">
      <div>
        {input.eyebrow ? <span className="command-canvas-eyebrow">{input.eyebrow}</span> : null}
        <h1 id={input.titleId}>{input.title}</h1>
        <p>{input.description}</p>
      </div>
      {input.actions ? <CommandCanvasActionCluster>{input.actions}</CommandCanvasActionCluster> : null}
    </header>
  )
}

export function CommandCanvasActionCluster(input: { children: ReactNode; className?: string }) {
  return <div className={cn('command-canvas-action-cluster', input.className)}>{input.children}</div>
}

export function CommandCanvasMonthYearPicker(input: MonthYearPeriodPickerProps) {
  return (
    <MonthYearPeriodPicker
      {...input}
      popoverClassName={cn('command-canvas-period-popover', input.popoverClassName)}
      triggerClassName={cn('command-canvas-period-trigger', input.triggerClassName)}
    />
  )
}

export function CommandCanvasMetricRail(input: {
  children: ReactNode
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      aria-label={input.ariaLabel}
      className={cn('command-canvas-metric-rail', input.className)}
      data-command-metric-rail
      role="group"
    >
      {input.children}
    </div>
  )
}

export function CommandCanvasMetricFilter(input: {
  label: string
  value: string
  note?: string
  icon: ReactNode
  active: boolean
  tone?: CommandCanvasTone
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={input.active}
      className="command-canvas-metric"
      data-active={input.active}
      data-tone={input.tone ?? 'neutral'}
      onClick={input.onClick}
      type="button"
    >
      <span aria-hidden="true" className="command-canvas-metric-icon">{input.icon}</span>
      <span className="command-canvas-metric-copy">
        <b>{input.label}</b>
        {input.note ? <small>{input.note}</small> : null}
      </span>
      <strong>{input.value}</strong>
    </button>
  )
}

export function CommandCanvasFilterBar(input: {
  search: ReactNode
  controls?: ReactNode
  context?: ReactNode
  actions?: ReactNode
  isUpdating?: boolean
  updatingLabel: string
  className?: string
}) {
  return (
    <div className={cn('command-canvas-filter-bar', input.className)} data-command-canvas-filter-bar>
      <div className="command-canvas-search-slot">{input.search}</div>
      {input.controls ? <div className="command-canvas-filter-controls">{input.controls}</div> : null}
      {input.context ? <div className="command-canvas-filter-context">{input.context}</div> : null}
      {input.actions ? <CommandCanvasActionCluster>{input.actions}</CommandCanvasActionCluster> : null}
      <span aria-live="polite" className="tw:sr-only">
        {input.isUpdating ? input.updatingLabel : ''}
      </span>
    </div>
  )
}

export type CommandCanvasSortDirection = 'ascending' | 'descending' | 'none'

export function CommandCanvasSortableHeading(input: {
  label: string
  direction: CommandCanvasSortDirection
  onClick: () => void
  className?: string
  semantic?: boolean
}) {
  const Icon = input.direction === 'ascending'
    ? ArrowUp
    : input.direction === 'descending'
      ? ArrowDown
      : ChevronsUpDown

  return (
    <span
      aria-sort={input.semantic === false ? undefined : input.direction}
      className={cn('command-canvas-sort-heading', input.className)}
      role={input.semantic === false ? undefined : 'columnheader'}
    >
      <button aria-label={input.semantic === false ? `${input.label}: ${input.direction}` : undefined} onClick={input.onClick} type="button">
        <span>{input.label}</span>
        <Icon aria-hidden="true" size={11} strokeWidth={1.8} />
      </button>
    </span>
  )
}

export function CommandCanvasDataList(input: {
  children: ReactNode
  ariaLabel: string
  header?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={input.ariaLabel}
      className={cn('command-canvas-data-list', input.className)}
      data-command-canvas-list
    >
      {input.header ? <div className="command-canvas-list-header">{input.header}</div> : null}
      <div className="command-canvas-list-body">{input.children}</div>
      {input.footer ? <div className="command-canvas-list-footer">{input.footer}</div> : null}
    </section>
  )
}

export function CommandCanvasOperationalDrawerContent(
  input: ComponentProps<typeof SheetContent>,
) {
  return (
    <SheetContent
      {...input}
      className={cn('command-canvas-operational-drawer', input.className)}
    />
  )
}

export function CommandCanvasConfirmationContent(
  input: ComponentProps<typeof DialogContent>,
) {
  return (
    <DialogContent
      {...input}
      className={cn('command-canvas-confirmation-dialog', input.className)}
    />
  )
}

export function CommandCanvasPartialDataNotice(input: {
  title: string
  description: string
  retry?: { label: string; onClick: () => void }
  className?: string
}) {
  return (
    <Alert className={cn('command-canvas-partial-notice', input.className)} role="status">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{input.title}</AlertTitle>
      <AlertDescription>
        <span>{input.description}</span>
        {input.retry ? (
          <Button onClick={input.retry.onClick} size="sm" type="button" variant="outline">
            {input.retry.label}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
