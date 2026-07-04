import type { ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type StoreWorkforceFilterOption = {
  value: string
  label: string
}

export function StoreWorkforceFilterSelect(input: {
  icon: ReactNode
  value: string
  ariaLabel: string
  options: readonly StoreWorkforceFilterOption[]
  onChange: (value: string) => void
}) {
  return (
    <div className="tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/90 tw:px-3">
      {input.icon}
      <Select value={input.value} onValueChange={input.onChange}>
        <SelectTrigger
          aria-label={input.ariaLabel}
          className="tw:h-auto tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:px-0 tw:py-0 tw:text-sm tw:font-medium tw:text-[#071333] tw:shadow-none tw:focus-visible:ring-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {input.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
