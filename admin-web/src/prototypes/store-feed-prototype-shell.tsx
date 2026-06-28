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
import { StoreFeedRegionComposerV1Prototype } from './store-feed-region-composer-v1'

const prototypeNavItems = [
  { label: 'Ana Sayfa', href: '/store/home', icon: Home },
  { label: 'Rankings', href: '/store/rankings', icon: Trophy },
  { label: 'KPI Özetleri', href: '/store/kpis', icon: TrendingUp },
  { label: 'Checklist', href: '/store/checklists', icon: ClipboardList },
  { label: 'Talep Merkezi', href: '/store/approvals', icon: ReceiptText },
  { label: 'Hedefler', href: '/store/targets', icon: Target },
  { label: 'Primler', href: '/store/incentives', icon: CircleDollarSign },
  { label: 'Norm Kadro', href: '/store/workforce', icon: UsersRound },
  { label: 'Görevler', href: '/store/tasks', icon: Bell },
  { label: 'Raporlar', href: '/store/reports', icon: BarChart3 },
  { label: 'Duyurular', href: '/store/feed?prototype=region-composer-v1', icon: Megaphone, active: true },
  { label: 'Ayarlar / Profil', href: '/store/settings', icon: Settings },
]

export function StoreFeedPrototypeShell() {
  return (
    <div className="store-shell store-command-app store-feed-prototype-shell">
      <aside className="store-command-sidebar" aria-label="Mağaza navigasyonu">
        <div className="store-command-brand">
          <div className="store-command-brand-mark store-command-brand-logo" aria-hidden="true">
            <img src={lufianLogoUrl} alt="" />
          </div>
          <div className="store-command-brand-text">
            <strong>LUFIAN</strong>
            <small>Store Home</small>
          </div>
        </div>

        <div className="store-command-persona-chip" aria-hidden="true">
          <span className="store-command-persona-dot" />
          <span>Bölge müdürü</span>
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
              <strong>Onur Kaytan</strong>
              <small>Bölge duyuru akışı</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="store-main store-command-main" aria-label="Mağaza çalışma alanı">
        <StoreFeedRegionComposerV1Prototype />
      </main>
    </div>
  )
}
