import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Store as StoreIcon } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CommandCanvasDataList,
  CommandCanvasSortableHeading,
  type CommandCanvasSortDirection,
} from '@/features/store-command-canvas/primitives'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { formatIncentiveMoney, formatIncentivePercent, formatIncentiveRate, formatSignedIncentiveMoney } from './format'
import { sumMoney } from './model'
import type { IncentiveRow, IncentiveStore, IncentiveWorkspace } from './types'

type Translate = ReturnType<typeof useLocalization>['t']
type SortKey = 'name' | 'target' | 'actual' | 'achievement' | 'total'

export function IncentiveWorkspaceHierarchy(input: {
  workspace: IncentiveWorkspace
  locale: AppLocale
  t: Translate
  readOnly: boolean
  interactionLocked?: boolean
  onOpenRow: (store: IncentiveStore, row: IncentiveRow, opener: HTMLButtonElement) => void
  onReviewStore?: (store: IncentiveStore) => void
  pendingStoreIds?: ReadonlySet<string>
}) {
  const [sort, setSort] = useState<{ key: SortKey | null; direction: 'ascending' | 'descending' }>({
    key: null, direction: 'ascending',
  })
  const regions = useMemo(() => input.workspace.regions.map((region) => ({
    ...region,
    stores: [...region.stores].sort((left, right) => compareStores(left, right, sort)),
  })), [input.workspace.regions, sort])
  const headings = (
    <div className="incentive-store-heading incentive-store-grid">
      <SortHeading label={input.t('storeIncentives.command.storeColumn')} name="name" sort={sort} setSort={setSort} />
      <SortHeading label={input.t('storeIncentives.command.targetColumn')} name="target" sort={sort} setSort={setSort} />
      <SortHeading label={input.t('storeIncentives.command.actualColumn')} name="actual" sort={sort} setSort={setSort} />
      <SortHeading label={input.t('storeIncentives.command.achievementColumn')} name="achievement" sort={sort} setSort={setSort} />
      <SortHeading label={input.t('storeIncentives.command.totalColumn')} name="total" sort={sort} setSort={setSort} />
      <span>{input.t('storeIncentives.command.reviewColumn')}</span>
    </div>
  )
  const regionHeadings = (
    <div className="incentive-region-heading">
      <span>{input.t('storeIncentives.command.regionManagers')}</span>
      <span>{input.t('storeIncentives.command.stores')}</span>
      <span>{input.t('storeIncentives.command.targetColumn')}</span>
      <span>{input.t('storeIncentives.command.actualColumn')}</span>
      <span>{input.t('storeIncentives.command.achievementColumn')}</span>
      <span>{input.t('storeIncentives.command.totalColumn')}</span>
      <span aria-hidden="true" />
    </div>
  )

  if (input.readOnly) {
    return (
      <CommandCanvasDataList ariaLabel={input.t('storeIncentives.command.viewerSection')} header={regionHeadings}>
        <Accordion className="incentive-region-list" type="multiple" defaultValue={regions.slice(0, 1).map((region) => region.regionId)}>
          {regions.map((region) => (
            <AccordionItem key={region.regionId} value={region.regionId}>
              {(() => {
                const target = sumMoney(region.stores.map((store) => store.storeTarget))
                const actual = sumMoney(region.stores.map((store) => store.storeActualNetSales))
                const achievement = calculateAchievement(target, actual)
                return (
              <AccordionTrigger className="incentive-region-trigger">
                <span className="incentive-region-name">
                  <span>{initials(region.regionManager.displayName)}</span>
                  <b>{region.regionManager.displayName || input.t('storeIncentives.command.unassignedManager')}</b>
                  <small>{region.regionName || input.t('storeIncentives.command.regionUnavailable')}</small>
                </span>
                <span data-label={input.t('storeIncentives.command.stores')}>{region.stores.length}<small>{input.t('storeIncentives.command.stores')}</small></span>
                <span data-label={input.t('storeIncentives.command.targetColumn')}>{formatIncentiveMoney(target, input.locale)}</span>
                <span data-label={input.t('storeIncentives.command.actualColumn')}>{formatIncentiveMoney(actual, input.locale)}</span>
                <span data-label={input.t('storeIncentives.command.achievementColumn')}><Badge variant={achievementTone(achievement)}>{formatIncentivePercent(achievement, input.locale)}</Badge></span>
                <span data-label={input.t('storeIncentives.command.totalColumn')}>{formatIncentiveMoney(regionTotal(region.stores), input.locale)}</span>
              </AccordionTrigger>
                )
              })()}
              <AccordionContent className="incentive-region-content">
                {headings}
                <StoreAccordion {...input} stores={region.stores} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CommandCanvasDataList>
    )
  }

  return (
    <CommandCanvasDataList ariaLabel={input.t('storeIncentives.regionManagerStoresAria')} header={headings}>
      {regions.map((region) => (
        <section className="incentive-region-store-group" key={region.regionId}>
          {regions.length > 1 ? (
            <header><b>{region.regionName || input.t('storeIncentives.command.unassignedRegion')}</b><span>{region.stores.length} {input.t('storeIncentives.command.stores')}</span></header>
          ) : null}
          <StoreAccordion {...input} stores={region.stores} />
        </section>
      ))}
    </CommandCanvasDataList>
  )
}

function StoreAccordion(input: {
  stores: IncentiveStore[]
  locale: AppLocale
  t: Translate
  readOnly: boolean
  interactionLocked?: boolean
  onOpenRow: (store: IncentiveStore, row: IncentiveRow, opener: HTMLButtonElement) => void
  onReviewStore?: (store: IncentiveStore) => void
  pendingStoreIds?: ReadonlySet<string>
}) {
  const [openStoreIds, setOpenStoreIds] = useState<string[]>(() => input.stores.slice(0, 1).map((store) => store.storeId))
  const toggleStore = (storeId: string) => setOpenStoreIds((current) => (
    current.includes(storeId) ? current.filter((value) => value !== storeId) : [...current, storeId]
  ))

  return (
    <div className="incentive-store-list">
      {input.stores.map((store) => {
        const reviewed = store.review.status === 'reviewed'
        const pending = input.pendingStoreIds?.has(store.storeId) ?? false
        const open = openStoreIds.includes(store.storeId)
        const contentId = `incentive-store-${store.storeId}-content`
        return (
          <article className="incentive-store-item" data-open={open} key={store.storeId}>
            <div className="incentive-store-summary incentive-store-grid">
              <button
                aria-controls={contentId}
                aria-expanded={open}
                className="incentive-store-main"
                onClick={() => toggleStore(store.storeId)}
                type="button"
              >
                <span className="incentive-store-identity">
                  <span><StoreIcon aria-hidden="true" size={16} /></span>
                  <b>{store.storeName}</b>
                  <small>{[store.city, store.storeCode].filter(Boolean).join(' / ') || input.t('storeIncentives.command.storeMetadataUnavailable')}</small>
                </span>
                <strong data-label={input.t('storeIncentives.command.targetColumn')}>{formatIncentiveMoney(store.storeTarget, input.locale)}</strong>
                <strong data-label={input.t('storeIncentives.command.actualColumn')}>{formatIncentiveMoney(store.storeActualNetSales, input.locale)}</strong>
                <Badge data-label={input.t('storeIncentives.command.achievementColumn')} variant={achievementTone(store.storeAchievementPct)}>{formatIncentivePercent(store.storeAchievementPct, input.locale)}</Badge>
                <strong data-label={input.t('storeIncentives.command.totalColumn')}>{formatIncentiveMoney(storeTotal(store), input.locale)}</strong>
              </button>
              {!input.readOnly && store.capabilities.canMarkStoreReview ? (
                <button
                  aria-pressed={reviewed}
                  className="incentive-store-review-toggle"
                  data-reviewed={reviewed}
                  disabled={pending || input.interactionLocked}
                  onClick={() => input.onReviewStore?.(store)}
                  type="button"
                >
                  <span>{reviewed ? <Check aria-hidden="true" size={14} /> : null}</span>
                  {input.t(reviewed ? 'storeIncentives.command.reviewed' : 'storeIncentives.command.reviewAction')}
                </button>
              ) : (
                <span className="incentive-store-review-toggle is-readonly" data-reviewed={reviewed}>
                  <span>{reviewed ? <Check aria-hidden="true" size={14} /> : null}</span>
                  {input.t(reviewed ? 'storeIncentives.command.reviewed' : 'storeIncentives.command.pending')}
                </span>
              )}
              <button
                aria-controls={contentId}
                aria-expanded={open}
                aria-label={`${store.storeName}: ${open ? input.t('storeIncentives.command.collapse') : input.t('storeIncentives.command.expand')}`}
                className="incentive-store-expand"
                onClick={() => toggleStore(store.storeId)}
                type="button"
              ><ChevronDown aria-hidden="true" size={16} /></button>
            </div>
            {open ? (
              <div className="incentive-store-content" id={contentId}>
              <div aria-label={`${store.storeName}: ${input.t('storeIncentives.command.personColumn')}`} className="incentive-person-table" role="group" tabIndex={0}>
                <div className="incentive-person-heading incentive-person-grid">
                  {['personColumn', 'roleColumn', 'targetColumn', 'actualColumn', 'rateColumn', 'calculatedColumn', 'finalColumn', 'statusColumn'].map((key) => (
                    <span key={key}>{input.t(`storeIncentives.command.${key}` as never)}</span>
                  ))}
                </div>
                {store.rows.length === 0 ? (
                  <div className="incentive-command-empty"><span>{input.t('storeIncentives.regionManagerNoRows')}</span></div>
                ) : store.rows.map((row) => (
                  <IncentivePersonRow
                    key={`${row.employeeId}:${row.participantType}`}
                    locale={input.locale}
                    onOpen={(opener) => input.onOpenRow(store, row, opener)}
                    interactionLocked={Boolean(input.interactionLocked)}
                    readOnly={input.readOnly || !store.capabilities.canCreateCorrection}
                    row={row}
                    storeName={store.storeName}
                    t={input.t}
                  />
                ))}
              </div>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function IncentivePersonRow(input: {
  row: IncentiveRow
  storeName: string
  locale: AppLocale
  t: Translate
  readOnly: boolean
  interactionLocked?: boolean
  onOpen: (opener: HTMLButtonElement) => void
}) {
  const changed = Number(input.row.signedDifferenceAmount ?? 0) !== 0
  const cells = (
    <>
      <span><b>{input.row.displayName}</b><small>{input.storeName}</small></span>
      <span data-label={input.t('storeIncentives.command.roleColumn')}>{positionLabel(input.row.positionCode, input.t)}</span>
      <span data-label={input.t('storeIncentives.command.targetColumn')}>{formatIncentiveMoney(input.row.target, input.locale)}</span>
      <span data-label={input.t('storeIncentives.command.actualColumn')}>{formatIncentiveMoney(input.row.actual, input.locale)}</span>
      <span data-label={input.t('storeIncentives.command.rateColumn')}>{formatIncentiveRate(input.row.rate, input.locale)}</span>
      <strong data-label={input.t('storeIncentives.command.calculatedColumn')}>{formatIncentiveMoney(input.row.calculatedAmount, input.locale)}</strong>
      <span className={changed ? 'is-corrected' : ''} data-label={input.t('storeIncentives.command.finalColumn')}>
        <strong>{formatIncentiveMoney(input.row.finalAmount, input.locale)}</strong>
        <small>{formatSignedIncentiveMoney(input.row.signedDifferenceAmount, input.locale)}</small>
      </span>
    </>
  )

  if (!input.readOnly) {
    return (
      <button
        aria-label={`${input.row.displayName}: ${input.t('storeIncentives.command.adjust')}`}
        className="incentive-person-grid incentive-person-row is-actionable"
        disabled={input.interactionLocked}
        onClick={(event) => input.onOpen(event.currentTarget)}
        type="button"
      >
        {cells}
        <span className="incentive-person-status">
          <Badge variant={changed ? 'secondary' : 'outline'}>{input.t(changed ? 'storeIncentives.command.corrected' : 'storeIncentives.command.noChange')}</Badge>
        </span>
        <ChevronRight aria-hidden="true" size={15} />
      </button>
    )
  }

  return (
    <div className="incentive-person-grid incentive-person-row is-readonly">
      {cells}
      <span className="incentive-person-status">
        {input.row.correction ? (
          <Button
            aria-label={`${input.row.displayName}: ${input.t('storeIncentives.command.viewCorrection')}`}
            onClick={(event) => input.onOpen(event.currentTarget)}
            size="sm"
            variant="outline"
          >{input.t('storeIncentives.command.viewCorrection')}</Button>
        ) : <Badge variant="outline">{input.t('storeIncentives.command.noChange')}</Badge>}
      </span>
    </div>
  )
}

function SortHeading(input: {
  label: string
  name: SortKey
  sort: { key: SortKey | null; direction: 'ascending' | 'descending' }
  setSort: (sort: { key: SortKey | null; direction: 'ascending' | 'descending' }) => void
}) {
  const direction: CommandCanvasSortDirection = input.sort.key === input.name ? input.sort.direction : 'none'
  return (
    <CommandCanvasSortableHeading
      direction={direction}
      label={input.label}
      semantic={false}
      onClick={() => input.setSort({
        key: input.name,
        direction: input.sort.key === input.name && input.sort.direction === 'ascending' ? 'descending' : 'ascending',
      })}
    />
  )
}

function compareStores(left: IncentiveStore, right: IncentiveStore, sort: { key: SortKey | null; direction: 'ascending' | 'descending' }) {
  if (sort.key === null) return 0
  const direction = sort.direction === 'ascending' ? 1 : -1
  if (sort.key === 'name') return left.storeName.localeCompare(right.storeName, 'tr') * direction
  const leftValue = sortValue(left, sort.key)
  const rightValue = sortValue(right, sort.key)
  return (leftValue === rightValue ? left.storeName.localeCompare(right.storeName, 'tr') : leftValue < rightValue ? -1 : 1) * direction
}

function sortValue(store: IncentiveStore, key: Exclude<SortKey, 'name'>) {
  const value = key === 'target' ? store.storeTarget
    : key === 'actual' ? store.storeActualNetSales
      : key === 'achievement' ? store.storeAchievementPct
        : storeTotal(store)
  return Number(value ?? Number.NEGATIVE_INFINITY)
}

function storeTotal(store: IncentiveStore) { return sumMoney(store.rows.map((row) => row.finalAmount)) }
function regionTotal(stores: IncentiveStore[]) { return sumMoney(stores.map(storeTotal)) }
function calculateAchievement(target: string | null, actual: string | null) {
  if (target === null || actual === null || Number(target) <= 0) return null
  return ((Number(actual) / Number(target)) * 100).toFixed(2)
}
function initials(value: string | null) { return (value ?? '—').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('tr-TR') }
function positionLabel(code: string, t: Translate) {
  if (code === 'STORE_MANAGER') return t('storeIncentives.widgetPositionStoreManager')
  if (code === 'ASSISTANT_MANAGER') return t('storeIncentives.widgetPositionAssistantManager')
  if (code === 'SALES_ASSOCIATE') return t('storeIncentives.widgetPositionSalesAssociate')
  if (code === 'SENIOR_SALES_CONSULTANT') return t('storeIncentives.widgetPositionSeniorSalesConsultant')
  return code.replaceAll('_', ' ')
}
function achievementTone(value: string | null): 'default' | 'destructive' | 'outline' { return value === null ? 'outline' : Number(value) >= 80 ? 'default' : 'destructive' }
