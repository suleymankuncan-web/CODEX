import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/utils'

type AuthTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'cyan'

const badgeTone: Record<AuthTone, string> = {
  neutral: 'tw:border-border tw:bg-background tw:text-muted-foreground',
  accent: 'tw:border-violet-200 tw:bg-violet-100 tw:text-violet-800',
  success: 'tw:border-emerald-200 tw:bg-emerald-100 tw:text-emerald-800',
  warning: 'tw:border-amber-200 tw:bg-amber-100 tw:text-amber-800',
  danger: 'tw:border-rose-200 tw:bg-rose-100 tw:text-rose-800',
  cyan: 'tw:border-cyan-200 tw:bg-cyan-100 tw:text-cyan-800',
}

function AuthFormGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2', className)}>{children}</div>
}

function AuthField({
  children,
  label,
}: {
  children: ReactNode
  label: ReactNode
}) {
  return (
    <label className="tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function AuthInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn('tw:bg-background/70', props.className)} />
}

function AuthNativeSelect({
  className,
  multiple,
  ...props
}: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'tw:w-full tw:min-w-0 tw:rounded-lg tw:border tw:border-input tw:bg-background/70 tw:px-2.5 tw:py-1 tw:text-sm tw:text-foreground tw:outline-none tw:transition-colors tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
        multiple ? 'tw:min-h-24' : 'tw:h-8',
        className,
      )}
      multiple={multiple}
      {...props}
    />
  )
}

function AuthActionRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2', className)}>{children}</div>
}

function AuthList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:grid tw:gap-2', className)}>{children}</div>
}

function AuthListRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <article className={cn('tw:rounded-lg tw:border tw:border-border tw:bg-background/55 tw:p-3', className)}>
      {children}
    </article>
  )
}

function AuthLinkRow({
  children,
  className,
  to,
}: {
  children: ReactNode
  className?: string
  to: string
}) {
  return (
    <Link
      className={cn(
        'tw:block tw:rounded-lg tw:border tw:border-border tw:bg-background/55 tw:p-3 tw:text-foreground tw:no-underline tw:transition-colors tw:hover:border-primary/40 tw:hover:bg-muted/50',
        className,
      )}
      to={to}
    >
      {children}
    </Link>
  )
}

function AuthRowHead({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-2', className)}>{children}</div>
}

function AuthMuted({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('tw:text-xs tw:leading-5 tw:text-muted-foreground', className)}>{children}</span>
}

function AuthStatusBadge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: AuthTone
}) {
  return (
    <Badge className={cn('tw:border', badgeTone[tone], className)} variant="outline">
      {children}
    </Badge>
  )
}

function AuthTimeline({ children }: { children: ReactNode }) {
  return <div className="tw:grid tw:gap-3">{children}</div>
}

function AuthTimelineItem({ children }: { children: ReactNode }) {
  return (
    <article className="tw:relative tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/55 tw:p-3 tw:pl-9">
      <span className="tw:absolute tw:left-3 tw:top-4 tw:size-3 tw:rounded-full tw:border-2 tw:border-background tw:bg-primary" />
      {children}
    </article>
  )
}

export {
  AuthActionRow,
  AuthField,
  AuthFormGrid,
  AuthInput,
  AuthLinkRow,
  AuthList,
  AuthListRow,
  AuthMuted,
  AuthNativeSelect,
  AuthRowHead,
  AuthStatusBadge,
  AuthTimeline,
  AuthTimelineItem,
  Button as AuthButton,
}

export type { AuthTone }
