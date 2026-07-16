import { useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AppLocale } from '@/lib/i18n'
import type { TargetCommandStore } from './types'

const months = {
  tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
} as const

export function TargetEntryPeriodPicker(input: {
  locale: AppLocale
  value: string
  store: TargetCommandStore | null
  previewYear: number
  onPreviewYearChange: (year: number) => void
  onValueChange: (period: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedYear = Number(input.value.slice(0, 4))
  const selectedMonth = Number(input.value.slice(5, 7)) - 1
  const labels = months[input.locale]
  const monthStatuses = new Map(input.store?.monthStatuses.map((item) => [item.period, item]) ?? [])
  const copy =
    input.locale === 'tr'
      ? {
          label: 'Hedef Gönderilecek Ayı Seçin',
          dialog: 'Hedef gönderilecek ay',
          approved: 'Onaylı',
          pending: 'Onay bekliyor',
          returned: 'İade edildi',
          noRecord: 'Durum kaydı yok',
          selected: 'Seçili ay',
        }
      : {
          label: 'Select Target Submission Month',
          dialog: 'Target submission month',
          approved: 'Approved',
          pending: 'Awaiting approval',
          returned: 'Returned',
          noRecord: 'No status record',
          selected: 'Selected month',
        }
  return (
    <div className="target-entry-period">
      <span>{copy.label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button aria-expanded={open} variant="outline">
            <CalendarDays />
            {labels[selectedMonth]} {selectedYear}
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-label={copy.dialog} className="target-entry-period-popover">
          <div className="target-entry-year">
            <Button
              aria-label="previous year"
              onClick={() => input.onPreviewYearChange(input.previewYear - 1)}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft />
            </Button>
            <strong>{input.previewYear}</strong>
            <Button
              aria-label="next year"
              onClick={() => input.onPreviewYearChange(input.previewYear + 1)}
              size="icon"
              variant="ghost"
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="target-entry-months">
            {labels.map((label, index) => {
              const period = `${input.previewYear}-${String(index + 1).padStart(2, '0')}`
              const monthStatus = monthStatuses.get(period)
              const isApproved = monthStatus?.isApproved ?? false
              const selected = period === input.value
              const stateClass = isApproved
                ? 'is-approved'
                : monthStatus?.status === 'pending'
                  ? 'is-pending'
                  : monthStatus?.status === 'returned'
                    ? 'is-returned'
                    : ''
              return (
                <button
                  aria-pressed={selected}
                  className={stateClass}
                  key={period}
                  onClick={() => {
                    input.onValueChange(period)
                    setOpen(false)
                  }}
                  type="button"
                >
                  <span>{label}</span>
                  <small>
                    {isApproved ? (
                      <>
                        <CheckCircle2 />
                        {copy.approved}
                      </>
                    ) : monthStatus?.status === 'pending' ? (
                      copy.pending
                    ) : monthStatus?.status === 'returned' ? (
                      copy.returned
                    ) : monthStatus?.status === 'unknown' ? (
                      copy.noRecord
                    ) : selected ? (
                      copy.selected
                    ) : (
                      copy.noRecord
                    )}
                  </small>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
