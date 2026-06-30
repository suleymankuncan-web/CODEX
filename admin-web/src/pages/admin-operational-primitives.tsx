import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { cn } from '../lib/utils'
import { AdminSurfaceBadge, type AdminSurfaceTone } from './admin-surface-primitives'

type AdminOperationalTone = AdminSurfaceTone | 'calm'

type AdminOperationalMetric = {
  id?: string
  label: ReactNode
  value: ReactNode
  description?: ReactNode
  trend?: ReactNode
  icon?: ReactNode
  tone?: AdminOperationalTone
}

type AdminOperationalAction = {
  href?: string | undefined
  label: ReactNode
}

const toneCardStyles: Record<AdminSurfaceTone, string> = {
  neutral: 'tw:border-border tw:bg-card/90',
  accent: 'tw:border-violet-200/80 tw:bg-violet-50/70',
  success: 'tw:border-emerald-200/80 tw:bg-emerald-50/70',
  warning: 'tw:border-amber-200/80 tw:bg-amber-50/70',
  danger: 'tw:border-rose-200/80 tw:bg-rose-50/70',
  cyan: 'tw:border-cyan-200/80 tw:bg-cyan-50/70',
}

const toneBarStyles: Record<AdminSurfaceTone, string> = {
  neutral: 'tw:bg-border',
  accent: 'tw:bg-violet-500',
  success: 'tw:bg-emerald-500',
  warning: 'tw:bg-amber-500',
  danger: 'tw:bg-rose-500',
  cyan: 'tw:bg-cyan-500',
}

function toSurfaceTone(tone: AdminOperationalTone | undefined): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  return tone ?? 'neutral'
}

function AdminOperationalPage({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel?: string | undefined
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('tw:mx-auto tw:flex tw:w-full tw:max-w-[88rem] tw:flex-col tw:gap-4 tw:py-2', className)}
    >
      {children}
    </section>
  )
}

function AdminOperationalHeader({
  actions,
  description,
  eyebrow,
  icon,
  meta,
  title,
}: {
  actions?: ReactNode | undefined
  description?: ReactNode | undefined
  eyebrow?: ReactNode | undefined
  icon?: ReactNode | undefined
  meta?: ReactNode | undefined
  title: ReactNode
}) {
  return (
    <header className="tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/90 tw:p-4 tw:shadow-sm tw:backdrop-blur">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
        <div className="tw:flex tw:min-w-0 tw:gap-3">
          {icon ? (
            <span className="tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:border tw:border-violet-200/80 tw:bg-violet-50 tw:text-violet-700">
              {icon}
            </span>
          ) : null}
          <div className="tw:min-w-0">
            {eyebrow ? (
              <div className="tw:mb-1 tw:text-[0.72rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
                {eyebrow}
              </div>
            ) : null}
            <h1 className="tw:m-0 tw:text-2xl tw:font-semibold tw:tracking-normal tw:text-foreground tw:sm:text-[1.9rem]">
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
        {actions ? <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:lg:justify-end">{actions}</div> : null}
      </div>
    </header>
  )
}

function AdminOperationalMetrics({
  className,
  items,
}: {
  className?: string | undefined
  items: AdminOperationalMetric[]
}) {
  return (
    <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-4', className)}>
      {items.map((item, index) => {
        const tone = toSurfaceTone(item.tone)

        return (
          <Card
            className={cn('tw:min-h-[6.5rem] tw:overflow-hidden tw:border tw:shadow-sm', toneCardStyles[tone])}
            data-testid={item.id ? `admin-metric-${item.id}` : undefined}
            key={item.id ?? index}
            size="sm"
          >
            <div className={cn('tw:h-1 tw:w-full', toneBarStyles[tone])} />
            <CardHeader className="tw:pb-1">
              <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                <div className="tw:min-w-0">
                  <CardTitle
                    aria-level={2}
                    className="tw:text-xs tw:font-medium tw:text-muted-foreground"
                    role="heading"
                  >
                    {item.label}
                  </CardTitle>
                  <div className="tw:mt-2 tw:text-2xl tw:font-semibold tw:tracking-normal tw:text-foreground">
                    {item.value}
                  </div>
                </div>
                {item.icon ? (
                  <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-background/80 tw:text-foreground/75">
                    {item.icon}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            {item.description || item.trend ? (
              <CardContent className="tw:flex tw:items-end tw:justify-between tw:gap-2 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                {item.description ? <span>{item.description}</span> : <span />}
                {item.trend ? <span className="tw:font-medium tw:text-foreground">{item.trend}</span> : null}
              </CardContent>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

function AdminOperationalSection({
  actions,
  ariaLabel,
  badge,
  children,
  className,
  description,
  eyebrow,
  testId,
  title,
}: {
  actions?: ReactNode | undefined
  ariaLabel?: string | undefined
  badge?: ReactNode | undefined
  children: ReactNode
  className?: string | undefined
  description?: ReactNode | undefined
  eyebrow?: ReactNode | undefined
  testId?: string | undefined
  title: ReactNode
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/90 tw:shadow-sm', className)}
      data-testid={testId}
    >
      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-border/70 tw:p-4 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
        <div className="tw:min-w-0">
          {eyebrow ? (
            <div className="tw:mb-1 tw:text-[0.68rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="tw:m-0 tw:text-base tw:font-semibold tw:tracking-normal tw:text-foreground">{title}</h2>
          {description ? (
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {badge || actions ? (
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:lg:justify-end">
            {badge}
            {actions}
          </div>
        ) : null}
      </div>
      <div className="tw:grid tw:gap-3 tw:p-4">{children}</div>
    </section>
  )
}

function AdminOperationalRow({
  action,
  children,
  href,
  meta,
  status,
  testId,
  title,
  tone = 'neutral',
}: {
  action?: AdminOperationalAction | undefined
  children?: ReactNode | undefined
  href?: string | undefined
  meta?: ReactNode | undefined
  status?: ReactNode | undefined
  testId?: string | undefined
  title: ReactNode
  tone?: AdminOperationalTone | undefined
}) {
  const rowTone = toSurfaceTone(tone)
  const content = (
    <>
      <span className={cn('tw:absolute tw:inset-y-3 tw:left-0 tw:w-1 tw:rounded-r-full', toneBarStyles[rowTone])} />
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
        <div className="tw:min-w-0">
          <div className="tw:text-sm tw:font-semibold tw:text-foreground">{title}</div>
          {meta ? <div className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">{meta}</div> : null}
        </div>
        {status ? <div className="tw:flex tw:shrink-0 tw:flex-wrap tw:gap-2">{status}</div> : null}
      </div>
      {children ? <div className="tw:mt-3">{children}</div> : null}
      {action ? (
        <div className="tw:mt-3 tw:flex tw:justify-end">
          <Button asChild={Boolean(action.href)} size="sm" variant={rowTone === 'danger' ? 'outline' : 'secondary'}>
            {action.href ? (
              <Link to={action.href}>
                {action.label}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            ) : (
              <span>{action.label}</span>
            )}
          </Button>
        </div>
      ) : null}
    </>
  )

  const className = cn(
    'tw:relative tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/65 tw:p-3 tw:pl-4 tw:text-left tw:shadow-xs',
    href && 'tw:transition-colors tw:hover:bg-muted/50',
  )

  if (href) {
    return (
      <Link className={className} data-testid={testId} to={href}>
        {content}
      </Link>
    )
  }

  return (
    <article className={className} data-testid={testId}>
      {content}
    </article>
  )
}

function AdminOperationalKeyGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string | undefined
}) {
  return <div className={cn('tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:xl:grid-cols-4', className)}>{children}</div>
}

function AdminOperationalKeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border/80 tw:bg-card/70 tw:p-3">
      <div className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</div>
      <div className="tw:mt-1 tw:break-words tw:text-sm tw:font-semibold tw:text-foreground">{value}</div>
    </div>
  )
}

function AdminOperationalState({
  action,
  children,
  description,
  isLoading = false,
  testId,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode | undefined
  children?: ReactNode | undefined
  description?: ReactNode | undefined
  isLoading?: boolean
  testId?: string | undefined
  title: ReactNode
  tone?: AdminOperationalTone | undefined
}) {
  const Icon = isLoading ? Loader2 : tone === 'success' || tone === 'calm' ? CheckCircle2 : Info

  return (
    <div
      className={cn('tw:flex tw:gap-3 tw:rounded-xl tw:border tw:p-3', toneCardStyles[toSurfaceTone(tone)])}
      data-testid={testId}
    >
      <Icon className={cn('tw:mt-0.5 tw:size-4 tw:shrink-0', isLoading && 'tw:animate-spin')} aria-hidden="true" />
      <div className="tw:min-w-0 tw:flex-1">
        <div className="tw:text-sm tw:font-semibold tw:text-foreground">{title}</div>
        {description ? <div className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{description}</div> : null}
        {children ? <div className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">{children}</div> : null}
        {action ? <div className="tw:mt-3">{action}</div> : null}
      </div>
    </div>
  )
}

function AdminOperationalEmpty({
  action,
  copy,
  title = 'Kayıt bulunamadı',
}: {
  action?: ReactNode | undefined
  copy?: ReactNode | undefined
  title?: ReactNode | undefined
}) {
  return (
    <AdminOperationalState action={action} description={copy} title={title} tone="neutral" />
  )
}

function AdminOperationalActionRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string | undefined
}) {
  return <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2', className)}>{children}</div>
}

function AdminOperationalFilterBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        'tw:flex tw:flex-col tw:gap-3 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/90 tw:p-3 tw:shadow-sm tw:lg:flex-row tw:lg:items-end',
        className,
      )}
    >
      {children}
    </div>
  )
}

function AdminOperationalSkeleton() {
  return <AdminOperationalState isLoading title="Yükleniyor" tone="neutral" />
}

function AdminOperationalBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: AdminOperationalTone
}) {
  return <AdminSurfaceBadge tone={toSurfaceTone(tone)}>{children}</AdminSurfaceBadge>
}

export {
  AdminOperationalActionRow,
  AdminOperationalBadge,
  AdminOperationalEmpty,
  AdminOperationalFilterBar,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalRow,
  AdminOperationalSection,
  AdminOperationalSkeleton,
  AdminOperationalState,
}

export type { AdminOperationalMetric, AdminOperationalTone }
