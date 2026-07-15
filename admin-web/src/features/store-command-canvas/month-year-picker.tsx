import { useMemo, useState } from 'react'
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
import type { AppLocale } from '../../lib/i18n'

const monthLabels = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export type MonthYearPeriodPickerProps = {
  ariaLabel: string
  locale: AppLocale
  onValueChange: (value: string) => void
  value: string
  availableValues?: string[] | undefined
  maxValue?: string | undefined
  outputMode?: 'month' | 'period-start' | undefined
  popoverClassName?: string | undefined
  title?: string | undefined
  triggerClassName?: string | undefined
}

export function MonthYearPeriodPicker(input: MonthYearPeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const activeMonthKey = normalizeMonthKey(input.value) ?? normalizeMonthKey(input.maxValue) ?? getCurrentMonthKey()
  const [year, setYear] = useState(Number(activeMonthKey.slice(0, 4)))
  const outputMode = input.outputMode ?? 'month'
  const availableByMonth = useMemo(() => {
    const entries = (input.availableValues ?? [])
      .map((value) => ({ key: normalizeMonthKey(value), value }))
      .filter((entry): entry is { key: string; value: string } => Boolean(entry.key))

    return new Map(entries.map((entry) => [entry.key, entry.value]))
  }, [input.availableValues])
  const availableMonthKeys = [...availableByMonth.keys()]
  const maxMonthKey = normalizeMonthKey(input.maxValue) ?? getCurrentMonthKey()
  const years = buildYearOptions({
    activeYear: year,
    availableMonthKeys,
    maxYear: Number(maxMonthKey.slice(0, 4)),
  })

  function selectMonth(month: number) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (monthKey > maxMonthKey) return
    if (availableMonthKeys.length > 0 && !availableByMonth.has(monthKey)) return

    input.onValueChange(availableByMonth.get(monthKey) ?? formatOutputValue(monthKey, outputMode))
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setYear(Number(activeMonthKey.slice(0, 4)))
      }}
    >
      <PopoverTrigger asChild>
        <Button aria-label={input.ariaLabel} className={input.triggerClassName} type="button" variant="outline">
          <CalendarDays data-icon="inline-start" />
          {formatMonthYearLabel(activeMonthKey, input.locale)}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className={input.popoverClassName ?? 'tw:w-72'}>
        <PopoverHeader>
          <PopoverTitle>{input.title ?? 'Dönem seç'}</PopoverTitle>
        </PopoverHeader>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger aria-label="Yıl seç" className="tw:w-full">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {years.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="tw:grid tw:grid-cols-3 tw:gap-2">
          {(monthLabels[input.locale] ?? monthLabels.tr).map((label, index) => {
            const month = index + 1
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            const selected = monthKey === activeMonthKey
            const disabled =
              monthKey > maxMonthKey ||
              (availableMonthKeys.length > 0 && !availableByMonth.has(monthKey))

            return (
              <Button
                disabled={disabled}
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

function normalizeMonthKey(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) return null
  const match = normalized.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : null
}

function formatMonthYearLabel(value: string, locale: AppLocale) {
  const monthKey = normalizeMonthKey(value) ?? getCurrentMonthKey()
  const [yearInput, monthInput] = monthKey.split('-')
  const year = Number(yearInput ?? new Date().getFullYear())
  const month = Number(monthInput ?? 1)

  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatOutputValue(monthKey: string, outputMode: 'month' | 'period-start') {
  return outputMode === 'period-start' ? `${monthKey}-01` : monthKey
}

function buildYearOptions(input: {
  activeYear: number
  availableMonthKeys: string[]
  maxYear: number
}) {
  const availableYears = input.availableMonthKeys
    .map((value) => Number(value.slice(0, 4)))
    .filter(Number.isFinite)
  const minYear = availableYears.length > 0 ? Math.min(...availableYears, input.activeYear) : input.maxYear - 4
  const maxYear = availableYears.length > 0 ? Math.max(...availableYears, input.activeYear) : Math.max(input.maxYear, input.activeYear)
  const years: number[] = []

  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year)
  }

  return years.length > 0 ? years : [input.activeYear]
}
