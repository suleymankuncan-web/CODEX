import type { ReactNode } from 'react'
import type { StoreEmployee } from '../features/workforce/api'
import { formatDate, formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { useLocalization } from '../features/localization/useLocalization'
import { getTenureFromDate, parseDateOnly } from './store-workforce-model'
import {
  getPersonnelRowStatus,
  type PersonnelStatusKind,
} from './store-workforce-store-manager-view-model'

type WorkforceTranslate = ReturnType<typeof useLocalization>['t']

export function StoreWorkforceTh(input: { children: ReactNode }) {
  return (
    <th className="tw:border-b tw:border-[#dfe6f3] tw:px-3 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-[0.02em] tw:text-[#687395]">
      {input.children}
    </th>
  )
}

export function StoreWorkforceMetricCard(input: {
  icon: ReactNode
  iconClassName: string
  title: string
  value: string
  note: string
}) {
  return (
    <article className="tw:flex tw:min-h-[112px] tw:items-center tw:gap-3 tw:rounded-[1.25rem] tw:border tw:border-[#dfe6f3] tw:bg-white/82 tw:p-3.5 tw:shadow-[0_18px_48px_rgba(58,75,118,0.10)] tw:backdrop-blur">
      <span className={`tw:grid tw:size-12 tw:shrink-0 tw:place-items-center tw:rounded-2xl ${input.iconClassName}`}>
        {input.icon}
      </span>
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-xs tw:font-semibold tw:text-[#647194]">
          {input.title}
        </span>
        <strong className="tw:mt-0.5 tw:block tw:text-[28px] tw:font-semibold tw:leading-none tw:tracking-normal tw:text-[#071333]">
          {input.value}
        </strong>
        <small className="tw:mt-1.5 tw:block tw:text-xs tw:font-medium tw:leading-4 tw:text-[#647194]">
          {input.note}
        </small>
      </span>
    </article>
  )
}

export function StoreWorkforcePanel(input: {
  title: string
  description: string
  badge?: string
  badgeClassName?: string
  testId?: string
  children: ReactNode
}) {
  return (
    <section
      className="tw:overflow-hidden tw:rounded-[1.25rem] tw:border tw:border-[#dfe6f3] tw:bg-white/78 tw:shadow-[0_20px_54px_rgba(58,75,118,0.11)] tw:backdrop-blur"
      data-testid={input.testId}
    >
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:border-b tw:border-[#dfe6f3] tw:p-4">
        <div className="tw:min-w-0">
          <h3 className="tw:text-[15px] tw:font-semibold tw:tracking-normal tw:text-[#071333]">
            {input.title}
          </h3>
          <p className="tw:mt-1 tw:text-xs tw:leading-4 tw:text-[#647194]">
            {input.description}
          </p>
        </div>
        {input.badge ? (
          <span className={input.badgeClassName ?? 'tw:rounded-full tw:bg-[#efe9ff] tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:text-[#5534e6]'}>
            {input.badge}
          </span>
        ) : null}
      </div>
      <div className="tw:p-4">{input.children}</div>
    </section>
  )
}

export function StoreWorkforceTenureGrid(input: {
  items: Array<{ label: string; value: string }>
}) {
  return (
    <div className="tw:grid tw:grid-cols-2 tw:gap-2.5">
      {input.items.map((item) => (
        <div
          key={item.label}
          className="tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-[#f8fbff] tw:p-3"
        >
          <strong className="tw:block tw:text-[22px] tw:font-semibold tw:leading-none tw:text-[#071333]">
            {item.value}
          </strong>
          <span className="tw:mt-1 tw:block tw:text-xs tw:font-medium tw:text-[#647194]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PersonnelTableRow(input: {
  employee: StoreEmployee
  locale: AppLocale
  now: Date
  openOffboardingEmployeeIds: Set<string>
  t: WorkforceTranslate
}) {
  const tenure = getTenureFromDate(input.employee.assignmentStartDate, input.now, input.locale)
  const reference = input.employee.externalEmployeeRef ?? input.t('storeWorkforce.missingReference')
  const status = getPersonnelRowStatus(input.employee, input.openOffboardingEmployeeIds)

  return (
    <tr className="tw:border-b tw:border-[#dae2f0]/90 last:tw:border-b-0">
      <td className="tw:px-3 tw:py-3">
        <PersonIdentity
          name={input.employee.displayName || input.t('storeWorkforce.missingEmployeeName')}
          reference={reference}
          tone={status.kind}
        />
      </td>
      <td className="tw:px-3 tw:py-3 tw:text-sm tw:text-[#071333]">
        <span className="tw:block tw:truncate">
          {input.employee.positionName || input.t('storeWorkforce.missingPosition')}
        </span>
      </td>
      <td className="tw:px-3 tw:py-3 tw:text-sm tw:text-[#647194]">
        {formatSafeDate(input.employee.assignmentStartDate, input.locale, input.t)}
      </td>
      <td className="tw:px-3 tw:py-3 tw:text-sm tw:font-semibold tw:text-[#071333]">
        {tenure.label}
      </td>
      <td className="tw:px-3 tw:py-3">
        <StatusPill kind={input.employee.externalEmployeeRef ? 'active' : 'codeWaiting'}>
          {input.employee.externalEmployeeRef ? 'Kod aktif' : 'Kod bekliyor'}
        </StatusPill>
      </td>
      <td className="tw:px-3 tw:py-3" data-testid="store-workforce-personnel-row-status">
        <StatusPill kind={status.kind}>{status.label}</StatusPill>
      </td>
    </tr>
  )
}

export function PersonnelMobileCard(input: {
  employee: StoreEmployee
  locale: AppLocale
  now: Date
  openOffboardingEmployeeIds: Set<string>
  t: WorkforceTranslate
}) {
  const tenure = getTenureFromDate(input.employee.assignmentStartDate, input.now, input.locale)
  const status = getPersonnelRowStatus(input.employee, input.openOffboardingEmployeeIds)

  return (
    <article className="tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/82 tw:p-3 tw:shadow-[0_12px_28px_rgba(58,75,118,0.08)]">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <PersonIdentity
          name={input.employee.displayName || input.t('storeWorkforce.missingEmployeeName')}
          reference={input.employee.positionName || input.t('storeWorkforce.missingPosition')}
          tone={status.kind}
        />
        <StatusPill kind={status.kind}>{status.label}</StatusPill>
      </div>
      <div className="tw:mt-3 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-sm">
        <span className="tw:text-[#647194]">{input.t('storeWorkforce.tenure')}</span>
        <strong className="tw:font-semibold tw:text-[#071333]">{tenure.label}</strong>
      </div>
    </article>
  )
}

export function WorkforceBarRow(input: {
  label: string
  value: number
  max: number
  index: number
  locale: AppLocale
}) {
  const colors = [
    'tw:from-[#6847ff] tw:to-[#35c7de]',
    'tw:from-[#f59e0b] tw:to-[#ffd166]',
    'tw:from-[#20bfd3] tw:to-[#7be8f5]',
    'tw:from-[#12a873] tw:to-[#77e8b5]',
    'tw:from-[#f43f6d] tw:to-[#ff9fba]',
  ]
  const width = Math.max(8, Math.round((input.value / input.max) * 100))

  return (
    <div className="tw:grid tw:grid-cols-[124px_minmax(0,1fr)_42px] tw:items-center tw:gap-2.5">
      <span className="tw:truncate tw:text-sm tw:font-medium tw:text-[#071333]">
        {input.label}
      </span>
      <span className="tw:h-2.5 tw:overflow-hidden tw:rounded-full tw:bg-[#e7edf7]">
        <span
          className={`tw:block tw:h-full tw:rounded-full tw:bg-gradient-to-r ${colors[input.index % colors.length]}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <strong className="tw:text-right tw:text-sm tw:font-semibold tw:text-[#071333]">
        {formatNumber(input.value, input.locale)}
      </strong>
    </div>
  )
}

function PersonIdentity(input: { name: string; reference: string; tone: PersonnelStatusKind }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
      <span className={getAvatarClass(input.tone)}>{getInitials(input.name)}</span>
      <span className="tw:min-w-0">
        <strong className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:leading-5 tw:text-[#071333]">
          {input.name}
        </strong>
        <span className="tw:block tw:truncate tw:text-xs tw:leading-4 tw:text-[#647194]">
          {input.reference}
        </span>
      </span>
    </div>
  )
}

function StatusPill(input: { kind: PersonnelStatusKind; children: ReactNode }) {
  return (
    <span className={getStatusClass(input.kind)}>
      <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
      {input.children}
    </span>
  )
}

function getStatusClass(kind: PersonnelStatusKind) {
  const base =
    'tw:inline-flex tw:min-h-[25px] tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2 tw:text-[11px] tw:font-semibold tw:whitespace-nowrap'

  if (kind === 'offboarding') return `${base} tw:bg-[#ffe4ec] tw:text-[#be1645]`
  if (kind === 'codeWaiting') return `${base} tw:bg-[#fff1d9] tw:text-[#a35a00]`
  return `${base} tw:bg-[#def9ec] tw:text-[#087a51]`
}

function getAvatarClass(kind: PersonnelStatusKind) {
  const base =
    'tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-[13px] tw:text-xs tw:font-bold'

  if (kind === 'offboarding') return `${base} tw:bg-[#ffe4ec] tw:text-[#be1645]`
  if (kind === 'codeWaiting') return `${base} tw:bg-[#fff1d9] tw:text-[#a35a00]`
  return `${base} tw:bg-[#efe9ff] tw:text-[#5534e6]`
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
      .join('') || 'P'
  )
}

function formatSafeDate(value: string, locale: AppLocale, t: WorkforceTranslate) {
  return parseDateOnly(value) ? formatDate(value, locale) : t('storeWorkforce.missingDate')
}
