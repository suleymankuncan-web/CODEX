import { useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  Check,
  ChevronDown,
  Clock3,
  FileClock,
  KeyRound,
  Mail,
  Search,
  ShieldCheck,
  Store,
  UserCog,
  UserPlus,
  UsersRound,
} from 'lucide-react'

type Tone = 'plum' | 'cyan' | 'mint' | 'amber' | 'rose' | 'slate'
type DetailTab = 'ozet' | 'roller' | 'magazalar' | 'gecmis'
type Tray = 'uyelik' | 'rol' | 'magaza' | 'denetim'

type RoleGrant = {
  id: string
  label: string
  scope: string
  detail: string
  tone: Tone
}

type StoreGrant = {
  id: string
  name: string
  region: string
  type: string
  access: string
}

type UserRecord = {
  id: string
  name: string
  email: string
  title: string
  employee: string
  status: 'Aktif' | 'Davet bekliyor' | 'Pasif'
  tone: Tone
  lastSeen: string
  roles: RoleGrant[]
  stores: StoreGrant[]
  audit: string[]
}

type AccountDraft = {
  name: string
  email: string
  employee: string
  status: UserRecord['status']
  exitDate: string
  reason: string
  closeAccess: boolean
}

const seedUsers: UserRecord[] = [
  {
    id: 'u-1',
    name: 'Onur Kaytan',
    email: 'onurkaytan@lufian.com.tr',
    title: 'Bölge müdürü',
    employee: 'BM-1024',
    status: 'Aktif',
    tone: 'cyan',
    lastSeen: 'Bugün 09:42',
    roles: [
      {
        id: 'r-1',
        label: 'Bölge müdürü',
        scope: 'Onur Kaytan Bölgesi',
        detail: '30 mağaza okuma ve saha operasyon erişimi',
        tone: 'cyan',
      },
      {
        id: 'r-2',
        label: 'Rapor görüntüleyici',
        scope: 'Bölge raporları',
        detail: 'KPI, hedef ve norm kadro raporları',
        tone: 'slate',
      },
    ],
    stores: [
      { id: 's-1', name: 'Balıkesir 10 Burda AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Aksiyon' },
      { id: 's-2', name: 'Balıkesir Edremit AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Aksiyon' },
      { id: 's-3', name: 'Bursa Anatolium AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Okuma' },
    ],
    audit: ['Rol kapsamı güncellendi', '30 mağaza erişimi bağlandı', 'Clerk üyeliği doğrulandı'],
  },
  {
    id: 'u-2',
    name: 'Mert Alcan',
    email: 'mert.alcan@lufian.com.tr',
    title: 'Mağaza müdürü',
    employee: 'CORP-4489',
    status: 'Aktif',
    tone: 'mint',
    lastSeen: 'Dün 18:10',
    roles: [
      {
        id: 'r-3',
        label: 'Mağaza müdürü',
        scope: 'Balıkesir 10 Burda AVM',
        detail: 'Hedef, görev, checklist kabul ve personel işlemleri',
        tone: 'mint',
      },
    ],
    stores: [
      { id: 's-1', name: 'Balıkesir 10 Burda AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Aksiyon' },
    ],
    audit: ['Mağaza müdürü rolü verildi', 'Aksiyon mağazası eşlendi', 'Personel kaydı bağlandı'],
  },
  {
    id: 'u-3',
    name: 'Ayşe Demir',
    email: 'ayse.demir@lufian.com.tr',
    title: 'Satış danışmanı',
    employee: 'CORP-5012',
    status: 'Aktif',
    tone: 'plum',
    lastSeen: 'Bugün 10:15',
    roles: [
      {
        id: 'r-4',
        label: 'Mağaza personeli',
        scope: 'Bağdat Caddesi',
        detail: 'Kendi performansı ve duyuru akışı',
        tone: 'plum',
      },
    ],
    stores: [
      { id: 's-4', name: 'Bağdat Caddesi', region: 'İstanbul', type: 'Şirket', access: 'Okuma' },
    ],
    audit: ['Personel görünümü açıldı', 'Clerk daveti kabul edildi'],
  },
  {
    id: 'u-4',
    name: 'Ece Korkmaz',
    email: 'ece.korkmaz@lufian.com.tr',
    title: 'HR admin',
    employee: 'HQ-018',
    status: 'Davet bekliyor',
    tone: 'amber',
    lastSeen: 'Davet gönderildi',
    roles: [
      {
        id: 'r-5',
        label: 'HR admin',
        scope: 'Şirket',
        detail: 'Kullanıcı ve personel eşleştirme işlemleri',
        tone: 'amber',
      },
    ],
    stores: [],
    audit: ['Üyelik oluşturuldu', 'Davet bekliyor'],
  },
]

const mockFirstNames = [
  'Deniz',
  'Burak',
  'Selin',
  'Emre',
  'Eylül',
  'Cem',
  'Elif',
  'Kerem',
  'İrem',
  'Kaan',
  'Mina',
  'Arda',
  'Derya',
  'Can',
  'Zeynep',
  'Umut',
  'Buse',
  'Ozan',
  'Melis',
  'Ali',
]

const mockLastNames = [
  'Yılmaz',
  'Kaya',
  'Demir',
  'Çelik',
  'Şahin',
  'Aydın',
  'Öztürk',
  'Arslan',
  'Doğan',
  'Korkmaz',
  'Koç',
  'Aksoy',
  'Polat',
  'Güneş',
  'Taş',
  'Yıldız',
]

const mockStorePool: StoreGrant[] = [
  { id: 's-1', name: 'Balıkesir 10 Burda AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Aksiyon' },
  { id: 's-2', name: 'Balıkesir Edremit AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Aksiyon' },
  { id: 's-3', name: 'Bursa Anatolium AVM', region: 'Onur Kaytan Bölgesi', type: 'Şirket', access: 'Okuma' },
  { id: 's-4', name: 'Bağdat Caddesi', region: 'İstanbul', type: 'Şirket', access: 'Okuma' },
  { id: 's-5', name: 'Marmara Park', region: 'Mehmet Ünlü Bölgesi', type: 'Şirket', access: 'Aksiyon' },
  { id: 's-6', name: 'İstanbul MOI AVM', region: 'Levent Yılmaz Bölgesi', type: 'Şirket', access: 'Aksiyon' },
  { id: 's-7', name: 'Bodrum Oasis AVM', region: 'Eda Doğanay Bölgesi', type: 'Şirket', access: 'Okuma' },
  { id: 's-8', name: 'Adana Cadde', region: 'Sercan Pöhrenkçi Bölgesi', type: 'Şirket', access: 'Aksiyon' },
]

const mockTitles = ['Bölge müdürü', 'Mağaza müdürü', 'Mağaza müdür yardımcısı', 'Satış danışmanı', 'HR admin'] as const
const mockStatuses: UserRecord['status'][] = ['Aktif', 'Aktif', 'Aktif', 'Davet bekliyor', 'Pasif']
const mockTones: Tone[] = ['cyan', 'mint', 'plum', 'amber', 'rose', 'slate']

function getMockRoles(title: string, index: number, store: StoreGrant): RoleGrant[] {
  if (title === 'Bölge müdürü') {
    return [
      {
        id: `mock-r-${index}-region`,
        label: 'Bölge müdürü',
        scope: store.region,
        detail: 'Bölge mağazaları, KPI, hedef ve saha operasyon erişimi',
        tone: 'cyan',
      },
    ]
  }

  if (title === 'HR admin') {
    return [
      {
        id: `mock-r-${index}-admin`,
        label: 'HR admin',
        scope: 'Şirket',
        detail: 'Kullanıcı, rol ve personel eşleştirme işlemleri',
        tone: 'amber',
      },
    ]
  }

  if (title.includes('Mağaza müdür')) {
    return [
      {
        id: `mock-r-${index}-manager`,
        label: title,
        scope: store.name,
        detail: 'Mağaza hedefi, görev, checklist ve personel işlemleri',
        tone: 'mint',
      },
    ]
  }

  return [
    {
      id: `mock-r-${index}-personnel`,
      label: 'Mağaza personeli',
      scope: store.name,
      detail: 'Kendi performansı, görevleri ve duyuru akışı',
      tone: 'slate',
    },
  ]
}

function getMockStores(title: string, index: number, store: StoreGrant): StoreGrant[] {
  if (title === 'HR admin') return []
  if (title === 'Bölge müdürü') {
    return [0, 1, 2, 3].map((offset) => mockStorePool[(index + offset) % mockStorePool.length]!)
  }

  return [store]
}

const generatedUsers: UserRecord[] = Array.from({ length: 96 }, (_, index) => {
  const displayIndex = index + seedUsers.length + 1
  const firstName = mockFirstNames[index % mockFirstNames.length]!
  const lastName = mockLastNames[Math.floor(index / mockFirstNames.length) % mockLastNames.length]!
  const title = mockTitles[index % mockTitles.length]!
  const status = mockStatuses[index % mockStatuses.length]!
  const tone = mockTones[index % mockTones.length]!
  const store = mockStorePool[index % mockStorePool.length]!
  const stores = getMockStores(title, index, store)

  return {
    id: `mock-u-${displayIndex}`,
    name: `${firstName} ${lastName}`,
    email: `pilot.auth.${String(displayIndex).padStart(3, '0')}@lufian.com.tr`,
    title,
    employee: title === 'HR admin' ? `HQ-${String(displayIndex).padStart(3, '0')}` : `CORP-${4200 + displayIndex}`,
    status,
    tone,
    lastSeen: index % 4 === 0 ? 'Bugün 11:20' : index % 4 === 1 ? 'Dün 17:45' : index % 4 === 2 ? '3 gün önce' : 'Davet gönderildi',
    roles: getMockRoles(title, index, store),
    stores,
    audit: [
      `${title} rolü kontrol edildi`,
      stores.length ? `${stores.length} mağaza erişimi bağlı` : 'Mağaza erişimi yok',
      status === 'Davet bekliyor' ? 'Davet yanıtı bekleniyor' : 'Üyelik doğrulandı',
    ],
  }
})

const users: UserRecord[] = [...seedUsers, ...generatedUsers]

const availableRoles = [
  { code: 'SUPER_ADMIN', label: 'Süper admin', tone: 'plum' as const },
  { code: 'HR_ADMIN', label: 'HR admin', tone: 'amber' as const },
  { code: 'REGION_MANAGER', label: 'Bölge müdürü', tone: 'cyan' as const },
  { code: 'STORE_MANAGER', label: 'Mağaza müdürü', tone: 'mint' as const },
  { code: 'STORE_PERSONNEL', label: 'Mağaza personeli', tone: 'slate' as const },
]

const availableStores: StoreGrant[] = mockStorePool

const filterLabels = ['Tümü', 'Admin', 'Bölge', 'Mağaza'] as const
const statusFilterLabels = ['Tümü', 'Aktif', 'Davet bekliyor', 'Pasif'] as const

function createAccountDraft(user: UserRecord): AccountDraft {
  return {
    name: user.name,
    email: user.email,
    employee: user.employee,
    status: user.status,
    exitDate: '',
    reason: '',
    closeAccess: true,
  }
}

export function AdminAuthAccessWorkbenchPrototype() {
  const baseDefaultUser = users[0]!
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<(typeof filterLabels)[number]>('Tümü')
  const [activeStatusFilter, setActiveStatusFilter] = useState<(typeof statusFilterLabels)[number]>('Tümü')
  const [selectedUserId, setSelectedUserId] = useState(baseDefaultUser.id)
  const [activeTab, setActiveTab] = useState<DetailTab>('ozet')
  const [openTray, setOpenTray] = useState<Tray>('rol')
  const [selectedRole, setSelectedRole] = useState('REGION_MANAGER')
  const [storeQuery, setStoreQuery] = useState('')
  const [draftStoreIds, setDraftStoreIds] = useState(['s-1', 's-2', 's-3'])
  const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({})
  const [accountBaselines, setAccountBaselines] = useState<Record<string, AccountDraft>>({})
  const [lastAccountAction, setLastAccountAction] = useState('Değişiklik yok')
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const displayedUsers = useMemo(
    () =>
      users.map((user) => {
        const draft = accountDrafts[user.id]
        if (!draft) return user

        return {
          ...user,
          name: draft.name,
          email: draft.email,
          employee: draft.employee,
          status: draft.status,
          tone: draft.status === 'Pasif' ? 'rose' : user.tone,
          audit:
            draft.status === 'Pasif'
              ? [`Hesap pasife alındı${draft.exitDate ? `: ${draft.exitDate}` : ''}`, ...user.audit]
              : user.audit,
        }
      }),
    [accountDrafts],
  )

  const liveMetrics = useMemo(
    () => [
      {
        label: 'Üyelik',
        value: String(displayedUsers.length),
        note: `${displayedUsers.filter((user) => user.status === 'Aktif').length} aktif`,
        icon: UsersRound,
        tone: 'cyan' as const,
      },
      {
        label: 'Rol ataması',
        value: String(displayedUsers.reduce((total, user) => total + user.roles.length, 0)),
        note: 'Admin, bölge ve mağaza',
        icon: ShieldCheck,
        tone: 'plum' as const,
      },
      {
        label: 'Mağaza erişimi',
        value: String(displayedUsers.reduce((total, user) => total + user.stores.length, 0)),
        note: 'Aksiyon ve okuma',
        icon: Store,
        tone: 'mint' as const,
      },
      {
        label: 'Kontrol bekleyen',
        value: String(displayedUsers.filter((user) => user.status !== 'Aktif').length),
        note: 'Davet ve eşleşme',
        icon: Clock3,
        tone: 'amber' as const,
      },
    ],
    [displayedUsers],
  )

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

    return displayedUsers.filter((user) => {
      const filterMatch =
        activeFilter === 'Tümü' ||
        (activeFilter === 'Admin' && user.roles.some((role) => role.label.toLocaleLowerCase('tr-TR').includes('admin'))) ||
        (activeFilter === 'Bölge' && user.title === 'Bölge müdürü') ||
        (activeFilter === 'Mağaza' && user.title.includes('Mağaza'))

      const statusMatch = activeStatusFilter === 'Tümü' || user.status === activeStatusFilter

      if (!filterMatch || !statusMatch) return false
      if (!normalizedQuery) return true

      return [user.name, user.email, user.title, user.employee].some((value) =>
        value.toLocaleLowerCase('tr-TR').includes(normalizedQuery),
      )
    })
  }, [activeFilter, activeStatusFilter, displayedUsers, query])

  const defaultUser = displayedUsers[0] ?? baseDefaultUser
  const selectedUser = displayedUsers.find((user) => user.id === selectedUserId) ?? defaultUser
  const selectedBaseUser = users.find((user) => user.id === selectedUser.id) ?? baseDefaultUser
  const selectedAccountDraft = accountDrafts[selectedUser.id] ?? createAccountDraft(selectedUser)
  const selectedAccountBaseline = accountBaselines[selectedUser.id] ?? createAccountDraft(selectedBaseUser)
  const accountChangeSummary = [
    selectedAccountDraft.name !== selectedAccountBaseline.name ? 'Ad soyad değişti' : null,
    selectedAccountDraft.email !== selectedAccountBaseline.email ? 'E-posta değişti' : null,
    selectedAccountDraft.employee !== selectedAccountBaseline.employee ? 'Personel kodu değişti' : null,
    selectedAccountDraft.status !== selectedAccountBaseline.status ? `Durum ${selectedAccountDraft.status}` : null,
    selectedAccountDraft.exitDate !== selectedAccountBaseline.exitDate ? `Çıkış tarihi ${selectedAccountDraft.exitDate || 'temizlendi'}` : null,
    selectedAccountDraft.reason !== selectedAccountBaseline.reason ? 'Kapatma nedeni değişti' : null,
  ].filter(Boolean) as string[]
  const updateAccountDraft = (patch: Partial<AccountDraft>) => {
    setAccountDrafts((current) => ({
      ...current,
      [selectedUser.id]: {
        ...(current[selectedUser.id] ?? createAccountDraft(selectedUser)),
        ...patch,
      },
    }))
    setLastAccountAction('Taslak değişti')
    setShowDeactivateConfirm(false)
  }
  const saveAccountDraft = () => {
    setAccountBaselines((current) => ({
      ...current,
      [selectedUser.id]: selectedAccountDraft,
    }))
    setLastAccountAction('Bilgiler kaydedildi')
    setShowDeactivateConfirm(false)
  }
  const deactivateAccount = () => {
    const nextDraft: AccountDraft = {
      ...selectedAccountDraft,
      status: 'Pasif',
      reason: selectedAccountDraft.reason || 'İşten ayrıldı',
      closeAccess: true,
    }
    setAccountDrafts((current) => ({
      ...current,
      [selectedUser.id]: nextDraft,
    }))
    setAccountBaselines((current) => ({
      ...current,
      [selectedUser.id]: nextDraft,
    }))
    setLastAccountAction('Hesap pasife alındı')
    setShowDeactivateConfirm(false)
  }
  const visibleStores = availableStores.filter((store) => {
    const normalizedQuery = storeQuery.trim().toLocaleLowerCase('tr-TR')
    if (!normalizedQuery) return true
    return [store.name, store.region, store.type].some((value) =>
      value.toLocaleLowerCase('tr-TR').includes(normalizedQuery),
    )
  })
  const selectedStoreCount = draftStoreIds.length
  const selectedRoleLabel = availableRoles.find((role) => role.code === selectedRole)?.label ?? 'Rol seçilmedi'

  return (
    <main className="admin-auth-workbench" aria-label="Erişim yönetimi prototipi">
      <section className="auth-workbench-shell">
        <header className="auth-workbench-header">
          <div className="auth-workbench-titleblock">
            <span className="auth-workbench-pill">
              <KeyRound size={15} />
              Erişim
            </span>
            <h1>Erişim Yönetimi</h1>
            <p>Kullanıcı, rol ve mağaza yetkilerini tek çalışma masasında düzenle.</p>
          </div>

          <div className="auth-workbench-actions" aria-label="Hızlı işlemler">
            <button className="auth-soft-button" type="button">
              <FileClock size={16} />
              Son işlemler
            </button>
            <button className="auth-primary-button" type="button" onClick={() => setOpenTray('uyelik')}>
              <UserPlus size={16} />
              Üyelik oluştur
            </button>
          </div>
        </header>

        <div className="auth-metric-strip" aria-label="Erişim özeti">
          {liveMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <article className={`auth-metric-card tone-${metric.tone}`} key={metric.label}>
                <span className="auth-metric-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </div>
              </article>
            )
          })}
        </div>

        <div className="auth-workbench-toolbar">
          <label className="auth-search-field">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kullanıcı, e-posta veya personel ara"
            />
          </label>
          <div className="auth-filter-group" aria-label="Kullanıcı filtresi">
            {filterLabels.map((label) => (
              <button
                className={activeFilter === label ? 'active' : ''}
                key={label}
                onClick={() => setActiveFilter(label)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="auth-filter-group compact-filter" aria-label="Durum filtresi">
            {statusFilterLabels.map((label) => (
              <button
                className={activeStatusFilter === label ? 'active' : ''}
                key={label}
                onClick={() => setActiveStatusFilter(label)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <button className="auth-soft-button auth-toolbar-button" type="button" onClick={() => setOpenTray('rol')}>
            <ShieldCheck size={16} />
            Rol ata
          </button>
          <button className="auth-soft-button auth-toolbar-button" type="button" onClick={() => setOpenTray('magaza')}>
            <Store size={16} />
            Mağaza bağla
          </button>
        </div>

        <section className="auth-workbench-grid">
          <aside className="auth-panel auth-user-list" aria-label="Kullanıcı listesi">
            <div className="auth-panel-head">
              <div>
                <span>Kişiler</span>
                <strong>{filteredUsers.length} kayıt</strong>
              </div>
              <button className="auth-icon-button" type="button" aria-label="Liste ayarları">
                <UserCog size={17} />
              </button>
            </div>

            <div className="auth-user-scroll">
              {filteredUsers.map((user) => (
                <button
                  className={`auth-user-row${selectedUser.id === user.id ? ' selected' : ''}`}
                  key={user.id}
                  onClick={() => {
                    setSelectedUserId(user.id)
                    setActiveTab('ozet')
                    setLastAccountAction('Değişiklik yok')
                    setShowDeactivateConfirm(false)
                  }}
                  type="button"
                >
                  <span className={`auth-avatar tone-${user.tone}`}>{user.name.slice(0, 1)}</span>
                  <span className="auth-user-copy">
                    <strong>{user.name}</strong>
                    <small>{user.title}</small>
                    <em>{user.email}</em>
                    <span className="auth-user-meta">
                      {user.stores.length ? `${user.stores.length} mağaza` : 'Mağaza yok'} · {user.lastSeen}
                    </span>
                  </span>
                  <span className={`auth-status tone-${user.tone}`}>{user.status}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="auth-panel auth-detail-panel" aria-label="Seçili kullanıcı">
            <div className="auth-profile-head">
              <div className="auth-profile-main">
                <span className={`auth-avatar auth-avatar-large tone-${selectedUser.tone}`}>
                  {selectedUser.name.slice(0, 1)}
                </span>
                <div>
                  <span className="auth-kicker">Seçili kullanıcı</span>
                  <h2>{selectedUser.name}</h2>
                  <p>{selectedUser.email}</p>
                </div>
              </div>
              <span className={`auth-status tone-${selectedUser.tone}`}>{selectedUser.status}</span>
            </div>

            <div className="auth-profile-facts">
              <Fact label="Rol" value={selectedUser.title} />
              <Fact label="Personel" value={selectedUser.employee} />
              <Fact label="Son hareket" value={selectedUser.lastSeen} />
              <Fact label="Mağaza" value={String(selectedUser.stores.length)} />
            </div>

            <div className="auth-tabs" aria-label="Kullanıcı detayı">
              {[
                ['ozet', 'Özet'],
                ['roller', 'Roller'],
                ['magazalar', 'Mağazalar'],
                ['gecmis', 'Geçmiş'],
              ].map(([id, label]) => (
                <button
                  className={activeTab === id ? 'active' : ''}
                  key={id}
                  onClick={() => setActiveTab(id as DetailTab)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="auth-tab-body">
              {activeTab === 'ozet' ? (
                <div className="auth-summary-grid">
                  <SummaryTile title="Rol durumu" value={`${selectedUser.roles.length} aktif rol`} tone="plum" />
                  <SummaryTile title="Mağaza erişimi" value={`${selectedUser.stores.length} mağaza`} tone="cyan" />
                  <SummaryTile title="Üyelik" value={selectedUser.status} tone={selectedUser.tone} />
                  <SummaryTile title="Son kontrol" value={selectedUser.audit[0] ?? 'Kayıt yok'} tone="slate" />
                </div>
              ) : null}

              {activeTab === 'roller' ? (
                <div className="auth-compact-list">
                  {selectedUser.roles.map((role) => (
                    <article className={`auth-access-row tone-${role.tone}`} key={role.id}>
                      <span className="auth-row-icon">
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <strong>{role.label}</strong>
                        <small>{role.scope}</small>
                        <p>{role.detail}</p>
                      </div>
                      <button type="button">Düzenle</button>
                    </article>
                  ))}
                </div>
              ) : null}

              {activeTab === 'magazalar' ? (
                <div className="auth-store-grid">
                  {selectedUser.stores.length ? (
                    selectedUser.stores.map((store) => <StoreCard key={store.id} store={store} />)
                  ) : (
                    <div className="auth-empty-state">Bu kullanıcıya bağlı mağaza yok.</div>
                  )}
                </div>
              ) : null}

              {activeTab === 'gecmis' ? (
                <div className="auth-timeline">
                  {selectedUser.audit.map((item, index) => (
                    <div className="auth-timeline-row" key={item}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="auth-panel auth-action-panel" aria-label="İşlem paneli">
            <div className="auth-panel-head">
              <div>
                <span>İşlem paneli</span>
                <strong>{selectedUser.name}</strong>
              </div>
              <span className="auth-mini-count">{selectedRoleLabel}</span>
            </div>

            <section className="auth-change-summary" aria-label="Değişiklik özeti">
              <div className="auth-section-title">
                <strong>Değişiklik özeti</strong>
                <span>{accountChangeSummary.length ? `${accountChangeSummary.length} taslak` : 'Temiz'}</span>
              </div>
              {accountChangeSummary.length ? (
                <ul>
                  {accountChangeSummary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>Seçili kullanıcıda bekleyen değişiklik yok.</p>
              )}
              <button
                className="auth-primary-button auth-full-button"
                disabled={!accountChangeSummary.length}
                type="button"
                onClick={saveAccountDraft}
              >
                <Check size={16} />
                {accountChangeSummary.length ? `${accountChangeSummary.length} değişikliği uygula` : 'Değişiklik yok'}
              </button>
            </section>

            <AccordionTray
              active={openTray === 'uyelik'}
              icon={<UserPlus size={16} />}
              label="Üyelik"
              meta="Yeni veya mevcut kişi"
              onToggle={() => setOpenTray(openTray === 'uyelik' ? 'rol' : 'uyelik')}
            >
              <div className="auth-account-section">
                <div className="auth-section-title">
                  <strong>Hesap bilgileri</strong>
                  <span>{lastAccountAction}</span>
                </div>
                <div className="auth-form-grid">
                  <label>
                    Ad soyad
                    <input
                      value={selectedAccountDraft.name}
                      onChange={(event) => updateAccountDraft({ name: event.target.value })}
                      placeholder="Kullanıcı adı"
                    />
                  </label>
                  <label>
                    E-posta
                    <input
                      value={selectedAccountDraft.email}
                      onChange={(event) => updateAccountDraft({ email: event.target.value })}
                      placeholder="isim@lufian.com.tr"
                    />
                  </label>
                  <label>
                    Personel kodu
                    <input
                      value={selectedAccountDraft.employee}
                      onChange={(event) => updateAccountDraft({ employee: event.target.value })}
                      placeholder="Personel adı veya kodu"
                    />
                  </label>
                </div>
                <div className="auth-status-switch" aria-label="Üyelik durumu">
                  {(['Aktif', 'Davet bekliyor', 'Pasif'] as const).map((status) => (
                    <button
                      className={selectedAccountDraft.status === status ? 'selected' : ''}
                      key={status}
                      onClick={() => updateAccountDraft({ status })}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <button className="auth-primary-button auth-full-button" type="button" onClick={saveAccountDraft}>
                  <Check size={16} />
                  Değişiklikleri kaydet
                </button>
              </div>

              <div className="auth-danger-box">
                <div className="auth-section-title">
                  <strong>İşten ayrılma / hesap kapatma</strong>
                  <span>Geçmiş kayıtlar korunur</span>
                </div>
                <div className="auth-form-grid compact-grid">
                  <label>
                    Çıkış tarihi
                    <input
                      value={selectedAccountDraft.exitDate}
                      onChange={(event) => updateAccountDraft({ exitDate: event.target.value })}
                      placeholder="30.06.2026"
                    />
                  </label>
                  <label>
                    Kapatma nedeni
                    <input
                      value={selectedAccountDraft.reason}
                      onChange={(event) => updateAccountDraft({ reason: event.target.value })}
                      placeholder="İşten ayrıldı"
                    />
                  </label>
                </div>
                <label className="auth-check-row">
                  <input
                    checked={selectedAccountDraft.closeAccess}
                    onChange={(event) => updateAccountDraft({ closeAccess: event.target.checked })}
                    type="checkbox"
                  />
                  Clerk oturumu, rol ve mağaza erişimini kapat
                </label>
                {showDeactivateConfirm ? (
                  <div className="auth-confirm-box">
                    <strong>Bu hesap pasife alınacak.</strong>
                    <p>Rol ve mağaza erişimi kapanır; geçmiş kayıtlar korunur.</p>
                    <div>
                      <button type="button" onClick={() => setShowDeactivateConfirm(false)}>
                        Vazgeç
                      </button>
                      <button type="button" onClick={deactivateAccount}>
                        Hesabı kapat
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="auth-danger-button auth-full-button"
                    type="button"
                    onClick={() => setShowDeactivateConfirm(true)}
                  >
                    Erişimi kapat ve pasife al
                  </button>
                )}
              </div>

              <button className="auth-soft-button auth-full-button" type="button">
                <Mail size={16} />
                Yeni davet oluştur
              </button>
            </AccordionTray>

            <AccordionTray
              active={openTray === 'rol'}
              icon={<ShieldCheck size={16} />}
              label="Rol ata"
              meta={selectedRoleLabel}
              onToggle={() => setOpenTray(openTray === 'rol' ? 'magaza' : 'rol')}
            >
              <div className="auth-role-palette">
                {availableRoles.map((role) => (
                  <button
                    className={`tone-${role.tone}${selectedRole === role.code ? ' selected' : ''}`}
                    key={role.code}
                    onClick={() => setSelectedRole(role.code)}
                    type="button"
                  >
                    {selectedRole === role.code ? <Check size={14} /> : null}
                    {role.label}
                  </button>
                ))}
              </div>
              <div className="auth-scope-row">
                <button className="selected" type="button">Şirket</button>
                <button type="button">Bölge</button>
                <button type="button">Mağaza</button>
              </div>
              <button className="auth-primary-button auth-full-button" type="button">
                <ShieldCheck size={16} />
                Rolü kaydet
              </button>
            </AccordionTray>

            <AccordionTray
              active={openTray === 'magaza'}
              icon={<Store size={16} />}
              label="Mağaza bağla"
              meta={`${selectedStoreCount} seçim`}
              onToggle={() => setOpenTray(openTray === 'magaza' ? 'denetim' : 'magaza')}
            >
              <label className="auth-search-field compact">
                <Search size={15} />
                <input
                  value={storeQuery}
                  onChange={(event) => setStoreQuery(event.target.value)}
                  placeholder="Mağaza ara"
                />
              </label>
              <div className="auth-store-picker">
                {visibleStores.map((store) => {
                  const checked = draftStoreIds.includes(store.id)
                  return (
                    <button
                      className={checked ? 'selected' : ''}
                      key={store.id}
                      onClick={() =>
                        setDraftStoreIds((current) =>
                          current.includes(store.id)
                            ? current.filter((id) => id !== store.id)
                            : [...current, store.id],
                        )
                      }
                      type="button"
                    >
                      <span>{checked ? <Check size={14} /> : <Store size={14} />}</span>
                      <strong>{store.name}</strong>
                      <small>{store.region}</small>
                    </button>
                  )
                })}
              </div>
              <button className="auth-primary-button auth-full-button" type="button">
                <Building2 size={16} />
                Mağazaları kaydet
              </button>
            </AccordionTray>

            <AccordionTray
              active={openTray === 'denetim'}
              icon={<FileClock size={16} />}
              label="Kontrol izi"
              meta="Son işlemler"
              onToggle={() => setOpenTray(openTray === 'denetim' ? 'rol' : 'denetim')}
            >
              <div className="auth-mini-timeline">
                {selectedUser.audit.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              <button className="auth-soft-button auth-full-button" type="button">
                <FileClock size={16} />
                Geçmişi aç
              </button>
            </AccordionTray>
          </aside>
        </section>
      </section>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="auth-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SummaryTile({ title, value, tone }: { title: string; value: string; tone: Tone }) {
  return (
    <article className={`auth-summary-tile tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  )
}

function StoreCard({ store }: { store: StoreGrant }) {
  return (
    <article className="auth-store-card">
      <div>
        <strong>{store.name}</strong>
        <small>{store.region}</small>
      </div>
      <span>{store.access}</span>
    </article>
  )
}

function AccordionTray({
  active,
  children,
  icon,
  label,
  meta,
  onToggle,
}: {
  active: boolean
  children: ReactNode
  icon: ReactNode
  label: string
  meta: string
  onToggle: () => void
}) {
  return (
    <section className={`auth-tray${active ? ' open' : ''}`}>
      <button className="auth-tray-head" onClick={onToggle} type="button">
        <span className="auth-tray-icon">{icon}</span>
        <span>
          <strong>{label}</strong>
          <small>{meta}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {active ? <div className="auth-tray-body">{children}</div> : null}
    </section>
  )
}
