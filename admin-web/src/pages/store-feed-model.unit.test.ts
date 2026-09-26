import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { FeedPost } from '../features/feed/contracts'
import { translate } from '../features/localization/dictionary'
import { compareFeedPosts, derivePostTitle, filterStoreFeedPosts } from './store-feed-model'
import { StoreFeedTable } from './store-feed-table'

const post = (overrides: Partial<FeedPost> = {}): FeedPost => ({
  feedPostId: 'announcement-1', postType: 'announcement', title: 'İZMİR mağazaları', body: 'Vitrin düzenlemesini kontrol edin.',
  linkLabel: null, linkUrl: null, visibilityScopeType: 'region', visibilityScopeIds: ['region-1'], isPinned: false,
  publishStatus: 'published', publishedAt: '2026-09-12T09:00:00', startsAt: null, endsAt: null,
  metricCode: null, metricLabel: null, challengeStartsOn: null, challengeEndsOn: null, targetRoute: null,
  createdByUserId: 'manager-1', updatedByUserId: 'manager-1', createdAt: '2026-09-12T09:00:00', updatedAt: '2026-09-12T09:00:00', ...overrides,
})

afterEach(() => vi.useRealTimers())

describe('store feed filtering', () => {
  it('searches Turkish titles, full bodies and metric labels without changing the source list', () => {
    const posts = [post(), post({ feedPostId: 'second', title: 'Diğer', body: 'Satış sonuçları', metricLabel: 'UPT' })]
    expect(filterStoreFeedPosts(posts, ' izmir ', 'all', 'tr')).toEqual([posts[0]])
    expect(filterStoreFeedPosts(posts, 'VİTRİN', 'all', 'tr')).toEqual([posts[0]])
    expect(filterStoreFeedPosts(posts, 'upt', 'all', 'tr')).toEqual([posts[1]])
    expect(posts).toHaveLength(2)
  })
  it('combines pin and today filters with the search, using publication date first', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-12T12:00:00'))
    const today = post({ isPinned: true })
    const old = post({ feedPostId: 'old', publishedAt: '2026-09-11T09:00:00' })
    expect(filterStoreFeedPosts([old, today], '', 'today', 'tr')).toEqual([today])
    expect(filterStoreFeedPosts([old, today], 'vitrin', 'pinned', 'tr')).toEqual([today])
    expect(filterStoreFeedPosts([old, today], 'eşleşmeyen', 'pinned', 'tr')).toEqual([])
  })
  it('keeps pinned announcements first and preserves newest-first ordering within each group', () => {
    const pinned = post({ feedPostId: 'pinned', isPinned: true, publishedAt: '2026-09-01T12:00:00' })
    const newer = post({ feedPostId: 'newer', publishedAt: '2026-09-12T12:00:00' })
    expect([post(), newer, pinned].sort(compareFeedPosts).map(item => item.feedPostId)).toEqual(['pinned', 'newer', 'announcement-1'])
  })
  it('retains the current creation title contract', () => {
    expect(derivePostTitle('\n  İlk satır  \nİkinci satır')).toBe('İlk satır')
    expect(derivePostTitle('a'.repeat(100))).toBe(`${'a'.repeat(93)}...`)
  })
})

describe('store feed read and manage surfaces', () => {
  function render(canManage: boolean) {
    return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(StoreFeedTable, {
      posts: [post({ linkLabel: 'Sıralamaları aç', targetRoute: '/store/rankings' })], locale: 'tr', t: (key, params) => translate('tr', key, params),
      canManagePost: () => canManage, editingPostId: null, editingBody: '', isMutationPending: false,
      onEditBodyChange: vi.fn(), onStartEdit: vi.fn(), onCancelEdit: vi.fn(), onSaveEdit: vi.fn(), onTogglePin: vi.fn(), onRemove: vi.fn(),
    })))
  }
  it('keeps complete content and existing destination visible for read-only users without management controls', () => {
    const html = render(false)
    expect(html).toContain('Vitrin düzenlemesini kontrol edin.')
    expect(html).toContain('href="/store/rankings"')
    expect(html).not.toContain('aria-label="Gönderi seçenekleri"')
    expect(html).not.toContain('Düzenle')
  })
  it('exposes an accessible options trigger only on the existing management surface', () => {
    expect(render(true)).toContain('aria-label="Gönderi seçenekleri"')
  })
})
