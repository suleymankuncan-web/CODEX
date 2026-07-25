import { Link } from 'react-router'
import { ArrowRight, Target, UserMinus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CommandCanvasOperationalDrawerContent } from '../features/store-command-canvas/primitives'
import { formatCopy, type RequestCenterCopy, type RequestCenterRow } from './store-approvals-request-center-model'
import { StoreStatusBadge } from './store-surface-primitives'

export function RequestCenterSelect(input: { ariaLabel: string; items: Array<{ label: string; value: string }>; onChange: (value: string) => void; value: string }) {
  return <Select value={input.value} onValueChange={input.onChange}><SelectTrigger aria-label={input.ariaLabel} className="tw:min-h-11 tw:rounded-xl tw:border-border tw:bg-white/75 tw:text-base tw:font-medium tw:md:text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{input.items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
}

export function RequestCenterTableRow(input: { row: RequestCenterRow; onOpen: (row: RequestCenterRow, trigger: HTMLElement) => void }) {
  return <TableRow data-testid="store-approvals-request-row" tabIndex={0} role="button" aria-label={`${input.row.title}, ${input.row.statusLabel}`} onClick={(event) => input.onOpen(input.row, event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.onOpen(input.row, event.currentTarget) } }} className={cn('tw:cursor-pointer tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary', rowTone(input.row))}>
    <TableCell className="tw:px-4 tw:py-3"><RequestRecord row={input.row} /></TableCell>
    <TableCell className="tw:px-4 tw:py-3"><RequestScope row={input.row} /></TableCell>
    <TableCell className="tw:px-4 tw:py-3"><RequestStatus row={input.row} /></TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-sm tw:font-medium tw:text-foreground">{input.row.waitingLabel}</TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-sm tw:text-muted-foreground">{input.row.nextOwnerLabel}</TableCell>
    <TableCell className="tw:px-4 tw:py-3 tw:text-xs tw:text-muted-foreground">{input.row.updatedLabel}</TableCell>
  </TableRow>
}

export function RequestCenterMobileCard(input: { row: RequestCenterRow; onOpen: (row: RequestCenterRow, trigger: HTMLElement) => void }) {
  return <button type="button" data-testid="store-approvals-request-row" onClick={(event) => input.onOpen(input.row, event.currentTarget)} className={cn('tw:grid tw:min-h-11 tw:w-full tw:min-w-0 tw:gap-3 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-white/75 tw:p-3 tw:text-left tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-primary', rowTone(input.row))}>
    <div className="tw:flex tw:min-w-0 tw:items-start tw:justify-between tw:gap-2"><RequestRecord row={input.row} /><RequestStatus row={input.row} /></div>
    <RequestScope row={input.row} />
    <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:border-t tw:border-border/60 tw:pt-2 tw:text-xs"><span><span className="tw:block tw:text-muted-foreground">{input.row.nextOwnerLabel}</span><strong>{input.row.waitingLabel}</strong></span><span className="tw:text-right tw:text-muted-foreground">{input.row.updatedLabel}</span></div>
  </button>
}

export function RequestCenterDrawer(input: { copy: RequestCenterCopy; row: RequestCenterRow | null; onOpenChange: (open: boolean) => void }) {
  const row = input.row
  return <Sheet open={Boolean(row)} onOpenChange={input.onOpenChange}><CommandCanvasOperationalDrawerContent className="tw:p-5" closeLabel={input.copy.close}>
    {row ? <><SheetHeader className="tw:border-b tw:border-border/70 tw:pb-4"><div className="tw:pr-8"><RequestStatus row={row} /></div><SheetTitle className="tw:text-xl tw:font-semibold">{row.title}</SheetTitle><SheetDescription>{input.copy.drawerDescription}</SheetDescription></SheetHeader>
      <div className="tw:grid tw:grid-cols-2 tw:gap-3"><Fact label={input.copy.factsType} value={row.subtitle} /><Fact label={input.copy.factsStore} value={row.scopeTitle} /><Fact label={input.copy.factsWaiting} value={row.waitingLabel} /><Fact label={input.copy.factsOwner} value={row.nextOwnerLabel} /><Fact label={input.copy.factsUpdated} value={row.updatedLabel} /><Fact label={input.copy.factsDue} value={row.dueLabel} /></div>
      <section aria-labelledby="request-timeline-title" className="tw:grid tw:gap-3"><div><h3 id="request-timeline-title" className="tw:text-sm tw:font-semibold">{input.copy.timelineTitle}</h3>{row.eventTotal > row.events.length ? <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{formatCopy(input.copy.timelineRecent, { count: String(row.eventTotal) })}</p> : null}</div><ol className="tw:grid tw:gap-0">{row.events.map((event, index) => <li key={event.id} className="tw:grid tw:grid-cols-[18px_minmax(0,1fr)] tw:gap-3"><span className="tw:flex tw:flex-col tw:items-center"><span className="tw:mt-1 tw:size-2.5 tw:rounded-full tw:bg-primary" />{index < row.events.length - 1 ? <span className="tw:min-h-12 tw:w-px tw:flex-1 tw:bg-border" /> : null}</span><div className="tw:pb-4"><strong className="tw:block tw:text-sm">{event.label}</strong><span className="tw:block tw:text-xs tw:leading-5 tw:text-muted-foreground">{event.occurredLabel} · {event.actorLabel}</span></div></li>)}</ol></section>
      <SheetFooter><Button asChild className="tw:min-h-11 tw:rounded-xl"><Link to={row.actionTo}>{row.actionLabel}<ArrowRight className="tw:size-4" /></Link></Button></SheetFooter></> : null}
  </CommandCanvasOperationalDrawerContent></Sheet>
}

function RequestRecord({ row }: { row: RequestCenterRow }) { const Icon = row.type === 'target' ? Target : row.type === 'sellerCode' ? UserPlus : UserMinus; return <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3"><span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-primary/10 tw:text-primary"><Icon className="tw:size-5" /></span><span className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-sm tw:font-semibold">{row.title}</strong><span className="tw:block tw:truncate tw:text-xs tw:leading-5 tw:text-muted-foreground">{row.subtitle}</span></span></div> }
function RequestScope({ row }: { row: RequestCenterRow }) { return <div className="tw:min-w-0"><strong className="tw:block tw:truncate tw:text-sm tw:font-semibold">{row.scopeTitle}</strong><span className="tw:block tw:truncate tw:text-xs tw:leading-5 tw:text-muted-foreground">{row.scopeSubtitle}</span></div> }
function RequestStatus({ row }: { row: RequestCenterRow }) { return <StoreStatusBadge tone={row.statusTone} className="tw:w-fit tw:whitespace-nowrap"><span className="tw:size-1.5 tw:rounded-full tw:bg-current" />{row.statusLabel}</StoreStatusBadge> }
function Fact({ label, value }: { label: string; value: string }) { return <div className="tw:min-w-0 tw:rounded-xl tw:border tw:border-border/70 tw:bg-muted/35 tw:p-3"><span className="tw:block tw:text-xs tw:text-muted-foreground">{label}</span><strong className="tw:mt-1 tw:block tw:break-words tw:text-sm">{value}</strong></div> }
function rowTone(row: RequestCenterRow) { return row.rowTone === 'urgent' ? 'tw:bg-[linear-gradient(90deg,rgba(255,241,217,0.72),rgba(255,255,255,0.28)_42%)]' : row.rowTone === 'returned' ? 'tw:bg-[linear-gradient(90deg,rgba(255,228,236,0.72),rgba(255,255,255,0.28)_42%)]' : undefined }
