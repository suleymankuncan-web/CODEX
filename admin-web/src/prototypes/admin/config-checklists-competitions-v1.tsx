import {
  BadgeCheck,
  ClipboardList,
  Medal,
  Percent,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  AdminOperationalActionRow,
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

export function AdminConfigChecklistsCompetitionsPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Admin kural ve kurgu prototipi">
      <AdminOperationalHeader
        eyebrow="Yapılandırma"
        title="Kural ve kurgu merkezi"
        description="KPI ağırlıkları, checklist şablonları ve yarışma etapları aynı operasyon ritmiyle yönetilir."
        icon={<ShieldCheck size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="accent">Yayın kontrolü</AdminOperationalBadge>
            <AdminOperationalBadge tone="neutral">Taslaklar</AdminOperationalBadge>
          </>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'config-version',
            label: 'Aktif sürüm',
            value: 'v12',
            description: 'Yayındaki KPI kural seti',
            icon: <BadgeCheck size={18} />,
            tone: 'success',
          },
          {
            id: 'config-validation',
            label: 'Kural toplamı',
            value: '100%',
            description: 'Yayın için dengeli',
            icon: <Percent size={18} />,
            tone: 'cyan',
          },
          {
            id: 'checklist-drafts',
            label: 'Checklist taslağı',
            value: '2',
            description: 'Tamamlanması gereken şablon',
            icon: <ClipboardList size={18} />,
            tone: 'warning',
          },
          {
            id: 'competition-stages',
            label: 'Yarışma etabı',
            value: '4',
            description: 'Hazır veya incelemede',
            icon: <Trophy size={18} />,
            tone: 'accent',
          },
        ]}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AdminOperationalSection
          title="KPI kural seti"
          description="Ağırlık, sahiplik ve yayın hazırlığı tek editör yüzeyinde kalır."
          badge={<AdminOperationalBadge tone="success">Yayınlanabilir</AdminOperationalBadge>}
          actions={
            <AdminOperationalActionRow>
              <Button size="sm" variant="outline">
                Taslak kaydet
              </Button>
              <Button size="sm">Yayınla</Button>
            </AdminOperationalActionRow>
          }
        >
          <AdminOperationalRow
            title="Hedef gerçekleştirme"
            meta="Mağaza müdürü / satış performansı"
            status={<AdminOperationalBadge tone="success">40%</AdminOperationalBadge>}
            tone="success"
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Davranış" value="Aksiyon üretir" />
              <AdminOperationalKeyValue label="Görünürlük" value="Mağaza ve bölge" />
              <AdminOperationalKeyValue label="Durum" value="Dengeli" />
              <AdminOperationalKeyValue label="Son karar" value="v12 ile yayında" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="GSM onayı"
            meta="Mağaza skoru / aylık katkı"
            status={<AdminOperationalBadge tone="cyan">5%</AdminOperationalBadge>}
            tone="cyan"
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Yayın hazırlığı"
          description="Eksik alanlar ve karar etkisi yayın öncesi görünür kalır."
          badge={<AdminOperationalBadge tone="neutral">3 kontrol</AdminOperationalBadge>}
        >
          <AdminOperationalState
            title="Ağırlık kontrolü tamam"
            description="KPI katkıları toplamı yayın için geçerli."
            tone="success"
          />
          <AdminOperationalState
            title="Son değişiklik incelenmeli"
            description="GSM onayı katkısı mağaza skoruna bağlanmış durumda."
            tone="cyan"
          />
        </AdminOperationalSection>
      </section>

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <AdminOperationalSection
          title="Checklist şablonları"
          description="BM ve VM şablonları, ağırlık dengesi ve yayın durumu birlikte izlenir."
          badge={<AdminOperationalBadge tone="warning">2 taslak</AdminOperationalBadge>}
        >
          <AdminOperationalRow
            title="BM Mağaza Ziyareti"
            meta="4 bölüm / 22 madde"
            status={<AdminOperationalBadge tone="warning">Taslak</AdminOperationalBadge>}
            tone="warning"
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Ağırlık" value="92 / 100" />
              <AdminOperationalKeyValue label="Yanıt tipi" value="Puan + not" />
              <AdminOperationalKeyValue label="Düşük skor" value="3 madde" />
              <AdminOperationalKeyValue label="Karar" value="Denge tamamlanmalı" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="VM Checklist"
            meta="3 bölüm / 18 madde"
            status={<AdminOperationalBadge tone="success">Yayında</AdminOperationalBadge>}
            tone="success"
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Şablon editörü"
          description="Bölüm, madde, puan ve takip eşiği aynı çalışma alanında düzenlenir."
          badge={<AdminOperationalBadge tone="accent">Editör</AdminOperationalBadge>}
        >
          <AdminOperationalKeyGrid className="tw:grid-cols-1">
            <AdminOperationalKeyValue label="Seçili bölüm" value="Vitrin standartları" />
            <AdminOperationalKeyValue label="Madde ağırlığı" value="20%" />
            <AdminOperationalKeyValue label="Düşük skor eşiği" value="6 ve altı" />
            <AdminOperationalKeyValue label="Sonuç" value="Takip maddesi oluşur" />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </section>

      <AdminOperationalHeader
        eyebrow="Yarışmalar"
        title="Etap ve paket yönetimi"
        description="Yarışma listesi, etap planı, takım kurgusu ve sonuç kontrolü aynı operasyon yüzeyinde ilerler."
        icon={<Medal size={18} />}
        meta={
          <>
            <AdminOperationalBadge tone="success">Aktif yarışma</AdminOperationalBadge>
            <AdminOperationalBadge tone="warning">Paket incelemesi</AdminOperationalBadge>
          </>
        }
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AdminOperationalSection
          title="Yarışma akışı"
          description="Etap, takım ve paket durumları sıradaki karar için gruplanır."
          badge={<AdminOperationalBadge tone="accent">4 etap</AdminOperationalBadge>}
        >
          <AdminOperationalRow
            title="Marmara Bölge Ligi"
            meta="Lig etabı / 24 mağaza"
            status={<AdminOperationalBadge tone="success">Çalışıyor</AdminOperationalBadge>}
            tone="success"
          >
            <AdminOperationalKeyGrid>
              <AdminOperationalKeyValue label="Başlangıç" value="1 Haziran" />
              <AdminOperationalKeyValue label="Bitiş" value="30 Haziran" />
              <AdminOperationalKeyValue label="Takım" value="8" />
              <AdminOperationalKeyValue label="Sonuç" value="Skorlar izleniyor" />
            </AdminOperationalKeyGrid>
          </AdminOperationalRow>
          <AdminOperationalRow
            title="Final etabı"
            meta="Paket planı / 2 takım"
            status={<AdminOperationalBadge tone="warning">İncelemede</AdminOperationalBadge>}
            tone="warning"
          />
        </AdminOperationalSection>

        <AdminOperationalSection
          title="Etap kurucu"
          description="Ön ayar, takım şablonu ve paket kararları tek form akışında kalır."
          badge={<AdminOperationalBadge tone="cyan">Hazır</AdminOperationalBadge>}
        >
          <AdminOperationalState
            title="Paket planı kaydedildi"
            description="Lig ve final etapları sıraya göre hazırlanmış durumda."
            tone="cyan"
          />
          <AdminOperationalKeyGrid className="tw:grid-cols-1">
            <AdminOperationalKeyValue label="Ön ayar" value="Lig sonra final" />
            <AdminOperationalKeyValue label="Takım şablonu" value="MARMARA A / MARMARA B" />
            <AdminOperationalKeyValue label="Sıradaki aksiyon" value="Paket planını onaya gönder" />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </section>

      <AdminOperationalSection
        title="Karar izi"
        description="Yayın, şablon ve etap kararları okunabilir kısa kayıtlarla takip edilir."
        badge={<AdminOperationalBadge tone="neutral">Son 5 kayıt</AdminOperationalBadge>}
      >
        <AdminOperationalRow
          title="KPI v12 yayınlandı"
          meta="Ağırlık toplamı doğrulandı"
          status={<AdminOperationalBadge tone="success">Tamamlandı</AdminOperationalBadge>}
          tone="success"
        />
        <AdminOperationalRow
          title="BM Checklist taslağı güncellendi"
          meta="Vitrin bölümünde 2 madde değişti"
          status={<AdminOperationalBadge tone="warning">Kontrol gerekli</AdminOperationalBadge>}
          tone="warning"
        />
        <AdminOperationalRow
          title="Final paketi hazırlandı"
          meta="Etap sırası ve takım şablonları seçildi"
          status={<AdminOperationalBadge tone="cyan">Hazır</AdminOperationalBadge>}
          tone="cyan"
        />
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
