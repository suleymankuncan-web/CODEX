import { useState, type ReactNode } from 'react'
import { ArrowUpRight, Search } from 'lucide-react'
import { Button } from '../components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { AdminSurfaceEmpty } from './admin-surface-primitives'
import { useLocalization } from '../features/localization/useLocalization'

export type InboxRecord = {
  id: string
  title: string
  store: string
  summary: string
  status: ReactNode
  detail: ReactNode
}

/** Shared inbox table: private request fields are revealed only in the review sheet. */
export function InboxRecords(input: { records: InboxRecord[]; title: string; toolbar?: ReactNode }) {
  const { t, locale } = useLocalization()
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase(locale)
  const records = input.records.filter(record => `${record.title} ${record.store} ${record.summary}`.toLocaleLowerCase(locale).includes(query))

  return <div className="admin-inbox-records">
    <div className="admin-inbox-toolbar">
      <InputGroup className="admin-inbox-search">
        <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
        <InputGroupInput value={search} onChange={event => setSearch(event.target.value)} aria-label={t('adminInbox.search')} placeholder={t('adminInbox.search')} />
      </InputGroup>
      {input.toolbar}
      <span className="admin-inbox-result-count" role="status">{t('adminInbox.recordCount', { count: records.length })}</span>
    </div>
    {records.length ? <Table className="admin-inbox-table" aria-label={input.title}>
      <TableHeader><TableRow>
        <TableHead>{t('adminInbox.record')}</TableHead>
        <TableHead className="admin-inbox-store-column">{t('storeTasks.store')}</TableHead>
        <TableHead>{t('adminInbox.status')}</TableHead>
        <TableHead><span className="tw:sr-only">{t('adminInbox.openDetail')}</span></TableHead>
      </TableRow></TableHeader>
      <TableBody>{records.map(record => <TableRow key={record.id}>
        <TableCell><strong className="admin-inbox-record-title">{record.title}</strong><span className="admin-inbox-record-summary">{record.summary}</span><span className="admin-inbox-mobile-store">{record.store}</span></TableCell>
        <TableCell className="admin-inbox-store-column">{record.store}</TableCell>
        <TableCell className="admin-inbox-status-cell">{record.status}</TableCell>
        <TableCell><Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={t('adminInbox.openRecord', { title: record.title })}><ArrowUpRight aria-hidden="true" /></Button></SheetTrigger>
          <SheetContent className="admin-inbox-sheet" closeLabel={t('adminInbox.close')}>
            <SheetHeader><SheetTitle>{record.title}</SheetTitle><SheetDescription>{record.store}</SheetDescription></SheetHeader>
            <div className="admin-inbox-sheet-body">{record.detail}</div>
          </SheetContent>
        </Sheet></TableCell>
      </TableRow>)}</TableBody>
    </Table> : <AdminSurfaceEmpty title={t('adminInbox.noMatches')} copy={t('adminInbox.changeFilters')} />}
  </div>
}
