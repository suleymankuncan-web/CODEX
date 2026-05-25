import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Home,
  Target,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TranslateFunction } from '../features/localization/dictionary'
import { cn } from '../lib/utils'

type StoreMyPerformanceRailProps = {
  showApprovalsLink: boolean
  t: TranslateFunction
}

type StoreMyPerformanceTopbarProps = {
  employeeHeading: string
  introCopy: string
  periodLabel: string
}

function StoreNavItem({
  children,
  icon: Icon,
  to,
}: {
  children: string
  icon: LucideIcon
  to: string
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="lg"
      className="tw:w-full tw:justify-start tw:gap-2 tw:text-muted-foreground tw:aria-[current=page]:bg-muted tw:aria-[current=page]:text-foreground"
    >
      <NavLink to={to}>
        <Icon data-icon="inline-start" />
        <span>{children}</span>
      </NavLink>
    </Button>
  )
}

export function StoreMyPerformanceRail({ showApprovalsLink, t }: StoreMyPerformanceRailProps) {
  return (
    <aside
      className="tw:sticky tw:top-0 tw:hidden tw:h-screen tw:flex-col tw:gap-3 tw:border-r tw:border-border tw:bg-card tw:p-3 tw:md:flex"
      aria-label={t('storeMe.nav.aria')}
    >
      <div
        className="tw:grid tw:size-11 tw:place-items-center tw:rounded-xl tw:bg-primary tw:text-primary-foreground"
        aria-label={t('storeMe.brandAria')}
      >
        <ChartNoAxesColumnIncreasing aria-hidden="true" />
      </div>
      <nav className="tw:grid tw:gap-1" aria-label={t('storeMe.nav.aria')}>
        <StoreNavItem to="/store/home" icon={Home}>{t('storeMe.nav.home')}</StoreNavItem>
        <StoreNavItem to="/store/me" icon={UserRound}>{t('storeMe.nav.me')}</StoreNavItem>
        <StoreNavItem to="/store/rankings" icon={Trophy}>{t('storeMe.nav.rankings')}</StoreNavItem>
        {showApprovalsLink ? (
          <StoreNavItem to="/store/approvals" icon={Target}>{t('storeMe.nav.targets')}</StoreNavItem>
        ) : null}
      </nav>
      <div className="tw:flex-1" />
      <StoreNavItem to="/store/tasks" icon={ClipboardList}>{t('storeMe.nav.tasks')}</StoreNavItem>
    </aside>
  )
}

export function StoreMyPerformanceTopbar({
  employeeHeading,
  introCopy,
  periodLabel,
}: StoreMyPerformanceTopbarProps) {
  return (
    <header className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-start tw:md:justify-between">
      <div className="tw:grid tw:min-w-0 tw:gap-2">
        <h1 className="tw:text-2xl tw:font-medium tw:leading-tight tw:text-foreground tw:md:text-4xl">
          {employeeHeading}
        </h1>
        <p className="tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
          {introCopy}
        </p>
      </div>
      <Badge
        variant="secondary"
        className="tw:h-auto tw:min-h-8 tw:self-start tw:px-3"
        data-testid="store-me-period-pill"
      >
        <CalendarDays data-icon="inline-start" />
        {periodLabel}
      </Badge>
    </header>
  )
}

export function StoreMyPerformanceMobileDock({ showApprovalsLink, t }: StoreMyPerformanceRailProps) {
  return (
    <nav
      className={cn(
        'tw:fixed tw:inset-x-3 tw:bottom-3 tw:z-40 tw:grid tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-2 tw:shadow-sm tw:md:hidden',
        showApprovalsLink ? 'tw:grid-cols-4' : 'tw:grid-cols-3',
      )}
      aria-label={t('storeMe.mobileNav')}
    >
      <Button asChild variant="ghost" size="sm">
        <NavLink to="/store/home">{t('storeMe.nav.home')}</NavLink>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <NavLink to="/store/me">{t('storeMe.nav.me')}</NavLink>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <NavLink to="/store/rankings">{t('storeMe.nav.rankings')}</NavLink>
      </Button>
      {showApprovalsLink ? (
        <Button asChild variant="ghost" size="sm">
          <NavLink to="/store/approvals">{t('storeMe.nav.targets')}</NavLink>
        </Button>
      ) : null}
    </nav>
  )
}
