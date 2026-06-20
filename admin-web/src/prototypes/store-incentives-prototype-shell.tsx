import {
  BarChart3,
  Bell,
  CircleDollarSign,
  ClipboardList,
  Home,
  Megaphone,
  ReceiptText,
  Settings,
  Store,
  Target,
  TrendingUp,
  Trophy,
  UsersRound,
} from 'lucide-react'
import lufianLogoUrl from '../assets/lufian-logo.png'
import { StoreIncentivesRegionManagerCommandV2Prototype } from './store-incentives-region-manager-command-v2'

const prototypeNavItems = [
  { label: 'Ana Sayfa', href: '/store/home', icon: Home },
  { label: 'Rankings', href: '/store/rankings', icon: Trophy },
  { label: 'KPI Özetleri', href: '/store/kpis', icon: TrendingUp },
  { label: 'Checklist', href: '/store/checklists', icon: ClipboardList },
  { label: 'Talep Merkezi', href: '/store/approvals', icon: ReceiptText },
  { label: 'Hedefler', href: '/store/targets', icon: Target },
  { label: 'Norm Kadro', href: '/store/workforce', icon: UsersRound },
  { label: 'Görevler', href: '/store/tasks', icon: Bell },
  { label: 'Primler', href: '/store/incentives?prototype=command-v2', icon: CircleDollarSign, active: true },
  { label: 'Raporlar', href: '/store/reports', icon: BarChart3 },
  { label: 'Duyurular', href: '/store/feed', icon: Megaphone },
  { label: 'Ayarlar', href: '/store/settings', icon: Settings },
]

export function StoreIncentivesPrototypeShell() {
  return (
    <div className="store-shell store-command-app store-shell-store-incentives">
      <aside className="store-command-sidebar" aria-label="Mağaza navigasyonu">
        <div className="store-command-brand">
          <div className="store-command-brand-mark store-command-brand-logo" aria-hidden="true">
            <img src={lufianLogoUrl} alt="" />
          </div>
          <div className="store-command-brand-text">
            <strong>LUFIAN</strong>
            <small>Mağaza alanı</small>
          </div>
        </div>

        <div className="store-command-persona-chip" aria-hidden="true">
          <span className="store-command-persona-dot" />
          <span>Bölge Müdürü</span>
        </div>

        <nav className="store-command-nav" aria-label="Mağaza menüsü">
          {prototypeNavItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                className={`store-command-nav-link${item.active ? ' store-command-nav-link-active' : ''}`}
                href={item.href}
                key={item.href}
                title={item.label}
              >
                <span className="store-command-nav-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="store-command-nav-label">{item.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="store-command-sidebar-footer">
          <div className="store-command-identity" aria-label="Oturum özeti">
            <span className="store-command-avatar" aria-hidden="true">
              <Store size={18} />
            </span>
            <span className="store-command-identity-text">
              <strong>Pilot Bölge</strong>
              <small>Bölge Müdürü / ön izleme</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="store-main store-command-main" aria-label="Mağaza çalışma alanı">
        <StoreIncentivesRegionManagerCommandV2Prototype />
      </main>
    </div>
  )
}
