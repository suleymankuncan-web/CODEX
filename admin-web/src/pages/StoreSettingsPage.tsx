import {
  Building2,
  Check,
  Globe2,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  StoreAccountAvatar,
  StoreAccountManagementButton,
} from '../features/account/store-account-controls'
import '../features/account/store-account.css'
import { useLocalization } from '../features/localization/useLocalization'
import { appLocales, type AppLocale } from '../lib/i18n'
import { resolveUserDisplayLabel } from '../lib/display-labels'
import { getStorePersonaLabelKey, resolveStorePersona } from '../app/store-navigation'
import { StoreSurfacePage } from './store-surface-primitives'
import './store-settings.css'

type SettingsSection = 'profile' | 'preferences' | 'security'

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

function parseSection(value: string | null): SettingsSection {
  return value === 'preferences' || value === 'security' ? value : 'profile'
}

function resolveScopeLabel(authSummary: AuthSessionSummary | null, t: ReturnType<typeof useLocalization>['t']) {
  const summary = authSummary?.scopeSummary
  if (!summary) return t('storeHome.settings.selfScope')

  if (summary.storeCount > 0) return t('storeHome.settings.storeScope', { count: summary.storeCount })
  if (summary.regionCount > 0) return t('storeHome.settings.regionScope', { count: summary.regionCount })
  if (summary.companyCount > 0) return t('storeHome.settings.companyScope', { count: summary.companyCount })
  return t('storeHome.settings.selfScope')
}

export function StoreSettingsPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, setLocale, t } = useLocalization()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = parseSection(searchParams.get('section'))
  const persona = resolveStorePersona(input.authSummary)
  const personaLabel = t(getStorePersonaLabelKey(persona))
  const displayName = resolveUserDisplayLabel(input.authSummary?.user, personaLabel)
  const email = input.authSummary?.user.email?.trim() || null
  const scopeLabel = resolveScopeLabel(input.authSummary, t)

  const selectSection = (nextSection: SettingsSection) => {
    setSearchParams(nextSection === 'profile' ? {} : { section: nextSection }, { replace: true })
  }

  return (
    <StoreSurfacePage ariaLabel={t('storeHome.settings.aria')} className="store-settings-page">
      <header className="store-settings-header">
        <div>
          <span className="store-settings-eyebrow">{t('storeHome.settings.eyebrow')}</span>
          <h1>{t('storeHome.settings.title')}</h1>
          <p>{t('storeHome.settings.copy')}</p>
        </div>
      </header>

      <nav className="store-settings-tabs" aria-label={t('storeHome.settings.aria')}>
        <button className={section === 'profile' ? 'is-active' : ''} type="button" onClick={() => selectSection('profile')}>
          <UserRound size={16} aria-hidden="true" />
          {t('storeHome.settings.profileTab')}
        </button>
        <button className={section === 'preferences' ? 'is-active' : ''} type="button" onClick={() => selectSection('preferences')}>
          <Languages size={16} aria-hidden="true" />
          {t('storeHome.settings.preferencesTab')}
        </button>
        <button className={section === 'security' ? 'is-active' : ''} type="button" onClick={() => selectSection('security')}>
          <ShieldCheck size={16} aria-hidden="true" />
          {t('storeHome.settings.securityTab')}
        </button>
      </nav>

      {section === 'profile' ? (
        <section className="store-settings-panel" aria-labelledby="store-settings-profile-title">
          <div className="store-settings-panel-heading">
            <span className="store-settings-section-icon"><UserRound aria-hidden="true" /></span>
            <div>
              <h2 id="store-settings-profile-title">{t('storeHome.settings.profileTitle')}</h2>
              <p>{t('storeHome.settings.profileCopy')}</p>
            </div>
          </div>

          <div className="store-settings-profile-workspace">
            <div className="store-settings-profile-portrait">
              <StoreAccountAvatar displayName={displayName} />
              <div>
                <strong>{displayName}</strong>
                <span>{personaLabel}</span>
              </div>
              <p>{t('storeHome.settings.photoCopy')}</p>
              <StoreAccountManagementButton>{t('storeHome.settings.managePhoto')}</StoreAccountManagementButton>
            </div>

            <dl className="store-settings-profile-details">
              <div>
                <dt><UserRound size={15} aria-hidden="true" />{t('storeHome.settings.nameLabel')}</dt>
                <dd>{displayName}</dd>
              </div>
              <div>
                <dt><Mail size={15} aria-hidden="true" />{t('storeHome.settings.emailLabel')}</dt>
                <dd>{email ?? t('storeHome.settings.noEmail')}</dd>
              </div>
              <div>
                <dt><ShieldCheck size={15} aria-hidden="true" />{t('storeHome.settings.roleLabel')}</dt>
                <dd>{personaLabel}</dd>
              </div>
              <div>
                <dt><Building2 size={15} aria-hidden="true" />{t('storeHome.settings.scopeLabel')}</dt>
                <dd>{scopeLabel}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      {section === 'preferences' ? (
        <section className="store-settings-panel" aria-labelledby="store-settings-preferences-title">
          <div className="store-settings-panel-heading">
            <span className="store-settings-section-icon"><Globe2 aria-hidden="true" /></span>
            <div>
              <h2 id="store-settings-preferences-title">{t('storeHome.settings.preferencesTitle')}</h2>
              <p>{t('storeHome.settings.preferencesCopy')}</p>
            </div>
          </div>
          <article className="store-settings-preference-row">
            <div>
              <h3>{t('storeHome.settings.languageTitle')}</h3>
              <p>{t('storeHome.settings.languageCopy')}</p>
              <small>{t('storeHome.settings.localPreferenceBadge')}</small>
            </div>
            <ToggleGroup
              aria-label={t('language.groupLabel')}
              className="store-settings-language-toggle"
              type="single"
              value={locale}
              onValueChange={(value) => {
                const nextLocale = parseLocale(value)
                if (nextLocale) setLocale(nextLocale)
              }}
            >
              {appLocales.map((option) => (
                <ToggleGroupItem aria-label={t(switchLabelByLocale[option])} key={option} value={option}>
                  {locale === option ? <Check size={14} aria-hidden="true" /> : null}
                  {t(localeLabelByLocale[option])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </article>
        </section>
      ) : null}

      {section === 'security' ? (
        <section className="store-settings-panel" aria-labelledby="store-settings-security-title">
          <div className="store-settings-panel-heading">
            <span className="store-settings-section-icon"><KeyRound aria-hidden="true" /></span>
            <div>
              <h2 id="store-settings-security-title">{t('storeHome.settings.securityTitle')}</h2>
              <p>{t('storeHome.settings.securityCopy')}</p>
            </div>
          </div>
          <div className="store-settings-security-grid">
            <article>
              <span className="store-settings-action-icon"><ShieldCheck aria-hidden="true" /></span>
              <div>
                <h3>{t('storeHome.settings.securityTitle')}</h3>
                <p>{t('storeHome.settings.securityHint')}</p>
              </div>
              <StoreAccountManagementButton>{t('storeHome.settings.manageSecurity')}</StoreAccountManagementButton>
            </article>
            <article>
              <span className="store-settings-action-icon is-danger"><LogOut aria-hidden="true" /></span>
              <div>
                <h3>{t('storeHome.settings.signOutTitle')}</h3>
                <p>{t('storeHome.settings.signOutCopy')}</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/auth/logout">{t('storeHome.settings.logout')}</Link>
              </Button>
            </article>
          </div>
        </section>
      ) : null}
    </StoreSurfacePage>
  )
}
