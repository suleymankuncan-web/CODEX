import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { cn } from '../lib/utils'

type AdminSurfaceTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'cyan'

type AdminMetricStripItem = {
  id?: string
  label: ReactNode
  value: ReactNode
  description?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  tone?: AdminSurfaceTone
}

const toneStyles: Record<AdminSurfaceTone, string> = {
  neutral: 'tw:border-border tw:bg-card tw:text-card-foreground',
  accent: 'tw:border-violet-200 tw:bg-violet-50/70 tw:text-violet-950',
  success: 'tw:border-emerald-200 tw:bg-emerald-50/70 tw:text-emerald-950',
  warning: 'tw:border-amber-200 tw:bg-amber-50/70 tw:text-amber-950',
  danger: 'tw:border-rose-200 tw:bg-rose-50/70 tw:text-rose-950',
  cyan: 'tw:border-cyan-200 tw:bg-cyan-50/70 tw:text-cyan-950',
}

const badgeToneStyles: Record<AdminSurfaceTone, string> = {
  neutral: 'tw:border-border tw:bg-background tw:text-muted-foreground',
  accent: 'tw:border-violet-200 tw:bg-violet-100 tw:text-violet-800',
  success: 'tw:border-emerald-200 tw:bg-emerald-100 tw:text-emerald-800',
  warning: 'tw:border-amber-200 tw:bg-amber-100 tw:text-amber-800',
  danger: 'tw:border-rose-200 tw:bg-rose-100 tw:text-rose-800',
  cyan: 'tw:border-cyan-200 tw:bg-cyan-100 tw:text-cyan-800',
}

function AdminSurfacePage({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('tw:mx-auto tw:flex tw:w-full tw:max-w-7xl tw:flex-col tw:gap-4 tw:py-2', className)}
    >
      {children}
    </section>
  )
}

function AdminSurfaceHeader({
  actions,
  className,
  description,
  eyebrow,
  icon,
  meta,
  title,
}: {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  eyebrow?: ReactNode
  icon?: ReactNode
  meta?: ReactNode
  title: ReactNode
}) {
  return (
    <header
      className={cn(
        'tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/85 tw:p-4 tw:shadow-sm tw:backdrop-blur tw:md:flex-row tw:md:items-start tw:md:justify-between',
        className,
      )}
    >
      <div className="tw:flex tw:min-w-0 tw:gap-3">
        {icon ? (
          <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
            {icon}
          </span>
        ) : null}
        <div className="tw:min-w-0">
          {eyebrow ? (
            <div className="tw:mb-1 tw:text-[0.72rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="tw:m-0 tw:text-2xl tw:font-semibold tw:tracking-normal tw:text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="tw:mt-1 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {description}
            </p>
          ) : null}
          {meta ? <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">{meta}</div> : null}
        </div>
      </div>
      {actions ? <AdminActionRow className="tw:md:justify-end">{actions}</AdminActionRow> : null}
    </header>
  )
}

function AdminMetricStrip({
  className,
  items,
}: {
  className?: string
  items: AdminMetricStripItem[]
}) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-4', className)}>
      {items.map((item, index) => (
        <Card
          className={cn('tw:min-h-28 tw:border tw:shadow-sm', toneStyles[item.tone ?? 'neutral'])}
          data-testid={item.id ? `admin-metric-${item.id}` : undefined}
          key={item.id ?? index}
          size="sm"
        >
          <CardHeader className="tw:pb-0">
            <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
              <div className="tw:min-w-0">
                <CardTitle
                  aria-level={2}
                  className="tw:text-xs tw:font-medium tw:text-muted-foreground"
                  role="heading"
                >
                  {item.label}
                </CardTitle>
                <div className="tw:mt-2 tw:text-2xl tw:font-semibold tw:tracking-normal">
                  {item.value}
                </div>
              </div>
              {item.icon ? (
                <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-background/70">
                  {item.icon}
                </span>
              ) : null}
            </div>
          </CardHeader>
          {(item.description || item.trend) ? (
            <CardContent className="tw:flex tw:items-end tw:justify-between tw:gap-2 tw:text-xs tw:text-muted-foreground">
              {item.description ? <span>{item.description}</span> : <span />}
              {item.trend ? <span className="tw:font-medium tw:text-foreground">{item.trend}</span> : null}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  )
}

function AdminStatePanel({
  action,
  children,
  className,
  description,
  isLoading = false,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode
  children?: ReactNode
  className?: string
  description?: ReactNode
  isLoading?: boolean
  title: ReactNode
  tone?: AdminSurfaceTone
}) {
  const Icon = isLoading
    ? Loader2
    : tone === 'danger'
      ? AlertCircle
      : tone === 'success'
        ? CheckCircle2
        : Info

  return (
    <Alert
      className={cn('tw:border tw:bg-card/85 tw:p-4', toneStyles[tone], className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className={cn('tw:size-4', isLoading && 'tw:animate-spin')} aria-hidden="true" />
      <AlertTitle aria-level={2} role="heading">{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {children ? <div className="tw:col-start-2 tw:mt-2">{children}</div> : null}
      {action ? <div className="tw:col-start-2 tw:mt-3">{action}</div> : null}
    </Alert>
  )
}

function AdminSurfaceSection({
  ariaLabel,
  actions,
  badge,
  children,
  className,
  description,
  eyebrow,
  testId,
  title,
}: {
  ariaLabel?: string
  actions?: ReactNode
  badge?: ReactNode
  children?: ReactNode
  className?: string
  description?: ReactNode
  eyebrow?: ReactNode
  testId?: string | undefined
  title: ReactNode
}) {
  return (
    <Card
      aria-label={ariaLabel}
      className={cn('tw:border tw:border-border tw:bg-card/85 tw:shadow-sm', className)}
      data-testid={testId}
    >
      <CardHeader className="tw:border-b tw:border-border/70 tw:pb-3">
        <div className="tw:min-w-0">
          {eyebrow ? (
            <div className="tw:mb-1 tw:text-[0.7rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
              {eyebrow}
            </div>
          ) : null}
          <CardTitle aria-level={2} role="heading">{title}</CardTitle>
          {description ? <CardDescription className="tw:mt-1">{description}</CardDescription> : null}
        </div>
        {badge || actions ? (
          <CardAction className="tw:col-span-2 tw:col-start-1 tw:row-start-3 tw:flex tw:w-full tw:flex-wrap tw:items-center tw:justify-start tw:gap-2 tw:pt-2 tw:sm:col-span-1 tw:sm:col-start-2 tw:sm:row-span-2 tw:sm:row-start-1 tw:sm:w-auto tw:sm:justify-end tw:sm:pt-0">
            {badge}
            {actions}
          </CardAction>
        ) : null}
      </CardHeader>
      {children ? <CardContent className="tw:grid tw:gap-3">{children}</CardContent> : null}
    </Card>
  )
}

function AdminKeyValueGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4', className)}>
      {children}
    </div>
  )
}

function AdminKeyValue({
  label,
  value,
}: {
  label: ReactNode
  value: ReactNode
}) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</div>
      <div className="tw:mt-1 tw:break-words tw:text-sm tw:font-medium tw:text-foreground">{value}</div>
    </div>
  )
}

function AdminSurfaceEmpty({
  children,
  copy,
  title,
}: {
  children?: ReactNode
  copy?: ReactNode
  title?: ReactNode
}) {
  const panelTitle = title ?? copy

  return (
    <AdminStatePanel
      title={panelTitle}
      description={title ? copy : undefined}
      tone="neutral"
    >
      {children}
    </AdminStatePanel>
  )
}

function AdminFilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'tw:flex tw:flex-col tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-3 tw:shadow-sm tw:md:flex-row tw:md:items-center',
        className,
      )}
    >
      {children}
    </div>
  )
}

function AdminActionRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2', className)}>
      {children}
    </div>
  )
}

function AdminSurfaceBadge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: AdminSurfaceTone
}) {
  return (
    <Badge className={cn('tw:border', badgeToneStyles[tone], className)} variant="outline">
      {children}
    </Badge>
  )
}

function AdminSurfaceSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('tw:grid tw:gap-3', className)}>
      <Skeleton className="tw:h-24 tw:w-full" />
      <Skeleton className="tw:h-48 tw:w-full" />
    </div>
  )
}

export {
  AdminActionRow,
  AdminFilterBar,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  AdminSurfaceSkeleton,
}

export type { AdminMetricStripItem, AdminSurfaceTone }
