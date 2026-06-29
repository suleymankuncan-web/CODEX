import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import {
  AdminOperationalBadge,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalRow,
  AdminOperationalSection,
  type AdminOperationalMetric,
} from '../../pages/admin-operational-primitives'

const importMetrics: AdminOperationalMetric[] = [
  {
    id: 'status',
    icon: <ShieldCheck size={18} />,
    label: 'Durum',
    value: 'Kontrol gerekli',
    description: '3 parti aksiyon istiyor',
    tone: 'warning',
  },
  {
    id: 'healthy',
    icon: <CheckCircle2 size={18} />,
    label: 'Sağlıklı',
    value: '18',
    description: 'Tamamlanan aktarım',
    tone: 'success',
  },
  {
    id: 'needs-action',
    icon: <AlertTriangle size={18} />,
    label: 'Aksiyon',
    value: '3',
    description: 'Eşleme veya retry bekler',
    tone: 'danger',
  },
  {
    id: 'retry-ready',
    icon: <RefreshCw size={18} />,
    label: 'Tekrar dene',
    value: '2',
    description: 'Operatör kararı hazır',
    tone: 'warning',
  },
]

const masterDataMetrics: AdminOperationalMetric[] = [
  {
    id: 'batches',
    icon: <DatabaseZap size={18} />,
    label: 'Parti',
    value: '6',
    description: 'Bootstrap iş kuyruğu',
    tone: 'accent',
  },
  {
    id: 'stores',
    icon: <FileSpreadsheet size={18} />,
    label: 'Mağaza',
    value: '30',
    description: 'Ana veri satırı',
    tone: 'cyan',
  },
  {
    id: 'personnel',
    icon: <ShieldCheck size={18} />,
    label: 'Personel',
    value: '150',
    description: 'Eşleşen profil',
    tone: 'success',
  },
  {
    id: 'readiness',
    icon: <AlertTriangle size={18} />,
    label: 'Karar',
    value: '2',
    description: 'Promotion öncesi kontrol',
    tone: 'warning',
  },
]

export function AdminIntegrationsMasterDataPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Entegrasyon ve ana veri operasyon prototipi">
      <AdminOperationalHeader
        eyebrow="Entegrasyonlar"
        title="Aktarım çalışma masası"
        description="Yükleme, retry ve satır kanıtı aynı iş kuyruğunda okunur."
        icon={<DatabaseZap size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="warning">3 aksiyon</AdminOperationalBadge>
            <AdminOperationalBadge tone="success">18 sağlıklı</AdminOperationalBadge>
          </>
        }
        actions={
          <Button type="button">
            <UploadCloud aria-hidden="true" />
            Yeni yükleme
          </Button>
        }
      />
      <AdminOperationalMetrics items={importMetrics} />
      <AdminOperationalSection
        title="Aktarım kuyruğu"
        description="Batch durumları, retry kararı ve detay kanıtı tek listede."
        actions={
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
            <Search size={16} aria-hidden="true" />
            <Input aria-label="Aktarım ara" placeholder="Parti, kaynak veya durum ara" />
          </div>
        }
      >
        <AdminOperationalRow
          title="power-bi-kpi / kpi"
          meta="455 hata · 4.751 kayıt · retry yapılabilir"
          tone="warning"
          status={<AdminOperationalBadge tone="warning">Kontrol gerekli</AdminOperationalBadge>}
          action={{ href: '/admin/integrations/batch-kpi-lineage-ui-1', label: 'Detay' }}
        >
          <AdminOperationalKeyGrid>
            <AdminOperationalKeyValue label="Satır kanıtı" value="Eşleşmeyen mağaza" />
            <AdminOperationalKeyValue label="Retry" value="Uygun" />
            <AdminOperationalKeyValue label="Sonraki adım" value="Detayı incele" />
            <AdminOperationalKeyValue label="Kaynak" value="Power BI" />
          </AdminOperationalKeyGrid>
        </AdminOperationalRow>
        <AdminOperationalRow
          title="power-bi-personnel / personnel"
          meta="0 hata · 150 kayıt · tamamlandı"
          tone="success"
          status={<AdminOperationalBadge tone="success">Hazır</AdminOperationalBadge>}
        />
      </AdminOperationalSection>
      <AdminOperationalHeader
        eyebrow="Ana veri"
        title="Master data çalışma masası"
        description="Validate, promotion ve mağaza/personel ana veri düzenleme akışı korunur."
        icon={<FileSpreadsheet size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="cyan">Batch seçili</AdminOperationalBadge>
            <AdminOperationalBadge tone="warning">Karar bekliyor</AdminOperationalBadge>
          </>
        }
      />
      <AdminOperationalMetrics items={masterDataMetrics} />
      <AdminOperationalSection
        title="Promotion kararı"
        description="Seçili parti satırları ve readiness kanıtı aynı çalışma alanında kalır."
      >
        <AdminOperationalRow
          title="batch-store-ready"
          meta="Store Istanbul · 1 satır · validate tamamlandı"
          tone="success"
          status={<AdminOperationalBadge tone="success">Promote edilebilir</AdminOperationalBadge>}
          action={{ href: '/admin/master-data/batch-store-ready', label: 'Partiyi aç' }}
        >
          <AdminOperationalKeyGrid>
            <AdminOperationalKeyValue label="Hazır satır" value="1" />
            <AdminOperationalKeyValue label="Geçersiz" value="0" />
            <AdminOperationalKeyValue label="Bekleyen" value="0" />
            <AdminOperationalKeyValue label="Aksiyon" value="Promote stores" />
          </AdminOperationalKeyGrid>
        </AdminOperationalRow>
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
