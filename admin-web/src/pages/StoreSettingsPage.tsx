import {
  Building2,
  Check,
  Globe2,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  ShieldCheck,
  Settings2,
  UserRound,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { StoreOperationsHeader } from './store-operations-layout'
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
    <StoreSurfacePage ariaLabelledBy="store-settings-title" className="store-settings-page" testId="store-settings-page">
      <StoreOperationsHeader title={t('storeHome.settings.title')} titleId="store-settings-title" eyebrow={personaLabel} description={t('storeHome.settings.copy')} icon={Settings2} />

      <div className="store-settings-layout">
        <Card className="store-settings-identity" aria-labelledby="store-settings-identity-title">
          <CardHeader>
            <StoreAccountAvatar displayName={displayName} />
            <CardTitle><h2 id="store-settings-identity-title">{displayName}</h2></CardTitle>
            <CardDescription><Badge variant="secondary">{personaLabel}</Badge></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="store-settings-scope"><Building2 aria-hidden="true" /><div><span>{t('storeHome.settings.scopeLabel')}</span><strong>{scopeLabel}</strong></div></div>
          </CardContent>
          <CardFooter>
            <p>{t('storeHome.settings.photoCopy')}</p>
            <StoreAccountManagementButton>{t('storeHome.settings.managePhoto')}</StoreAccountManagementButton>
          </CardFooter>
        </Card>

        <Card className="store-settings-workspace">
          <Tabs value={section} onValueChange={value => selectSection(parseSection(value))}>
            <TabsList aria-label={t('storeHome.settings.aria')}>
              <TabsTrigger value="profile"><UserRound aria-hidden="true" />{t('storeHome.settings.profileTab')}</TabsTrigger>
              <TabsTrigger value="preferences"><Languages aria-hidden="true" />{t('storeHome.settings.preferencesTab')}</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck aria-hidden="true" />{t('storeHome.settings.securityTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="store-settings-panel">
              <CardHeader>
                <CardTitle><h2>{t('storeHome.settings.profileTitle')}</h2></CardTitle>
                <CardDescription>{t('storeHome.settings.profileCopy')}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="store-settings-profile-details">
                  <div><dt><UserRound aria-hidden="true" />{t('storeHome.settings.nameLabel')}</dt><dd>{displayName}</dd></div>
                  <div><dt><Mail aria-hidden="true" />{t('storeHome.settings.emailLabel')}</dt><dd>{email ?? t('storeHome.settings.noEmail')}</dd></div>
                  <div><dt><ShieldCheck aria-hidden="true" />{t('storeHome.settings.roleLabel')}</dt><dd>{personaLabel}</dd></div>
                  <div><dt><Building2 aria-hidden="true" />{t('storeHome.settings.scopeLabel')}</dt><dd>{scopeLabel}</dd></div>
                </dl>
              </CardContent>
            </TabsContent>

            <TabsContent value="preferences" className="store-settings-panel">
              <CardHeader>
                <CardTitle><h2>{t('storeHome.settings.preferencesTitle')}</h2></CardTitle>
                <CardDescription>{t('storeHome.settings.preferencesCopy')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="store-settings-preference-row">
                  <div className="store-settings-preference-copy"><span className="store-settings-action-icon"><Globe2 aria-hidden="true" /></span><div><h3>{t('storeHome.settings.languageTitle')}</h3><p>{t('storeHome.settings.languageCopy')}</p><Badge variant="secondary">{t('storeHome.settings.localPreferenceBadge')}</Badge></div></div>
                  <ToggleGroup aria-label={t('language.groupLabel')} className="store-settings-language-toggle" variant="outline" type="single" value={locale} onValueChange={value => { const nextLocale = parseLocale(value); if (nextLocale) setLocale(nextLocale) }}>
                    {appLocales.map(option => <ToggleGroupItem aria-label={t(switchLabelByLocale[option])} key={option} value={option}>{locale === option ? <Check aria-hidden="true" /> : null}{t(localeLabelByLocale[option])}</ToggleGroupItem>)}
                  </ToggleGroup>
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="security" className="store-settings-panel">
              <CardHeader>
                <CardTitle><h2>{t('storeHome.settings.securityTitle')}</h2></CardTitle>
                <CardDescription>{t('storeHome.settings.securityCopy')}</CardDescription>
              </CardHeader>
              <CardContent className="store-settings-security-list">
                <article><span className="store-settings-action-icon"><KeyRound aria-hidden="true" /></span><div><h3>{t('storeHome.settings.securityTitle')}</h3><p>{t('storeHome.settings.securityHint')}</p></div><StoreAccountManagementButton>{t('storeHome.settings.manageSecurity')}</StoreAccountManagementButton></article>
                <Separator />
                <article><span className="store-settings-action-icon"><LogOut aria-hidden="true" /></span><div><h3>{t('storeHome.settings.signOutTitle')}</h3><p>{t('storeHome.settings.signOutCopy')}</p></div><Button variant="outline" asChild><Link to="/auth/logout"><LogOut aria-hidden="true" data-icon="inline-start" />{t('storeHome.settings.logout')}</Link></Button></article>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </StoreSurfacePage>
  )
}
