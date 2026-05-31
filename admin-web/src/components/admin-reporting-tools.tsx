import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { cn } from '../lib/utils'

type AdminReportingToolbarInput = {
  sortValue: string
  onSortChange: (value: string) => void
  sortOptions: Array<{ value: string; label: string }>
  onExport: () => void
  sortAriaLabel?: string
  exportLabel?: string
  children?: ReactNode
  className?: string
}

export function AdminReportingToolbar(input: AdminReportingToolbarInput) {
  return (
    <div className={cn('tw:flex tw:w-full tw:flex-col tw:gap-2 tw:sm:w-auto tw:sm:flex-row tw:sm:items-center', input.className)}>
      {input.children}
      <Select value={input.sortValue} onValueChange={input.onSortChange}>
        <SelectTrigger
          aria-label={input.sortAriaLabel ?? 'Sort rows'}
          className="tw:w-full tw:min-w-48 tw:bg-background/70 tw:sm:w-56"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {input.sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={input.onExport}>
        <Download aria-hidden="true" />
        {input.exportLabel ?? 'Export CSV'}
      </Button>
    </div>
  )
}
