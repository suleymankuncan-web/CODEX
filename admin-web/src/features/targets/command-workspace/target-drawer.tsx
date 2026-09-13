import { StoreTargetHistory } from './store-target-history'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Pencil, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { getTargetRevisionBasis } from '../api'
import { getTargetCommandCopy } from './copy'
import { formatTargetTimestamp } from './format'
import { getTargetStatusMeta } from './status'
import { distributeTargetByDays, hasCompleteDistributionDays, isDepartedForTarget, targetPrecisionUnits } from './store-manager-model'
import type { TargetCommandStore } from './types'
import './target-review-drawer.css'

export type TargetApprovalInput = {
  requestId: string
  approvalNote?: string
  approvedTotalTargetValue?: number
  approvedAllocations?: Array<{ employeeId: string; assigneeLabel: string; targetValue: number; distributionDays?: number; note?: string }>
}

export function TargetCommandDrawer(input: {
  store: TargetCommandStore | null; period: string; canReadBasis: boolean
  editable: boolean; pending?: boolean; error?: string | null
  onClose: () => void; onApprove?: (value: TargetApprovalInput) => void
}) {
  const { locale } = useLocalization()
  const tr = locale === 'tr'
  const copy = getTargetCommandCopy(locale)
  const request = input.store?.request ?? null
  const [drafts, setDrafts] = useState<Record<string,string>>(() => Object.fromEntries((request?.allocations ?? []).map(a => [a.employeeId, a.targetValue])))
  const [days, setDays] = useState<Record<string,string>>(() => Object.fromEntries((request?.allocations ?? []).map(a => [a.employeeId, a.distributionDays === undefined ? '' : String(a.distributionDays)])))
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const basis = useQuery({queryKey:['target-revision-basis','review',input.store?.storeId,input.period],enabled:Boolean(input.store && input.canReadBasis),staleTime:0,queryFn:()=>getTargetRevisionBasis({storeId:input.store!.storeId,requestMonth:`${input.period}-01`})})
  const people = [...(input.store?.personnel ?? [])]
  for (const a of request?.allocations ?? []) if (!people.some(p => p.employeeId === a.employeeId)) people.push({employeeId:a.employeeId,displayName:a.displayName,positionCode:null,positionLabel:null,targetValue:a.targetValue,eligibilityStatus:'historical_allocation'})
  const allocatedPeople = people.filter(p => request?.allocations.some(a => a.employeeId === p.employeeId))
  const fixedSales = Object.fromEntries(allocatedPeople.filter(p => isDepartedForTarget(p.terminationDate,input.period)).map(p => [p.employeeId,p.actualSales ?? null]))
  const updateDays = (id:string, value:string) => {
    const nextDays = {...days,[id]:value}
    setDays(nextDays)
    setDrafts(distributeTargetByDays({total:request?.totalTargetValue??'0',note,allocations:drafts,distributionDays:nextDays,fixedSales},allocatedPeople).allocations)
  }
  const daysValid = hasCompleteDistributionDays({total:request?.totalTargetValue??'0',note,allocations:drafts,distributionDays:days,fixedSales},allocatedPeople)
  const units = Object.values(drafts).reduce((sum,value)=>sum+targetPrecisionUnits(value),0)
  const target = targetPrecisionUnits(request?.totalTargetValue)
  const balance = target-units
  const hasEdits = Boolean(request?.allocations.some(a=>targetPrecisionUnits(drafts[a.employeeId])!==targetPrecisionUnits(a.targetValue) || (days[a.employeeId]??'') !== (a.distributionDays === undefined ? '' : String(a.distributionDays))))
  const writable = input.editable && request?.status === 'pending_region_approval' && !input.pending
  const departureMismatch = people.some(p=>isDepartedForTarget(p.terminationDate,input.period) && (p.actualSales == null || Number(p.actualSales)<0 || targetPrecisionUnits(drafts[p.employeeId])!==targetPrecisionUnits(p.actualSales)))
  const canApprove = writable && !departureMismatch && (!input.canReadBasis || (basis.isSuccess && !basis.isFetching && !basis.data.periodClosed)) && (!hasEdits || (balance===0 && daysValid && note.trim().length>0 && (request?.allocations ?? []).every(a=>targetPrecisionUnits(drafts[a.employeeId])>0)))
  const money = (value:string|number|null|undefined)=>value==null?'—':new Intl.NumberFormat(tr?'tr-TR':'en-GB',{style:'currency',currency:'TRY',minimumFractionDigits:2,maximumFractionDigits:4}).format(Number(value))
  const month = new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(Number(input.period.slice(0,4)),Number(input.period.slice(5,7))-1,1))
  const meta = input.store ? getTargetStatusMeta(locale)[input.store.status] : null
  const approve = () => {if (!canApprove || !request) return;input.onApprove?.({requestId:request.requestId,...(note.trim()?{approvalNote:note.trim()}:{}),...(hasEdits?{approvedTotalTargetValue:target/10000,approvedAllocations:request.allocations.map(a=>({employeeId:a.employeeId,assigneeLabel:a.displayName,targetValue:targetPrecisionUnits(drafts[a.employeeId])/10000,distributionDays:Number(days[a.employeeId]||0),...(a.note?{note:a.note}:{})}))}:{})})}
  return <Sheet open={input.store!==null} onOpenChange={open=>{if(!open&&!input.pending)input.onClose()}}>
    <CommandCanvasOperationalDrawerContent className="target-review-drawer">
      <SheetHeader className="target-review-header"><div className="target-review-eyebrow"><Target size={16}/>{tr?'HEDEF DAĞILIMI İNCELEMESİ':'TARGET DISTRIBUTION REVIEW'}</div><SheetTitle>{input.store?.storeName ?? copy.detail}</SheetTitle><SheetDescription>{month}</SheetDescription><Badge variant="secondary">{meta?.label}</Badge>{input.canReadBasis && input.store && <div className="target-review-history-action"><StoreTargetHistory storeId={input.store.storeId} storeName={input.store.storeName} period={input.period} locale={locale} readOnlyDetails /></div>}</SheetHeader>
      <div className="target-review-body">{!request ? <div className="target-review-empty"><strong>{copy.missing}</strong><p>{copy.missingNote}</p></div> : <>
        <div className="target-review-stats"><Stat label={tr?'Mağaza hedefi':'Store target'} value={money(target/10000)}/><Stat label={tr?'Dağıtılan hedef':'Allocated target'} value={money(units/10000)}/><Stat label={tr?'Kalan bakiye':'Balance'} value={money(balance/10000)}/><Stat label={copy.personnel} value={String(people.length)}/></div>
        <div className="target-review-toolbar"><div><h3>{tr?'Personel hedef dağılımı':'Personnel target distribution'}</h3><p>{tr?'Satışları ve hedef değişimlerini birlikte inceleyin.':'Review sales alongside target changes.'}</p></div>{writable && <Button variant="outline" size="sm" onClick={()=>setEditing(!editing)}><Pencil size={14}/>{editing?(tr?'Düzenlemeyi bitir':'Finish editing'):(tr?'Günleri düzenle':'Edit days')}</Button>}</div>
        {input.canReadBasis && basis.isError && <div role="alert">{tr?'Önceki hedefler yüklenemedi.':'Previous targets could not be loaded.'}<Button variant="outline" onClick={()=>void basis.refetch()}>{tr?'Tekrar dene':'Retry'}</Button></div>}
        <div className="target-review-table"><div className="target-review-columns" aria-hidden="true">{(tr?['İsim','Pozisyon','Dağıtım günü','Gerçekleşen satış','Önceki hedef','Yeni hedef','Pay']:['Name','Position','Days','Actual sales','Previous target','New target','Share']).map(label=><span key={label}>{label}</span>)}</div>
          {people.map(person=>{
            const allocation=request.allocations.find(a=>a.employeeId===person.employeeId)
            const previous=input.canReadBasis&&basis.isSuccess ? basis.data.items.find(a=>a.employeeId===person.employeeId)?.targetValue??0 : null
            const next=drafts[person.employeeId]??'0'
            const diff=previous===null?null:(targetPrecisionUnits(next)-targetPrecisionUnits(previous))/10000
            const departed=isDepartedForTarget(person.terminationDate,input.period)
            return <div className="target-review-row" key={person.employeeId}>
              <span className="target-review-name"><strong>{person.displayName}</strong>{departed?<small className="is-negative">{tr?'İşten ayrıldı':'Left employment'}</small>:person.hireDate?.slice(0,7)===input.period?<small className="is-new">{tr?'Yeni Personel':'New employee'}</small>:null}</span>
              <span data-label={tr?'Pozisyon':'Position'}>{person.positionLabel??'—'}</span>
              <span data-label={tr?'Dağıtım günü':'Days'}>{editing&&writable&&allocation&&!departed?<Input type="number" min={1} step={1} aria-label={`${person.displayName} dağıtım günü`} inputMode="numeric" value={days[person.employeeId]??''} onChange={event=>updateDays(person.employeeId,event.target.value)}/>:days[person.employeeId]??(allocation?'—':0)}</span>
              <span data-label={tr?'Gerçekleşen satış':'Actual sales'}>{money(person.actualSales)}</span>
              <span data-label={tr?'Önceki hedef':'Previous target'}>{money(previous)}</span>
              <span data-label={tr?'Yeni hedef':'New target'}><strong>{money(next)}</strong>{diff!==null&&<small className={diff>0?'is-positive':diff<0?'is-negative':''}>{diff===0?(tr?'Değişmedi':'Unchanged'):`${diff>0?'+':'−'}${money(Math.abs(diff))}`}</small>}{departed&&<small>{person.actualSales != null && targetPrecisionUnits(next) === targetPrecisionUnits(person.actualSales) ? (tr?'Satış tutarına sabit':'Fixed to actual sales') : (tr?'Revizyon gerekli':'Revision required')}</small>}</span>
              <span data-label={tr?'Pay':'Share'}>{target>0?`%${Math.round(targetPrecisionUnits(next)/target*100)}`:'%0'}</span>
            </div>
          })}
        </div>
        <div className="target-review-notes"><section><Label>{tr?'Mağaza müdürü notu':'Store manager note'}</Label><p>{request.requestReason||'—'}</p><small>{tr?'Gönderildi':'Submitted'} · {formatTargetTimestamp(request.createdAt,locale)}</small></section><section>{writable?<><Label htmlFor="target-review-note">{tr?'Onay notu':'Approval note'}{hasEdits?' *':''}</Label><Textarea id="target-review-note" value={note} onChange={event=>setNote(event.target.value)} placeholder={tr?'Değişiklik yaptıysanız gerekçesini yazın.':'Explain any changes.'}/></>:<><Label>{tr?'Onay notu':'Approval note'}</Label><p>{request.approvalNote||'—'}</p><small>{formatTargetTimestamp(request.approvedAt,locale)}</small></>}</section></div>
        {departureMismatch&&writable&&<p role="alert" className="target-review-error">{tr?'Ayrılan personelin hedefi güncel satış tutarıyla uyuşmuyor. Mağazadan dağılımı güncellemesini isteyin.':'A departed employee target does not match recorded sales. Request an updated distribution.'}</p>}
        {input.error&&<p role="alert" className="target-review-error">{input.error}</p>}
      </>}</div>
      <div className="target-review-footer"><span><small>{tr?'Kalan bakiye':'Balance'}</small><strong className={balance===0?'is-positive':'is-negative'}>{request?money(balance/10000):'—'}</strong></span><div><Button variant="outline" disabled={input.pending} onClick={input.onClose}>{copy.close}</Button>{input.editable&&request?.status==='pending_region_approval'&&<Button disabled={!canApprove} onClick={approve}><BadgeCheck/>{input.pending?copy.approving:(tr?'Dağılımı onayla':'Approve distribution')}</Button>}</div></div>
    </CommandCanvasOperationalDrawerContent>
  </Sheet>
}
function Stat({label,value}:{label:string;value:string}) {return <div><small>{label}</small><strong>{value}</strong></div>}
