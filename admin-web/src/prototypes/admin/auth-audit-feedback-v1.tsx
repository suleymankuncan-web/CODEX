import { ClipboardCheck, KeyRound, MessageSquareWarning, ShieldCheck, UserCog } from 'lucide-react'
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

const metrics = [
  {
    id: 'auth-users',
    label: 'Aktif kullanıcı',
    value: '142',
    description: 'Yetkili oturum havuzu',
    icon: <UserCog size={18} />,
    tone: 'cyan' as const,
  },
  {
    id: 'role-grants',
    label: 'Rol ataması',
    value: '38',
    description: 'Aktif erişim kaydı',
    icon: <ShieldCheck size={18} />,
    tone: 'accent' as const,
  },
  {
    id: 'audit-trace',
    label: 'Denetim izi',
    value: '24',
    description: 'Son işlem kaydı',
    icon: <ClipboardCheck size={18} />,
    tone: 'warning' as const,
  },
  {
    id: 'feedback',
    label: 'Pilot geri bildirim',
    value: '6',
    description: 'Sınıflandırma bekliyor',
    icon: <MessageSquareWarning size={18} />,
    tone: 'danger' as const,
  },
]

const authRows = [
  {
    title: 'Onur Kaytan',
    meta: 'Bölge müdürü - 30 mağaza aksiyon yetkisi',
    status: 'Aktif',
    tone: 'success' as const,
  },
  {
    title: 'Süleyman Kuncan',
    meta: 'Admin - kullanıcı ve rol yönetimi',
    status: 'Kontrol edildi',
    tone: 'accent' as const,
  },
]

const traceRows = [
  {
    title: 'Rol ataması güncellendi',
    meta: 'Admin tarafından bölge müdürü rol kapsamı yenilendi',
    status: 'Denetim izi var',
    tone: 'warning' as const,
  },
  {
    title: 'Pilot geri bildirim sınıflandırıldı',
    meta: 'P2 pilot sürtünme olarak işaretlendi',
    status: 'Kaydedildi',
    tone: 'success' as const,
  },
]

export function AdminAuthAuditFeedbackPrototype() {
  return (
    <AdminOperationalPage ariaLabel="Admin yetki, denetim ve pilot geri bildirim prototipi">
      <AdminOperationalHeader
        eyebrow="Admin operasyon"
        title="Yetki ve Denetim"
        description="Kullanıcı erişimleri, işlem izleri ve pilot geri bildirimleri tek operasyon ritminde izlenir."
        icon={<KeyRound size={20} />}
        meta={
          <>
            <AdminOperationalBadge tone="accent">Güvenlik</AdminOperationalBadge>
            <AdminOperationalBadge tone="cyan">Denetim</AdminOperationalBadge>
            <AdminOperationalBadge tone="neutral">Pilot</AdminOperationalBadge>
          </>
        }
      />

      <AdminOperationalMetrics items={metrics} />

      <section className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[1.15fr_0.85fr]">
        <AdminOperationalSection
          eyebrow="Erişim kuyruğu"
          title="Kullanıcı ve rol kayıtları"
          badge={<AdminOperationalBadge tone="accent">2 kayıt</AdminOperationalBadge>}
        >
          {authRows.map((row) => (
            <AdminOperationalRow
              key={row.title}
              title={row.title}
              meta={row.meta}
              status={<AdminOperationalBadge tone={row.tone}>{row.status}</AdminOperationalBadge>}
              tone={row.tone}
            >
              <AdminOperationalKeyGrid>
                <AdminOperationalKeyValue label="Rol" value={row.meta.split(' - ')[0]} />
                <AdminOperationalKeyValue label="Durum" value={row.status} />
              </AdminOperationalKeyGrid>
            </AdminOperationalRow>
          ))}
        </AdminOperationalSection>

        <AdminOperationalSection
          eyebrow="İşlem izi"
          title="Son denetim hareketleri"
          badge={<AdminOperationalBadge tone="warning">Canlı kayıt</AdminOperationalBadge>}
        >
          {traceRows.map((row) => (
            <AdminOperationalRow
              key={row.title}
              title={row.title}
              meta={row.meta}
              status={<AdminOperationalBadge tone={row.tone}>{row.status}</AdminOperationalBadge>}
              tone={row.tone}
            />
          ))}
        </AdminOperationalSection>
      </section>
    </AdminOperationalPage>
  )
}
