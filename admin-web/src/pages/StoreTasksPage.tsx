import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Bell, ReceiptText, TrendingUp } from 'lucide-react'
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
import { WorkflowInboxDetail } from '../features/workflow/WorkflowInboxDetail'
import { getWorkflowInbox } from '../features/workflow/api'
import {
  formatWorkflowItemType,
  formatWorkflowSourceType,
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  type WorkflowInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'

function canUseWorkflowInbox(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || roles.includes('SUPER_ADMIN') || roles.includes('REPORT_VIEWER')
}

export function StoreTasksPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const inboxEnabled = canUseWorkflowInbox(input.authSummary)
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? 'Mağaza kapsamı yok'
  const inboxQuery = useQuery({
    queryKey: ['workflow-inbox'],
    queryFn: getWorkflowInbox,
    enabled: inboxEnabled,
    retry: false,
  })

  const items = useMemo(() => inboxQuery.data?.items ?? [], [inboxQuery.data?.items])
  const sortedItems = useMemo(() => {
    const urgencyRank = { high: 0, medium: 1, low: 2 }
    const statusRank = { needs_attention: 0, informational: 1, completed: 2 }

    return [...items].sort((left, right) => {
      const statusDelta = statusRank[left.inboxStatus] - statusRank[right.inboxStatus]
      if (statusDelta !== 0) return statusDelta

      const urgencyDelta = urgencyRank[left.urgency] - urgencyRank[right.urgency]
      if (urgencyDelta !== 0) return urgencyDelta

      const leftTime = new Date(left.needsAttentionAt ?? left.createdAt ?? 0).getTime()
      const rightTime = new Date(right.needsAttentionAt ?? right.createdAt ?? 0).getTime()
      return rightTime - leftTime
    })
  }, [items])
  const pendingItems = useMemo(
    () => items.filter((item) => item.inboxStatus === 'needs_attention'),
    [items],
  )
  const approvalItems = useMemo(
    () => items.filter((item) => item.itemType === 'approval'),
    [items],
  )
  const acknowledgementItems = useMemo(
    () => items.filter((item) => item.itemType === 'acknowledgement'),
    [items],
  )
  const taskItems = useMemo(
    () => items.filter((item) => item.itemType === 'task'),
    [items],
  )

  if (!inboxEnabled) {
    return (
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">Mağaza işleri</div>
            <h2 className="hero-title">Ortak iş kuyruğu açılmadan önce operasyon rolü netleşmeli.</h2>
            <p className="hero-copy">
              Faz 3 kuyruğu artık kontrat tabanlı; bu oturumun onay, kabul veya rapor destekli
              işleri okuyabilecek bir mağaza rolüyle açılması gerekiyor.
            </p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label="Rota" value="/store/tasks" />
            <MetricAccent label="Mağaza kapsamı" value={primaryStoreId} />
            <MetricAccent label="Durum" value="Ön izleme" />
          </div>
        </section>
      </section>
    )
  }

  if (inboxQuery.isLoading) {
    return (
      <ScreenState
        title="İş kuyruğu yükleniyor"
        copy="Onay ve kabul işleri mobil kullanıma uygun tek kuyruğa alınıyor."
      />
    )
  }

  if (inboxQuery.isError) {
    return (
      <ScreenState
        title="İş kuyruğu açılamadı"
        copy={getErrorMessage(inboxQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Ortak iş kuyruğu</div>
          <h2 className="hero-title">Aksiyon gerektiren işler tek mağaza kuyruğunda.</h2>
          <p className="hero-copy">
            Onay, kabul ve KPI takipleri anlamını korur; mağaza tarafında ise tek dil, tek öncelik
            modeli ve mobil öncelikli okuma düzeniyle görünür.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Rota" value="/store/tasks" />
          <MetricAccent label="Mağaza kapsamı" value={primaryStoreId} />
          <MetricAccent label="Kuyruk öğesi" value={String(items.length)} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Aksiyon bekleyenler"
          value={pendingItems.length}
          note="Mevcut rol setinden aksiyon bekleyen işler."
          icon={<Bell size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'calm'}
        />
        <MetricCard
          title="Yüksek öncelik"
          value={items.filter((item) => item.urgency === 'high').length}
          note="Önce bakılması gereken işler."
          icon={<TrendingUp size={18} />}
          tone={items.some((item) => item.urgency === 'high') ? 'danger' : 'neutral'}
        />
        <MetricCard
          title="Onaylar"
          value={approvalItems.length}
          note="Hedef dağıtımı gibi karar gerektiren işler."
          icon={<ReceiptText size={18} />}
          tone={approvalItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="Kabul bekleyenler"
          value={acknowledgementItems.length}
          note="Checklist görünürlüğünü ve kabulünü kayıt altına alan işler."
          icon={<ClipboardList size={18} />}
          tone={acknowledgementItems.length > 0 ? 'accent' : 'neutral'}
        />
        <MetricCard
          title="KPI takipleri"
          value={taskItems.length}
          note="KPI performans sinyallerinden yükselen takip işleri."
          icon={<TrendingUp size={18} />}
          tone={taskItems.length > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Kuyruk bağlamı</div>
              <h3>Bu ekran neleri ortaklaştırır</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="İş tipleri" value="onay, kabul, görev" />
            <KeyValue label="KPI bağlantısı" value={taskItems.length > 0 ? 'KPI takibi aktif' : 'KPI takibine hazır'} />
            <KeyValue label="Kuyruk durumları" value="aksiyon bekliyor, tamamlandı, bilgilendirme" />
            <KeyValue label="Ana düzen" value="mobil öncelikli satırlar" />
            <KeyValue label="Çözülen roller" value={formatDisplayRoles(input.authSummary?.user.roleCodes)} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Kontrol sınırı</div>
              <h3>Bu kuyruk neleri karıştırmaz</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>İş anlamlarını birleştirmez</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>Onay karar ister. Kabul işi görünürlüğü doğrular. Ortak kuyruk bunları tek statü makinesine düzlemez.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Geniş masaüstü tablosu gerektirmez</strong>
                <CheckCircle2 size={16} />
              </div>
              <p>Her satır öncelik, başlık, özet ve birincil aksiyon yolunu dar ekranda da taşır.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Bugünün kuyruğu</div>
            <h3>Ortak kontrata bağlı aksiyonlar</h3>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Şu anda aksiyon gerektiren iş yok"
            copy="Onaylar, kabuller ve ilerideki KPI sapmaları ortak iş kuyruğuna düştüğünde burada görünür."
          />
        ) : (
          <div className="stacked-table">
            {sortedItems.map((item) => (
              <WorkflowInboxRow key={`${item.sourceType}:${item.sourceId}`} item={item} />
            ))}
          </div>
        )}
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store/checklists">
          Mağaza checklistleri
        </Link>
        <Link className="control-button store-shell-link" to="/store/approvals">
          Mağaza onayları
        </Link>
      </div>
    </section>
  )
}

function WorkflowInboxRow(input: { item: WorkflowInboxItem }) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.summary}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone="accent">{formatWorkflowSourceType(input.item.sourceType)}</StatusPill>
          <StatusPill tone={mapInboxStatusTone(input.item.inboxStatus)}>
            {formatWorkflowInboxStatusLabel(input.item.inboxStatus)}
          </StatusPill>
          <StatusPill tone={mapWorkflowUrgencyTone(input.item.urgency)}>
            {formatWorkflowUrgencyLabel(input.item.urgency)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label="İş tipi" value={formatWorkflowItemType(input.item.itemType)} />
        <KeyValue label="Aktör rolü" value={formatState(input.item.actorRole)} />
        <KeyValue label="Mağaza" value={input.item.storeName || input.item.storeId} />
        <KeyValue
          label="Aksiyon zamanı"
          value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt) : 'Şimdi'}
        />
      </div>

      {input.item.historyPreview ? <p className="queue-subtitle">{input.item.historyPreview}</p> : null}

      <WorkflowInboxDetail item={input.item} />

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to={input.item.deepLink}>
          {formatWorkflowPrimaryActionLabel(input.item)}
        </Link>
        <span className="queue-subtitle">
          {formatWorkflowSecondaryActionLabel(input.item)}
        </span>
      </div>
    </article>
  )
}

function formatWorkflowPrimaryActionLabel(item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return item.inboxStatus === 'needs_attention' ? 'Talebi onayla' : 'Geçmişi incele'
    case 'checklist_receipt':
      return item.inboxStatus === 'needs_attention' ? 'Kabul ediyorum' : 'Kabul kaydını gör'
    case 'kpi_exception':
      return 'KPI detayına git'
    default:
      return item.primaryActionLabel
  }
}

function formatWorkflowSecondaryActionLabel(item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return 'Detayı aç'
    case 'checklist_receipt':
      return 'Checklist sonucunu aç'
    case 'kpi_exception':
      return 'Sapmayı incele'
    default:
      return item.secondaryActionLabel ?? 'Detayı aç'
  }
}

function formatWorkflowInboxStatusLabel(status: WorkflowInboxItem['inboxStatus']) {
  switch (status) {
    case 'needs_attention':
      return 'Aksiyon bekliyor'
    case 'completed':
      return 'Tamamlandı'
    case 'informational':
      return 'Bilgilendirme'
    default:
      return formatState(status)
  }
}

function formatWorkflowUrgencyLabel(urgency: WorkflowInboxItem['urgency']) {
  switch (urgency) {
    case 'high':
      return 'Yüksek'
    case 'medium':
      return 'Orta'
    case 'low':
      return 'Düşük'
    default:
      return formatState(urgency)
  }
}
