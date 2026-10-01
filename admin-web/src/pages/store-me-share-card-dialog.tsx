import { buildPerformanceCardFile, canSharePerformanceCard, downloadPerformanceCard } from './store-me-share-card-export'
import { forwardRef, useEffect, useRef, useState } from 'react'
import {
  Award,
  Crown,
  Download,
  Share2,
  Medal,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { StoreMePerformanceBadgeIcon } from './store-me-performance-badges'
import type { StoreMeShareCardViewModel } from './store-me-share-card-model'

type StoreMeShareCardDialogProps = {
  card: StoreMeShareCardViewModel
  isOpen: boolean
  onClose: () => void
  t: TranslateFunction
}

const badgeIconByName: Record<StoreMePerformanceBadgeIcon, typeof Trophy> = {
  crown: Crown,
  medal: Medal,
  podium: Award,
  'shield-check': ShieldCheck,
  target: Target,
  trophy: Trophy,
  'trending-up': TrendingUp,
}

export const StoreMeShareCardPreview = forwardRef<HTMLElement, {
  card: StoreMeShareCardViewModel
  t: TranslateFunction
}>(function StoreMeShareCardPreview({
  card,
  t,
}, ref) {
  const BadgeIcon = card.badge ? badgeIconByName[card.badge.icon] : Trophy

  return (
    <article ref={ref} className="store-me-share-card" data-testid="store-me-share-card-preview">
      <div className="store-me-share-card-aura" aria-hidden="true" />
      <header className="store-me-share-card-header">
        <span>
          <strong>LUFIAN</strong>
          <small>{t('storeMe.shareCardBrand')}</small>
        </span>
        <em>{card.periodLabel}</em>
      </header>

      <section className="store-me-share-score" aria-label={t('storeMe.performanceScore')}>
        <span className="store-me-share-score-ring" aria-hidden="true" />
        <div className="store-me-share-score-core">
          <small>{t('storeMe.shareCardScore')}</small>
          <strong>{card.score}</strong>
        </div>
      </section>

      {card.badge ? (
        <div className={`store-me-share-badge store-me-share-badge-${card.badge.tone}`}>
          <BadgeIcon aria-hidden="true" />
          <span>{card.badge.label}</span>
        </div>
      ) : null}

      <section className={`store-me-share-person${card.employeeName.length > 24 ? ' store-me-share-person-long' : ''}`}>
        <h2>{card.employeeName}</h2>
        <p>{card.storeName}</p>
      </section>

      <footer className="store-me-share-rank">
        <span className="store-me-share-rank-icon" aria-hidden="true">
          <Trophy />
        </span>
        <span>
          <small>{t('storeMe.shareCardTurkeyRank')}</small>
          <strong>#{card.turkeyRank} / {card.turkeyPopulation}</strong>
          {card.percentile ? (
            <em>{t('storeMe.shareCardPercentile', { value: card.percentile })}</em>
          ) : null}
        </span>
      </footer>
    </article>
  )
})

export function StoreMeShareCardDialog({
  card,
  isOpen,
  onClose,
  t,
}: StoreMeShareCardDialogProps) {
  const [cardElement, setCardElement] = useState<HTMLElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const downloadAttemptRef = useRef(0)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [downloadState, setDownloadState] = useState<'idle' | 'working' | 'success' | 'error'>('idle')

  function closeDialog() {
    downloadAttemptRef.current += 1
    setDownloadState('idle')
    setImageFile(null)
    onClose()
  }

  useEffect(() => {
    if (!isOpen || !card.isAvailable || !cardElement) return
    const element = cardElement
    const attempt = ++downloadAttemptRef.current
    void (async () => {
      try {
        const { toBlob } = await import('html-to-image')
        if (attempt !== downloadAttemptRef.current) return
        setImageFile(null)
        setDownloadState('working')
        const blob = await toBlob(element, { cacheBust: true, pixelRatio: 3, backgroundColor: '#050711' })
        if (attempt !== downloadAttemptRef.current) return
        if (!blob) throw new Error('PNG image unavailable')
        setImageFile(buildPerformanceCardFile(blob, card.employeeName, card.periodKey))
        setDownloadState('idle')
      } catch {
        if (attempt === downloadAttemptRef.current) setDownloadState('error')
      }
    })()
    return () => { downloadAttemptRef.current += 1 }
  }, [isOpen, card, cardElement])

  function downloadPng() {
    if (!imageFile || downloadState === 'working') return
    downloadPerformanceCard(imageFile)
    setDownloadState('success')
  }

  async function shareImage() {
    if (!imageFile || downloadState === 'working') return
    // Image generation completed before this click, preserving native user activation.
    const attempt = downloadAttemptRef.current
    setDownloadState('working')
    try {
      await navigator.share({ files: [imageFile] })
      if (attempt === downloadAttemptRef.current) setDownloadState('idle')
    } catch (error) {
      if (attempt === downloadAttemptRef.current) setDownloadState(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'error')
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeDialog()
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="store-me-share-dialog tw:max-w-[440px] tw:gap-4 tw:p-4 sm:tw:max-w-[480px]"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current?.focus()
        }}
      >
        <DialogHeader className="tw:flex-row tw:items-center tw:justify-between tw:space-y-0">
          <DialogTitle>{t('storeMe.shareCardTitle')}</DialogTitle>
          <Button type="button" variant="ghost" size="icon" onClick={closeDialog} aria-label={t('storeMe.shareCardClose')}>
            <X />
          </Button>
        </DialogHeader>

        {card.isAvailable ? (
          <div className="store-me-share-preview-shell">
            <StoreMeShareCardPreview card={card} t={t} ref={setCardElement} />
          </div>
        ) : (
          <div className="store-me-share-unavailable" role="status">
            <strong>{t('storeMe.shareCardUnavailableTitle')}</strong>
            <p>{card.unavailableReason ?? t('storeMe.shareCardUnavailableCopy')}</p>
          </div>
        )}

        <div className="store-me-share-actions">
          <span aria-live="polite">
            {downloadState === 'working' && !imageFile ? t('storeMe.shareCardPreparing') : null}
            {downloadState === 'success' ? t('storeMe.shareCardDownloadSuccess') : null}
            {downloadState === 'error' ? t('storeMe.shareCardDownloadError') : null}
          </span>
          <Button type="button" variant="outline" onClick={closeDialog}>
            {t('storeMe.shareCardClose')}
          </Button>
          <Button
            type="button"
            disabled={!imageFile || downloadState === 'working'}
            onClick={downloadPng}
          >
            <Download data-icon="inline-start" />
            {t('storeMe.shareCardDownloadPng')}
          </Button>
          {imageFile && canSharePerformanceCard(imageFile) ? <Button type="button" disabled={downloadState === 'working'} onClick={shareImage}><Share2 data-icon="inline-start" />{t('storeMe.shareCardShareImage')}</Button> : null}
        </div>
        {card.isAvailable ? <p className="tw:m-0 tw:text-xs tw:text-muted-foreground">{t('storeMe.shareCardSavePhotoHint')}</p> : null}
      </DialogContent>
    </Dialog>
  )
}
