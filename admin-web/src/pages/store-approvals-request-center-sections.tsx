import { Fragment } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatCopy, type RequestCenterCopy, type RequestCenterRow } from './store-approvals-request-center-model'
import { StoreStatusBadge } from './store-surface-primitives'

export function RequestCenterSelect(input: { ariaLabel: string; items: Array<{ label: string; value: string }>; onChange: (value: string) => void; value: string }) {
  return <Select value={input.value} onValueChange={input.onChange}><SelectTrigger aria-label={input.ariaLabel}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{input.items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
}

export function RequestCenterTableRow(input: { row: RequestCenterRow; onOpen: (row: RequestCenterRow, trigger: HTMLElement) => void; inlineCopy?: RequestCenterCopy | undefined; expanded?: boolean }) {
  return <Fragment><TableRow data-testid="store-approvals-request-row" onClick={event => input.onOpen(input.row, event.currentTarget.querySelector('button') ?? event.currentTarget)} className="tw:cursor-pointer">
    <TableCell className="tw:px-4 tw:py-3"><Button variant="ghost" className="approvals-request-open" aria-expanded={input.inlineCopy ? Boolean(input.expanded) : undefined} aria-label={`${input.row.title}, ${input.row.statusLabel}`} onClick={event => {event.stopPropagation();input.onOpen(input.row,event.currentTarget)}}><RequestRecord row={input.row} />{input.inlineCopy && <ChevronDown size={16} aria-hidden="true" className={input.expanded ? 'tw:rotate-180' : undefined}/>}</Button></TableCell>
    <TableCell className="tw:px-4 tw:py-3"><RequestScope row={input.row} /></TableCell>
    <TableCell className="tw:px-4 tw:py-3"><RequestStatus row={input.row} /></TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium tw:text-foreground">{input.row.waitingLabel}</TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-sm tw:text-muted-foreground">{input.row.nextOwnerLabel}</TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-xs tw:text-muted-foreground">{input.row.updatedLabel}</TableCell>
  </TableRow>{input.inlineCopy && input.expanded && <TableRow><TableCell colSpan={6}><RequestCenterInlineDetails row={input.row} copy={input.inlineCopy}/></TableCell></TableRow>}</Fragment>
}

export function RequestCenterMobileCard(input: { row: RequestCenterRow; onOpen: (row: RequestCenterRow, trigger: HTMLElement) => void; inlineCopy?: RequestCenterCopy | undefined; expanded?: boolean }) {
  return <div><button type="button" aria-expanded={input.inlineCopy ? Boolean(input.expanded) : undefined} data-testid="store-approvals-request-row" onClick={(event) => input.onOpen(input.row, event.currentTarget)} className={cn('tw:grid tw:min-h-11 tw:w-full tw:min-w-0 tw:gap-3 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-white/75 tw:p-3 tw:text-left tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary', rowTone(input.row))}>
    <div className="tw:flex tw:min-w-0 tw:items-start tw:justify-between tw:gap-2"><RequestRecord row={input.row} /><RequestStatus row={input.row} /></div>
    <RequestScope row={input.row} />
    <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:border-t tw:border-border/60 tw:pt-2 tw:text-xs"><span><span className="tw:block tw:text-muted-foreground">{input.row.nextOwnerLabel}</span><strong>{input.row.waitingLabel}</strong></span><span className="tw:text-right tw:text-muted-foreground">{input.row.updatedLabel}</span></div>
  </button>{input.inlineCopy && input.expanded && <RequestCenterInlineDetails row={input.row} copy={input.inlineCopy}/>}</div>
}

function RequestRecord({ row }: { row: RequestCenterRow }) { return <span className="tw:min-w-0 tw:text-left"><strong className="tw:block tw:text-sm tw:font-semibold tw:whitespace-normal">{row.title}</strong><span className="tw:block tw:text-xs tw:leading-5 tw:text-muted-foreground tw:whitespace-normal">{row.subtitle}</span></span> }
function RequestScope({ row }: { row: RequestCenterRow }) { return <div className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-sm tw:font-semibold">{row.scopeTitle}</strong><span className="tw:block tw:truncate tw:text-xs tw:leading-5 tw:text-muted-foreground">{row.scopeSubtitle}</span></div> }
function RequestStatus({ row }: { row: RequestCenterRow }) { return <StoreStatusBadge tone={row.statusTone} className="tw:w-fit tw:whitespace-nowrap"><span className="tw:size-1.5 tw:rounded-full tw:bg-current" />{row.statusLabel}</StoreStatusBadge> }
function rowTone(row: RequestCenterRow) { return row.rowTone === 'urgent' ? 'tw:border-l-destructive' : undefined }

function RequestCenterInlineDetails({ row, copy }: { row: RequestCenterRow; copy: RequestCenterCopy }) {
  return <section className="approvals-inline-history" aria-label={`${row.title} · ${copy.timelineTitle}`}>
    <div className="approvals-inline-heading"><strong>{copy.timelineTitle}</strong>{row.eventTotal > row.events.length && <small>{formatCopy(copy.timelineRecent, { count: String(row.eventTotal) })}</small>}</div>
    <ol>{row.events.map(event => <li key={event.id}><span className="approvals-inline-dot" aria-hidden="true"/><div><strong>{event.label}</strong><small>{event.occurredLabel} · {event.actorLabel}</small></div></li>)}</ol>
    <div className="approvals-inline-footer"><span>{row.dueLabel}</span></div>
  </section>
}
