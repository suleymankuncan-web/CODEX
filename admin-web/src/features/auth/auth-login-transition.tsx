import { useState } from 'react'
import { ArrowRight, ArrowUpRight, Eye, LifeBuoy, LockKeyhole, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import logo from '../../assets/login-studio/hr-axis-logo.png'
import photograph from '../../assets/login-studio/retail-editorial.png'
import { useLocalization } from '../localization/useLocalization'
import '@fontsource-variable/geist/wght.css'
import '../../styles/onprem-login.css'

export function AuthLoginTransition({ failed = false }: { failed?: boolean }) {
  const { t } = useLocalization()
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <div className="onprem-login-entry" data-entry-pending="true">
      <div className="login-site">
        <header className="site-header">
          <a href="/auth/login" className="brand" aria-label="HR Axis">
            <img src={logo} alt="HR Axis" width={164} height={52} />
          </a>
          <span className="header-caption">İnsan, her şeyin merkezinde.</span>
          <Button variant="ghost" className="help-button" aria-expanded={helpOpen} aria-controls="entry-help" onClick={() => setHelpOpen(!helpOpen)}>
            <LifeBuoy aria-hidden="true" /> Yardım <ArrowUpRight aria-hidden="true" />
          </Button>
        </header>
        <main className="login-stage">
          <img className="stage-image" src={photograph} alt="" fetchPriority="high" />
          <div className="stage-shade" aria-hidden="true" />
          <section className="editorial-copy" aria-label="HR Axis'e hoş geldiniz">
            <div className="eyebrow"><span /> HER GÜN, BİRLİKTE.</div>
            <h1>İyi bir gün, <br />seninle <br />başlar.</h1>
            <p>Ekibin, hedeflerin, tüm iş günün.<br />Hepsi aynı yerde.</p>
          </section>
          <section className="login-panel" aria-labelledby="entry-login-title">
            <div className="panel-brand"><span>LUFIAN</span><span className="panel-brand-line" /><span>ÇALIŞAN PORTALI</span></div>
            <header className="welcome">
              <span className="welcome-kicker">YENİ BİR GÜNE</span>
              <h2 id="entry-login-title">Hoş geldin.</h2>
              <p>Devam etmek için hesabına giriş yap.</p>
            </header>
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
              <p role={failed ? 'alert' : 'status'} className={failed ? 'field-error' : 'sr-only'}>
                {t(failed ? 'authFlow.loginTemporarilyUnavailable' : 'authFlow.loginPreparing')}
              </p>
            </div>
            {helpOpen && (
              <aside id="entry-help" className="inline-notice" role="status">
                <div><strong>Birlikte çözelim.</strong><p>Hesabına erişemiyorsan mağaza yöneticin veya şirketinin insan kaynakları ekibiyle iletişime geç.</p></div>
                <Button variant="ghost" size="icon" aria-label="Bilgilendirmeyi kapat" onClick={() => setHelpOpen(false)}><X /></Button>
              </aside>
            )}
            <div className="panel-footer"><LockKeyhole size={16} aria-hidden="true" /><span>Sana ait hesap. Ekibine açılan kapı.</span></div>
          </section>
        </main>
        <footer className="site-footer"><span>© {new Date().getFullYear()} HR Axis</span><span>İyi işler, iyi ekiplerle.</span></footer>
      </div>
    </div>
  )
}
