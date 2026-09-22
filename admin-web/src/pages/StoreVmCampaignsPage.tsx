import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Image, Layers3, Plus, RefreshCcw, ShieldCheck } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  CommandCanvasMetric,
  CommandCanvasMetricRail,
  CommandCanvasPage,
  CommandCanvasPageHeader,
} from '../features/store-command-canvas/primitives'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Checkbox } from '../components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { actionToast } from '../lib/action-toast'
import { getUserFacingErrorMessage } from '../lib/format'
import {
  createVmReference,
  configureAndPublishVmReference,
  changeVmAssignmentState,
  getVmCampaigns,
  getVmManagedCampaigns,
  getVmReferenceReadUrl,
  getVmReferenceOptions,
  getVmReferences,
  getVmReviewerCampaigns,
  retireVmReference,
  reviseVmCampaign,
  submitVmCampaign,
  uploadVmEvidence,
  type VmCampaignAssignment,
} from '../features/vm-campaigns/api'
import { RegionManagerAdvisoryWorkspace } from '../features/vm-campaigns/RegionManagerAdvisoryWorkspace'
import './store-vm-campaigns.css'

export function StoreVmCampaignsPage(input: { authSummary: AuthSessionSummary | null }) {
  const roles = input.authSummary?.user.roleCodes ?? []
  const publisherCompanies = input.authSummary?.user.permissionScopes?.VM_REFERENCE_PUBLISHER?.companyIds ?? []
  const reviewerCompanies = input.authSummary?.user.permissionScopes?.VM_VISUAL_REVIEWER?.companyIds ?? []
  const permissionScopes = input.authSummary?.user.permissionScopes ?? {}
  const publisher = roles.includes('VISUAL_MERCHANDISER') && publisherCompanies.length > 0
  const reviewer = roles.includes('VISUAL_MERCHANDISER') && reviewerCompanies.length > 0
  return roles.includes('REGION_MANAGER')
    ? <RegionManagerAdvisoryWorkspace />
    : publisher
    ? <PublisherWorkspace companyId={publisherCompanies[0]!}
        windowAuthority={permissionScopes.VM_CAMPAIGN_WINDOW_AUTHORITY?.companyIds.includes(publisherCompanies[0]!) ?? false}
        scopeAuthority={permissionScopes.VM_CAMPAIGN_SCOPE_AUTHORITY?.companyIds.includes(publisherCompanies[0]!) ?? false}
        emergencyAuthority={permissionScopes.VM_CAMPAIGN_EMERGENCY_AUTHORITY?.companyIds.includes(publisherCompanies[0]!) ?? false} />
    : reviewer
      ? <ReviewerWorkspace companyId={reviewerCompanies[0]!} />
    : <StoreManagerWorkspace allowed={roles.includes('STORE_MANAGER')} />
}

function ReviewerWorkspace(input: { companyId: string }) {
  const query = useQuery({ queryKey: ['vm-reviewer-campaigns', input.companyId],
    queryFn: () => getVmReviewerCampaigns(input.companyId) })
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items])
  const metricsUnavailable = query.isPending || query.isError
  return <CommandCanvasPage ariaLabelledBy="vm-review-title" className="vm-campaign-page">
    <CommandCanvasPageHeader titleId="vm-review-title" eyebrow="Salt okunur"
      title="VM kampanya kapsamı" description="Mağazaların teslim ve süre durumlarını inceleyin." />
    <CommandCanvasMetricRail ariaLabel="VM kampanya kapsam özeti">
      <CommandCanvasMetric label="Mağaza" value={metricsUnavailable ? '—' : String(items.length)} icon={<Layers3 />} tone="plum" />
      <CommandCanvasMetric label="Bekleyen" value={metricsUnavailable ? '—' : String(items.filter((item) => ['scheduled', 'open'].includes(item.deadlineStatus)).length)} icon={<CalendarClock />} tone="amber" />
      <CommandCanvasMetric label="Zamanında" value={metricsUnavailable ? '—' : String(items.filter((item) => item.deadlineStatus === 'on_time').length)} icon={<ShieldCheck />} tone="mint" />
    </CommandCanvasMetricRail>
    <SurfaceState loading={query.isPending} error={query.error} empty={items.length === 0} emptyCopy="İncelenecek kampanya yok."
      onRetry={() => void query.refetch()} retrying={query.isFetching} />
    <div className="vm-campaign-list">{items.map((assignment) => <article key={assignment.assignmentId}>
      <header><div><span>{assignment.storeName}</span><h2>{assignment.referenceName}</h2></div>
        <strong data-status={assignment.deadlineStatus}>{statusLabel(assignment.deadlineStatus)}</strong></header>
      <p>{formatWindow(assignment.startsAt, assignment.submissionClosesAt)}</p>
    </article>)}</div>
  </CommandCanvasPage>
}

function PublisherWorkspace(input: { companyId: string; windowAuthority: boolean; scopeAuthority: boolean; emergencyAuthority: boolean }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ referenceCode: '', referenceName: '', instructions: '' })
  const [selectedReference, setSelectedReference] = useState<null | { referenceSetId: string; version: number; referenceName: string }>(null)
  const query = useQuery({ queryKey: ['vm-references', input.companyId], queryFn: () => getVmReferences(input.companyId) })
  const create = useMutation({
    mutationFn: () => createVmReference({ companyId: input.companyId, ...draft }),
    onSuccess: async () => {
      setOpen(false)
      setDraft({ referenceCode: '', referenceName: '', instructions: '' })
      await queryClient.invalidateQueries({ queryKey: ['vm-references', input.companyId] })
      actionToast.success('Referans taslağı oluşturuldu.')
    },
    onError: (error) => actionToast.error(error, 'Referans oluşturulamadı.'),
  })
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items])
  const metricsUnavailable = query.isPending || query.isError
  return (
    <CommandCanvasPage ariaLabelledBy="vm-reference-title" className="vm-campaign-page">
      <CommandCanvasPageHeader titleId="vm-reference-title" eyebrow="Görsel standart yönetimi"
        title="VM referansları" description="Yayınlanmadan önce referansları, kapsamı ve kampanya penceresini hazırlayın."
        actions={<Button onClick={() => setOpen((value) => !value)}><Plus /> Yeni referans</Button>} />
      <CommandCanvasMetricRail ariaLabel="VM referans özeti">
        <CommandCanvasMetric label="Toplam" value={metricsUnavailable ? '—' : String(items.length)} icon={<Layers3 />} tone="plum" />
        <CommandCanvasMetric label="Taslak" value={metricsUnavailable ? '—' : String(items.filter((item) => item.status === 'draft').length)} icon={<Image />} tone="amber" />
        <CommandCanvasMetric label="Aktif" value={metricsUnavailable ? '—' : String(items.filter((item) => item.status === 'open').length)} icon={<CheckCircle2 />} tone="mint" />
      </CommandCanvasMetricRail>
      {open ? <form className="vm-reference-composer" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <Input aria-label="Referans kodu" placeholder="Referans kodu" value={draft.referenceCode} onChange={(event) => setDraft({ ...draft, referenceCode: event.target.value })} required />
        <Input aria-label="Referans adı" placeholder="Referans adı" value={draft.referenceName} onChange={(event) => setDraft({ ...draft, referenceName: event.target.value })} required />
        <Textarea aria-label="Uygulama talimatı" placeholder="Uygulama talimatı" value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} required />
        <div><Button type="button" variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button><Button disabled={create.isPending} type="submit">Taslağı oluştur</Button></div>
      </form> : null}
      <SurfaceState loading={query.isPending} error={query.error} empty={items.length === 0} emptyCopy="Henüz VM referansı yok."
        onRetry={() => void query.refetch()} retrying={query.isFetching} />
      {items.length > 0 ? <div className="vm-reference-list">{items.map((item) => <article key={item.referenceSetId}>
        <div><span>{item.referenceCode}</span><h2>{item.referenceName}</h2><p>{item.instructions}</p></div>
        <div className="vm-reference-actions"><strong data-status={item.status}>{statusLabel(item.status)}</strong>
          {item.status === 'draft' ? <Button size="sm" variant="outline" onClick={() => setSelectedReference({ referenceSetId: item.referenceSetId, version: item.version, referenceName: item.referenceName })}>Hazırla ve yayınla</Button> : null}</div>
      </article>)}</div> : null}
      {selectedReference ? <PublisherConfiguration companyId={input.companyId} reference={selectedReference}
        onClose={() => setSelectedReference(null)} onPublished={async () => {
          setSelectedReference(null)
          await queryClient.invalidateQueries({ queryKey: ['vm-references', input.companyId] })
        }} /> : null}
      {input.windowAuthority || input.scopeAuthority || input.emergencyAuthority
        ? <PublisherOperations companyId={input.companyId} windowAuthority={input.windowAuthority}
            scopeAuthority={input.scopeAuthority} emergencyAuthority={input.emergencyAuthority}
            references={items.map((item) => ({ referenceSetId: item.referenceSetId,
              referenceName: item.referenceName, status: item.status, version: item.version }))} />
        : null}
    </CommandCanvasPage>
  )
}

function PublisherOperations(input: { companyId: string; windowAuthority: boolean; scopeAuthority: boolean; emergencyAuthority: boolean; references: Array<{ referenceSetId: string; referenceName: string; status: string; version: number }> }) {
  const queryClient = useQueryClient()
  const campaigns = useQuery({ queryKey: ['vm-managed-campaigns', input.companyId], queryFn: () => getVmManagedCampaigns(input.companyId) })
  const options = useQuery({ queryKey: ['vm-reference-options', input.companyId], queryFn: () => getVmReferenceOptions(input.companyId) })
  const [referenceSetId, setReferenceSetId] = useState('')
  const [command, setCommand] = useState<'extend' | 'reopen' | 'scope_add' | 'retire'>(
    input.windowAuthority ? 'extend' : input.scopeAuthority ? 'scope_add' : 'retire')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [reason, setReason] = useState('')
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [assignmentReasons, setAssignmentReasons] = useState<Record<string, string>>({})
  const selectedReference = input.references.find((item) => item.referenceSetId === referenceSetId)
  const refresh = async () => { await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['vm-references', input.companyId] }),
    queryClient.invalidateQueries({ queryKey: ['vm-managed-campaigns', input.companyId] }),
  ]) }
  const revise = useMutation({ mutationFn: async () => {
    if (!selectedReference) throw new Error('Referans seçin.')
    if (command === 'retire') return retireVmReference({ companyId: input.companyId,
      referenceSetId, expectedRevision: selectedReference.version, reason })
    return reviseVmCampaign({ companyId: input.companyId, referenceSetId,
      expectedRevision: selectedReference.version, command, startsOn, endsOn,
      reason, storeIds: command === 'scope_add' ? storeIds : [] })
  }, onSuccess: async () => { await refresh(); setReason(''); setStoreIds([]); actionToast.success('Kampanya güncellendi.') },
  onError: (error) => actionToast.error(error, 'Kampanya güncellenemedi.') })
  const assignment = useMutation({ mutationFn: (payload: { item: VmCampaignAssignment; command: 'withdraw' | 'exempt' | 'hold' | 'reconcile' }) =>
    changeVmAssignmentState({ companyId: input.companyId, referenceSetId: payload.item.referenceSetId,
      assignmentId: payload.item.assignmentId, expectedVersion: payload.item.version,
      command: payload.command, reason: assignmentReasons[payload.item.assignmentId] ?? '' }),
  onSuccess: async () => { await refresh(); actionToast.success('Mağaza durumu güncellendi.') },
  onError: (error) => actionToast.error(error, 'Mağaza durumu güncellenemedi.') })
  const managed = campaigns.data?.items ?? []
  return <section className="vm-publish-workbench" aria-label="Kampanya operasyonları">
    <header><div><span>Kampanya operasyonları</span><h2>Takvim ve mağaza durumu</h2></div></header>
    <form onSubmit={(event) => { event.preventDefault(); revise.mutate() }}>
      <div className="vm-window-fields"><label><span>Referans</span><Select value={referenceSetId} onValueChange={setReferenceSetId}><SelectTrigger><SelectValue placeholder="Referans seçin" /></SelectTrigger><SelectContent>{input.references.filter((item) => item.status !== 'draft' && item.status !== 'retired').map((item) => <SelectItem key={item.referenceSetId} value={item.referenceSetId}>{item.referenceName}</SelectItem>)}</SelectContent></Select></label>
        <label><span>İşlem</span><Select value={command} onValueChange={(value) => setCommand(value as typeof command)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{input.windowAuthority ? <><SelectItem value="extend">Süreyi uzat</SelectItem><SelectItem value="reopen">Yeniden aç</SelectItem></> : null}{input.scopeAuthority ? <SelectItem value="scope_add">Mağaza ekle</SelectItem> : null}{input.emergencyAuthority ? <SelectItem value="retire">Arşivle</SelectItem> : null}</SelectContent></Select></label></div>
      {command !== 'retire' ? <div className="vm-window-fields"><label><span>Başlangıç</span><Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><label><span>Bitiş</span><Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label></div> : null}
      {command === 'scope_add' ? <>
        <SurfaceState loading={options.isPending} error={options.error}
          empty={!options.isPending && !options.isError && (options.data?.stores.length ?? 0) === 0}
          emptyCopy="Eklenecek mağaza bulunamadı." onRetry={() => void options.refetch()} retrying={options.isFetching} />
        {!options.isPending && !options.isError && (options.data?.stores.length ?? 0) > 0 ? <fieldset><legend>Eklenecek mağazalar</legend><div className="vm-store-options">{(options.data?.stores ?? []).map((store) => <label key={store.storeId} className="vm-option-row"><Checkbox checked={storeIds.includes(store.storeId)} onCheckedChange={(checked) => setStoreIds((current) => checked ? [...current, store.storeId] : current.filter((id) => id !== store.storeId))} /><span>{store.storeName}</span></label>)}</div></fieldset> : null}
      </> : null}
      <label><span>İşlem gerekçesi</span><Textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <footer><Button disabled={!selectedReference || !reason.trim() || (command !== 'retire' && (!startsOn || !endsOn)) || (command === 'scope_add' && storeIds.length === 0) || revise.isPending} type="submit">İşlemi uygula</Button></footer>
    </form>
    <SurfaceState loading={campaigns.isPending} error={campaigns.error} empty={!campaigns.isPending && managed.length === 0} emptyCopy="Yönetilecek mağaza ataması yok."
      onRetry={() => void campaigns.refetch()} retrying={campaigns.isFetching} />
    <div className="vm-campaign-list">{managed.map((item) => <article key={item.assignmentId}><header><div><span>{item.storeName}</span><h2>{item.referenceName}</h2></div><strong data-status={item.deadlineStatus}>{statusLabel(item.deadlineStatus)}</strong></header>
      <Input aria-label={`${item.storeName} işlem gerekçesi`} placeholder="İşlem gerekçesi" value={assignmentReasons[item.assignmentId] ?? ''} onChange={(event) => setAssignmentReasons((current) => ({ ...current, [item.assignmentId]: event.target.value }))} />
      <div className="vm-assignment-actions">{item.deadlineStatus === 'operational_hold' && input.emergencyAuthority ? <Button size="sm" variant="outline" disabled={!assignmentReasons[item.assignmentId]?.trim() || assignment.isPending} onClick={() => assignment.mutate({ item, command: 'reconcile' })}>Mutabakatı tamamla</Button> : ['scheduled', 'open'].includes(item.deadlineStatus) ? <>{input.emergencyAuthority ? <Button size="sm" variant="outline" disabled={!assignmentReasons[item.assignmentId]?.trim() || assignment.isPending} onClick={() => assignment.mutate({ item, command: 'hold' })}>Beklemeye al</Button> : null}{input.scopeAuthority ? <><Button size="sm" variant="outline" disabled={!assignmentReasons[item.assignmentId]?.trim() || assignment.isPending} onClick={() => assignment.mutate({ item, command: 'exempt' })}>Muaf tut</Button><Button size="sm" variant="destructive" disabled={!assignmentReasons[item.assignmentId]?.trim() || assignment.isPending} onClick={() => assignment.mutate({ item, command: 'withdraw' })}>Kapsamdan çıkar</Button></> : null}</> : null}</div>
    </article>)}</div>
  </section>
}

function PublisherConfiguration(input: { companyId: string; reference: { referenceSetId: string; version: number; referenceName: string }; onClose: () => void; onPublished: () => Promise<void> }) {
  const optionsQuery = useQuery({ queryKey: ['vm-reference-options', input.companyId], queryFn: () => getVmReferenceOptions(input.companyId) })
  const [templateId, setTemplateId] = useState('')
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [files, setFiles] = useState<Record<string, File>>({})
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [reason, setReason] = useState('')
  const templates = optionsQuery.data?.templates ?? []
  const stores = optionsQuery.data?.stores ?? []
  const template = templates.find((item) => item.templateId === templateId)
  const publish = useMutation({
    mutationFn: () => configureAndPublishVmReference({ companyId: input.companyId,
      referenceSetId: input.reference.referenceSetId, expectedRevision: input.reference.version,
      startsOn, endsOn, reason, storeIds: selectedStores,
      items: (template?.items ?? []).filter((item) => selectedItems.includes(item.templateItemId)).map((item, index) => ({
        templateId, templateItemId: item.templateItemId, itemOrder: index,
        expectedVisualIntent: item.itemText, reviewInstructions: item.itemText,
        rubricVersion: 'vm-reference-v1', file: files[item.templateItemId]!,
      })) }),
    onSuccess: async () => { await input.onPublished(); actionToast.success('VM referansı yayınlandı.') },
    onError: (error) => { actionToast.error(error, 'VM referansı yayınlanamadı.') },
  })
  const chosenItems = (template?.items ?? []).filter((item) => selectedItems.includes(item.templateItemId))
  const complete = Boolean(templateId && startsOn && endsOn && reason.trim() && selectedStores.length && chosenItems.length && chosenItems.every((item) => files[item.templateItemId]))
  return <section className="vm-publish-workbench" aria-label={`${input.reference.referenceName} yayın hazırlığı`}>
    <header><div><span>Yayın hazırlığı</span><h2>{input.reference.referenceName}</h2></div><Button variant="ghost" onClick={input.onClose}>Kapat</Button></header>
    <SurfaceState loading={optionsQuery.isPending} error={optionsQuery.error} empty={!optionsQuery.isPending && templates.length === 0} emptyCopy="Yayında VM checklist şablonu bulunamadı."
      onRetry={() => void optionsQuery.refetch()} retrying={optionsQuery.isFetching} />
    {templates.length ? <form onSubmit={(event) => { event.preventDefault(); publish.mutate() }}>
      <label><span>VM checklist şablonu</span><Select value={templateId} onValueChange={(value) => { setTemplateId(value); setSelectedItems([]); setFiles({}) }}><SelectTrigger><SelectValue placeholder="Şablon seçin" /></SelectTrigger><SelectContent>{templates.map((item) => <SelectItem key={item.templateId} value={item.templateId}>{item.templateName}</SelectItem>)}</SelectContent></Select></label>
      {template ? <fieldset><legend>Kontrol maddeleri ve referans görselleri</legend>{template.items.map((item) => <label key={item.templateItemId} className="vm-option-row"><Checkbox checked={selectedItems.includes(item.templateItemId)} onCheckedChange={(checked) => setSelectedItems((current) => checked ? [...current, item.templateItemId] : current.filter((id) => id !== item.templateItemId))} /><span>{item.itemNo}. {item.itemText}</span>{selectedItems.includes(item.templateItemId) ? <Input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${item.itemText} referans görseli`} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) setFiles((current) => ({ ...current, [item.templateItemId]: file })) }} /> : null}</label>)}</fieldset> : null}
      <fieldset><legend>Mağaza kapsamı</legend><div className="vm-store-options">{stores.map((store) => <label key={store.storeId} className="vm-option-row"><Checkbox checked={selectedStores.includes(store.storeId)} onCheckedChange={(checked) => setSelectedStores((current) => checked ? [...current, store.storeId] : current.filter((id) => id !== store.storeId))} /><span>{store.storeName}</span></label>)}</div></fieldset>
      <div className="vm-window-fields"><label><span>Başlangıç</span><Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><label><span>Bitiş</span><Input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label></div>
      <label><span>Yayın notu</span><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Kampanya kapsamını açıklayın" /></label>
      <footer><Button type="button" variant="outline" onClick={input.onClose}>Vazgeç</Button><Button disabled={!complete || publish.isPending} type="submit">Referansı yayınla</Button></footer>
    </form> : null}
  </section>
}

function StoreManagerWorkspace(input: { allowed: boolean }) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<Record<string, Record<string, { file: File; captureSource: 'camera' | 'gallery' }>>>({})
  const [attestations, setAttestations] = useState<Record<string, boolean>>({})
  const [referenceUrls, setReferenceUrls] = useState<Record<string, string>>({})
  const objectUrls = useRef<string[]>([])
  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])
  const query = useQuery({ queryKey: ['vm-campaigns'], queryFn: getVmCampaigns, enabled: input.allowed })
  const submit = useMutation({
    mutationFn: async (assignment: VmCampaignAssignment) => {
      const selected = files[assignment.assignmentId] ?? {}
      if (assignment.items.some((item) => !selected[item.referenceItemId])) {
        throw new Error('Her kontrol maddesi için bir görsel seçin.')
      }
      const uploaded = []
      for (const item of assignment.items) {
        uploaded.push(await uploadVmEvidence({
          assignmentId: assignment.assignmentId,
          referenceItemId: item.referenceItemId,
          file: selected[item.referenceItemId]!.file,
          captureSource: selected[item.referenceItemId]!.captureSource,
          contentPolicyAttestation: attestations[assignment.assignmentId] === true,
        }))
      }
      return submitVmCampaign({ assignmentId: assignment.assignmentId,
        expectedVersion: assignment.version, items: uploaded })
    },
    onSuccess: async (_data, assignment) => {
      setFiles((current) => { const next = { ...current }; delete next[assignment.assignmentId]; return next })
      setAttestations((current) => { const next = { ...current }; delete next[assignment.assignmentId]; return next })
      await queryClient.invalidateQueries({ queryKey: ['vm-campaigns'] })
      actionToast.success('Denetim kanıtı gönderildi.')
    },
    onError: (error) => actionToast.error(error, 'Kanıt gönderilemedi.'),
  })
  const referenceRead = useMutation({ mutationFn: (payload: { assignmentId: string; referenceItemId: string }) => getVmReferenceReadUrl(payload),
    onSuccess: (data, payload) => { objectUrls.current.push(data.url); setReferenceUrls((current) => ({ ...current, [`${payload.assignmentId}:${payload.referenceItemId}`]: data.url })) },
    onError: (error) => actionToast.error(error, 'Referans görseli açılamadı.'),
  })
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items])
  const counts = useMemo(() => ({ open: items.filter((item) => item.deadlineStatus === 'open').length,
    done: items.filter((item) => item.deadlineStatus === 'on_time').length }), [items])
  const metricsUnavailable = input.allowed && (query.isPending || query.isError)
  return (
    <CommandCanvasPage ariaLabelledBy="vm-campaign-title" className="vm-campaign-page">
      <CommandCanvasPageHeader titleId="vm-campaign-title" eyebrow="VM denetimleri" title="Görsel kampanyalar"
        description="Mağazanıza atanan görsel standardı inceleyin ve süre içinde mağaza kanıtını gönderin." />
      <CommandCanvasMetricRail ariaLabel="VM kampanya özeti">
        <CommandCanvasMetric label="Atanan" value={metricsUnavailable ? '—' : String(items.length)} icon={<Layers3 />} tone="plum" />
        <CommandCanvasMetric label="Açık" value={metricsUnavailable ? '—' : String(counts.open)} icon={<CalendarClock />} tone="amber" />
        <CommandCanvasMetric label="Zamanında" value={metricsUnavailable ? '—' : String(counts.done)} icon={<ShieldCheck />} tone="mint" />
      </CommandCanvasMetricRail>
      {!input.allowed ? <SurfaceState empty emptyCopy="Bu yüzey yalnız Mağaza Müdürü içindir." /> : null}
      <SurfaceState loading={input.allowed && query.isPending} error={input.allowed ? query.error : undefined}
        empty={input.allowed && items.length === 0} emptyCopy="Atanmış görsel kampanya yok."
        onRetry={() => void query.refetch()} retrying={query.isFetching} />
      <div className="vm-campaign-list">{items.map((assignment) => <article key={assignment.assignmentId}>
        <header><div><span>{assignment.storeName}</span><h2>{assignment.referenceName}</h2></div><strong data-status={assignment.deadlineStatus}>{statusLabel(assignment.deadlineStatus)}</strong></header>
        <p>{formatWindow(assignment.startsAt, assignment.submissionClosesAt)}</p>
        {assignment.items.map((item) => <div key={item.referenceItemId} className="vm-evidence-picker">
          <span><b>{item.expectedVisualIntent}</b><small>{item.reviewInstructions}</small></span>
          {referenceUrls[`${assignment.assignmentId}:${item.referenceItemId}`] ? <img className="vm-reference-preview" src={referenceUrls[`${assignment.assignmentId}:${item.referenceItemId}`]} alt={`${item.expectedVisualIntent} referans görünümü`} /> : <Button type="button" size="sm" variant="outline" disabled={referenceRead.isPending} onClick={() => referenceRead.mutate({ assignmentId: assignment.assignmentId, referenceItemId: item.referenceItemId })}>Referansı görüntüle</Button>}
          <div className="vm-capture-actions">
            <label><span>Fotoğraf çek</span><input accept="image/jpeg,image/png,image/webp" aria-label={`${item.expectedVisualIntent} için fotoğraf çek`} disabled={assignment.deadlineStatus !== 'open' || submit.isPending} type="file" capture="environment"
              onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) setFiles((current) => ({ ...current,
                [assignment.assignmentId]: { ...(current[assignment.assignmentId] ?? {}), [item.referenceItemId]: { file, captureSource: 'camera' } } })) }} /></label>
            <label><span>Galeriden seç</span><input accept="image/jpeg,image/png,image/webp" aria-label={`${item.expectedVisualIntent} için galeriden seç`} disabled={assignment.deadlineStatus !== 'open' || submit.isPending} type="file"
              onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) setFiles((current) => ({ ...current,
                [assignment.assignmentId]: { ...(current[assignment.assignmentId] ?? {}), [item.referenceItemId]: { file, captureSource: 'gallery' } } })) }} /></label>
          </div>
          <small>Yalnız reyon ve ürün görünümü yükleyin; kişi, belge, ekran veya plaka eklemeyin.</small>
        </div>)}
        {assignment.deadlineStatus === 'open' ? <label className="vm-content-attestation">
          <Checkbox checked={attestations[assignment.assignmentId] === true}
            onCheckedChange={(checked) => setAttestations((current) => ({ ...current, [assignment.assignmentId]: checked === true }))} />
          <span>Görsellerin yalnız reyon ve ürün içerdiğini; kişi, belge, ekran veya plaka içermediğini onaylıyorum.</span>
        </label> : null}
        {assignment.deadlineStatus === 'open' ? <Button disabled={submit.isPending || attestations[assignment.assignmentId] !== true || assignment.items.some((item) => !files[assignment.assignmentId]?.[item.referenceItemId])}
          onClick={() => submit.mutate(assignment)}>Kanıtları gönder</Button> : null}
      </article>)}</div>
    </CommandCanvasPage>
  )
}

function SurfaceState(input: { loading?: boolean; error?: unknown; empty?: boolean; emptyCopy: string; onRetry?: () => void; retrying?: boolean }) {
  if (input.loading) return <div className="vm-surface-state" role="status">Veriler hazırlanıyor…</div>
  if (input.error) return <div className="vm-surface-state vm-surface-error" role="alert">
    <span>{getUserFacingErrorMessage(input.error, 'Veri alınamadı.')}</span>
    {input.onRetry ? <Button type="button" size="sm" variant="outline" disabled={input.retrying} onClick={input.onRetry}>
      <RefreshCcw data-icon="inline-start" />{input.retrying ? 'Yeniden deneniyor…' : 'Yeniden dene'}
    </Button> : null}
  </div>
  if (input.empty) return <div className="vm-surface-state">{input.emptyCopy}</div>
  return null
}

function statusLabel(status: string) {
  return ({
    draft: 'Taslak', scheduled: 'Planlandı', open: 'Açık', closed: 'Kapandı', on_time: 'Zamanında',
    late: 'Gecikmeli', missed: 'Süresi geçti', operational_hold: 'Beklemede', exempt: 'Muaf',
    withdrawn: 'Kapsamdan çıkarıldı', retired: 'Arşivlendi',
  } as Record<string, string>)[status] ?? status.replaceAll('_', ' ')
}
function formatWindow(start: string, end: string) { return `${new Date(start).toLocaleString('tr-TR')} – ${new Date(end).toLocaleString('tr-TR')}` }
