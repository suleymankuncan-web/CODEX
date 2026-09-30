import { Fragment } from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StoreReturnRow } from './api'
import { returnDate, returnMoney, returnStatus } from './format'

export function StoreReturnsRows({ rows, locale }: { rows: StoreReturnRow[]; locale: 'tr' | 'en' }) {
  const tr = locale === 'tr'
  const labels = tr ? ['Personel', 'İlk satış mağazası', 'İade mağazası', 'Durum', 'İade tutarı'] : ['Personnel', 'Original store', 'Receiving store', 'Status', 'Return amount']
  return <Table className="tw:block tw:w-full tw:table-fixed tw:sm:table" aria-label={tr ? 'Tarihli iade dökümü' : 'Dated return ledger'}>
    <TableHeader className="tw:hidden tw:sm:table-header-group tw:sticky tw:top-0 tw:z-10 tw:bg-popover"><TableRow>{labels.map(label => <TableHead key={label} className="tw:px-3 tw:text-xs tw:whitespace-normal">{label}</TableHead>)}</TableRow></TableHeader>
    <TableBody className="tw:block tw:sm:table-row-group">{rows.map((row, index) => <Fragment key={row.returnId}>
      {index === 0 || row.businessDate !== rows[index - 1]?.businessDate ? <TableRow className="tw:block tw:bg-muted/50 tw:sm:table-row"><TableCell colSpan={5} className="tw:block tw:px-3 tw:py-2 tw:text-xs tw:font-semibold tw:sm:table-cell"><time dateTime={row.businessDate}>{returnDate(row.businessDate, locale)}</time></TableCell></TableRow> : null}
      <TableRow data-return-id={row.returnId} className="tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-2 tw:px-3 tw:py-2 tw:sm:table-row tw:sm:p-0">
        <TableCell className="tw:block tw:min-w-0 tw:p-0 tw:sm:table-cell tw:sm:p-3 tw:whitespace-normal tw:break-words"><span className="tw:block tw:text-[10px] tw:text-muted-foreground tw:sm:hidden">{labels[0]}</span><strong className="tw:text-xs">{row.displayName ?? (tr ? 'Personel eşleşmedi' : 'Unmatched personnel')}</strong><small className="tw:block tw:text-[11px] tw:text-muted-foreground">{row.personnelCode ?? '—'}</small></TableCell>
        <StoreCell label={labels[1]!} name={row.originalStoreName} code={row.originalStoreCode} locale={locale} />
        <StoreCell label={labels[2]!} name={row.receivingStoreName} code={row.receivingStoreCode} locale={locale} />
        <TableCell className="tw:block tw:min-w-0 tw:p-0 tw:sm:table-cell tw:sm:p-3 tw:whitespace-normal"><span className="tw:block tw:text-[10px] tw:text-muted-foreground tw:sm:hidden">{labels[3]}</span><Badge variant="outline" className="tw:h-auto tw:whitespace-normal tw:break-words tw:text-[10px]">{returnStatus(row, locale)}</Badge></TableCell>
        <TableCell className="tw:col-span-2 tw:block tw:min-w-0 tw:sm:table-cell tw:p-0 tw:sm:p-3 tw:text-right tw:tabular-nums tw:whitespace-normal"><span className="tw:mr-2 tw:text-[10px] tw:text-muted-foreground tw:sm:hidden">{labels[4]}</span><strong className="tw:text-xs">{returnMoney(row.signedAmount, locale)}</strong></TableCell>
      </TableRow>
    </Fragment>)}</TableBody>
  </Table>
}

function StoreCell({ label, name, code, locale }: { label: string; name: string | null; code: string | null; locale: 'tr' | 'en' }) {
  return <TableCell className="tw:block tw:min-w-0 tw:p-0 tw:sm:table-cell tw:sm:p-3 tw:whitespace-normal tw:break-words"><span className="tw:block tw:text-[10px] tw:text-muted-foreground tw:sm:hidden">{label}</span><span className="tw:text-xs">{name ?? (code ? (locale === 'tr' ? 'Şirket dışı mağaza' : 'External store') : '—')}</span><small className="tw:block tw:text-[11px] tw:text-muted-foreground">{code ?? '—'}</small></TableCell>
}
