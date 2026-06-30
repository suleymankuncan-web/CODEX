import { Megaphone, Pin, Send, ShieldCheck, Trophy } from 'lucide-react'
import {
  AdminOperationalBadge,
  AdminOperationalHeader,
  AdminOperationalKeyGrid,
  AdminOperationalKeyValue,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalSection,
} from '../../pages/admin-operational-primitives'
import { Button } from '../../components/ui/button'

export function AdminFeedOperationalPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Kontrollu sirket ve bolge duyurulari">
      <AdminOperationalHeader
        description="Duyuru ve challenge postlari magazalara tek kontrollu akistan ulasir."
        eyebrow="Duyurular"
        icon={<Megaphone aria-hidden="true" size={22} />}
        meta={
          <>
            <AdminOperationalBadge tone="neutral">/admin/feed</AdminOperationalBadge>
            <AdminOperationalBadge tone="cyan">Bolge duyurusu</AdminOperationalBadge>
          </>
        }
        title="Kontrollu sirket ve bolge duyurulari"
      />
      <AdminOperationalMetrics
        items={[
          {
            description: 'Taslak, yayinda ve arsivlenen toplam post.',
            icon: <Megaphone aria-hidden="true" size={18} />,
            label: 'Toplam post',
            tone: 'accent',
            value: 12,
          },
          {
            description: 'Magaza akisi ustunde kalan duyuru.',
            icon: <Pin aria-hidden="true" size={18} />,
            label: 'Sabitlenenler',
            tone: 'warning',
            value: 2,
          },
          {
            description: 'Sadece yonlendirme; skor motoru degil.',
            icon: <Trophy aria-hidden="true" size={18} />,
            label: 'Challenge postlari',
            tone: 'calm',
            value: 4,
          },
          {
            description: 'Magaza feed tarafindan okunabilir.',
            icon: <Send aria-hidden="true" size={18} />,
            label: 'Yayinda',
            tone: 'cyan',
            value: 8,
          },
        ]}
      />
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <AdminOperationalSection
          badge={<AdminOperationalBadge tone="neutral">Duyuru</AdminOperationalBadge>}
          eyebrow="Composer"
          title="Feed postu olustur"
        >
          <div className="tw:grid tw:gap-3 tw:sm:grid-cols-2">
            <div className="tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:p-3">
              Baslik
            </div>
            <div className="tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:p-3">
              Kapsam
            </div>
            <div className="tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:p-3 tw:sm:col-span-2">
              Govde metni
            </div>
          </div>
          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
            <Button variant="secondary">Taslak kaydet</Button>
            <Button>Postu yayinla</Button>
          </div>
        </AdminOperationalSection>
        <AdminOperationalSection
          badge={
            <AdminOperationalBadge tone="success">
              <ShieldCheck aria-hidden="true" size={13} />
              Kendi bolgesi
            </AdminOperationalBadge>
          }
          eyebrow="Koruma siniri"
          title="Feed bir skor motoru degildir"
        >
          <AdminOperationalKeyGrid>
            <AdminOperationalKeyValue label="Challenge hedefi" value="/store/rankings" />
            <AdminOperationalKeyValue label="Skor sahipligi" value="Performans modulleri" />
            <AdminOperationalKeyValue label="Yarisma etaplari" value="Feed uzerinden mutasyon yok" />
            <AdminOperationalKeyValue label="Bolge yoneticisi" value="Sadece kendi bolgesi" />
          </AdminOperationalKeyGrid>
        </AdminOperationalSection>
      </div>
      <AdminOperationalSection badge={<AdminOperationalBadge tone="neutral">12 Postlar</AdminOperationalBadge>} eyebrow="Post kutuphanesi" title="Yonetilen feed postlari">
        {['May UPT Challenge', 'Bolge toplantisi bugun 15:00'].map((title) => (
          <article className="tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/65 tw:p-4 tw:shadow-xs" key={title}>
            <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
              <div>
                <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{title}</strong>
                <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">Magaza feed akisi icin yayinlanan duyuru.</p>
              </div>
              <div className="tw:flex tw:flex-wrap tw:gap-2">
                <AdminOperationalBadge tone="accent">Challenge</AdminOperationalBadge>
                <AdminOperationalBadge tone="success">Yayinda</AdminOperationalBadge>
              </div>
            </div>
          </article>
        ))}
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
