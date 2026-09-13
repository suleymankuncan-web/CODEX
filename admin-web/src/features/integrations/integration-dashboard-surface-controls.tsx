import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { Field, FieldLabel } from '../../components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { AdminKeyValue } from '../../pages/admin-surface-primitives'
import type { TranslateFunction } from '../localization/dictionary'

const trNumberFormatter = new Intl.NumberFormat('tr-TR')

function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}

function IntegrationField(input: { children: ReactNode; label: string }) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{input.label}</FieldLabel>
      {isValidElement(input.children) ? cloneElement(input.children as ReactElement<{ id: string }>, { id }) : input.children}
    </Field>
  )
}

function IntegrationSelect(input: {
  children: ReactNode
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
}) {
  const options = Children.toArray(input.children).filter(isValidElement) as ReactElement<{ value: string; children: ReactNode }>[]
  return (
    <Select value={`value:${input.value}`} onValueChange={(value) => input.onValueChange(value.slice(6))} disabled={input.disabled ?? false}>
      <SelectTrigger id={input.id} aria-label={input['aria-label']} className="integration-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {options.map((option) => <SelectItem key={option.props.value} value={`value:${option.props.value}`}>{option.props.children}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  )
}

function IntegrationUploadDrop(input: {
  fileName: string
  icon: ReactNode
  onFileChange: (file: File | null) => void
  title: string
}) {
  return (
    <label className="integration-upload-drop tw:flex tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-border tw:bg-card tw:p-4 tw:transition hover:tw:border-primary/50 focus-within:tw:ring-2 focus-within:tw:ring-ring">
      <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
        {input.icon}
      </span>
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-sm tw:font-medium tw:text-foreground">{input.title}</span>
        <span className="tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{input.fileName}</span>
      </span>
      <input
        aria-label={input.title}
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
