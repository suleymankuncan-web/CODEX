import type { ReactNode } from 'react'
import { AdminKeyValue, AdminKeyValueGrid, type AdminSurfaceTone } from '../../pages/admin-surface-primitives'

function DetailList(input: { items: [string, string][] }) {
  return (
    <AdminKeyValueGrid>
      {input.items.map(([label, value]) => (
        <AdminKeyValue key={label} label={label} value={value} />
      ))}
    </AdminKeyValueGrid>
  )
}

function DependencyCard(input: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <span className="tw:grid tw:size-8 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
        {input.icon}
      </span>
      <div className="tw:mt-2 tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</div>
      <div className="tw:mt-1 tw:break-words tw:text-sm tw:font-medium tw:text-foreground">{input.value}</div>
    </div>
  )
}

function ReconciliationStat(input: { label: string; value: string }) {
  return <AdminKeyValue label={input.label} value={input.value} />
}

function DetailProgressRow(input: {
  label: string
  rate: number
  tone: AdminSurfaceTone
  value: number
}) {
  const width = `${Math.max(0, Math.min(100, input.rate * 100))}%`
  const toneClass =
    input.tone === 'danger'
      ? 'tw:bg-rose-500'
      : input.tone === 'warning'
        ? 'tw:bg-amber-500'
        : input.tone === 'success'
          ? 'tw:bg-emerald-500'
          : 'tw:bg-primary'

  return (
    <div className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-sm">
        <span className="tw:text-muted-foreground">{input.label}</span>
        <span className="tw:font-medium tw:text-foreground">{input.value}</span>
      </div>
      <div className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-muted">
        <div className={`tw:h-full tw:rounded-full ${toneClass}`} style={{ width }} />
      </div>
    </div>
  )
}

function LineageChipList(input: { ariaLabel: string; children: ReactNode }) {
  return (
    <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2" aria-label={input.ariaLabel}>
      {input.children}
    </div>
  )
}

function LineageChip(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-background/70 tw:px-3 tw:py-2">
      <span className="tw:block tw:text-[0.7rem] tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <code className="tw:block tw:max-w-full tw:break-all tw:text-xs tw:text-foreground">{input.value}</code>
    </div>
  )
}

export {
  DependencyCard,
  DetailList,
  DetailProgressRow,
  LineageChip,
  LineageChipList,
  ReconciliationStat,
}
