import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Target,
  UsersRound,
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
  AdminOperationalState,
} from '../../pages/admin-operational-primitives'

export function AdminTargetsIncentivesPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Hedef ve prim operasyon prototipi">
      <AdminOperationalHeader
        eyebrow="Hedefler"
        title="Hedef onayları"
        description="Personel hedef kapsamı, bekleyen dağıtım talepleri ve yakın karar geçmişi tek çalışma yüzeyinde izlenir."
        icon={<ClipboardCheck size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="warning">3 aksiyon</AdminOperationalBadge>
            <AdminOperationalBadge tone="neutral">30 mağaza</AdminOperationalBadge>
          </>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'target-pending',
            label: 'Onay bekleyen',
            value: '3',
            description: 'Bölge kararı bekleyen talep',
            icon: <ReceiptText size={18} />,
            tone: 'warning',
          },
          {
            id: 'target-approved',
            label: 'Onaylanan',
            value: '12',
            description: 'Yakın dönem kararları',
            icon: <CheckCircle2 size={18} />,
            tone: 'success',
          },
          {
            id: 'target-coverage',
            label: 'Kapsam',
            value: '86%',
            description: 'Hedefi hazır personel',
            icon: <Target size={18} />,
            tone: 'accent',
          },
          {
            id: 'target-personnel',
            label: 'Personel',
            value: '150',
            description: 'Hedef kontrol kapsamı',
            icon: <UsersRound size={18} />,
            tone: 'cyan',
          },
        ]}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <AdminOperationalSection
          title="Onay kuyruğu"
          description="Mağaza, dönem, toplam hedef ve dağıtım etkisi aynı satırda okunur."
          badge={<AdminOperationalBadge tone="warning">3 talep</AdminOperationalBadge>}
        >
          <AdminOperationalRow
            title="Marmara Park hedef dağıtımı"
            meta="Mayıs 2026 / 4 personel"
            tone="warning"
            status={<AdminOperationalBadge tone="warning">Onay bekliyor</AdminOperationalBadge>}
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Toplam hedef" value="1.000.000 TL" />
              <AdminOperationalKeyValue label="Gönderen" value="Ada Yılmaz" />
              <AdminOperationalKeyValue label="Hazırlık" value="4 / 4 personel" />
              <AdminOperationalKeyValue label="Karar" value="Onaylanabilir" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="Emaar Square hedef revizesi"
            meta="Mayıs 2026 / 2 değişiklik"
            tone="accent"
            status={<AdminOperationalBadge tone="accent">Revize</AdminOperationalBadge>}
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Kapsam kontrolü"
          description="Eksik, bekleyen ve eski hedef referansları onaydan önce görünür."
          badge={<AdminOperationalBadge tone="accent">86%</AdminOperationalBadge>}
        >
          <AdminOperationalKeyGrid className="tw:grid-cols-1">
            <AdminOperationalKeyValue label="Hedefi hazır" value="129 / 150" />
            <AdminOperationalKeyValue label="Eksik hedef" value="12" />
            <AdminOperationalKeyValue label="Bekleyen değişiklik" value="6" />
            <AdminOperationalKeyValue label="Eski referans" value="3" />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </section>

      <AdminOperationalHeader
        eyebrow="Primler"
        title="Prim yönetimi"
        description="Bölge müdürü paketleri, final düzeltmeler ve admin kararları dönem bazında yönetilir."
        icon={<CircleDollarSign size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="success">Şirket mağazaları</AdminOperationalBadge>
            <AdminOperationalBadge tone="cyan">Mayıs 2026</AdminOperationalBadge>
          </>
        }
        actions={<Button variant="outline">Dönem yenile</Button>}
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'incentive-stores',
            label: 'Mağaza',
            value: '24',
            description: 'Prim kapsamı',
            icon: <Store size={18} />,
            tone: 'cyan',
          },
          {
            id: 'incentive-payable',
            label: 'Toplam hak ediş',
            value: '1.286.450,75 TL',
            description: 'Nihai tutarlar',
            icon: <CircleDollarSign size={18} />,
            tone: 'success',
          },
          {
            id: 'incentive-corrections',
            label: 'Düzeltme',
            value: '7',
            description: 'Admin kararı bekler',
            icon: <SlidersHorizontal size={18} />,
            tone: 'warning',
          },
          {
            id: 'incentive-packages',
            label: 'Onay paketi',
            value: '5',
            description: 'Bölge gönderimi',
            icon: <ShieldCheck size={18} />,
            tone: 'accent',
          },
        ]}
      />

      <AdminOperationalSection
        title="Bölge müdürü onay paketleri"
        description="Gönderilen paket, düzeltme notu ve admin kararı aynı satırda kalır."
        badge={<AdminOperationalBadge tone="warning">2 bekleyen</AdminOperationalBadge>}
      >
        <AdminOperationalRow
          title="Eda Doğanay"
          meta="2 mağaza / 1 düzeltme / 1 Haziran 2026"
          tone="warning"
          status={<AdminOperationalBadge tone="warning">Onaya gönderildi</AdminOperationalBadge>}
        >
          <AdminOperationalKeyGrid>
            <AdminOperationalKeyValue label="Kontrol" value="2 / 3 mağaza" />
            <AdminOperationalKeyValue label="Düzeltme" value="+125,25 TL" />
            <AdminOperationalKeyValue label="Final" value="4.085,25 TL" />
            <AdminOperationalKeyValue label="Karar" value="Revizyon veya onay" />
          </AdminOperationalKeyGrid>
        </AdminOperationalRow>
        <AdminOperationalState
          title="Manuel düzeltme ayrı işlem kaydı oluşturur"
          description="Satış kaynağı değişmeden final prim tutarı için denetimli düzeltme yapılır."
          tone="accent"
        />
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
