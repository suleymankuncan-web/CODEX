import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, LifeBuoy, LockKeyhole, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import logo from '../../assets/login-studio/hr-axis-logo.png'
import photograph from '../../assets/login-studio/retail-editorial.png'
import { prepareLoginEntrance } from './login-entrance'
import '@fontsource-variable/geist/wght.css'
import '../../styles/onprem-login.css'
import '../../styles/clerk-login-studio.css'
import '../../styles/onprem-login-motion.css'

export function AuthLoginStudio(input: { children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const entranceRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (entranceRef.current) prepareLoginEntrance(entranceRef.current)
  }, [])

  return (
    <div ref={entranceRef} className="onprem-login-entry" data-entry-pending="true">
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

            {input.children}

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
