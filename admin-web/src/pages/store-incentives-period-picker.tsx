import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { monthLabels, formatPeriodLabel, parsePeriod } from './store-incentives-period-model'

export function PeriodPicker(input: {
  period: string
  onChange: (period: string) => void
  triggerClassName?: string
}) {
  const parsed = parsePeriod(input.period)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(parsed.year)
  const yearOptions = Array.from({ length: 7 }, (_, index) => parsed.year - 3 + index)

  function selectMonth(month: number) {
    input.onChange(`${year}-${String(month).padStart(2, '0')}`)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setYear(parsed.year)
      }}
    >
      <PopoverTrigger asChild>
        <Button className={input.triggerClassName} type="button" variant="outline">
          <CalendarDays data-icon="inline-start" />
          {formatPeriodLabel(input.period)}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="tw:w-72">
        <PopoverHeader>
          <PopoverTitle>Dönem seç</PopoverTitle>
        </PopoverHeader>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger aria-label="Yıl seç" className="tw:w-full">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="tw:grid tw:grid-cols-3 tw:gap-2">
          {monthLabels.map((label, index) => {
            const month = index + 1
            const value = `${year}-${String(month).padStart(2, '0')}`
            const selected = value === input.period

            return (
              <Button
                key={label}
                onClick={() => selectMonth(month)}
                size="sm"
                type="button"
                variant={selected ? 'default' : 'outline'}
              >
                {label.slice(0, 3)}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
