import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import type { StoreHomeCommandModel } from '../pages/store-home-command-model'
import { StoreHomeCommandView } from '../pages/store-home-command-view'
import { StorePrototypeCommandShell } from './store-prototype-command-shell'

const prototypeModel: StoreHomeCommandModel = {
  persona: 'regionManager',
  personaLabel: 'Bölge müdürü',
  identityLabel: 'Onur Kaytan Bölgesi',
  periodLabel: 'Haziran 2026',
  todayTitle: 'Bugün',
  todayNote: 'Önce hedef kararı',
  metrics: [
    {
      id: 'urgent',
      label: 'Acil iş',
      value: '4',
      note: 'Bugün karar bekliyor',
      tone: 'rose',
      icon: <AlertTriangle size={20} />,
    },
    {
      id: 'pending',
      label: 'Onay bekleyen',
      value: '6',
      note: 'Hedef ve checklist',
      tone: 'amber',
      icon: <ShieldCheck size={20} />,
    },
    {
      id: 'stores',
      label: 'Takipte mağaza',
      value: '9',
      note: 'Bölge portföyü',
      tone: 'cyan',
      icon: <Store size={20} />,
    },
    {
      id: 'feed',
      label: 'Duyurular',
      value: '3',
      note: '1 sabit gönderi',
      tone: 'plum',
      icon: <Megaphone size={20} />,
    },
  ],
  priorities: [
    {
      id: 'target-approval',
      source: 'Hedefler',
      title: 'Balıkesir 10 Burda AVM hedef kararı bekliyor',
      detail: 'Mağaza hedef dağılımı gönderildi. Personel dağılımı dengeli görünüyor; karar aynı pencerede verilebilir.',
      meta: 'Mayıs 2026 · 4 personel',
      status: 'Karar bekliyor',
      cta: 'Hedefleri aç',
      href: '/store/targets',
      routeLabel: 'Hedefler',
      tone: 'amber',
      icon: <Target size={20} />,
      priority: 10,
      filter: 'approval',
    },
    {
      id: 'checklist-acceptance',
      source: 'Checklist',
      title: 'VM sonucu mağaza kabulünde bekliyor',
      detail: 'Bağdat Caddesi kontrol sonucu mağaza müdürü kabulü bekliyor. Düşük madde yok, takip notu var.',
      meta: 'Bugün · 14:20',
      status: 'Kabul bekliyor',
      cta: 'Sonucu incele',
      href: '/store/checklists',
      routeLabel: 'Checklistler',
      tone: 'cyan',
      icon: <ClipboardCheck size={20} />,
      priority: 20,
      filter: 'approval',
      testId: 'store-home-checklist-card',
    },
    {
      id: 'task-followup',
      source: 'Görevler',
      title: 'Reyon düzeni aksiyonu gecikmeye yaklaşıyor',
      detail: 'Aksiyon 12 gündür açık. Mağaza müdürü çözüm notu ekledi; bölge tarafında sadece sonuç izlenir.',
      meta: '12 gün açık',
      status: 'Takipte',
      cta: 'Görevi görüntüle',
      href: '/store/tasks',
      routeLabel: 'Görevler',
      tone: 'rose',
      icon: <Bell size={20} />,
      priority: 30,
      filter: 'critical',
    },
    {
      id: 'incentive-review',
      source: 'Primler',
      title: 'Haziran prim paketi kontrol sürecinde',
      detail: 'Bölge paketi kapanış sonrası kontrol edilecek. Düzeltme notu olan kayıtlar ayrı işaretlenir.',
      meta: 'Haziran 2026',
      status: 'Kontrol',
      cta: 'Primleri aç',
      href: '/store/incentives',
      routeLabel: 'Primler',
      tone: 'plum',
      icon: <WalletCards size={20} />,
      priority: 40,
      filter: 'approval',
    },
    {
      id: 'workforce-gap',
      source: 'Norm Kadro',
      title: 'Edremit Novada eksik kadroda çalışıyor',
      detail: 'Mağaza 41 gündür eksik kadroda. Aktif personel ve pozisyon dengesi norm kadro dosyasında görülebilir.',
      meta: '41 gündür',
      status: 'Eksik',
      cta: 'Norm kadroyu aç',
      href: '/store/workforce',
      routeLabel: 'Norm Kadro',
      tone: 'amber',
      icon: <UsersRound size={20} />,
      priority: 50,
      filter: 'critical',
      testId: 'store-home-visit-priority-card',
    },
  ],
  announcements: [
    {
      id: 'pinned-weekend',
      label: 'Sabit',
      copy: 'Hafta sonu ürün odağı: yeni sezon giriş alanı ve kasa önü aksesuar düzeni.',
      time: 'Bugün 09:10',
    },
    {
      id: 'region-note',
      label: 'Bölge',
      copy: 'VM ziyaretleri tamamlanan mağazalar sonuç kabulünü aynı gün kapatsın.',
      time: 'Dün 18:45',
    },
  ],
  quickLinks: [
    {
      id: 'kpis',
      label: 'KPI özetleri',
      value: '3 sinyal',
      href: '/store/kpis',
      icon: <TrendingUp size={20} />,
      tone: 'cyan',
    },
    {
      id: 'reports',
      label: 'Raporlar',
      value: 'Hazır',
      href: '/store/reports',
      icon: <FileText size={20} />,
      tone: 'mint',
    },
    {
      id: 'feed',
      label: 'Duyurular',
      value: '3 yeni',
      href: '/store/feed',
      icon: <Megaphone size={20} />,
      tone: 'plum',
    },
  ],
}

export function StoreHomeCommandV1Prototype() {
  return (
    <StorePrototypeCommandShell
      activePath="/store/home"
      identityLabel="Onur Kaytan Bölgesi"
      personaLabel="Bölge müdürü"
      subtitle="Günlük operasyon"
    >
      <StoreHomeCommandView model={prototypeModel} />
    </StorePrototypeCommandShell>
  )
}
