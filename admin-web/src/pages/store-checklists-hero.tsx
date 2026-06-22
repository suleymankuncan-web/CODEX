import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clock3,
  Store as StoreIcon,
} from 'lucide-react'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { getStaticCopy } from './store-checklists-logic'
import { ChecklistMetric } from './store-checklists-atoms'

export function StoreChecklistsHero(input: {
  canManageVisits: boolean
  heroAverageScore: number | null
  heroCompletedCount: number
  heroScopeLabel: string
  heroStoreCount: number
  heroWaitingCount: number
  locale: AppLocale
  periodLabel: string
  t: TranslateFunction
  vmOnlyVisitScope: boolean
}) {
  const {
    canManageVisits,
    heroAverageScore,
    heroCompletedCount,
    heroStoreCount,
    heroWaitingCount,
    locale,
    periodLabel,
    t,
    vmOnlyVisitScope,
  } = input

  return (
    <header className="store-checklists-flow-header">
      <div className="store-checklists-flow-topline">
        <div className="store-checklists-hero-copy">
          <h1>{getStaticCopy(locale, 'Checklist Akış Sayfası', 'Checklist Flow')}</h1>
          <p>
            {canManageVisits
              ? getStaticCopy(
                  locale,
                  'Bölge müdürünün mağaza checklist süreçlerini yönettiği akış ekranı.',
                  'Flow surface for managing store checklist operations.',
                )
              : getStaticCopy(
                  locale,
                  'Mağazana ait tamamlanan checklist sonuçları ve kabul bekleyen kayıtlar burada izlenir.',
                  'Completed checklist results and acknowledgement records for your store are tracked here.',
                )}
          </p>
        </div>
        <div className="store-checklists-header-actions">
          <div
            className="store-checklists-period-pill"
            aria-label={getStaticCopy(locale, 'Seçili dönem', 'Selected period')}
          >
            <CalendarDays aria-hidden="true" />
            <span>{periodLabel}</span>
          </div>
        </div>
      </div>

      <div className="store-checklists-command-metrics" aria-label={t('storeChecklists.summaryAria')}>
        <ChecklistMetric
          icon={<StoreIcon aria-hidden="true" />}
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Atanmış mağaza', 'Assigned stores')
              : t('storeChecklists.store')
          }
          note={
            canManageVisits
              ? vmOnlyVisitScope
                ? getStaticCopy(locale, 'VM görünümü', 'VM view')
                : getStaticCopy(locale, 'BM görünümü', 'BM view')
              : getStaticCopy(locale, 'Kabul kayıtları', 'Receipt records')
          }
          tone={heroStoreCount > 0 ? 'accent' : 'neutral'}
          value={formatNumber(heroStoreCount, locale)}
        />
        <ChecklistMetric
          icon={<CheckSquare aria-hidden="true" />}
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Checklist yapılan', 'Completed visits')
              : t('storeChecklists.acknowledged')
          }
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Bu ay', 'This month')
              : getStaticCopy(locale, 'Geçmiş', 'History')
          }
          tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}
          value={formatNumber(heroCompletedCount, locale)}
        />
        <ChecklistMetric
          icon={<Clock3 aria-hidden="true" />}
          label={getStaticCopy(locale, 'Checklist Bekleyen', 'Waiting checklists')}
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Bu ay yapılmayan', 'Not completed this month')
              : t('storeChecklists.needsAcknowledgement')
          }
          tone={heroWaitingCount > 0 ? 'warning' : 'calm'}
          value={formatNumber(heroWaitingCount, locale)}
        />
        <ChecklistMetric
          icon={<BarChart3 aria-hidden="true" />}
          label={getStaticCopy(locale, 'Ortalama skor', 'Average score')}
          note={
            canManageVisits
              ? vmOnlyVisitScope
                ? getStaticCopy(locale, 'VM', 'VM')
                : getStaticCopy(locale, 'BM + VM', 'BM + VM')
              : getStaticCopy(locale, 'Son sonuçlar', 'Latest results')
          }
          tone={
            heroAverageScore !== null && heroAverageScore >= 70
              ? 'calm'
              : heroAverageScore === null
                ? 'neutral'
                : 'warning'
          }
          value={
            heroAverageScore === null
              ? '-'
              : formatNumber(heroAverageScore, locale, { maximumFractionDigits: 1 })
          }
        />
      </div>
    </header>
  )
}
