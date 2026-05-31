import type { ChangeEvent, ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { cn } from '../../lib/utils'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  type AdminSurfaceTone,
} from '../../pages/admin-surface-primitives'
import type { CompetitionDisplayTone } from './display'

type CompetitionFeedbackTone = CompetitionDisplayTone | 'error'

const toneMap: Record<CompetitionFeedbackTone, AdminSurfaceTone> = {
  accent: 'accent',
  calm: 'success',
  danger: 'danger',
  error: 'danger',
  neutral: 'neutral',
  warning: 'warning',
}

function mapCompetitionTone(tone: CompetitionFeedbackTone): AdminSurfaceTone {
  return toneMap[tone]
}

function CompetitionStatusBadge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: CompetitionFeedbackTone
}) {
  return (
    <AdminSurfaceBadge {...(className ? { className } : {})} tone={mapCompetitionTone(tone)}>
      {children}
    </AdminSurfaceBadge>
  )
}

function CompetitionStatePanel({
  action,
  children,
  copy,
  isLoading = false,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode
  children?: ReactNode
  copy?: ReactNode
  isLoading?: boolean
  title: ReactNode
  tone?: CompetitionFeedbackTone
}) {
  return (
    <AdminStatePanel
      action={action}
      description={copy}
      isLoading={isLoading}
      title={title}
      tone={mapCompetitionTone(tone)}
    >
      {children}
    </AdminStatePanel>
  )
}

function CompetitionEmptyState({
  copy,
  title,
}: {
  copy?: ReactNode
  title: ReactNode
}) {
  return <AdminSurfaceEmpty copy={copy} title={title} />
}

function CompetitionRowList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:grid tw:gap-3', className)}>{children}</div>
}

function CompetitionRow({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel?: string
  children: ReactNode
  className?: string
}) {
  return (
    <article aria-label={ariaLabel} className={className}>
      <Card
        className="tw:border tw:border-border tw:bg-background/65 tw:shadow-none"
        role="group"
        size="sm"
      >
        <CardContent className="tw:grid tw:gap-3">{children}</CardContent>
      </Card>
    </article>
  )
}

function CompetitionRowHeader({
  actions,
  badge,
  description,
  title,
}: {
  actions?: ReactNode
  badge?: ReactNode
  description?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
      <div className="tw:min-w-0">
        <h3 className="tw:m-0 tw:text-sm tw:font-medium tw:text-foreground">
          <strong className="tw:font-medium">{title}</strong>
        </h3>
        {description ? (
          <p className="tw:mt-1 tw:m-0 tw:text-xs tw:leading-5 tw:text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {badge || actions ? (
        <AdminActionRow className="tw:shrink-0 tw:sm:justify-end">
          {badge}
          {actions}
        </AdminActionRow>
      ) : null}
    </div>
  )
}

function CompetitionSubtleText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('tw:m-0 tw:text-sm tw:leading-6 tw:text-muted-foreground', className)}>{children}</p>
}

function CompetitionInlineNotice({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: CompetitionFeedbackTone
}) {
  const Icon = tone === 'error' || tone === 'danger'
    ? AlertCircle
    : tone === 'calm'
      ? CheckCircle2
      : tone === 'warning'
        ? AlertCircle
        : Info

  return (
    <div
      className={cn(
        'tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-sm',
        tone === 'warning' && 'tw:border-amber-200 tw:bg-amber-50/70 tw:text-amber-950',
        (tone === 'error' || tone === 'danger') && 'tw:border-rose-200 tw:bg-rose-50/70 tw:text-rose-950',
        tone === 'calm' && 'tw:border-emerald-200 tw:bg-emerald-50/70 tw:text-emerald-950',
        (tone === 'neutral' || tone === 'accent') && 'tw:border-border tw:bg-muted/40 tw:text-muted-foreground',
      )}
    >
      <Icon className="tw:mt-0.5 tw:size-4 tw:shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

function CompetitionFieldGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4', className)}>{children}</div>
}

function CompetitionTextField({
  label,
  min,
  type = 'text',
  value,
  onChange,
}: {
  label: string
  min?: string
  type?: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="tw:grid tw:gap-1.5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</span>
      <Input min={min} type={type} value={value} onChange={onChange} />
    </label>
  )
}

function CompetitionTextareaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <label className="tw:grid tw:gap-1.5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</span>
      <Textarea className="tw:min-h-24" value={value} onChange={onChange} />
    </label>
  )
}

function CompetitionSelectField({
  children,
  label,
  value,
  onChange,
}: {
  children: ReactNode
  label: string
  value: string
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
}) {
  return (
    <label className="tw:grid tw:gap-1.5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{label}</span>
      <select
        className="tw:h-8 tw:w-full tw:rounded-lg tw:border tw:border-input tw:bg-background tw:px-2.5 tw:text-sm tw:text-foreground tw:outline-none tw:transition-colors tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
        value={value}
        onChange={onChange}
      >
        {children}
      </select>
    </label>
  )
}

function CompetitionCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: ReactNode
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:px-3 tw:py-2 tw:text-sm">
      <input
        checked={checked}
        className="tw:size-4 tw:accent-primary"
        type="checkbox"
        onChange={onChange}
      />
      <span className="tw:min-w-0">{label}</span>
    </label>
  )
}

function CompetitionCheckboxGrid({ children }: { children: ReactNode }) {
  return <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:md:grid-cols-2 tw:xl:grid-cols-3">{children}</div>
}

function CompetitionSectionHeader({
  badge,
  description,
  eyebrow,
  title,
}: {
  badge?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}) {
  return (
    <CardHeader className="tw:border-b tw:border-border/70 tw:pb-3">
      <div className="tw:min-w-0">
        {eyebrow ? (
          <div className="tw:mb-1 tw:text-[0.7rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
            {eyebrow}
          </div>
        ) : null}
        <CardTitle aria-level={2} role="heading">{title}</CardTitle>
        {description ? <CompetitionSubtleText className="tw:mt-1">{description}</CompetitionSubtleText> : null}
      </div>
      {badge ? <div className="tw:col-start-2 tw:row-span-2 tw:row-start-1 tw:self-start tw:justify-self-end">{badge}</div> : null}
    </CardHeader>
  )
}

function CompetitionLoadingInline({
  copy,
  title,
}: {
  copy: ReactNode
  title: ReactNode
}) {
  return (
    <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-muted/40 tw:px-3 tw:py-2 tw:text-sm tw:text-muted-foreground">
      <Loader2 className="tw:size-4 tw:animate-spin" aria-hidden="true" />
      <span className="tw:font-medium tw:text-foreground">{title}</span>
      <span>{copy}</span>
    </div>
  )
}

export {
  AdminActionRow as CompetitionActionRow,
  AdminKeyValue as CompetitionKeyValue,
  AdminKeyValueGrid as CompetitionKeyValueGrid,
  Button as CompetitionButton,
  CompetitionCheckbox,
  CompetitionCheckboxGrid,
  CompetitionEmptyState,
  CompetitionFieldGrid,
  CompetitionInlineNotice,
  CompetitionLoadingInline,
  CompetitionRow,
  CompetitionRowHeader,
  CompetitionRowList,
  CompetitionSectionHeader,
  CompetitionSelectField,
  CompetitionStatePanel,
  CompetitionStatusBadge,
  CompetitionSubtleText,
  CompetitionTextareaField,
  CompetitionTextField,
}
