import { forwardRef, useRef, useState } from 'react'
import {
  Award,
  Crown,
  Download,
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

function slugifyFilePart(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'personel'
}

function buildShareCardFileName(card: StoreMeShareCardViewModel) {
  const periodPart = card.periodKey.slice(0, 7) || 'donem'
  return `lufian-performans-karti-${slugifyFilePart(card.employeeName)}-${periodPart}.png`
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
  const cardRef = useRef<HTMLElement | null>(null)
  const [downloadState, setDownloadState] = useState<'idle' | 'working' | 'success' | 'error'>('idle')

  async function downloadPng() {
    if (!cardRef.current || !card.isAvailable) {
      return
    }

    setDownloadState('working')
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#050711',
      })
      const link = document.createElement('a')
      link.download = buildShareCardFileName(card)
      link.href = dataUrl
      link.click()
      setDownloadState('success')
    } catch {
      setDownloadState('error')
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setDownloadState('idle')
        }
      }}
    >
      <DialogContent className="store-me-share-dialog tw:max-w-[440px] tw:gap-4 tw:p-4 sm:tw:max-w-[480px]">
        <DialogHeader className="tw:flex-row tw:items-center tw:justify-between tw:space-y-0">
          <DialogTitle>{t('storeMe.shareCardTitle')}</DialogTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t('storeMe.shareCardClose')}>
            <X />
          </Button>
        </DialogHeader>

        {card.isAvailable ? (
          <div className="store-me-share-preview-shell">
            <StoreMeShareCardPreview card={card} t={t} ref={cardRef} />
          </div>
        ) : (
          <div className="store-me-share-unavailable" role="status">
            <strong>{t('storeMe.shareCardUnavailableTitle')}</strong>
            <p>{card.unavailableReason ?? t('storeMe.shareCardUnavailableCopy')}</p>
          </div>
        )}

        <div className="store-me-share-actions">
          <span aria-live="polite">
            {downloadState === 'success' ? t('storeMe.shareCardDownloadSuccess') : null}
            {downloadState === 'error' ? t('storeMe.shareCardDownloadError') : null}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('storeMe.shareCardClose')}
          </Button>
          <Button
            type="button"
            disabled={!card.isAvailable || downloadState === 'working'}
            onClick={downloadPng}
          >
            <Download data-icon="inline-start" />
            {t('storeMe.shareCardDownloadPng')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
