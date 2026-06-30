import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  DatabaseZap,
  FileSpreadsheet,
  GitBranch,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  AdminOperationalBadge,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalRow,
  AdminOperationalSection,
} from '../../pages/admin-operational-primitives'

export function AdminSnapshotsReportsPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Snapshot ve rapor operasyon prototipi">
      <AdminOperationalHeader
        eyebrow="Snapshot"
        title="Snapshot çalışmaları"
        description="Günlük kapanış, tekrar deneme ve aksiyon isteyen çalışmalar tek listede izlenir."
        icon={<DatabaseZap size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="warning">2 aksiyon</AdminOperationalBadge>
            <AdminOperationalBadge tone="accent">1 tekrar hazır</AdminOperationalBadge>
          </>
        }
        actions={
          <Button type="button">
            <RefreshCcw aria-hidden="true" />
            Günlük kapanışı başlat
          </Button>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'snapshot-healthy',
            label: 'Sağlıklı',
            value: '18',
            description: 'Tamamlanan çalışma',
            icon: <ShieldCheck size={18} />,
            tone: 'success',
          },
          {
            id: 'snapshot-active',
            label: 'İşlemde',
            value: '2',
            description: 'Aktif kuyruk',
            icon: <Activity size={18} />,
            tone: 'neutral',
          },
          {
            id: 'snapshot-retry',
            label: 'Tekrar hazır',
            value: '1',
            description: 'Operatör kararı bekler',
            icon: <RefreshCcw size={18} />,
            tone: 'accent',
          },
          {
            id: 'snapshot-stuck',
            label: 'Takıldı',
            value: '1',
            description: 'Detay kontrolü gerekir',
            icon: <Clock3 size={18} />,
            tone: 'danger',
          },
        ]}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <AdminOperationalSection
          title="Aksiyon kuyruğu"
          description="Öncelik, dönem ve tekrar durumu aynı satırda okunur."
          badge={<AdminOperationalBadge tone="warning">2 kayıt</AdminOperationalBadge>}
        >
          <AdminOperationalRow
            title="Günlük snapshot"
            meta="6 Mayıs 2026 / tekrar 1"
            tone="danger"
            status={
              <>
                <AdminOperationalBadge tone="danger">Takıldı</AdminOperationalBadge>
                <AdminOperationalBadge tone="warning">Başarısız</AdminOperationalBadge>
              </>
            }
            action={{ href: '/admin/snapshots/snapshot-stuck-no-rerun', label: 'Detay' }}
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Öneri" value="Bağımlılık kontrolü" />
              <AdminOperationalKeyValue label="Dönem" value="6 Mayıs" />
              <AdminOperationalKeyValue label="Tekrar" value="Kapalı" />
              <AdminOperationalKeyValue label="Son durum" value="İnceleme gerekli" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="Aylık snapshot"
            meta="31 Mayıs 2026 / tekrar hazır"
            tone="accent"
            status={<AdminOperationalBadge tone="accent">Tekrar hazır</AdminOperationalBadge>}
            action={{ href: '/admin/snapshots/snapshot-failed-rerun', label: 'Detay' }}
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Çalışma detayı"
          description="Bağımlılık, çıktı hacmi ve denetim izi aynı detay yüzeyinde kalır."
          badge={<AdminOperationalBadge tone="cyan">Kanıt görünür</AdminOperationalBadge>}
        >
          <AdminOperationalKeyGrid>
            <AdminOperationalKeyValue label="Durum" value="Başarısız" />
            <AdminOperationalKeyValue label="Sağlık" value="Takıldı" />
            <AdminOperationalKeyValue label="Tekrar" value="Hayır" />
            <AdminOperationalKeyValue label="Satır" value="45" />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </section>

      <AdminOperationalHeader
        eyebrow="Raporlar"
        title="Rapor çalışma masası"
        description="Son tamamlanan çalışma seçilir; işgücü, KPI, checklist ve personel çıkışı raporları aynı ritimde okunur."
        icon={<FileSpreadsheet size={18} />}
        meta={<AdminOperationalBadge tone="success">Son çalışma hazır</AdminOperationalBadge>}
        actions={<Button variant="outline">Çalışma seç</Button>}
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'report-total',
            label: 'Toplam satır',
            value: '45',
            description: 'Tüm rapor kesitleri',
            icon: <BarChart3 size={18} />,
            tone: 'neutral',
          },
          {
            id: 'report-workforce',
            label: 'İşgücü',
            value: '12',
            description: 'Kadro satırı',
            icon: <BriefcaseBusiness size={18} />,
            tone: 'success',
          },
          {
            id: 'report-kpis',
            label: 'KPI',
            value: '24',
            description: 'Performans satırı',
            icon: <GitBranch size={18} />,
            tone: 'accent',
          },
          {
            id: 'report-turnover',
            label: 'Personel çıkışı',
            value: '3',
            description: 'Çıkış satırı',
            icon: <TrendingDown size={18} />,
            tone: 'warning',
          },
        ]}
      />

      <AdminOperationalSection
        title="Rapor kesitleri"
        description="Her kesit seçili çalışmanın okunabilir çıktısını açar."
        badge={<AdminOperationalBadge tone="cyan">4 kesit</AdminOperationalBadge>}
      >
        <AdminOperationalRow
          title="Checklistler"
          meta="6 satır / kritik bulgu kontrolü"
          tone="warning"
          status={<AdminOperationalBadge tone="warning">İncele</AdminOperationalBadge>}
          action={{ href: '/admin/reports/checklists/snapshot-versioned', label: 'Aç' }}
        />
        <AdminOperationalRow
          title="KPI"
          meta="24 satır / hedef gerçekleşme"
          tone="accent"
          status={<AdminOperationalBadge tone="accent">Hazır</AdminOperationalBadge>}
          action={{ href: '/admin/reports/kpis/snapshot-versioned', label: 'Aç' }}
        />
        <AdminOperationalRow
          title="İşgücü"
          meta="12 satır / norm ve fiili denge"
          tone="success"
          status={<AdminOperationalBadge tone="success">Hazır</AdminOperationalBadge>}
          action={{ href: '/admin/reports/workforce/snapshot-versioned', label: 'Aç' }}
        />
        <AdminOperationalRow
          title="Personel çıkışı"
          meta="3 satır / kapsam bazlı oran"
          tone="neutral"
          status={<AdminOperationalBadge tone="neutral">Hazır</AdminOperationalBadge>}
          action={{ href: '/admin/reports/turnover/snapshot-versioned', label: 'Aç' }}
        />
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
