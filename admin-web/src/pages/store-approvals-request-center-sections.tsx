import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileWarning,
  Target,
  Undo2,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  RequestCenterCopy,
  RequestCenterRow,
} from './store-approvals-request-center-model'
import {
  StoreStatusBadge,
  type StoreSurfaceTone,
} from './store-surface-primitives'

export function RequestCenterHeader(input: { copy: RequestCenterCopy }) {
  return (
    <header className="tw:flex tw:items-center tw:gap-3">
      <span className="tw:grid tw:size-11 tw:place-items-center tw:rounded-2xl tw:bg-[linear-gradient(135deg,#6d47ff,#20bfd3)] tw:text-white tw:shadow-[0_18px_34px_rgba(109,71,255,0.22)]">
        <FileWarning className="tw:size-5" />
      </span>
      <div className="tw:min-w-0">
        <h1
          id="store-approvals-request-center-title"
          className="tw:text-[clamp(26px,3vw,38px)] tw:font-semibold tw:leading-none tw:text-foreground"
        >
          {input.copy.title}
        </h1>
        <p className="tw:mt-2 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
          {input.copy.description}
        </p>
      </div>
    </header>
  )
}

export function RequestCenterMetrics(input: {
  copy: RequestCenterCopy
  doneCount: number
  openCount: number
  returnedCount: number
}) {
  return (
    <section
      aria-label="Talep merkezi özetleri"
      className="tw:grid tw:gap-3 tw:md:grid-cols-3"
    >
      <RequestCenterMetric
        icon={<Clock3 className="tw:size-5" />}
        label={input.copy.pendingMetric}
        note={input.copy.pendingMetricNote}
        value={input.openCount}
        tone="warning"
      />
      <RequestCenterMetric
        icon={<Undo2 className="tw:size-5" />}
        label={input.copy.returnedMetric}
        note={input.copy.returnedMetricNote}
        value={input.returnedCount}
        tone="danger"
      />
      <RequestCenterMetric
        icon={<CheckCircle2 className="tw:size-5" />}
        label={input.copy.completedMetric}
        note={input.copy.completedMetricNote}
        value={input.doneCount}
        tone="calm"
      />
    </section>
  )
}

export function RequestCenterSelect(input: {
  ariaLabel: string
  items: Array<{ label: string; value: string }>
  onChange: (value: string) => void
  value: string
}) {
  return (
    <Select value={input.value} onValueChange={input.onChange}>
      <SelectTrigger
        aria-label={input.ariaLabel}
        className="tw:min-h-11 tw:rounded-xl tw:border-border tw:bg-white/75 tw:text-sm tw:font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {input.items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function RequestCenterTableRow(input: { row: RequestCenterRow }) {
  return (
    <TableRow
      data-testid="store-approvals-request-row"
      className={cn(
        input.row.rowTone === 'urgent'
          ? 'tw:bg-[linear-gradient(90deg,rgba(255,241,217,0.72),rgba(255,255,255,0.28)_42%)]'
          : undefined,
        input.row.rowTone === 'returned'
          ? 'tw:bg-[linear-gradient(90deg,rgba(255,228,236,0.72),rgba(255,255,255,0.28)_42%)]'
          : undefined,
      )}
    >
      <TableCell className="tw:px-4 tw:py-3">
        <RequestRecord row={input.row} />
      </TableCell>
      <TableCell className="tw:px-4 tw:py-3">
        <RequestScope row={input.row} />
      </TableCell>
      <TableCell className="tw:px-4 tw:py-3">
        <RequestStatus row={input.row} />
      </TableCell>
      <TableCell className="tw:px-4 tw:py-3 tw:text-xs tw:text-muted-foreground">
        {input.row.sourceLabel}
      </TableCell>
      <TableCell className="tw:px-4 tw:py-3 tw:text-xs tw:text-muted-foreground">
        {input.row.updatedLabel}
      </TableCell>
      <TableCell className="tw:px-4 tw:py-3">
        <RequestAction row={input.row} />
      </TableCell>
    </TableRow>
  )
}

export function RequestCenterMobileCard(input: { row: RequestCenterRow }) {
  return (
    <article
      data-testid="store-approvals-request-row"
      className={cn(
        'tw:grid tw:min-w-0 tw:gap-3 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-white/75 tw:p-3',
        input.row.rowTone === 'urgent'
          ? 'tw:bg-[linear-gradient(90deg,rgba(255,241,217,0.72),rgba(255,255,255,0.36)_60%)]'
          : undefined,
        input.row.rowTone === 'returned'
          ? 'tw:bg-[linear-gradient(90deg,rgba(255,228,236,0.72),rgba(255,255,255,0.36)_60%)]'
          : undefined,
      )}
    >
      <div className="tw:grid tw:min-w-0 tw:gap-2">
        <RequestRecord row={input.row} />
        <RequestStatus row={input.row} />
      </div>
      <RequestScope row={input.row} />
      <div className="tw:grid tw:min-w-0 tw:gap-2">
        <span className="tw:text-xs tw:text-muted-foreground">{input.row.updatedLabel}</span>
        <div className="tw:flex tw:justify-start">
          <RequestAction row={input.row} />
        </div>
      </div>
    </article>
  )
}

function RequestCenterMetric(input: {
  icon: ReactNode
  label: string
  note: string
  value: number
  tone: StoreSurfaceTone
}) {
  const toneClass = {
    accent: 'tw:bg-primary/10 tw:text-primary',
    calm: 'tw:bg-emerald-50 tw:text-emerald-700',
    danger: 'tw:bg-rose-50 tw:text-rose-600',
    neutral: 'tw:bg-muted tw:text-muted-foreground',
    warning: 'tw:bg-amber-50 tw:text-amber-600',
  } satisfies Record<StoreSurfaceTone, string>

  return (
    <Card className="tw:min-h-[118px] tw:rounded-2xl tw:border-border/80 tw:bg-card/85 tw:shadow-[0_20px_60px_rgba(61,79,122,0.12)]">
      <CardContent className="tw:grid tw:h-full tw:grid-cols-[44px_minmax(0,1fr)] tw:items-center tw:gap-3 tw:p-4">
        <span className={cn('tw:grid tw:size-11 tw:place-items-center tw:rounded-xl', toneClass[input.tone])}>
          {input.icon}
        </span>
        <div className="tw:min-w-0">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
          <strong className="tw:my-1 tw:block tw:text-3xl tw:font-semibold tw:leading-none tw:text-foreground">
            {input.value}
          </strong>
          <span className="tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.note}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function RequestRecord(input: { row: RequestCenterRow }) {
  const Icon = input.row.type === 'target'
    ? Target
    : input.row.type === 'sellerCode'
      ? UserPlus
      : UserMinus
  const toneClass = input.row.type === 'target'
    ? 'tw:bg-amber-50 tw:text-amber-600'
    : input.row.type === 'sellerCode'
      ? 'tw:bg-rose-50 tw:text-rose-600'
      : 'tw:bg-primary/10 tw:text-primary'

  return (
    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
      <span className={cn('tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl', toneClass)}>
        <Icon className="tw:size-5" />
      </span>
      <div className="tw:min-w-0">
        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">
          {input.row.title}
        </strong>
        <span className="tw:block tw:truncate tw:text-xs tw:leading-5 tw:text-muted-foreground">
          {input.row.subtitle}
        </span>
      </div>
    </div>
  )
}

function RequestScope(input: { row: RequestCenterRow }) {
  return (
    <div className="tw:min-w-0">
      <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">
        {input.row.scopeTitle}
      </strong>
      <span className="tw:block tw:truncate tw:text-xs tw:leading-5 tw:text-muted-foreground">
        {input.row.scopeSubtitle}
      </span>
    </div>
  )
}

function RequestStatus(input: { row: RequestCenterRow }) {
  return (
    <StoreStatusBadge tone={input.row.statusTone} className="tw:w-fit tw:whitespace-nowrap">
      <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
      {input.row.statusLabel}
    </StoreStatusBadge>
  )
}

function RequestAction(input: { row: RequestCenterRow }) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(
        'tw:h-9 tw:rounded-xl tw:px-3 tw:text-xs tw:font-semibold',
        input.row.actionPrimary
          ? 'store-command-soft-action'
          : 'store-command-muted-action',
      )}
    >
      <Link to={input.row.actionTo}>
        {input.row.actionLabel}
        <ArrowRight className="tw:size-4" />
      </Link>
    </Button>
  )
}
