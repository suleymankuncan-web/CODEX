import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Eye } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { Sheet, SheetHeader, SheetTitle } from '../../components/ui/sheet'
import { Textarea } from '../../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
  CommandCanvasConfirmationContent,
  CommandCanvasMetric,
  CommandCanvasMetricFilter,
  CommandCanvasMetricRail,
  CommandCanvasOperationalDrawerContent,
  CommandCanvasPage,
  CommandCanvasPageHeader,
} from '../store-command-canvas/primitives'
import { actionToast } from '../../lib/action-toast'
import { ApiError } from '../../lib/api'
import {
  getVisualAdvisories,
  getVisualAdvisory,
  getVisualAdvisoryImage,
  reviewVisualAdvisory,
  type VisualAdvisory,
} from './api'

type ReviewDecision = 'accept' | 'override' | 'reject' | 'recapture'
type AdvisoryFilter = 'all' | 'waiting' | 'manual' | 'reviewed'

export function RegionManagerAdvisoryWorkspace() {
  const queryClient = useQueryClient()
  const selectedRowRef = useRef<HTMLButtonElement | null>(null)
  const reviewButtonRef = useRef<HTMLButtonElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [decision, setDecision] = useState<ReviewDecision>('accept')
  const [finalDecision, setFinalDecision] = useState<'pass' | 'partial' | 'fail'>('partial')
  const [reason, setReason] = useState('')
  const [filter, setFilter] = useState<AdvisoryFilter>('all')
  const closeReview = () => {
    setReviewOpen(false)
    requestAnimationFrame(() => reviewButtonRef.current?.focus())
  }
  const list = useQuery({ queryKey: ['visual-advisories'], queryFn: getVisualAdvisories })
  const detail = useQuery({
    queryKey: ['visual-advisory', selectedId],
    queryFn: () => getVisualAdvisory(selectedId!),
    enabled: Boolean(selectedId),
  })
  const review = useMutation({
    mutationFn: () => reviewVisualAdvisory({
      comparisonRunId: selectedId!, decision, reason,
      ...(decision === 'override' ? { finalDecision } : {}),
    }),
    onSuccess: async () => {
      closeReview()
      setReason('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['visual-advisories'] }),
        queryClient.invalidateQueries({ queryKey: ['visual-advisory', selectedId] }),
      ])
      actionToast.success('Bölge değerlendirmesi kaydedildi.')
    },
    onError: (error) => actionToast.error(
      error,
      error instanceof ApiError && error.status === 409
        ? 'Bu öneri daha önce farklı bir kararla değerlendirildi. Listeyi yenileyip tekrar kontrol edin.'
        : 'Değerlendirme kaydedilemedi.',
    ),
  })
  const items = useMemo(() => list.data?.items ?? [], [list.data?.items])
  const waiting = items.filter((item) => !item.reviewed && item.status === 'completed').length
  const manual = items.filter((item) => !item.reviewed && item.status !== 'completed').length
  const reviewed = items.filter((item) => item.reviewed).length
  const visibleItems = items.filter((item) => {
    if (filter === 'waiting') return !item.reviewed && item.status === 'completed'
    if (filter === 'manual') return !item.reviewed && item.status !== 'completed'
    if (filter === 'reviewed') return item.reviewed
    return true
  })
  const listFailure = list.error instanceof ApiError ? list.error.status : null

  return <CommandCanvasPage ariaLabelledBy="visual-advisory-title" className="vm-campaign-page">
    <CommandCanvasPageHeader titleId="visual-advisory-title" eyebrow="Bölge denetimi"
      title="Görsel denetim önerileri"
      description="Otomatik öneriyi mağaza kanıtıyla birlikte inceleyin; nihai karar her zaman sizdedir." />
    <CommandCanvasMetricRail ariaLabel="Görsel denetim özeti">
      <CommandCanvasMetric label="Toplam" value={String(items.length)} icon={<ClipboardCheck />} />
      <CommandCanvasMetricFilter label="İnceleme bekliyor" value={String(waiting)} icon={<Eye />} tone="amber"
        active={filter === 'waiting'} onClick={() => setFilter((value) => value === 'waiting' ? 'all' : 'waiting')} />
      <CommandCanvasMetricFilter label="Manuel karar" value={String(manual)} icon={<AlertTriangle />} tone="rose"
        active={filter === 'manual'} onClick={() => setFilter((value) => value === 'manual' ? 'all' : 'manual')} />
      <CommandCanvasMetricFilter label="İncelendi" value={String(reviewed)} icon={<CheckCircle2 />} tone="mint"
        active={filter === 'reviewed'} onClick={() => setFilter((value) => value === 'reviewed' ? 'all' : 'reviewed')} />
    </CommandCanvasMetricRail>
    <p className="vm-advisory-notice"><AlertTriangle aria-hidden="true" /> Bu öneri mağaza sonucunu veya puanını otomatik değiştirmez.</p>
    {list.isPending ? <div className="vm-surface-state" role="status">Öneriler hazırlanıyor…</div> : null}
    {list.error ? <div className="vm-surface-state vm-surface-error" role="alert">
      <span>{listFailure === 503 ? 'Görsel öneri pilotu şu anda kapalı.' : listFailure === 401 || listFailure === 403
        ? 'Bu çalışma alanına erişim yetkiniz yok.' : 'Öneriler alınamadı.'}</span>
      {listFailure !== 401 && listFailure !== 403 && listFailure !== 503
        ? <Button variant="outline" onClick={() => void list.refetch()}>Yeniden dene</Button> : null}
    </div> : null}
    {!list.isPending && !list.error && items.length === 0 ? <div className="vm-surface-state">İncelenecek öneri yok.</div> : null}
    {!list.isPending && !list.error && items.length > 0 && visibleItems.length === 0
      ? <div className="vm-surface-state">Bu filtreyle eşleşen öneri yok. <Button variant="outline" onClick={() => setFilter('all')}>Filtreyi temizle</Button></div>
      : null}
    <div className="vm-advisory-list" aria-live="polite">
      {visibleItems.map((item) => <button key={item.comparisonRunId} type="button" onClick={(event) => {
        selectedRowRef.current = event.currentTarget
        setSelectedId(item.comparisonRunId)
      }}>
        <span><small>{item.storeName}</small><b>{item.referenceName}</b></span>
        <span><strong data-decision={item.suggestion ?? 'manual'}>{decisionLabel(item.suggestion)}</strong>
          <small>{item.reviewed ? 'İncelendi' : confidenceLabel(item)}</small></span>
      </button>)}
    </div>
    <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) {
      setSelectedId(null)
      requestAnimationFrame(() => selectedRowRef.current?.focus())
    } }}>
      <CommandCanvasOperationalDrawerContent className="vm-advisory-drawer">
        <SheetHeader><SheetTitle>{detail.data?.storeName ?? 'Görsel denetim'}</SheetTitle></SheetHeader>
        {detail.isPending ? <div className="vm-surface-state">Detay hazırlanıyor…</div> : null}
        {detail.error ? <div className="vm-surface-state vm-surface-error" role="alert">Detay alınamadı.
          <Button variant="outline" onClick={() => void detail.refetch()}>Yeniden dene</Button>
        </div> : null}
        {detail.data ? <AdvisoryDetail item={detail.data} /> : null}
        {detail.data && !detail.data.reviewed ? <Button ref={reviewButtonRef} onClick={() => {
          setDecision(detail.data!.acceptAllowed ? 'accept' : 'recapture')
          setReviewOpen(true)
        }}><ClipboardCheck /> Karar ver</Button> : null}
      </CommandCanvasOperationalDrawerContent>
    </Sheet>
    <Dialog open={reviewOpen} onOpenChange={(open) => { if (open) setReviewOpen(true); else closeReview() }}>
      <CommandCanvasConfirmationContent>
        <DialogHeader><DialogTitle>Bölge değerlendirmesi</DialogTitle></DialogHeader>
        <div className="vm-advisory-review-form">
          <label><span>Karar</span><Select value={decision} onValueChange={(value) => setDecision(value as ReviewDecision)}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              {detail.data?.acceptAllowed ? <SelectItem value="accept">Öneriyi kabul et</SelectItem> : null}
              <SelectItem value="override">Kararı değiştir</SelectItem>
              <SelectItem value="reject">Öneriyi reddet</SelectItem>
              <SelectItem value="recapture">Yeni fotoğraf iste</SelectItem>
            </SelectContent></Select></label>
          {decision === 'override' ? <label><span>Nihai sonuç</span><Select value={finalDecision} onValueChange={(value) => setFinalDecision(value as typeof finalDecision)}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="pass">Uygun</SelectItem><SelectItem value="partial">Kısmen uygun</SelectItem><SelectItem value="fail">Uygun değil</SelectItem>
            </SelectContent></Select></label> : null}
          <label><span>Değerlendirme notu</span><Textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={closeReview}>Vazgeç</Button>
          <Button disabled={!reason.trim() || review.isPending} onClick={() => review.mutate()}>Kararı kaydet</Button></DialogFooter>
      </CommandCanvasConfirmationContent>
    </Dialog>
  </CommandCanvasPage>
}

function AdvisoryDetail({ item }: { item: VisualAdvisory }) {
  const [images, setImages] = useState<{ reference?: string; evidence?: string }>({})
  const [imageAttempt, setImageAttempt] = useState(0)
  const [imageError, setImageError] = useState(false)
  useEffect(() => {
    let active = true
    const urls: string[] = []
    Promise.all([
      getVisualAdvisoryImage(item.comparisonRunId, 'reference'),
      getVisualAdvisoryImage(item.comparisonRunId, 'evidence'),
    ]).then(([reference, evidence]) => {
      urls.push(reference, evidence)
      if (active) { setImages({ reference, evidence }); setImageError(false) }
    }).catch(() => { if (active) { setImages({}); setImageError(true) } })
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [item.comparisonRunId, imageAttempt])
  return <div className="vm-advisory-detail">
    <p className="vm-advisory-notice"><AlertTriangle aria-hidden="true" /> Öneri bilgilendirme amaçlıdır; puanı otomatik değiştirmez.</p>
    <div className="vm-advisory-images">
      <figure>{images.reference ? <img src={images.reference} alt="Referans mağaza görünümü" /> : <span>Referans hazırlanıyor…</span>}<figcaption>Referans</figcaption></figure>
      <figure>{images.evidence ? <img src={images.evidence} alt="Mağaza kanıt görünümü" /> : <span>Kanıt hazırlanıyor…</span>}<figcaption>Mağaza kanıtı</figcaption></figure>
    </div>
    {imageError ? <div className="vm-surface-state vm-surface-error" role="alert">Görsellerin bir bölümü alınamadı.
      <Button variant="outline" onClick={() => setImageAttempt((value) => value + 1)}>Yeniden dene</Button>
    </div> : null}
    <section><small>Öneri</small><h3>{decisionLabel(item.suggestion)}</h3><p>{confidenceLabel(item)}</p></section>
    <section><small>Değerlendirme zamanı</small><p>{item.finishedAt ? new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(item.finishedAt)) : 'Henüz tamamlanmadı'}</p></section>
    {item.criterion ? <section><small>Kontrol ölçütü</small><p>{item.criterion}</p></section> : null}
    {item.dimensions.length ? <section><small>Ölçüt sonuçları</small><div className="vm-advisory-dimensions">
      {item.dimensions.map((dimension) => <div key={dimension.key}>
        <b>{labelCode(dimension.key)}</b>
        <span>{dimension.score === null ? 'Manuel inceleme' : `%${Math.round(dimension.score)}`}</span>
        <p>{dimension.explanation}</p>
      </div>)}
    </div></section> : null}
    {item.qualityFlags.length ? <section><small>Görüntü uyarıları</small><p>{item.qualityFlags.map(labelCode).join(', ')}</p></section> : null}
    {item.modelLimitations.length ? <section><small>Sınırlamalar</small><p>{item.modelLimitations.map(labelCode).join(', ')}</p></section> : null}
    {item.review ? <section><small>Bölge kararı</small><p>{item.review.reason}</p></section> : null}
  </div>
}

function decisionLabel(value: VisualAdvisory['suggestion']) {
  return ({ pass: 'Uygun', partial: 'Kısmen uygun', fail: 'Uygun değil', abstain: 'Manuel inceleme', recapture_required: 'Yeni fotoğraf gerekli' } as const)[value ?? 'abstain']
}
function confidenceLabel(item: VisualAdvisory) { return item.confidence === null ? 'Manuel değerlendirme' : `%${Math.round(item.confidence * 100)} güven` }
function labelCode(value: string) { return value.replaceAll('_', ' ') }
