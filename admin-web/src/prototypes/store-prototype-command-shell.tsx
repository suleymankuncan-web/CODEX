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
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import lufianLogoUrl from '../assets/lufian-logo.png'

type PrototypeNavItem = {
  label: string
  href: string
  icon: LucideIcon
}

const navItems: PrototypeNavItem[] = [
  { label: 'Ana Sayfa', href: '/store/home?prototype=command-v1', icon: Home },
  { label: 'Benim Performansım', href: '/store/me', icon: UserRound },
  { label: 'Rankings', href: '/store/rankings', icon: Trophy },
  { label: 'KPI Özetleri', href: '/store/kpis', icon: TrendingUp },
  { label: 'Checklist', href: '/store/checklists', icon: ClipboardList },
  { label: 'Talep Merkezi', href: '/store/approvals', icon: ReceiptText },
  { label: 'Hedefler', href: '/store/targets', icon: Target },
  { label: 'Primler', href: '/store/incentives', icon: CircleDollarSign },
  { label: 'Norm Kadro', href: '/store/workforce', icon: UsersRound },
  { label: 'Görevler', href: '/store/tasks', icon: Bell },
  { label: 'Raporlar', href: '/store/reports', icon: BarChart3 },
  { label: 'Duyurular', href: '/store/feed', icon: Megaphone },
  { label: 'Ayarlar / Profil', href: '/store/settings', icon: Settings },
]

export function StorePrototypeCommandShell(input: {
  activePath: '/store/home'
  children: ReactNode
  identityLabel: string
  personaLabel: string
  subtitle: string
}) {
  return (
    <div className="store-shell store-command-app store-shell-store-home">
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
          <span>{input.personaLabel}</span>
        </div>

        <nav className="store-command-nav" aria-label="Mağaza menüsü">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href.startsWith(input.activePath)
            return (
              <a
                className={`store-command-nav-link${isActive ? ' store-command-nav-link-active' : ''}`}
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
              <strong>{input.identityLabel}</strong>
              <small>{input.subtitle}</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="store-main store-command-main" aria-label="Mağaza çalışma alanı">
        {input.children}
      </main>
    </div>
  )
}
