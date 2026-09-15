import { ArrowRight, Eye } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useLocalization } from '../localization/useLocalization'
import { AuthLoginStudio } from './auth-login-studio'
import { AuthLoginNotice } from './auth-login-notice'

export function AuthLoginTransition({ failed = false }: { failed?: boolean }) {
  const { t } = useLocalization()

  return (
    <AuthLoginStudio>
      <div aria-busy={!failed}>
        {/* Credentials are accepted only by Keycloak after the secure handoff. */}
        <div className="field-block">
          <label htmlFor="entry-username">E-posta veya kullanıcı adı</label>
          <Input id="entry-username" placeholder="Kullanıcı adını gir" disabled autoComplete="off" />
        </div>
        <div className="field-block">
          <label htmlFor="entry-password">Şifre</label>
          <div className="password-wrap">
            <Input id="entry-password" type="password" placeholder="Şifreni gir" disabled autoComplete="off" />
            <span className="password-toggle" aria-hidden="true"><Eye /></span>
          </div>
        </div>
        <div className="form-options">
          <label className="remember-label"><input type="checkbox" disabled /> Beni hatırla</label>
          <span className="forgot-button">Şifremi unuttum</span>
        </div>
        <Button className="login-submit" disabled={!failed} onClick={() => window.location.reload()}>
          <span>{failed ? t('authFlow.retrySignIn') : 'Giriş yap'}</span><ArrowRight aria-hidden="true" />
        </Button>
        {failed ? (
          <AuthLoginNotice>{t('authFlow.loginTemporarilyUnavailable')}</AuthLoginNotice>
        ) : (
          <p role="status" className="sr-only">{t('authFlow.loginPreparing')}</p>
        )}
      </div>
    </AuthLoginStudio>
  )
}
