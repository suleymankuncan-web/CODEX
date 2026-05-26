import { Globe2, Languages, MonitorCog, UserRound } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { appLocales, type AppLocale } from '../lib/i18n'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreSectionCard,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

const localeLabelByLocale: Record<AppLocale, 'language.turkishShort' | 'language.englishShort'> = {
  tr: 'language.turkishShort',
  en: 'language.englishShort',
}

const switchLabelByLocale: Record<AppLocale, 'language.switchToTurkish' | 'language.switchToEnglish'> = {
  tr: 'language.switchToTurkish',
  en: 'language.switchToEnglish',
}

function parseLocale(value: string): AppLocale | null {
  return value === 'tr' || value === 'en' ? value : null
}

function StoreSettingsLanguageToggle() {
  const { locale, setLocale, t } = useLocalization()

  return (
    <ToggleGroup
      aria-label={t('language.groupLabel')}
      className="tw:w-full tw:rounded-lg tw:border tw:border-border tw:bg-muted/40 tw:p-1 tw:sm:w-fit"
      spacing={1}
      type="single"
      value={locale}
      variant="outline"
      onValueChange={(value) => {
        const nextLocale = parseLocale(value)

        if (nextLocale) {
          setLocale(nextLocale)
        }
      }}
    >
      {appLocales.map((option) => (
        <ToggleGroupItem
          aria-label={t(switchLabelByLocale[option])}
          className="tw:flex-1 tw:border-0 tw:data-[state=on]:bg-background tw:data-[state=on]:shadow-sm tw:sm:flex-none"
          key={option}
          value={option}
        >
          {t(localeLabelByLocale[option])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function StoreSettingsPage() {
  const { locale, t } = useLocalization()
  const activeLanguageLabel = t(localeLabelByLocale[locale])

  return (
    <StoreSurfacePage ariaLabel={t('storeHome.settings.aria')}>
      <StoreSurfaceHeader
        eyebrow={t('storeHome.settings.eyebrow')}
        title={t('storeHome.settings.title')}
        description={t('storeHome.settings.copy')}
        badges={[
          { label: `${t('storeHome.settings.currentLanguageLabel')}: ${activeLanguageLabel}`, tone: 'accent' },
          { label: t('storeHome.settings.localPreferenceBadge'), tone: 'neutral' },
        ]}
      />

      <StoreSectionCard
        title={t('storeHome.settings.languageTitle')}
        description={t('storeHome.settings.languageCopy')}
        badge={{ label: t('storeHome.utility.statusPreference'), tone: 'accent' }}
        ariaLabel={t('storeHome.settings.languagePanelAria')}
      >
        <div className="tw:grid tw:gap-4 tw:lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-primary/15 tw:bg-primary/5 tw:p-4">
            <span className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-lg tw:bg-background tw:text-primary tw:shadow-sm">
              <Languages aria-hidden="true" />
            </span>
            <div>
              <h2 className="tw:text-base tw:font-semibold tw:text-foreground">
                {t('storeHome.settings.availableLanguages')}
              </h2>
              <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {t('storeHome.settings.languagePreferenceCopy')}
              </p>
            </div>
            <StoreSettingsLanguageToggle />
          </div>

          <StoreInfoGrid
            items={[
              {
                label: t('storeHome.settings.currentLanguageLabel'),
                value: activeLanguageLabel,
                tone: 'accent',
              },
              {
                label: t('storeHome.settings.storageLabel'),
                value: t('storeHome.settings.storageValue'),
              },
              {
                label: t('storeHome.settings.scopeLabel'),
                value: t('storeHome.settings.scopeValue'),
                tone: 'calm',
              },
            ]}
            className="tw:self-stretch tw:xl:grid-cols-3"
          />
        </div>
      </StoreSectionCard>

      <StoreSectionCard
        title={t('storeHome.settings.profileStatusTitle')}
        description={t('storeHome.settings.profileStatusCopy')}
        badge={{ label: t('storeHome.utility.statusBoundary'), tone: 'neutral' }}
        ariaLabel={t('storeHome.settings.boundaryAria')}
      >
        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <StoreEmptyState
            title={t('storeHome.settings.profileEmptyTitle')}
            description={t('storeHome.settings.profileEmptyCopy')}
          />
          <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/70 tw:p-4">
            <div className="tw:flex tw:items-center tw:gap-2">
              <span className="tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-lg tw:bg-secondary tw:text-primary">
                <UserRound aria-hidden="true" />
              </span>
              <div className="tw:min-w-0">
                <h2 className="tw:text-sm tw:font-semibold tw:text-foreground">
                  {t('storeHome.settings.preferenceModelTitle')}
                </h2>
                <p className="tw:text-xs tw:text-muted-foreground">
                  {t('storeHome.settings.preferenceModelCopy')}
                </p>
              </div>
            </div>
            <div className="tw:flex tw:flex-wrap tw:gap-2">
              <StoreStatusBadge tone="accent">
                <Globe2 className="tw:size-3" aria-hidden="true" />
                {t('storeHome.settings.scopeValue')}
              </StoreStatusBadge>
              <StoreStatusBadge tone="neutral">
                <MonitorCog className="tw:size-3" aria-hidden="true" />
                {t('storeHome.settings.storageValue')}
              </StoreStatusBadge>
            </div>
          </div>
        </div>
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}
