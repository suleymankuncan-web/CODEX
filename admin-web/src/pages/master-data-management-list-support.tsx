import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { AdminStatePanel } from './admin-surface-primitives'

export function RecordArea(input: {
  children: ReactNode
  error: unknown
  loading: boolean
  onRetry: () => void
}) {
  if (input.loading) {
    return <div className="tw:p-4 tw:sm:p-5"><AdminStatePanel isLoading title="Kayıtlar yükleniyor" /></div>
  }
  if (input.error) {
    return (
      <div className="tw:p-4 tw:sm:p-5">
        <AdminStatePanel
          tone="danger"
          title="Kayıtlar alınamadı"
          description="Bağlantınızı kontrol edip yeniden deneyin."
          action={<Button onClick={input.onRetry} size="sm" variant="outline">Yeniden dene</Button>}
        />
      </div>
    )
  }
  return input.children
}

export function PaginationFooter(input: {
  label: string
  offset: number
  onPageChange: (page: number) => void
  page: number
  pageSize: number
  pending: boolean
  total: number
}) {
  const pageCount = Math.max(1, Math.ceil(input.total / input.pageSize))
  const visiblePage = Math.floor(input.offset / input.pageSize)
  const from = input.total === 0 ? 0 : input.offset + 1
  const to = Math.min(input.offset + input.pageSize, input.total)

  return (
    <footer aria-busy={input.pending} className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border tw:bg-muted/25 tw:px-4 tw:py-3 tw:sm:px-5">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
        {from}-{to} / {input.total} {input.label}
      </span>
      <div className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:min-w-10 tw:text-center tw:text-xs tw:text-muted-foreground">{visiblePage + 1} / {pageCount}</span>
        <Button aria-label={`Önceki ${input.label} sayfası`} disabled={input.pending || input.page === 0} onClick={() => input.onPageChange(Math.max(0, input.page - 1))} size="icon-sm" variant="outline">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button aria-label={`Sonraki ${input.label} sayfası`} disabled={input.pending || input.page + 1 >= pageCount} onClick={() => input.onPageChange(Math.min(pageCount - 1, input.page + 1))} size="icon-sm" variant="outline">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </footer>
  )
}
