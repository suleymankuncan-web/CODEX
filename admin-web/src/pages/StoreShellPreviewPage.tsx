import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BadgeCheck, ClipboardList, Megaphone, ReceiptText, Store, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { getVisibleFeedPosts } from '../features/feed/api'
import { formatFeedPostType } from '../features/feed/contracts'
import { getErrorMessage } from '../lib/format'

export function StoreShellPreviewPage(input: {
  authSummary: AuthSessionSummary | null
  recommendedLanding: string
}) {
  const user = input.authSummary?.user
  const feedQuery = useQuery({
    queryKey: ['visible-feed', 'home-preview'],
    queryFn: getVisibleFeedPosts,
    retry: false,
  })
  const pinnedPosts = useMemo(
    () => (feedQuery.data?.items ?? []).filter((post) => post.isPinned).slice(0, 3),
    [feedQuery.data?.items],
  )

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Mağaza ana sayfa Faz 1</div>
          <h2 className="hero-title">
            Mağaza kullanıcısı için admin panelinden ayrılmış görev odaklı ana sayfa.
          </h2>
          <p className="hero-copy">
            Checklist, KPI, onay ve prim işleri mağaza kapsamlı kullanıcıya rapor kalabalığı
            olarak değil, odaklı günlük aksiyon olarak gelmeli.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Alan" value="/store" />
          <MetricAccent label="Geçerli açılış" value={input.recommendedLanding} />
          <MetricAccent label="Amaç" value="Görev odaklı" />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Bugünkü işler"
          value={3}
          note="Checklist takibi, onaylar ve primle ilgili gözden geçirmeler burada başlamalı."
          icon={<ClipboardList size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Mağaza odağı"
          value={1}
          note="Mağaza kullanıcısı yalnızca kendi kapsamını ilgilendiren parçayı görmeli."
          icon={<Store size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Ortak yetki"
          value={1}
          note="Yüzey ayrı; auth, kapsam ve audit temelleri ortak kalır."
          icon={<BadgeCheck size={18} />}
          tone="warning"
        />
      </section>

      {feedQuery.isError ? (
        <ScreenState
          title="Sabit duyurular açılamadı"
          copy={getErrorMessage(feedQuery.error)}
          tone="error"
        />
      ) : pinnedPosts.length > 0 ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Sabit duyurular</div>
              <h3>Günlük işlerden önce şirket odağı</h3>
            </div>
            <Link className="control-button store-shell-link" to="/store/feed">
              Tüm duyurular
            </Link>
          </div>
          <div className="stacked-table">
            {pinnedPosts.map((post) => (
              <div className="stacked-row" key={post.feedPostId}>
                <div className="stacked-row-head">
                  <strong>{post.title}</strong>
                  <div className="action-cluster">
                    <StatusPill tone={post.postType === 'challenge' ? 'accent' : 'neutral'}>
                      {formatFeedPostType(post.postType)}
                    </StatusPill>
                    <Megaphone size={16} />
                  </div>
                </div>
                <p>{post.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Mağaza ana sayfası</div>
              <h3>Mağaza kullanıcısı önce nereye ulaşmalı</h3>
            </div>
            <StatusPill tone="accent">Faz 1</StatusPill>
          </div>

          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Bugünkü işler</strong>
                <StatusPill tone="warning">Öncelik</StatusPill>
              </div>
              <p>
                Checklist tamamlamaları, bekleyen onaylar ve mağazada hemen aksiyon gerektiren işler.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>KPI özetleri</strong>
                <StatusPill tone="calm">Görünürlük</StatusPill>
              </div>
              <p>
                Varsayılan giriş admin tipi rapor tabloları değil, mağaza kapsamlı özet kartlar ve
                hızlı trendler olmalı.
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Prim özeti</strong>
                <StatusPill tone="accent">Sonra</StatusPill>
              </div>
              <p>
                Gelecekte prim görünürlüğü mağaza alanında okunmalı; konfigürasyon ve inceleme
                admin tarafında kalmalı.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Çözülen oturum</div>
              <h3>Mevcut kullanıcı mağaza alanına hangi kapsamla geliyor</h3>
            </div>
          </div>

          <div className="key-grid">
            <KeyValue label="Kullanıcı id" value={user?.userId ?? 'Oturum çözülmedi'} />
            <KeyValue label="Roller" value={formatDisplayRoles(user?.roleCodes, 'Çözülen rol yok')} />
            <KeyValue label="Şirket idleri" value={user?.scope.companyIds.join(', ') || 'yok'} />
            <KeyValue label="Mağaza idleri" value={user?.scope.storeIds.join(', ') || 'yok'} />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/store/tasks">
              Mağaza işleri
            </Link>
            <Link className="control-button store-shell-link" to="/store/checklists">
              Mağaza checklistleri
            </Link>
            <Link className="control-button store-shell-link" to="/store/kpis">
              Mağaza KPI özetleri
            </Link>
            <Link className="control-button store-shell-link" to="/store/me">
              Benim performansim
            </Link>
            <Link className="control-button store-shell-link" to="/store/rankings">
              Siralamalar
            </Link>
            <Link className="control-button store-shell-link" to="/store/approvals">
              Mağaza onayları
            </Link>
            <Link className="control-button store-shell-link" to="/store/incentives">
              Mağaza primleri
            </Link>
            <Link className="control-button store-shell-link" to="/admin/reports">
              Admin raporları
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Rota iskeleti</div>
            <h3>Gelecek mağaza işleri nereye oturmalı</h3>
          </div>
        </div>

        <div className="store-route-grid">
          <RoutePreviewCard
            route="/store/tasks"
            title="İş kuyruğu"
            copy="Checklist takibi, bekleyen talepler ve gelecek mağaza aksiyonları için günlük kuyruk."
            icon={<ClipboardList size={18} />}
            tone="accent"
          />
          <RoutePreviewCard
            route="/store/checklists"
            title="Checklists"
            copy="Mağaza uygulama yüzeyi, tamamlama ilerlemesi ve checklist takibi."
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/kpis"
            title="KPI özetleri"
            copy="Mağaza odaklı KPI kartları ve hızlı trend görünürlüğü."
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/me"
            title="Benim performansim"
            copy="Mağaza personeli için bireysel KPI, skor ve sıralama yüzeyi."
            icon={<BadgeCheck size={18} />}
            tone="calm"
          />
          <RoutePreviewCard
            route="/store/rankings"
            title="Siralamalar"
            copy="Kapanmış gün snapshotlarından gelen personel ve mağaza sıralamaları."
            icon={<Target size={18} />}
            tone="warning"
          />
          <RoutePreviewCard
            route="/store/approvals"
            title="Onaylar"
            copy="Mağaza seviyesindeki onay ve kabul işleri için gelecek kutusu."
            icon={<ReceiptText size={18} />}
            tone="accent"
          />
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Buraya ne ait</div>
              <h3>Mağaza alanı sahipliği</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Checklist aksiyonu</strong>
                <ArrowRight size={16} />
              </div>
              <p>Mağaza ekibine bağlı uygulama, tamamlama ve takip işleri.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Mağaza KPI görünürlüğü</strong>
                <ArrowRight size={16} />
              </div>
              <p>Platform yönetimi değil, aksiyon almayı kolaylaştıran hızlı sinyal ve trend görünürlüğü.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Prim ve onay tüketimi</strong>
                <ArrowRight size={16} />
              </div>
              <p>
                Mağaza kullanıcısı burada okur ve aksiyon alır; admin konfigürasyon ve inceleme başka yerde kalır.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Admin'de ne kalır</div>
              <h3>Bunları `/store` içine taşırma</h3>
            </div>
          </div>
          <EmptyState
            title="Yönetişim admin öncelikli kalır"
            copy="Import operasyonları, snapshot orkestrasyonu, auth yönetimi, audit incelemesi ve mağazalar arası platform kontrolleri mağaza kullanıcılarını desteklese bile admin alanında kalmalı."
          />
        </article>
      </section>
    </section>
  )
}

function RoutePreviewCard(input: {
  route: string
  title: string
  copy: string
  icon: ReactNode
  tone: 'accent' | 'calm' | 'warning'
}) {
  return (
    <article className={`store-route-card store-route-card-${input.tone}`}>
      <div className="store-route-card-head">
        <span className="store-route-card-icon">{input.icon}</span>
        <code>{input.route}</code>
      </div>
      <h4>{input.title}</h4>
      <p>{input.copy}</p>
    </article>
  )
}
