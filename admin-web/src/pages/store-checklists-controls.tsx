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
        <input
          aria-label={getStaticCopy(input.locale, 'Checklist arama', 'Checklist search')}
          placeholder={getStaticCopy(input.locale, 'Mağaza veya checklist ara', 'Search store or checklist')}
          value={input.searchQuery}
          onChange={(event) => input.onSearchChange(event.target.value)}
        />
      </label>
      <label className="store-checklists-filter">
        <span>{getStaticCopy(input.locale, 'Ay', 'Month')}</span>
        <select
          aria-label={getStaticCopy(input.locale, 'Ay filtresi', 'Month filter')}
          value={input.selectedMonth}
          onChange={(event) => input.onMonthChange(event.target.value)}
        >
          {input.monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.templateType')}</span>
        <select
          aria-label={input.t('storeChecklists.templateType')}
          value={input.typeFilter}
          onChange={(event) => input.onTypeChange(event.target.value as ChecklistTypeFilter)}
        >
          {input.typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.status')}</span>
        <select
          aria-label={input.t('storeChecklists.status')}
          value={input.statusFilter}
          onChange={(event) => input.onStatusChange(event.target.value as ChecklistStatusFilter)}
        >
          <option value="all">{getStaticCopy(input.locale, 'Tüm durumlar', 'All statuses')}</option>
          <option value="missing">{input.t('storeChecklists.noVisit')}</option>
          <option value="draft">{input.t('storeChecklists.coverage.draft')}</option>
          <option value="completed">{input.t('storeChecklists.status.completed')}</option>
          <option value="pending">{input.t('storeChecklists.needsAcknowledgement')}</option>
          <option value="acknowledged">{input.t('storeChecklists.acknowledged')}</option>
        </select>
      </label>
      <button className="store-checklists-ghost-button" type="button" onClick={input.onClear}>
        {getStaticCopy(input.locale, 'Filtreleri sıfırla', 'Reset filters')}
      </button>
    </section>
  )
}

export function ChecklistTabs(input: {
  activeTab: ChecklistTab
  tabs: ChecklistTabOption[]
  onChange: (tab: ChecklistTab) => void
}) {
  return (
    <nav className="store-checklists-tabs" role="tablist" aria-label="Checklist bölümleri">
      {input.tabs.map((tab) => (
        <button
          aria-controls={`store-checklist-panel-${tab.key}`}
          aria-selected={input.activeTab === tab.key}
          className={`store-checklists-tab store-checklists-tone-${tab.tone}`}
          id={`store-checklist-tab-${tab.key}`}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => input.onChange(tab.key)}
        >
          <span>{tab.label}</span>
          <small>{tab.count}</small>
        </button>
      ))}
    </nav>
  )
}
