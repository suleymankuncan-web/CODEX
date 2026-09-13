import { Link } from 'react-router'
import { Check, ChevronRight, MoreVertical, Pencil, Pin, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { FeedPost } from '../features/feed/contracts'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import { formatPostTimestamp, getPostBody, getPostRowType, isEditedPost } from './store-feed-model'

type StoreFeedTableProps = {
  posts: FeedPost[]
  locale: AppLocale
  t: TranslateFunction
  canManage: boolean
  editingPostId: string | null
  editingBody: string
  isMutationPending: boolean
  onEditBodyChange: (value: string) => void
  onStartEdit: (post: FeedPost) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onTogglePin: (post: FeedPost) => void
  onRemove: (post: FeedPost) => void
}

export function StoreFeedTable(input: StoreFeedTableProps) {
  const { t } = input
  const tr = input.locale === 'tr'
  return <Table className="store-feed-table" aria-label={t('storeFeed.heroEyebrow')}>
    <TableHeader><TableRow>
      <TableHead scope="col">{tr ? 'Duyuru' : 'Announcement'}</TableHead>
      <TableHead scope="col">{tr ? 'Paylaşım tarihi' : 'Published'}</TableHead>
      <TableHead scope="col">{tr ? 'Durum' : 'Status'}</TableHead>
      {input.canManage ? <TableHead scope="col"><span className="tw:sr-only">{t('storeFeed.postOptionsAria')}</span></TableHead> : null}
    </TableRow></TableHeader>
    <TableBody>{input.posts.map(post => {
      const destination = post.targetRoute ?? post.linkUrl
      return <TableRow key={post.feedPostId} data-testid="store-feed-post-row">
        <TableCell>
          {input.editingPostId === post.feedPostId ? <div className="store-feed-editor">
            <FieldGroup><Field><FieldLabel htmlFor={`edit-${post.feedPostId}`}>{t('storeFeed.editBodyAria')}</FieldLabel><Textarea id={`edit-${post.feedPostId}`} value={input.editingBody} disabled={input.isMutationPending} onChange={event => input.onEditBodyChange(event.target.value)} autoFocus /></Field></FieldGroup>
            <div className="store-feed-editor-actions"><Button variant="outline" size="sm" disabled={input.isMutationPending} onClick={input.onCancelEdit}>{t('storeFeed.cancelAction')}</Button><Button size="sm" disabled={!input.editingBody.trim() || input.isMutationPending} onClick={input.onSaveEdit}><Check data-icon="inline-start" />{t('storeFeed.saveAction')}</Button></div>
          </div> : <div className="store-feed-content"><p>{getPostBody(post)}</p><div className="store-feed-metadata"><span>{getPostRowType(post) === 'focus' ? t('storeFeed.regionFocus') : t('storeFeed.type.announcement')}</span>{post.metricLabel ? <span>{post.metricLabel}</span> : null}{isEditedPost(post) ? <span>{t('storeFeed.edited')}</span> : null}</div>{destination && post.linkLabel ? <Button variant="link" size="sm" asChild><Link to={destination}>{post.linkLabel}<ChevronRight data-icon="inline-end" /></Link></Button> : null}</div>}
        </TableCell>
        <TableCell className="store-feed-date"><time dateTime={post.publishedAt ?? post.createdAt}>{formatPostTimestamp(post.publishedAt ?? post.createdAt, input.locale, t)}</time></TableCell>
        <TableCell className="store-feed-status"><Badge variant={post.isPinned ? 'secondary' : 'outline'}>{post.isPinned ? <><Pin data-icon="inline-start" />{t('storeFeed.pinned')}</> : t('storeFeed.published')}</Badge></TableCell>
        {input.canManage ? <TableCell className="store-feed-actions"><DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={input.isMutationPending} aria-label={t('storeFeed.postOptionsAria')}><MoreVertical /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => input.onStartEdit(post)}><Pencil />{t('storeFeed.editAction')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => input.onTogglePin(post)}><Pin />{post.isPinned ? t('storeFeed.unpinAction') : t('storeFeed.pinAction')}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => input.onRemove(post)}><Trash2 />{t('storeFeed.archiveAction')}</DropdownMenuItem>
          </DropdownMenuGroup></DropdownMenuContent>
        </DropdownMenu></TableCell> : null}
      </TableRow>
    })}</TableBody>
  </Table>
}
