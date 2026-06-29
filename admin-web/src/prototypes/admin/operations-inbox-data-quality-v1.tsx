import { Bell, DatabaseZap, Inbox, RadioTower, ShieldCheck, Users } from 'lucide-react'
import {
  AdminOperationalBadge,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalRow,
  AdminOperationalSection,
  AdminOperationalState,
} from '../../pages/admin-operational-primitives'

export function AdminOperationsInboxDataQualityPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Admin operasyon prototipi">
      <AdminOperationalHeader
        eyebrow="Operasyon"
        title="Operasyon kontrolü"
        description="Import, snapshot, işgücü ve ortak kuyruk kararları tek ritimde izlenir."
        icon={<RadioTower size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="success">Canlı sinyal</AdminOperationalBadge>
            <AdminOperationalBadge tone="warning">7 aksiyon</AdminOperationalBadge>
          </>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'prototype-readiness',
            label: 'Hazırlık',
            value: 'Kontrollü',
            description: 'Pilot kararları açık aksiyonlara bağlı.',
            icon: <ShieldCheck size={18} />,
            tone: 'warning',
          },
          {
            id: 'prototype-import',
            label: 'Import',
            value: '3',
            description: 'Mapping veya retry bekleyen parti.',
            icon: <DatabaseZap size={18} />,
            tone: 'warning',
          },
          {
            id: 'prototype-workforce',
            label: 'İşgücü',
            value: '4',
            description: 'HR onayı bekleyen kayıt.',
            icon: <Users size={18} />,
            tone: 'accent',
          },
          {
            id: 'prototype-workflow',
            label: 'Ortak kuyruk',
            value: '2',
            description: 'Aksiyon bekleyen iş.',
            icon: <Inbox size={18} />,
            tone: 'cyan',
          },
        ]}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <AdminOperationalSection
          title="Öncelikli aksiyonlar"
          description="Adminin sıradaki kararları tek listede görünür."
          badge={<AdminOperationalBadge tone="warning">3 açık</AdminOperationalBadge>}
        >
          <AdminOperationalRow
            title="Satıcı kodu onayı"
            meta="Bağdat Caddesi / Ayşe Yılmaz"
            status={<AdminOperationalBadge tone="warning">HR onayı</AdminOperationalBadge>}
            tone="warning"
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Pozisyon" value="Satış danışmanı" />
              <AdminOperationalKeyValue label="Referans" value="FM8375" />
              <AdminOperationalKeyValue label="Önerilen" value="FM8376" />
              <AdminOperationalKeyValue label="Tarih" value="1 Mayıs 2026" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="Snapshot tekrar denemesi"
            meta="monthly-store-kpi / 31 Mayıs"
            status={<AdminOperationalBadge tone="accent">Retry hazır</AdminOperationalBadge>}
            tone="accent"
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Veri kalitesi"
          description="Ürün hatası ile veri kaynağı problemi ayrışır."
          badge={<AdminOperationalBadge tone="warning">Dikkat</AdminOperationalBadge>}
        >
          <AdminOperationalState title="Import ve mapping baskısı" tone="warning">
            42 hata satırı, 2 mağaza mapping’i ve 1 personel eşleşmesi kontrol bekliyor.
          </AdminOperationalState>
          <AdminOperationalState title="Kaynak güveni" tone="success">
            KPI config ve leaderboard dönemi yayınlı.
          </AdminOperationalState>
        </AdminOperationalSection>
      </section>

      <AdminOperationalSection
        title="Admin iş kuyruğu"
        description="Onay, iade ve takip işleri aynı karar dilinde listelenir."
        badge={<AdminOperationalBadge tone="cyan">Tek kuyruk</AdminOperationalBadge>}
      >
        <AdminOperationalRow
          title="April Target Distribution"
          meta="Hedef dağıtımı / Bölge onayı"
          status={
            <>
              <AdminOperationalBadge tone="danger">Yüksek</AdminOperationalBadge>
              <AdminOperationalBadge tone="warning">Aksiyon bekliyor</AdminOperationalBadge>
            </>
          }
          tone="danger"
        />
        <AdminOperationalRow
          title="Personel çıkış onayı"
          meta="Store Personnel / FM8001"
          status={<AdminOperationalBadge tone="warning">HR onayı</AdminOperationalBadge>}
          tone="warning"
        />
      </AdminOperationalSection>

      <AdminOperationalHeader
        eyebrow="Gelen Kutusu"
        title="Admin iş kuyruğu"
        description="Satıcı kodu, personel çıkışı ve ortak workflow kayıtları tek karar masasında toplanır."
        icon={<Bell size={18} />}
        meta={<AdminOperationalBadge tone="warning">Aksiyon bekleyenler: 4</AdminOperationalBadge>}
      />
    </AdminOperationalPage>
  )
}
