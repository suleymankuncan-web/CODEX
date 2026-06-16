import {
  AlertTriangle,
  Archive,
  History,
  ListChecks,
  MapPinned,
  RefreshCw,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import type {
  ChecklistStatusFilter,
  ChecklistTab,
  ChecklistTabOption,
  ChecklistTypeFilter,
} from './store-checklists-model'
import { getStaticCopy } from './store-checklists-logic'

export function ChecklistToolbar(input: {
  locale: AppLocale
  monthOptions: Array<{ label: string; value: string }>
  searchQuery: string
  selectedMonth: string
  statusFilter: ChecklistStatusFilter
  t: TranslateFunction
  typeFilter: ChecklistTypeFilter
  typeOptions: Array<{ value: ChecklistTypeFilter; label: string }>
  onClear: () => void
  onMonthChange: (value: string) => void
  onSearchChange: (value: string) => void
  onStatusChange: (value: ChecklistStatusFilter) => void
  onTypeChange: (value: ChecklistTypeFilter) => void
}) {
  return (
    <section
      className="store-checklists-toolbar"
      aria-label={getStaticCopy(input.locale, 'Checklist filtreleri', 'Checklist filters')}
    >
      <label className="store-checklists-filter store-checklists-filter-search">
        <span>{getStaticCopy(input.locale, 'Arama', 'Search')}</span>
        <div className="store-checklists-search-shell">
          <Search aria-hidden="true" />
          <Input
            aria-label={getStaticCopy(input.locale, 'Checklist arama', 'Checklist search')}
            placeholder={getStaticCopy(input.locale, 'Mağaza veya checklist ara', 'Search store or checklist')}
            value={input.searchQuery}
            onChange={(event) => input.onSearchChange(event.target.value)}
          />
        </div>
      </label>
      <label className="store-checklists-filter">
        <span>{getStaticCopy(input.locale, 'Ay', 'Month')}</span>
        <Select value={input.selectedMonth} onValueChange={input.onMonthChange}>
          <SelectTrigger aria-label={getStaticCopy(input.locale, 'Ay filtresi', 'Month filter')} className="tw:w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {input.monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.templateType')}</span>
        <Select
          value={input.typeFilter}
          onValueChange={(value) => input.onTypeChange(value as ChecklistTypeFilter)}
        >
          <SelectTrigger aria-label={input.t('storeChecklists.templateType')} className="tw:w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {input.typeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.status')}</span>
        <Select
          value={input.statusFilter}
          onValueChange={(value) => input.onStatusChange(value as ChecklistStatusFilter)}
        >
          <SelectTrigger aria-label={input.t('storeChecklists.status')} className="tw:w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{getStaticCopy(input.locale, 'Tüm durumlar', 'All statuses')}</SelectItem>
              <SelectItem value="missing">{input.t('storeChecklists.noVisit')}</SelectItem>
              <SelectItem value="draft">{input.t('storeChecklists.coverage.draft')}</SelectItem>
              <SelectItem value="completed">{input.t('storeChecklists.status.completed')}</SelectItem>
              <SelectItem value="pending">{input.t('storeChecklists.needsAcknowledgement')}</SelectItem>
              <SelectItem value="acknowledged">{input.t('storeChecklists.acknowledged')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
      <Button className="store-checklists-reset-button" type="button" variant="outline" onClick={input.onClear}>
        <RefreshCw data-icon="inline-start" />
        {getStaticCopy(input.locale, 'Filtreleri sıfırla', 'Reset filters')}
      </Button>
    </section>
  )
}

export function ChecklistTabs(input: {
  activeTab: ChecklistTab
  locale: AppLocale
  tabs: ChecklistTabOption[]
  onChange: (tab: ChecklistTab) => void
}) {
  const activeTab = input.tabs.find((tab) => tab.key === input.activeTab) ?? input.tabs[0]
  if (!activeTab) return null
  const sectionPickerLabel = getStaticCopy(input.locale, 'Checklist bölümleri', 'Checklist sections')

  return (
    <>
      <div className="store-checklists-mobile-tab-picker">
        <Select
          value={activeTab?.key}
          onValueChange={(value) => input.onChange(value as ChecklistTab)}
        >
          <SelectTrigger aria-label={sectionPickerLabel} className="tw:w-full">
            <div className="store-checklists-mobile-tab-value">
              {activeTab ? <ChecklistTabIcon tab={activeTab.key} /> : <ListChecks aria-hidden="true" />}
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {input.tabs.map((tab) => (
                <SelectItem key={tab.key} value={tab.key}>
                  {tab.label} ({tab.count})
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div
        className="store-checklists-tabs"
        aria-label={sectionPickerLabel}
        role="tablist"
      >
        {input.tabs.map((tab, index) => (
          <Button
            aria-controls={`store-checklist-panel-${tab.key}`}
            aria-selected={input.activeTab === tab.key}
            className={`store-checklists-tab store-checklists-tab-${tab.key} store-checklists-tone-${tab.tone}`}
            id={`store-checklist-tab-${tab.key}`}
            key={tab.key}
            role="tab"
            tabIndex={input.activeTab === tab.key ? 0 : -1}
            type="button"
            variant="ghost"
            onClick={() => input.onChange(tab.key)}
            onKeyDown={(event) => {
              if (input.tabs.length === 0) return
              const lastIndex = input.tabs.length - 1
              const nextIndex =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? (index + 1) % input.tabs.length
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? (index - 1 + input.tabs.length) % input.tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? lastIndex
                        : index

              if (nextIndex === index) return

              event.preventDefault()
              const nextTab = input.tabs[nextIndex]
              if (!nextTab) return
              input.onChange(nextTab.key)
              window.requestAnimationFrame(() => {
                document.getElementById(`store-checklist-tab-${nextTab.key}`)?.focus()
              })
            }}
          >
            <ChecklistTabIcon tab={tab.key} />
            <span>{tab.label}</span>
            <small>{tab.count}</small>
          </Button>
        ))}
      </div>
    </>
  )
}

function ChecklistTabIcon(input: { tab: ChecklistTab }) {
  if (input.tab === 'inbox') return <Archive aria-hidden="true" />
  if (input.tab === 'incomplete') return <AlertTriangle aria-hidden="true" />
  if (input.tab === 'history') return <History aria-hidden="true" />
  if (input.tab === 'plan') return <MapPinned aria-hidden="true" />
  return <ListChecks aria-hidden="true" />
}
