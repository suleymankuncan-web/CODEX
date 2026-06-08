import { cn } from '@/lib/utils'

const textInk = 'tw:text-[#071333]'
const textMuted = 'tw:text-[#647194]'

export function MiniBars(input: { inactive?: boolean }) {
  const muted = input.inactive ? 'tw:opacity-35' : undefined

  return (
    <div className={cn('tw:flex tw:h-[18px] tw:w-28 tw:items-center tw:gap-1', muted)} aria-hidden="true">
      <span className="tw:block tw:h-2.5 tw:w-[54%] tw:rounded-full tw:bg-[#6847ff]" />
      <span className="tw:block tw:h-2.5 tw:w-[16%] tw:rounded-full tw:bg-[#f59e0b]" />
      <span className="tw:block tw:h-2.5 tw:w-[18%] tw:rounded-full tw:bg-[#20bfd3]" />
      <span className="tw:block tw:h-2.5 tw:w-[12%] tw:rounded-full tw:bg-[#12a873]" />
    </div>
  )
}

export function MiniMetric(input: { label: string; value: string }) {
  return (
    <div className="tw:rounded-2xl tw:border tw:border-[#dfe6f3] tw:bg-white/75 tw:p-3">
      <span className={cn('tw:text-xs tw:font-semibold', textMuted)}>{input.label}</span>
      <strong className={cn('tw:mt-1 tw:block tw:truncate tw:text-lg tw:font-bold', textInk)}>
        {input.value}
      </strong>
    </div>
  )
}

export function MiniValue(input: { label: string; value: string }) {
  return (
    <div className="tw:rounded-xl tw:border tw:border-[#dfe6f3] tw:bg-white/70 tw:p-2.5">
      <span className={cn('tw:block tw:text-[11px] tw:font-semibold', textMuted)}>
        {input.label}
      </span>
      <strong className={cn('tw:mt-1 tw:block tw:text-xs tw:font-bold', textInk)}>
        {input.value}
      </strong>
    </div>
  )
}
