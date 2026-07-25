import { useMemo, useState } from 'react'
import { BadgeCheck, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { getTargetCommandCopy } from './copy'
import { formatTargetMoney, formatTargetTimestamp } from './format'
import { getTargetStatusMeta } from './status'
import type { TargetCommandStore } from './types'

export type TargetApprovalInput = {
  requestId: string
  approvalNote?: string
  approvedTotalTargetValue?: number
  approvedAllocations?: Array<{ employeeId: string; assigneeLabel: string; targetValue: number; note?: string }>
}

export function TargetCommandDrawer(input: {
  store: TargetCommandStore | null
  editable: boolean
  pending?: boolean
  error?: string | null
  onClose: () => void
  onApprove?: (value: TargetApprovalInput) => void
}) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  const request = input.store?.request ?? null
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries((request?.allocations ?? []).map((allocation) => [allocation.employeeId, allocation.targetValue])))
  const [note, setNote] = useState(() => request?.approvalNote ?? '')
  const [editing, setEditing] = useState<string | null>(null)
  const distributedMinor = useMemo(() => Object.values(drafts).reduce((sum, value) => sum + toMinor(value), 0), [drafts])
  const targetMinor = toMinor(request?.totalTargetValue ?? 0)
  const distributed = distributedMinor / 100
  const target = targetMinor / 100
  const balanceMinor = targetMinor - distributedMinor
  const balance = balanceMinor / 100
  const hasEdits = Boolean(request && request.allocations.some((allocation) => toMinor(drafts[allocation.employeeId]) !== toMinor(allocation.targetValue)))
  const directApprovalReady = input.editable && request?.status === 'pending_region_approval'
  const adjustedApprovalReady = balanceMinor === 0 && editing === null && request?.allocations.length
    && Object.values(drafts).every((value) => toMinor(value) > 0) && Boolean(note.trim())
  const canApprove = Boolean(directApprovalReady && (!hasEdits || adjustedApprovalReady))
  const meta = input.store ? getTargetStatusMeta(locale)[input.store.status] : null

  return <Sheet open={input.store !== null} onOpenChange={(open) => { if (!open && !input.pending) input.onClose() }}>
    <CommandCanvasOperationalDrawerContent className="target-command-drawer">
      <SheetHeader className="target-command-drawer-header"><span className="target-command-drawer-icon"><Target size={19} /></span><div><SheetTitle>{input.store?.storeName ?? copy.detail}</SheetTitle><SheetDescription>{meta?.label} · {input.store?.storeCode}</SheetDescription></div></SheetHeader>
      {input.store ? <div className="target-command-drawer-body">
        {!request ? <div className="target-command-drawer-empty"><strong>{copy.missing}</strong><p>{copy.missingNote}</p></div> : <>
        <section className="target-command-drawer-metrics"><DrawerStat label={copy.target} value={formatTargetMoney(request?.totalTargetValue, locale)} /><DrawerStat label={copy.distributed} value={formatTargetMoney(distributed, locale)} /><DrawerStat label={copy.balance} value={formatTargetMoney(balance, locale)} tone={balance === 0 ? 'good' : 'warning'} /><DrawerStat label={copy.personnel} value={String(request?.allocationCount ?? input.store.personnel.length)} /></section>
        {request?.requestReason ? <section className="target-command-note"><small>{copy.requestNote}</small><p>{request.requestReason}</p></section> : null}
        <section className="target-command-allocations"><div className="target-command-section-heading"><div><h3>{copy.allocation}</h3><p>{input.editable ? copy.editHint : copy.readOnlyHint}</p></div></div>{request.allocations.length ? request.allocations.map((allocation) => { const role = input.store?.personnel.find((person) => person.employeeId === allocation.employeeId)?.positionLabel ?? '—'; const isEditing = editing === allocation.employeeId; const content = <><span><strong>{allocation.displayName}</strong><small>{role}</small></span><span><strong>{formatTargetMoney(drafts[allocation.employeeId], locale)}</strong><small>{target > 0 ? `%${Math.round(Number(drafts[allocation.employeeId] ?? 0) / target * 100)} pay` : '—'}</small></span></>; return <div className={`target-command-person ${isEditing ? 'is-editing' : ''}`} key={allocation.employeeId}>{input.editable ? <button onClick={() => setEditing((current) => current === allocation.employeeId ? null : allocation.employeeId)} type="button">{content}</button> : <div className="target-command-person-summary">{content}</div>}{isEditing ? <div className="target-command-inline-editor"><Label><span className="tw:sr-only">{allocation.displayName}</span><Input autoFocus aria-label={`${allocation.displayName} hedefi`} inputMode="decimal" value={drafts[allocation.employeeId] ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [allocation.employeeId]: event.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') }))} /></Label><Button onClick={() => setEditing(null)} size="sm" variant="outline">{copy.close}</Button></div> : null}</div> }) : <div className="target-command-drawer-empty">{copy.noPersonnel}</div>}</section>
        <section className="target-command-audit"><div className="target-command-section-heading"><div><h3>{copy.audit}</h3><p>{copy.readOnlyHint}</p></div></div><dl><AuditRow label={copy.submitted} value={formatTargetTimestamp(request?.createdAt, locale)} /><AuditRow label={copy.approvedAt} value={formatTargetTimestamp(request?.approvedAt, locale)} /><AuditRow label={copy.decisionNote} value={request?.approvalNote ?? '—'} /></dl></section>
        {input.editable && hasEdits ? <div className="target-command-form-field"><Label htmlFor="target-approval-note">{copy.approvalNote}</Label><Textarea id="target-approval-note" maxLength={1000} placeholder={copy.approvalNotePlaceholder} value={note} onChange={(event) => setNote(event.target.value)} /></div> : null}
        {input.error ? <p className="target-command-error" role="alert">{input.error}</p> : null}
        </>}
      </div> : null}
      <div className="target-command-drawer-footer">{request ? <span className={balance === 0 ? 'is-good' : 'is-warning'}><small>{copy.balance}</small><strong>{formatTargetMoney(balance, locale)}</strong></span> : <span><small>{copy.state}</small><strong>{copy.missing}</strong></span>}<div><Button disabled={input.pending} onClick={input.onClose} variant="outline">{copy.close}</Button>{input.editable && request && input.onApprove ? <Button disabled={!canApprove || input.pending} onClick={() => input.onApprove?.({ requestId: request.requestId, ...(note.trim() ? { approvalNote: note.trim() } : {}), ...(hasEdits ? { approvedTotalTargetValue: target, approvedAllocations: request.allocations.map((allocation) => ({ employeeId: allocation.employeeId, assigneeLabel: allocation.displayName, targetValue: Number(drafts[allocation.employeeId]), ...(allocation.note ? { note: allocation.note } : {}) })) } : {}) })}><BadgeCheck />{input.pending ? copy.approving : copy.approve}</Button> : null}</div></div>
    </CommandCanvasOperationalDrawerContent>
  </Sheet>
}

function DrawerStat(input: { label: string; value: string; tone?: string }) { return <div data-tone={input.tone}><small>{input.label}</small><strong>{input.value}</strong></div> }
function AuditRow(input: { label: string; value: string }) { return <div><dt>{input.label}</dt><dd>{input.value}</dd></div> }
function toMinor(value: string | number | null | undefined) { return Math.round(Number(value ?? 0) * 100) }
