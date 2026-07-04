import { useEffect, useState } from 'react'
import {
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Megaphone,
  MoreVertical,
  Pencil,
  Pin,
  RefreshCcw,
  Send,
  Store,
  Trash2,
} from 'lucide-react'

type FeedPostType = 'announcement' | 'focus'
type FeedTone = 'plum' | 'cyan' | 'mint' | 'amber'

type FeedPost = {
  id: string
  body: string
  edited?: boolean
  linkLabel?: string
  metric?: string
  pinned: boolean
  postedAt: string
  type: FeedPostType
}

const initialPosts: FeedPost[] = [
  {
    id: 'may-upt',
    body: 'Haziran ayı UPT odağı için ilk 10 mağaza paylaşımı yayınlandı. Gün sonu kontrollerinde mağaza ekibiyle birlikte takip edin.',
    linkLabel: 'Rankings',
    metric: 'UPT',
    pinned: true,
    postedAt: 'Bugün 09:20',
    type: 'focus',
  },
  {
    id: 'visual-standard',
    body: 'Vitrin kontrol listesi cuma kapanışına kadar tamamlanacak. Eksik kalan mağazalar için kısa not bırakılması yeterli.',
    linkLabel: 'Checklist',
    pinned: false,
    postedAt: 'Dün 17:45',
    type: 'announcement',
  },
  {
    id: 'weekend',
    body: 'Hafta sonu yoğunluğu için kasa destek planı mağaza müdürüyle paylaşılacak. Planı tamamlanan mağazalar dönüş yapmasın.',
    linkLabel: 'Görevler',
    pinned: false,
    postedAt: '24 Haziran 14:10',
    type: 'announcement',
  },
]

const metricCards = [
  { label: 'Görünür duyuru', value: '12', note: 'Bölge mağazalarına açık', icon: Megaphone, tone: 'plum' },
  { label: 'Sabitlenen', value: '3', note: 'Üstte kalan paylaşım', icon: Pin, tone: 'amber' },
  { label: 'Bugün paylaşılan', value: '4', note: 'Son 24 saat', icon: Clock3, tone: 'cyan' },
  { label: 'Bölge mağazası', value: '30', note: 'Duyuru kapsamı', icon: Store, tone: 'mint' },
] satisfies Array<{
  icon: typeof Megaphone
  label: string
  note: string
  tone: FeedTone
  value: string
}>

export function StoreFeedRegionComposerV1Prototype() {
  const [notice, setNotice] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [pinNextPost, setPinNextPost] = useState(false)
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [removedPostSnapshot, setRemovedPostSnapshot] = useState<{ index: number; post: FeedPost } | null>(null)
  const [posts, setPosts] = useState(initialPosts)

  const canPublish = body.trim().length > 0
  const visiblePosts = [...posts].sort((left, right) => Number(right.pinned) - Number(left.pinned))

  useEffect(() => {
    if (!openPostMenuId) return

    function closeMenuWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPostMenuId(null)
      }
    }

    window.addEventListener('keydown', closeMenuWithEscape)

    return () => window.removeEventListener('keydown', closeMenuWithEscape)
  }, [openPostMenuId])

  function publishPost() {
    if (!canPublish) return

    const nextPost: FeedPost = {
      id: `prototype-${Date.now()}`,
      body: body.trim(),
      pinned: pinNextPost,
      postedAt: 'Şimdi',
      type: 'announcement',
    }

    setPosts((current) => [nextPost, ...current])
    setBody('')
    setPinNextPost(false)
    setRemovedPostSnapshot(null)
    setNotice(pinNextPost ? 'Bölge duyurusu sabitlenerek paylaşıldı.' : 'Bölge duyurusu paylaşıldı.')
  }

  function startEditingPost(post: FeedPost) {
    setEditingPostId(post.id)
    setEditingBody(post.body)
    setOpenPostMenuId(null)
  }

  function cancelEditingPost() {
    setEditingPostId(null)
    setEditingBody('')
  }

  function saveEditingPost() {
    const nextBody = editingBody.trim()
    if (!editingPostId || nextBody.length === 0) return

    setPosts((current) =>
      current.map((post) => (post.id === editingPostId ? { ...post, body: nextBody, edited: true } : post)),
    )
    setEditingPostId(null)
    setEditingBody('')
    setRemovedPostSnapshot(null)
    setNotice('Gönderi güncellendi.')
  }

  function togglePostPin(postId: string) {
    const targetPost = posts.find((post) => post.id === postId)

    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)))
    setOpenPostMenuId(null)
    setRemovedPostSnapshot(null)
    setNotice(targetPost?.pinned ? 'Gönderi sabitlemeden kaldırıldı.' : 'Gönderi sabitlendi.')
  }

  function removePost(postId: string) {
    const targetPostIndex = posts.findIndex((post) => post.id === postId)
    const targetPost = posts[targetPostIndex]

    if (!targetPost) return

    setPosts((current) => current.filter((post) => post.id !== postId))
    setOpenPostMenuId(null)
    setRemovedPostSnapshot({ index: targetPostIndex, post: targetPost })
    if (editingPostId === postId) {
      cancelEditingPost()
    }
    setNotice('Gönderi yayından kaldırıldı.')
  }

  function undoRemovePost() {
    if (!removedPostSnapshot) return

    setPosts((current) => {
      if (current.some((post) => post.id === removedPostSnapshot.post.id)) return current

      const nextPosts = [...current]
      nextPosts.splice(Math.min(removedPostSnapshot.index, nextPosts.length), 0, removedPostSnapshot.post)
      return nextPosts
    })
    setRemovedPostSnapshot(null)
    setNotice('Gönderi geri alındı.')
  }

  return (
    <section
      className="feed-command"
      aria-labelledby="feed-command-title"
      onClick={() => setOpenPostMenuId(null)}
    >
      <header className="feed-command-hero">
        <div className="feed-command-title-block">
          <div className="feed-command-pills">
            <span className="feed-pill feed-pill-primary">
              <Megaphone size={15} />
              Duyurular
            </span>
            <span className="feed-pill">Bölge müdürü</span>
            <span className="feed-pill feed-pill-soft">Onur Kaytan Bölgesi</span>
          </div>
          <h1 id="feed-command-title">Duyurular</h1>
          <p>Bölge mağazalarına giden hızlı duyuru ve paylaşım akışı.</p>
        </div>
        <div className="feed-command-actions">
          <button type="button" className="feed-button feed-button-muted">
            <RefreshCcw size={16} />
            Yenile
          </button>
        </div>
      </header>

      <div className="feed-metrics">
        {metricCards.map((card) => {
          const Icon = card.icon
          return (
            <article className={`feed-metric feed-metric-${card.tone}`} key={card.label}>
              <span className="feed-metric-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </article>
          )
        })}
      </div>

      <section className="feed-composer-card feed-composer-card-compact" aria-label="Bölge duyurusu paylaş">
        <div className="feed-composer-avatar" aria-hidden="true">
          <Megaphone size={20} />
        </div>
        <div className="feed-composer-form">
          <textarea
            aria-label="Duyuru içeriği"
            className="feed-composer-body"
            placeholder="Bölge mağazalarına ne duyurmak istiyorsun?"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="feed-composer-footer">
            <span className="feed-composer-context">Onur Kaytan Bölgesi</span>
            <div className="feed-composer-actions">
              <button
                type="button"
                className={`feed-pin-toggle${pinNextPost ? ' feed-pin-toggle-active' : ''}`}
                aria-pressed={pinNextPost}
                onClick={() => setPinNextPost((current) => !current)}
              >
                <Pin size={15} />
                Sabitle
              </button>
              <button
                type="button"
                className="feed-button feed-button-primary feed-composer-submit"
                disabled={!canPublish}
                onClick={publishPost}
              >
                <Send size={16} />
                Paylaş
              </button>
            </div>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="feed-notice">
          <span className="feed-notice-copy">
            <Check size={16} />
            {notice}
          </span>
          {removedPostSnapshot ? (
            <button type="button" className="feed-notice-action" onClick={undoRemovePost}>
              Geri al
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="feed-list-panel feed-list-panel-full">
        <div className="feed-list-head">
          <div>
            <h2>Bölge akışı</h2>
            <p>En yeni duyurular ve bölge paylaşımları.</p>
          </div>
          <span>{posts.length} kayıt</span>
        </div>

        <div className="feed-list">
          {visiblePosts.map((post, index) => (
            <FeedPostRow
              key={post.id}
              post={post}
              editingBody={editingBody}
              isEditing={editingPostId === post.id}
              isMenuOpen={openPostMenuId === post.id}
              opensUp={index === visiblePosts.length - 1}
              onCancelEdit={cancelEditingPost}
              onEditBodyChange={setEditingBody}
              onMenuToggle={() => setOpenPostMenuId((current) => (current === post.id ? null : post.id))}
              onRemove={() => removePost(post.id)}
              onSaveEdit={saveEditingPost}
              onStartEdit={() => startEditingPost(post)}
              onTogglePin={() => togglePostPin(post.id)}
            />
          ))}
        </div>
      </section>
    </section>
  )
}

function FeedPostRow(input: {
  editingBody: string
  isEditing: boolean
  isMenuOpen: boolean
  opensUp: boolean
  onCancelEdit: () => void
  onEditBodyChange: (value: string) => void
  onMenuToggle: () => void
  onRemove: () => void
  onSaveEdit: () => void
  onStartEdit: () => void
  onTogglePin: () => void
  post: FeedPost
}) {
  return (
    <article className={`feed-post-row feed-post-${input.post.type}`}>
      <div
        className={`feed-post-menu-wrap${input.isMenuOpen ? ' feed-post-menu-wrap-open' : ''}${
          input.opensUp ? ' feed-post-menu-wrap-up' : ''
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="feed-post-menu-button"
          aria-expanded={input.isMenuOpen}
          aria-label="Gönderi seçenekleri"
          onClick={input.onMenuToggle}
        >
          <MoreVertical size={18} />
        </button>
        {input.isMenuOpen ? (
          <div className="feed-post-menu" role="menu">
            <button type="button" role="menuitem" onClick={input.onStartEdit}>
              <Pencil size={15} />
              Düzenle
            </button>
            <button type="button" role="menuitem" onClick={input.onTogglePin}>
              <Pin size={15} />
              {input.post.pinned ? 'Sabitlemeden kaldır' : 'Sabitle'}
            </button>
            <button type="button" role="menuitem" className="feed-post-menu-danger" onClick={input.onRemove}>
              <Trash2 size={15} />
              Yayından kaldır
            </button>
          </div>
        ) : null}
      </div>
      <div className="feed-post-icon" aria-hidden="true">
        {input.post.type === 'focus' ? <Megaphone size={18} /> : <BellRing size={18} />}
      </div>
      <div className="feed-post-main">
        {input.isEditing ? (
          <div className="feed-post-edit">
            <textarea
              className="feed-post-editor"
              aria-label="Gönderi metnini düzenle"
              value={input.editingBody}
              onChange={(event) => input.onEditBodyChange(event.target.value)}
            />
            <div className="feed-post-edit-actions">
              <button type="button" className="feed-button feed-button-muted" onClick={input.onCancelEdit}>
                Vazgeç
              </button>
              <button
                type="button"
                className="feed-button feed-button-primary"
                disabled={input.editingBody.trim().length === 0}
                onClick={input.onSaveEdit}
              >
                <Check size={15} />
                Kaydet
              </button>
            </div>
          </div>
        ) : (
          <p>{input.post.body}</p>
        )}
        <div className="feed-post-meta">
          <span className="feed-post-time">
            <Clock3 size={14} />
            {input.post.postedAt}
          </span>
          {input.post.pinned ? <span className="feed-post-meta-pin">Sabit</span> : null}
          {input.post.edited ? <span className="feed-post-meta-edited">Düzenlendi</span> : null}
          <span className="feed-post-meta-live">Yayında</span>
          <span>{input.post.type === 'focus' ? 'Bölge odağı' : 'Duyuru'}</span>
          {input.post.metric ? <span>{input.post.metric}</span> : null}
          {input.post.linkLabel ? (
            <span>
              {input.post.linkLabel}
              <ChevronRight size={14} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
