import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Camera, CheckCircle2, RotateCcw, Send, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { actionToast } from '../../lib/action-toast'
import {
  finalizeStoreActionSolutionEvidence,
  getStoreActionPhotoReview,
  getStoreActionSolutionEvidenceContent,
  reviewStoreActionSolution,
  submitStoreActionSolution,
  uploadStoreActionSolutionEvidence,
} from './api'

type Plan = {
  actionPlanId: string
  status: string
  photoEvidenceVersion: number
  currentSolutionAttemptId: string | null
  resolutionWorkflowVersion: number
}
type PhotoReviewProjection = {
  actionPlanId: string
  status: string
  version: number
  currentAttemptId: string | null
  findingMediaAssetIds: string[]
  attempts: Array<{
    attemptId: string
    attemptNo: number
    resolutionNote: string
    submittedAt: string
    mediaAssetIds: string[]
    review: null | { decision: 'approve' | 'reject'; reason: string | null; reviewedAt: string }
  }>
}

export function StoreActionPhotoReviewControl(input: {
  plan: Plan
  view: 'store_manager' | 'region_manager' | 'report_viewer'
  canReview: boolean
  onChanged: () => Promise<void>
}) {
  if (input.plan.resolutionWorkflowVersion !== 2 || input.view === 'report_viewer') return null
  return input.view === 'store_manager'
    ? <StoreManagerSubmission {...input} />
    : <RegionManagerReview {...input} />
}

function StoreManagerSubmission(input: {
  plan: Plan; onChanged: () => Promise<void>
}) {
  const fileId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const retryRef = useRef<null | {
    fingerprint: string; idempotencyKey: string; mediaAssetId?: string; finalized: boolean
  }>(null)
  const canSubmitState = ['open', 'in_progress', 'blocked', 'correction_required'].includes(input.plan.status)
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file || !note.trim()) throw new Error('Çözüm notu ve onaylı kanıt görseli zorunludur.')
      const fingerprint = [input.plan.photoEvidenceVersion, file.name, file.size, file.lastModified, note.trim()].join(':')
      if (retryRef.current?.fingerprint !== fingerprint) {
        retryRef.current = { fingerprint, idempotencyKey: crypto.randomUUID(), finalized: false }
      }
      const retry = retryRef.current
      if (!retry.mediaAssetId) {
        const upload = await uploadStoreActionSolutionEvidence({ actionPlanId: input.plan.actionPlanId, file })
        retry.mediaAssetId = upload.mediaAssetId
      }
      if (!retry.finalized) {
        await finalizeStoreActionSolutionEvidence({ actionPlanId: input.plan.actionPlanId, mediaAssetId: retry.mediaAssetId })
        retry.finalized = true
      }
      return submitStoreActionSolution({
        actionPlanId: input.plan.actionPlanId,
        body: {
          resolutionNote: note.trim(), mediaAssetId: retry.mediaAssetId,
          expectedVersion: input.plan.photoEvidenceVersion, idempotencyKey: retry.idempotencyKey,
        },
      })
    },
    onSuccess: async () => {
      actionToast.success('Çözüm Bölge Müdürü incelemesine gönderildi')
      retryRef.current = null
      setFile(null); setNote(''); await input.onChanged()
    },
    onError: (error) => actionToast.error(error, 'Çözüm gönderilemedi.'),
  })
  if (input.plan.status === 'solution_review_pending') {
    return <div className="tasks-command-photo-state" role="status"><ShieldCheck /><div><b>İnceleme bekliyor</b><span>Görev yalnız Bölge Müdürü onayından sonra kapanır.</span></div></div>
  }
  if (!canSubmitState) return null
  return <section className="tasks-command-photo-review" aria-labelledby={`${fileId}-title`}>
    <div className="tasks-command-photo-heading"><Camera /><div><h3 id={`${fileId}-title`}>Fotoğraflı çözüm bildirimi</h3><p>Gerçek fotoğraf pilotu kapalıdır; bu aşamada yalnız sistemin onaylı sentetik test görseli kabul edilir.</p></div></div>
    <label htmlFor={fileId}>Çözüm kanıtı</label>
    <Input id={fileId} type="file" accept="image/jpeg,image/png,image/webp" disabled={mutation.isPending} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <label>Çözüm notu<Textarea value={note} maxLength={500} disabled={mutation.isPending} onChange={(event) => setNote(event.target.value)} /></label>
    <Button disabled={!file || !note.trim() || mutation.isPending} onClick={() => mutation.mutate()}><Send data-icon="inline-start" />{mutation.isPending ? 'Gönderiliyor…' : input.plan.status === 'correction_required' ? 'Düzeltmeyi yeniden gönder' : 'İncelemeye gönder'}</Button>
  </section>
}

function RegionManagerReview(input: {
  plan: Plan; canReview: boolean; onChanged: () => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const retryRef = useRef<null | { fingerprint: string; idempotencyKey: string }>(null)
  const query = useQuery({
    queryKey: ['store-action-photo-review', input.plan.actionPlanId],
    queryFn: () => getStoreActionPhotoReview({ actionPlanId: input.plan.actionPlanId }),
    enabled: input.plan.status === 'solution_review_pending',
  })
  const projection = query.data as PhotoReviewProjection | undefined
  const current = projection?.attempts?.find((attempt) => attempt.attemptId === projection.currentAttemptId)
  const mutation = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => {
      const fingerprint = [current!.attemptId, decision, reason.trim(), projection!.version].join(':')
      if (retryRef.current?.fingerprint !== fingerprint) {
        retryRef.current = { fingerprint, idempotencyKey: crypto.randomUUID() }
      }
      return reviewStoreActionSolution({
        actionPlanId: input.plan.actionPlanId,
        solutionAttemptId: current!.attemptId,
        body: {
          solutionAttemptId: current!.attemptId, decision,
          ...(decision === 'reject' ? { reason: reason.trim() } : {}),
          expectedVersion: projection!.version, idempotencyKey: retryRef.current.idempotencyKey,
        },
      })
    },
    onSuccess: async (_data, decision) => {
      actionToast.success(decision === 'approve' ? 'Çözüm onaylandı ve görev kapandı' : 'Düzeltme istendi')
      retryRef.current = null
      setReason(''); await input.onChanged(); await query.refetch()
    },
    onError: (error) => actionToast.error(error, 'İnceleme kaydedilemedi.'),
  })
  if (input.plan.status !== 'solution_review_pending') return null
  if (query.isLoading) return <p role="status">Çözüm kanıtı yükleniyor…</p>
  if (query.isError || !current) return <div className="tasks-command-photo-state" role="alert"><XCircle /><div><b>Çözüm kanıtı açılamadı</b><Button variant="outline" onClick={() => void query.refetch()}>Tekrar dene</Button></div></div>
  return <section className="tasks-command-photo-review">
    <div className="tasks-command-photo-heading"><ShieldCheck /><div><h3>Çözüm incelemesi</h3><p>Güncel deneme #{current.attemptNo}. Eski denemeler korunur.</p></div></div>
    <div className="tasks-command-photo-comparison" aria-label="Bulgu ve çözüm kanıtı karşılaştırması">
      <EvidenceGroup title="Denetim bulgusu" emptyText="Bulgu görseli bulunmuyor" mediaAssetIds={projection?.findingMediaAssetIds ?? []} actionPlanId={input.plan.actionPlanId} />
      <EvidenceGroup title="Çözüm kanıtı" emptyText="Çözüm görseli bulunmuyor" mediaAssetIds={current.mediaAssetIds} actionPlanId={input.plan.actionPlanId} />
    </div>
    <blockquote>{current.resolutionNote}</blockquote>
    <label>Düzeltme nedeni<Textarea value={reason} maxLength={500} disabled={mutation.isPending} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="tasks-command-photo-actions"><Button disabled={!input.canReview || mutation.isPending} onClick={() => mutation.mutate('approve')}><CheckCircle2 data-icon="inline-start" />Onayla ve kapat</Button><Button variant="outline" disabled={!input.canReview || !reason.trim() || mutation.isPending} onClick={() => mutation.mutate('reject')}><RotateCcw data-icon="inline-start" />Düzeltme iste</Button></div>
  </section>
}

function EvidenceGroup(input: {
  title: string; emptyText: string; mediaAssetIds: string[]; actionPlanId: string
}) {
  return <section className="tasks-command-photo-comparison-group">
    <h4>{input.title}</h4>
    {input.mediaAssetIds.length > 0
      ? <div className="tasks-command-photo-evidence-grid">{input.mediaAssetIds.map((mediaAssetId) => <EvidenceThumbnail key={mediaAssetId} actionPlanId={input.actionPlanId} mediaAssetId={mediaAssetId} />)}</div>
      : <div className="tasks-command-photo-placeholder">{input.emptyText}</div>}
  </section>
}

function EvidenceThumbnail(input: { actionPlanId: string; mediaAssetId: string }) {
  const query = useQuery({
    queryKey: ['store-action-evidence-content', input.actionPlanId, input.mediaAssetId, 'thumbnail'],
    queryFn: () => getStoreActionSolutionEvidenceContent({ ...input, variant: 'thumbnail' }),
  })
  const url = useMemo(() => query.data ? URL.createObjectURL(query.data) : null, [query.data])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  if (query.isLoading) return <div className="tasks-command-photo-placeholder">Görsel yükleniyor…</div>
  if (!url) return <div className="tasks-command-photo-placeholder" role="alert">Görsel kullanılamıyor</div>
  return <img src={url} alt="Mağaza müdürünün çözüm kanıtı" />
}
