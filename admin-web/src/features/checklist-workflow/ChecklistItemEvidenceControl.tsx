import { useEffect, useRef, useState } from 'react'
import { Camera, Eye, ImagePlus, LoaderCircle, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  finalizeApprovedSyntheticMobileChecklistItemEvidence,
  getMobileChecklistItemEvidenceContent,
  linkMobileChecklistItemEvidence,
  saveMobileChecklistResponse,
  unlinkMobileChecklistItemEvidence,
  uploadApprovedSyntheticMobileChecklistItemEvidence,
  type MobileChecklistToday,
  type ChecklistItemEvidenceProjection,
} from '../checklists/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import { canSelectSyntheticChecklistFixture } from './checklist-item-evidence-model'

type EvidenceItem = MobileChecklistToday['activeInstances'][number]['evidence'][number]

export function ChecklistItemEvidenceControl(input: {
  active: MobileChecklistToday['activeInstances'][number]
  comment?: string
  captureAvailable: boolean
  disabled: boolean
  maxEvidenceCount: number
  policy: 'none' | 'optional' | 'required'
  score: number | undefined
  templateItemId: string
  evidence: EvidenceItem[]
  evidenceVersion: number
  onProjectionChange: (projection: ChecklistItemEvidenceProjection) => void
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'uploading' | 'processing' | 'linking'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryFile, setRetryFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const busy = state !== 'idle'
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])
  const canSelectFixture = canSelectSyntheticChecklistFixture({
    disabled: input.disabled || !input.captureAvailable,
    busy,
    evidenceCount: input.evidence.length,
    maxEvidenceCount: input.maxEvidenceCount,
  })

  if (input.policy === 'none') return null

  const upload = async (file: File) => {
    setError(null)
    setRetryFile(file)
    if (!Number.isFinite(input.score)) {
      setError('Kanıt eklemeden önce bu maddeyi yanıtlayın.')
      return
    }
    try {
      setState('saving')
      await saveMobileChecklistResponse({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        scoreValue: input.score!,
        ...(input.comment ? { commentText: input.comment } : {}),
      })
      setState('uploading')
      const uploaded = await uploadApprovedSyntheticMobileChecklistItemEvidence({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        file,
      })
      setState('processing')
      await finalizeApprovedSyntheticMobileChecklistItemEvidence({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        mediaAssetId: uploaded.mediaAssetId,
      })
      setState('linking')
      const linked = await linkMobileChecklistItemEvidence({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        mediaAssetId: uploaded.mediaAssetId,
        expectedEvidenceVersion: input.evidenceVersion,
        idempotencyKey: crypto.randomUUID(),
      })
      input.onProjectionChange(linked.data.evidence)
      setRetryFile(null)
    } catch (cause) {
      setError(getUserFacingErrorMessage(cause, 'Kanıt yüklenemedi. Yalnız onaylı sentetik test görseli kullanılabilir.'))
    } finally {
      setState('idle')
    }
  }

  const remove = async (item: EvidenceItem) => {
    setError(null)
    try {
      setState('linking')
      const unlinked = await unlinkMobileChecklistItemEvidence({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        mediaAssetId: item.mediaAssetId,
        expectedEvidenceVersion: input.evidenceVersion,
        idempotencyKey: crypto.randomUUID(),
        reason: 'Kullanıcı checklist tamamlanmadan önce kanıtı kaldırdı.',
      })
      input.onProjectionChange(unlinked.data.evidence)
      setPreviewUrl(null)
    } catch (cause) {
      setError(getUserFacingErrorMessage(cause, 'Kanıt kaldırılamadı.'))
    } finally {
      setState('idle')
    }
  }

  const preview = async (item: EvidenceItem) => {
    setError(null)
    try {
      const content = await getMobileChecklistItemEvidenceContent({
        checklistInstanceId: input.active.checklistInstanceId,
        templateItemId: input.templateItemId,
        mediaAssetId: item.mediaAssetId,
        variant: 'thumbnail',
      })
      setPreviewUrl(URL.createObjectURL(content))
    } catch (cause) {
      setError(getUserFacingErrorMessage(cause, 'Kanıt önizlemesi açılamadı.'))
    }
  }

  return (
    <section className="tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-3" aria-label="Fotoğraf kanıtı">
      <div className="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-2">
        <div>
          <strong className="tw:text-sm tw:text-foreground">Denetim kanıtı</strong>
          <p className="tw:mt-0.5 tw:text-xs tw:text-muted-foreground">
            {input.policy === 'required' ? 'Tamamlamak için en az bir hazır görsel gerekli.' : 'İsterseniz bu maddeye görsel ekleyebilirsiniz.'}
          </p>
        </div>
        <span className="tw:rounded-full tw:border tw:border-border tw:bg-background tw:px-2 tw:py-1 tw:text-xs tw:font-semibold">
          {input.evidence.length}/{input.maxEvidenceCount}
        </span>
      </div>

      <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
        <Button type="button" size="sm" variant="outline" disabled title="Gerçek fotoğraf izni henüz açık değil">
          <Camera data-icon="inline-start" /> Kamera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSelectFixture}
          onClick={() => galleryInputRef.current?.click()}
        >
          <ImagePlus data-icon="inline-start" /> Sentetik test görseli seç
        </Button>
        <input
          ref={galleryInputRef}
          className="tw:sr-only"
          type="file"
          aria-label="Sentetik checklist kanÄ±t gÃ¶rseli seÃ§"
          accept="image/jpeg,image/png,image/webp"
          disabled={!canSelectFixture}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void upload(file)
          }}
        />
        {retryFile && !busy ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void upload(retryFile)}>
            <RefreshCcw data-icon="inline-start" /> Tekrar dene
          </Button>
        ) : null}
      </div>
      {!input.captureAvailable ? (
        <p className="tw:mt-2 tw:text-xs tw:text-muted-foreground" role="status">
          Fotoğraf kanıtı şu anda kapalı; mevcut taslak ve zorunlu politika korunur.
        </p>
      ) : null}

      {busy ? (
        <p className="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground" role="status" aria-live="polite">
          <LoaderCircle className="tw:size-4 tw:animate-spin" />
          {state === 'saving' ? 'Yanıt kaydediliyor…' : state === 'uploading' ? 'Görsel yükleniyor…' : state === 'processing' ? 'Görsel güvenle işleniyor…' : 'Kanıt bağlanıyor…'}
        </p>
      ) : null}
      {error ? <p className="tw:mt-3 tw:text-xs tw:font-medium tw:text-destructive" role="alert">{error}</p> : null}

      {input.evidence.length > 0 ? (
        <ul className="tw:mt-3 tw:grid tw:gap-2">
          {input.evidence.map((item, index) => (
            <li key={item.mediaAssetId} className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:p-2">
              <span className="tw:text-xs tw:font-medium">Kanıt {index + 1} · Hazır</span>
              <span className="tw:flex tw:gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Kanıt ${index + 1} önizle`} onClick={() => void preview(item)}><Eye /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Kanıt ${index + 1} kaldır`} disabled={busy} onClick={() => void remove(item)}><Trash2 /></Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {previewUrl ? <img className="tw:mt-3 tw:max-h-48 tw:w-full tw:rounded-lg tw:border tw:border-border tw:object-contain" src={previewUrl} alt="Denetim kanıtı önizlemesi" /> : null}
    </section>
  )
}
