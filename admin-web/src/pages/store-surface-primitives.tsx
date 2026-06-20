import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StoreSurfaceTone =
  | 'neutral'
  | 'accent'
  | 'calm'
  | 'warning'
  | 'danger'
  | 'plum'
  | 'mint'
  | 'amber'
  | 'cyan'

type StoreSurfaceAction = {
  label: string
  to?: LinkProps['to']
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
}

const toneClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-primary/20 tw:bg-primary/5',
  amber: 'tw:border-chart-4/30 tw:bg-chart-4/10',
  calm: 'tw:border-emerald-500/20 tw:bg-emerald-500/10',
  cyan: 'tw:border-accent/25 tw:bg-accent/10',
  danger: 'tw:border-destructive/20 tw:bg-destructive/10',
  mint: 'tw:border-emerald-500/20 tw:bg-emerald-500/10',
  neutral: 'tw:border-border tw:bg-card/95',
  plum: 'tw:border-primary/20 tw:bg-primary/5',
  warning: 'tw:border-chart-4/30 tw:bg-chart-4/10',
}

const toneIconClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:bg-primary/10 tw:text-primary',
  amber: 'tw:bg-chart-4/15 tw:text-chart-4',
  calm: 'tw:bg-emerald-500/10 tw:text-emerald-600',
  cyan: 'tw:bg-accent/10 tw:text-accent',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  mint: 'tw:bg-emerald-500/10 tw:text-emerald-600',
  neutral: 'tw:bg-muted tw:text-muted-foreground',
  plum: 'tw:bg-primary/10 tw:text-primary',
  warning: 'tw:bg-chart-4/15 tw:text-chart-4',
}

const toneBadgeClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-primary/20 tw:bg-primary/10 tw:text-primary',
  amber: 'tw:border-chart-4/30 tw:bg-chart-4/15 tw:text-chart-4',
  calm: 'tw:border-emerald-500/20 tw:bg-emerald-500/10 tw:text-emerald-700',
  cyan: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent',
  danger: 'tw:border-destructive/20 tw:bg-destructive/10 tw:text-destructive',
  mint: 'tw:border-emerald-500/20 tw:bg-emerald-500/10 tw:text-emerald-700',
  neutral: 'tw:border-border tw:bg-muted/40 tw:text-muted-foreground',
  plum: 'tw:border-primary/20 tw:bg-primary/10 tw:text-primary',
  warning: 'tw:border-chart-4/30 tw:bg-chart-4/15 tw:text-chart-4',
}

export function StoreSurfacePage(input: {
  children: ReactNode
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  testId?: string
}) {
  return (
    <section
      aria-label={input.ariaLabel}
      aria-labelledby={input.ariaLabelledBy}
      data-testid={input.testId}
      className={cn('tw:mx-auto tw:flex tw:w-full tw:max-w-[1420px] tw:flex-col tw:gap-4 tw:py-1', input.className)}
    >
      {input.children}
    </section>
  )
}

export function StoreCommandBar(input: {
  title: string
  description?: string
  actions?: StoreSurfaceAction[]
  end?: ReactNode
  className?: string
}) {
  const actions = input.actions ?? []

  return (
    <div className={cn('tw:flex tw:min-h-10 tw:flex-col tw:gap-3 tw:text-xs tw:text-muted-foreground tw:md:flex-row tw:md:items-center tw:md:justify-between', input.className)}>
      <p>
        <strong className="tw:text-foreground">{input.title}</strong>
        {input.description ? <> {input.description}</> : null}
      </p>
      {input.end ?? (actions.length ? (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {actions.map((action) => (
            <StoreSurfaceActionButton action={action} key={action.label} />
          ))}
        </div>
      ) : null)}
    </div>
  )
}

export function StoreSurfaceHeader(input: {
  title: string
  description?: string
  eyebrow?: string
  badges?: Array<{ label: string; tone?: StoreSurfaceTone }>
  action?: StoreSurfaceAction
  actions?: StoreSurfaceAction[]
  icon?: ReactNode
  titleId?: string
}) {
  const actions = input.actions ?? (input.action ? [input.action] : [])

  return (
    <header
      data-store-surface-header
      className="tw:grid tw:gap-4 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:p-4 tw:shadow-sm tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center"
    >
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
        {input.icon ? (
          <span className="tw:flex tw:size-12 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-gradient-to-br tw:from-primary tw:to-accent tw:text-primary-foreground tw:shadow-sm">
            {input.icon}
          </span>
        ) : null}
        <div className="tw:min-w-0">
          {input.eyebrow ? (
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.eyebrow}</span>
          ) : null}
          <h1
            id={input.titleId}
            className="tw:text-3xl tw:font-semibold tw:leading-none tw:text-foreground tw:md:text-4xl"
          >
            {input.title}
          </h1>
          {input.description ? (
            <p className="tw:mt-1 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.description}</p>
          ) : null}
          {input.badges?.length ? (
            <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
              {input.badges.map((badge) => (
                <StoreStatusBadge key={badge.label} tone={badge.tone ?? 'neutral'}>
                  {badge.label}
                </StoreStatusBadge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions.length > 0 ? (
        <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:flex-wrap tw:sm:justify-end">
          {actions.map((action) => (
            <StoreSurfaceActionButton action={action} key={action.label} />
          ))}
        </div>
      ) : null}
    </header>
  )
}

export function StoreSurfaceActionButton(input: { action: StoreSurfaceAction }) {
  const content = (
    <>
      {input.action.icon}
      {input.action.label}
    </>
  )

  if (input.action.to) {
    return (
      <Button
        asChild
        variant={input.action.variant ?? 'default'}
        className="tw:min-h-9 tw:w-full tw:rounded-xl tw:text-xs tw:font-semibold tw:md:w-auto"
      >
        <Link to={input.action.to}>{content}</Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={input.action.variant ?? 'default'}
      disabled={input.action.disabled}
      className="tw:min-h-9 tw:w-full tw:rounded-xl tw:text-xs tw:font-semibold tw:md:w-auto"
      onClick={input.action.onClick}
    >
      {content}
    </Button>
  )
}

export function StoreSurfacePanel(input: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'gradient'
  ariaLabel?: string
}) {
  return (
    <section
      aria-label={input.ariaLabel}
      className={cn(
        'tw:rounded-2xl tw:border tw:border-border tw:p-5 tw:shadow-sm',
        input.tone === 'gradient' ? 'tw:bg-gradient-to-br tw:from-primary/10 tw:to-accent/10' : 'tw:bg-card/90',
        input.className,
      )}
    >
      {input.children}
    </section>
  )
}

export function StoreFinanceBand(input: {
  label: string
  value: string
  description?: string
  badge?: { label: string; tone?: StoreSurfaceTone }
  side?: ReactNode
}) {
  return (
    <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_16.25rem]">
      <StoreSurfacePanel tone="gradient" className="tw:grid tw:min-h-56 tw:content-between tw:gap-4 tw:overflow-hidden">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
          <div>
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
            <strong className="tw:mt-3 tw:block tw:text-5xl tw:font-semibold tw:leading-none tw:text-foreground">
              {input.value}
            </strong>
          </div>
          {input.badge ? <StoreStatusBadge tone={input.badge.tone ?? 'neutral'}>{input.badge.label}</StoreStatusBadge> : null}
        </div>
        {input.description ? <p className="tw:max-w-2xl tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.description}</p> : null}
      </StoreSurfacePanel>
      {input.side}
    </div>
  )
}

export function StoreStepList(input: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="tw:grid tw:gap-2">
      {input.items.map((item) => (
        <div
          className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-muted/30 tw:px-3 tw:py-2"
          key={`${item.label}:${item.value}`}
        >
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{item.label}</span>
          <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function StoreToolbar(input: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('tw:grid tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:p-3 tw:shadow-sm', input.className)}>
      {input.children}
    </div>
  )
}

export function StoreToolbarField(input: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('tw:grid tw:min-h-16 tw:gap-1 tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:px-3 tw:py-2', input.className)}>
      <span className="tw:text-[0.7rem] tw:font-medium tw:text-muted-foreground">{input.label}</span>
      {input.children}
    </div>
  )
}

export function StoreMetricGrid(input: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return (
    <section
      aria-label={input.ariaLabel}
      className={cn('tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4', input.className)}
    >
      {input.children}
    </section>
  )
}

export function StoreMetricCard(input: {
  title: string
  value: string | number
  note?: string
  icon?: ReactNode
  tone?: StoreSurfaceTone
  progress?: number
  action?: StoreSurfaceAction
}) {
  const progressValue =
    input.progress === undefined ? undefined : Math.max(0, Math.min(100, input.progress))

  return (
    <article
      data-store-tone={input.tone ?? 'neutral'}
      className="tw:grid tw:min-h-28 tw:grid-cols-[2.75rem_minmax(0,1fr)] tw:items-center tw:gap-3 tw:rounded-2xl tw:border tw:border-border tw:bg-card/95 tw:p-4 tw:shadow-sm"
    >
      {input.icon ? (
        <span
          data-store-surface-icon
          className={cn(
            'tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl',
            toneIconClasses[input.tone ?? 'neutral'],
          )}
        >
          {input.icon}
        </span>
      ) : null}
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.title}</span>
        <strong className="tw:mt-1 tw:block tw:truncate tw:text-2xl tw:font-semibold tw:leading-none tw:text-foreground">
          {input.value}
        </strong>
        {input.note ? <span className="tw:mt-2 tw:block tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.note}</span> : null}
        {progressValue !== undefined ? <Progress className="tw:mt-2" value={progressValue} /> : null}
        {input.action ? <div className="tw:mt-3"><StoreSurfaceActionButton action={input.action} /></div> : null}
      </span>
    </article>
  )
}

export function StoreSectionCard(input: {
  title: string
  description?: string
  children: ReactNode
  badge?: { label: string; tone?: StoreSurfaceTone }
  action?: StoreSurfaceAction
  className?: string
  testId?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}) {
  return (
    <section
      aria-label={input.ariaLabel}
      aria-labelledby={input.ariaLabelledBy}
      data-store-section-card
      data-testid={input.testId}
      className={cn('tw:overflow-visible tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-sm', input.className)}
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border tw:p-4 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <h2 className="tw:text-xl tw:font-semibold tw:leading-snug tw:text-foreground">{input.title}</h2>
          {input.description ? (
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.description}</p>
          ) : null}
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          {input.badge ? (
            <StoreStatusBadge tone={input.badge.tone ?? 'neutral'}>
              {input.badge.label}
            </StoreStatusBadge>
          ) : null}
          {input.action ? <StoreSurfaceActionButton action={input.action} /> : null}
        </div>
      </div>
      <div className="tw:p-3">{input.children}</div>
    </section>
  )
}

export function StoreInfoGrid(input: {
  items: Array<{ label: string; value: string; tone?: StoreSurfaceTone }>
  className?: string
}) {
  return (
    <div className={cn('tw:grid tw:gap-2 tw:sm:grid-cols-2 tw:xl:grid-cols-4', input.className)}>
      {input.items.map((item) => (
        <div
          key={`${item.label}:${item.value}`}
          className={cn(
            'tw:flex tw:min-h-20 tw:flex-col tw:justify-between tw:gap-2 tw:rounded-xl tw:border tw:p-3',
            toneClasses[item.tone ?? 'neutral'],
          )}
        >
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{item.label}</span>
          <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function StoreStatusBadge(input: {
  children: ReactNode
  tone?: StoreSurfaceTone
  className?: string
}) {
  return (
    <Badge
      data-store-tone={input.tone ?? 'neutral'}
      variant="outline"
      className={cn('tw:shadow-none', toneBadgeClasses[input.tone ?? 'neutral'], input.className)}
    >
      {input.children}
    </Badge>
  )
}

export function StoreStackedList(input: { children: ReactNode; className?: string }) {
  return <div className={cn('tw:flex tw:flex-col tw:gap-2', input.className)}>{input.children}</div>
}

export function StoreStackedRow(input: {
  children: ReactNode
  className?: string
  tone?: StoreSurfaceTone
  ariaLabel?: string
  testId?: string
}) {
  return (
    <article
      aria-label={input.ariaLabel}
      data-store-tone={input.tone ?? 'neutral'}
      data-testid={input.testId}
      className={cn(
        'tw:rounded-xl tw:border tw:p-3 tw:shadow-sm tw:transition-colors',
        toneClasses[input.tone ?? 'neutral'],
        input.className,
      )}
    >
      {input.children}
    </article>
  )
}

export function StoreEmptyState(input: {
  title?: string
  titleAsHeading?: boolean
  description: string
  action?: StoreSurfaceAction
}) {
  const title = input.titleAsHeading ? (
    <h2 className="tw:text-sm tw:font-semibold tw:text-foreground">{input.title}</h2>
  ) : (
    <strong className="tw:text-sm tw:text-foreground">{input.title}</strong>
  )

  return (
    <div className="tw:flex tw:min-h-28 tw:flex-col tw:items-start tw:justify-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-border tw:bg-muted/30 tw:p-4">
      {input.title ? title : null}
      <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.description}</p>
      {input.action ? <StoreSurfaceActionButton action={input.action} /> : null}
    </div>
  )
}

export function StoreLoadingState(input: { title: string; description: string }) {
  return (
    <StoreSurfacePage>
      <StoreSurfaceHeader title={input.title} description={input.description} />
      <Card>
        <CardContent className="tw:flex tw:flex-col tw:gap-3">
          <Skeleton className="tw:h-8 tw:w-1/3" />
          <Skeleton className="tw:h-24 tw:w-full" />
          <Skeleton className="tw:h-24 tw:w-full" />
        </CardContent>
      </Card>
    </StoreSurfacePage>
  )
}

export function StoreErrorState(input: {
  title: string
  description: string
  action?: StoreSurfaceAction
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle role="heading" aria-level={2}>
        {input.title}
      </AlertTitle>
      <AlertDescription className="tw:flex tw:flex-col tw:gap-3">
        <span>{input.description}</span>
        {input.action ? <StoreSurfaceActionButton action={input.action} /> : null}
      </AlertDescription>
    </Alert>
  )
}

export function StoreSectionSeparator() {
  return <Separator className="tw:my-2" />
}
