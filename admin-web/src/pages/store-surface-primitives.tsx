import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StoreSurfaceTone = 'neutral' | 'accent' | 'calm' | 'warning' | 'danger'

type StoreSurfaceAction = {
  label: string
  to?: LinkProps['to']
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
}

const toneBadgeVariant: Record<StoreSurfaceTone, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  accent: 'default',
  calm: 'secondary',
  danger: 'destructive',
  neutral: 'outline',
  warning: 'secondary',
}

const toneClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-primary/20 tw:bg-primary/5',
  calm: 'tw:border-accent/25 tw:bg-accent/10',
  danger: 'tw:border-destructive/20 tw:bg-destructive/10',
  neutral: 'tw:border-border tw:bg-card/80',
  warning: 'tw:border-chart-4/30 tw:bg-chart-4/10',
}

const toneIconClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:bg-primary/10 tw:text-primary',
  calm: 'tw:bg-accent/10 tw:text-accent',
  danger: 'tw:bg-destructive/10 tw:text-destructive',
  neutral: 'tw:bg-muted tw:text-muted-foreground',
  warning: 'tw:bg-chart-4/15 tw:text-chart-4',
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
      className={cn('tw:flex tw:flex-col tw:gap-4 tw:py-1', input.className)}
    >
      {input.children}
    </section>
  )
}

export function StoreSurfaceHeader(input: {
  title: string
  description?: string
  eyebrow?: string
  badges?: Array<{ label: string; tone?: StoreSurfaceTone }>
  action?: StoreSurfaceAction
  titleId?: string
}) {
  return (
    <header
      data-store-surface-header
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/85 tw:p-4 tw:shadow-sm tw:md:flex-row tw:md:items-start tw:md:justify-between"
    >
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
        {input.eyebrow ? (
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.eyebrow}</span>
        ) : null}
        <div className="tw:flex tw:flex-col tw:gap-1">
          <h1
            id={input.titleId}
            className="tw:text-xl tw:font-semibold tw:leading-tight tw:text-foreground tw:md:text-2xl"
          >
            {input.title}
          </h1>
          {input.description ? (
            <p className="tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.description}
            </p>
          ) : null}
        </div>
        {input.badges?.length ? (
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            {input.badges.map((badge) => (
              <StoreStatusBadge key={badge.label} tone={badge.tone ?? 'neutral'}>
                {badge.label}
              </StoreStatusBadge>
            ))}
          </div>
        ) : null}
      </div>
      {input.action ? <StoreSurfaceActionButton action={input.action} /> : null}
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
        className="tw:w-full tw:md:w-auto"
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
      className="tw:w-full tw:md:w-auto"
      onClick={input.action.onClick}
    >
      {content}
    </Button>
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
    <Card
      data-store-tone={input.tone ?? 'neutral'}
      size="sm"
      className={cn('tw:min-h-32', toneClasses[input.tone ?? 'neutral'])}
    >
      <CardHeader className="tw:flex tw:flex-row tw:items-start tw:gap-3">
        {input.icon ? (
          <span
            data-store-surface-icon
            className={cn(
              'tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
              toneIconClasses[input.tone ?? 'neutral'],
            )}
          >
            {input.icon}
          </span>
        ) : null}
        <div className="tw:min-w-0 tw:flex-1">
          <h2 className="tw:text-sm tw:font-medium tw:text-muted-foreground">{input.title}</h2>
          <CardTitle className="tw:mt-1 tw:text-2xl tw:font-semibold">{input.value}</CardTitle>
        </div>
      </CardHeader>
      {input.note || progressValue !== undefined || input.action ? (
        <CardContent className="tw:flex tw:flex-col tw:gap-2">
          {input.note ? <p className="tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.note}</p> : null}
          {progressValue !== undefined ? <Progress value={progressValue} /> : null}
          {input.action ? <StoreSurfaceActionButton action={input.action} /> : null}
        </CardContent>
      ) : null}
    </Card>
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
    <Card
      aria-label={input.ariaLabel}
      aria-labelledby={input.ariaLabelledBy}
      data-store-section-card
      data-testid={input.testId}
      className={cn('tw:bg-card/85 tw:shadow-sm', input.className)}
    >
      <CardHeader>
        <CardTitle>
          <h2 className="tw:text-base tw:font-semibold tw:leading-snug tw:text-foreground">
            {input.title}
          </h2>
        </CardTitle>
        {input.description ? <CardDescription>{input.description}</CardDescription> : null}
        {input.badge ? (
          <CardAction>
            <StoreStatusBadge tone={input.badge.tone ?? 'neutral'}>
              {input.badge.label}
            </StoreStatusBadge>
          </CardAction>
        ) : null}
        {input.action ? (
          <CardAction>
            <StoreSurfaceActionButton action={input.action} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{input.children}</CardContent>
    </Card>
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
            'tw:flex tw:min-h-20 tw:flex-col tw:justify-between tw:gap-2 tw:rounded-lg tw:border tw:p-3',
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
      variant={toneBadgeVariant[input.tone ?? 'neutral']}
      className={cn(input.tone === 'warning' ? 'tw:text-foreground' : undefined, input.className)}
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
        'tw:rounded-lg tw:border tw:p-3 tw:transition-colors',
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
    <div className="tw:flex tw:min-h-28 tw:flex-col tw:items-start tw:justify-center tw:gap-3 tw:rounded-lg tw:border tw:border-dashed tw:border-border tw:bg-muted/30 tw:p-4">
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
