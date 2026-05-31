import type { ReactNode, SelectHTMLAttributes } from 'react'
import { AdminKeyValue } from '../../pages/admin-surface-primitives'
import type { TranslateFunction } from '../localization/dictionary'

const trNumberFormatter = new Intl.NumberFormat('tr-TR')

function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}

function IntegrationField(input: { children: ReactNode; label: string }) {
  return (
    <label className="tw:grid tw:gap-1.5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      {input.children}
    </label>
  )
}

function IntegrationSelect(input: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...input}
      className={`tw:h-8 tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-2.5 tw:text-sm tw:font-medium tw:text-foreground tw:shadow-sm tw:outline-none tw:transition focus-visible:tw:border-ring focus-visible:tw:ring-3 focus-visible:tw:ring-ring/50 disabled:tw:cursor-not-allowed disabled:tw:opacity-50 ${input.className ?? ''}`}
    />
  )
}

function IntegrationUploadDrop(input: {
  fileName: string
  icon: ReactNode
  onFileChange: (file: File | null) => void
  title: string
}) {
  return (
    <label className="tw:flex tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-border tw:bg-background/70 tw:p-3 tw:transition hover:tw:border-primary/50">
      <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
        {input.icon}
      </span>
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{input.title}</span>
        <span className="tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{input.fileName}</span>
      </span>
      <input
        className="tw:sr-only"
        type="file"
        onChange={(event) => input.onFileChange(event.target.files?.[0] ?? null)}
      />
    </label>
  )
}

function IntegrationEvidenceValue(input: {
  description: string
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div className="tw:flex tw:items-start tw:gap-2">
        <span className="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
          {input.icon}
        </span>
        <div className="tw:min-w-0">
          <div className="tw:text-sm tw:font-medium tw:text-foreground">{input.label}</div>
          <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">{input.description}</p>
          <div className="tw:mt-2 tw:break-words tw:text-sm tw:font-medium tw:text-foreground">{input.value}</div>
        </div>
      </div>
    </div>
  )
}

function UploadSummaryGrid(input: {
  summary: {
    periodMonth: string | null
    periodStart: string
    periodEnd: string
    canonicalRowCount: number
    personnelRowsRead: number
    ignoredPersonnelRows: number
    scopeExcludedPersonnelRows: number
    personnelGrossSalesRows: number
    negativePersonnelRowsIgnored: number
    storeRowsRead: number
    scopeExcludedStoreRows: number
    mappingMode: string
    reconciliation: {
      comparedStoreCount: number
      balancedStoreCount: number
      warningStoreCount: number
      items: Array<unknown>
    }
  }
  t: TranslateFunction
}) {
  const summaryItems = [
    {
      label: input.t('adminIntegrations.period'),
      value: input.summary.periodMonth ?? `${input.summary.periodStart} / ${input.summary.periodEnd}`,
    },
    { label: input.t('adminIntegrations.canonicalKpiRows'), value: formatNumber(input.summary.canonicalRowCount) },
    { label: input.t('adminIntegrations.personnelRowsRead'), value: formatNumber(input.summary.personnelRowsRead) },
    { label: input.t('adminIntegrations.ignoredPersonnelRows'), value: formatNumber(input.summary.ignoredPersonnelRows) },
    { label: input.t('adminIntegrations.scopeExcludedPersonnelRows'), value: formatNumber(input.summary.scopeExcludedPersonnelRows) },
    { label: input.t('adminIntegrations.personnelGrossSalesRows'), value: formatNumber(input.summary.personnelGrossSalesRows) },
    { label: input.t('adminIntegrations.negativePersonnelRowsIgnored'), value: formatNumber(input.summary.negativePersonnelRowsIgnored) },
    { label: input.t('adminIntegrations.storeRowsRead'), value: formatNumber(input.summary.storeRowsRead) },
    { label: input.t('adminIntegrations.scopeExcludedStoreRows'), value: formatNumber(input.summary.scopeExcludedStoreRows) },
    { label: input.t('adminIntegrations.mappingMode'), value: input.summary.mappingMode },
  ]

  return (
    <section
      className="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4"
      aria-label={input.t('adminIntegrations.uploadResultAria')}
    >
      {summaryItems.map((item) => (
        <AdminKeyValue key={item.label} label={item.label} value={item.value} />
      ))}
      {input.summary.reconciliation.items.length > 0 ? (
        <>
          <AdminKeyValue label={input.t('adminIntegrations.comparedStores')} value={formatNumber(input.summary.reconciliation.comparedStoreCount)} />
          <AdminKeyValue label={input.t('adminIntegrations.balancedStores')} value={formatNumber(input.summary.reconciliation.balancedStoreCount)} />
          <AdminKeyValue label={input.t('adminIntegrations.warningStores')} value={formatNumber(input.summary.reconciliation.warningStoreCount)} />
        </>
      ) : null}
    </section>
  )
}

export {
  IntegrationEvidenceValue,
  IntegrationField,
  IntegrationSelect,
  IntegrationUploadDrop,
  UploadSummaryGrid,
}
