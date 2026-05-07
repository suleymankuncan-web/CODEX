import type { ReactNode } from 'react'

export function ReportingToolbar(input: {
  sortValue: string
  onSortChange: (value: string) => void
  sortOptions: Array<{ value: string; label: string }>
  onExport: () => void
  sortAriaLabel?: string
  exportLabel?: string
  children?: ReactNode
}) {
  return (
    <div className="toolbar-cluster">
      {input.children}
      <label className="control-select">
        <span className="sr-only">{input.sortAriaLabel ?? 'Sort rows'}</span>
        <select value={input.sortValue} onChange={(event) => input.onSortChange(event.target.value)}>
          {input.sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button className="control-button" type="button" onClick={input.onExport}>
        {input.exportLabel ?? 'Export CSV'}
      </button>
    </div>
  )
}
