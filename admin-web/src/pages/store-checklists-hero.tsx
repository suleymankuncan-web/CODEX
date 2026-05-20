import type { TranslateFunction } from '../features/localization/dictionary'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { getStaticCopy } from './store-checklists-logic'
import { ChecklistBadge, ChecklistMetric } from './store-checklists-atoms'

export function StoreChecklistsHero(input: {
  canManageVisits: boolean
  heroAverageScore: number | null
  heroCompletedCount: number
  heroScopeLabel: string
  heroStoreCount: number
  heroWaitingCount: number
  locale: AppLocale
  t: TranslateFunction
  vmOnlyVisitScope: boolean
}) {
  const {
    canManageVisits,
    heroAverageScore,
    heroCompletedCount,
    heroScopeLabel,
    heroStoreCount,
    heroWaitingCount,
    locale,
    t,
    vmOnlyVisitScope,
  } = input

  return (
    <header className="store-checklists-command-hero">
      <div className="store-checklists-hero-copy">
        <div className="store-checklists-hero-pills" aria-label={t('storeChecklists.summaryAria')}>
          <ChecklistBadge tone="accent">{heroScopeLabel}</ChecklistBadge>
          <ChecklistBadge tone={heroWaitingCount > 0 ? 'warning' : 'calm'}>
            {getStaticCopy(
              locale,
              `${formatNumber(heroWaitingCount, locale)} mağaza bekliyor`,
              `${formatNumber(heroWaitingCount, locale)} stores waiting`,
            )}
          </ChecklistBadge>
          <ChecklistBadge tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}>
            {getStaticCopy(
              locale,
              `${formatNumber(heroCompletedCount, locale)} kayıt tamamlandı`,
              `${formatNumber(heroCompletedCount, locale)} records completed`,
            )}
          </ChecklistBadge>
        </div>
        <div className="store-checklists-eyebrow">{t('storeChecklists.heroEyebrow')}</div>
        <h2>
          {canManageVisits
            ? getStaticCopy(
                locale,
                'Bugünkü saha turunda öncelik düşük checklist skorlu mağazalarda.',
                'Today’s field route prioritizes stores with low checklist scores.',
              )
            : getStaticCopy(
                locale,
                'Mağazana yapılan kontroller tek ekranda.',
                'Your store checklist receipts stay in one focused surface.',
              )}
        </h2>
        <p>
          {canManageVisits
            ? vmOnlyVisitScope
              ? getStaticCopy(
                  locale,
                  'VM kullanıcıları yalnızca kendilerine atanmış mağazaların VM checklist akışını görür ve doldurur.',
                  'VM users only see and complete VM checklist flows for their assigned stores.',
                )
              : getStaticCopy(
                  locale,
                  'Bölge = Bölge müdürü. BM kendisine tanımlı mağazaları görür; BM Checklist ve VM Checklist puanlarını birlikte okuyabilir. VM yalnızca kendi VM Checklist kayıtlarına erişir.',
                  'Region means region manager. BM users see assigned stores and can read BM plus VM checklist scores together. VM users only access their own VM checklist records.',
                )
            : getStaticCopy(
                locale,
                'BM ve VM sonuçlarını tarih, skor ve kabul durumuyla takip edip mağaza aksiyonunu hızla kapatabilirsin.',
                'Track BM and VM results by date, score, and acknowledgement status so store follow-up stays tight.',
              )}
        </p>
      </div>
      <div className="store-checklists-command-metrics" aria-label={t('storeChecklists.summaryAria')}>
        <ChecklistMetric
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Atanmış mağaza', 'Assigned stores')
              : t('storeChecklists.store')
          }
          note={
            canManageVisits
              ? vmOnlyVisitScope
                ? getStaticCopy(locale, 'VM kapsamı', 'VM scope')
                : getStaticCopy(locale, 'BM kapsamı', 'Field scope')
              : getStaticCopy(locale, 'Kabul kapsamı', 'Receipt scope')
          }
          tone={heroStoreCount > 0 ? 'accent' : 'neutral'}
          value={formatNumber(heroStoreCount, locale)}
        />
        <ChecklistMetric
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Checklist yapılan', 'Completed visits')
              : t('storeChecklists.acknowledged')
          }
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Bu ay', 'This month')
              : getStaticCopy(locale, 'Yakın geçmiş', 'Recent history')
          }
          tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}
          value={formatNumber(heroCompletedCount, locale)}
        />
        <ChecklistMetric
          label={getStaticCopy(locale, 'Bekleyen', 'Waiting')}
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Öncelik sıralı', 'Prioritized')
              : t('storeChecklists.needsAcknowledgement')
          }
          tone={heroWaitingCount > 0 ? 'warning' : 'calm'}
          value={formatNumber(heroWaitingCount, locale)}
        />
        <ChecklistMetric
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
