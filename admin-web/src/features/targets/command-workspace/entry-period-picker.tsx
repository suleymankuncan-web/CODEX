import { CalendarPicker } from '@/components/ui/calendar-picker'
import type { AppLocale } from '@/lib/i18n'
import type { TargetCommandStore } from './types'

export function TargetEntryPeriodPicker(input: {
  locale: AppLocale
  value: string
  store: TargetCommandStore | null
  previewYear: number
  onPreviewYearChange: (year: number) => void
  onValueChange: (period: string) => void
}) {
  const label = input.locale === 'tr' ? 'Hedef Gönderilecek Ayı Seçin' : 'Select Target Submission Month'
  return <div className="target-entry-period"><span>{label}</span>
    <CalendarPicker mode="month" value={input.value} locale={input.locale} ariaLabel={label}
      contentClassName="target-entry-period-popover"
      onMonthPreview={month => input.onPreviewYearChange(month.getFullYear())}
      onValueChange={input.onValueChange}
      monthDescription={month => {
        const period = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0')
        const status = input.store?.monthStatuses.find(item => item.period === period)
        const text = status?.isApproved ? (input.locale === 'tr' ? 'Onaylı' : 'Approved')
          : status?.status === 'pending' ? (input.locale === 'tr' ? 'Onay bekliyor' : 'Awaiting approval')
          : status?.status === 'returned' ? (input.locale === 'tr' ? 'İade edildi' : 'Returned')
          : (input.locale === 'tr' ? 'Durum kaydı yok' : 'No status record')
        return <p role="status" className="tw:m-0 tw:text-xs tw:text-muted-foreground">{text}</p>
      }} />
  </div>
}
