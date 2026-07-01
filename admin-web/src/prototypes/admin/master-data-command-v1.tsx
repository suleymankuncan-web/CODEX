import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  ChevronRight,
  Clock3,
  DatabaseZap,
  GitBranch,
  History,
  Link2,
  RefreshCw,
  Save,
  Search,
  UploadCloud,
  UserRound,
  UsersRound,
} from 'lucide-react'
import './master-data-command-v1.css'

type TabId = 'issues' | 'stores' | 'personnel' | 'imports' | 'history'
type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

type IssueRow = {
  id: string
  title: string
  entity: string
  owner: string
  reason: string
  impact: string
  priority: 'Yüksek' | 'Orta' | 'Düşük'
  tone: Tone
}

type StoreRow = {
  id: string
  name: string
  code: string
  city: string
  type: 'Şirket' | 'Bayi' | 'İşletme'
  regionManager: string
  storeManager: string
  status: 'Aktif' | 'Pasif'
  kpi: 'Dahil' | 'Hariç'
  personnel: number
  issue: string
  tone: Tone
}

type PersonnelRow = {
  id: string
  name: string
  sellerCode: string
  store: string
  position: string
  status: 'Aktif' | 'Pasif' | 'Ayrıldı'
  startDate: string
  issue: string
  tone: Tone
}

type ImportRow = {
  id: string
  source: string
  entity: 'Mağaza' | 'Personel' | 'Bölge'
  rows: string
  ready: string
  blocked: string
  decision: string
  tone: Tone
}

type AuditRow = {
  title: string
  before: string
  after: string
  actor: string
  time: string
}

const navItems = ['Operasyonlar', 'Entegrasyonlar', 'Ana Veri', 'Auth', 'Raporlar', 'Ayarlar']

const issues: IssueRow[] = [
  {
    id: 'issue-region-missing',
    title: 'Bölge müdürü ataması eksik',
    entity: 'Marmara Park',
    owner: 'Mağaza',
    reason: 'Mağaza aktif ama bölge müdürü seçilmemiş.',
    impact: 'KPI, hedef ve prim görünümü etkilenir.',
    priority: 'Yüksek',
    tone: 'danger',
  },
  {
    id: 'issue-seller-code',
    title: 'Satıcı kodu bulunamadı',
    entity: 'Sinem Tekkurt',
    owner: 'Personel',
    reason: 'Satış eşleşmesi için satıcı kodu gerekli.',
    impact: 'Satış, prim ve ranking kayıtları eksik kalır.',
    priority: 'Yüksek',
    tone: 'danger',
  },
  {
    id: 'issue-manager-check',
    title: 'Mağaza müdürü kontrolü',
    entity: 'Bursa Downtown',
    owner: 'Mağaza',
    reason: 'Mağaza müdürü bilgisi önceki dönemden farklı.',
    impact: 'Hedef dağıtımı ve mağaza görünümü etkilenir.',
    priority: 'Orta',
    tone: 'warning',
  },
  {
    id: 'issue-position-review',
    title: 'Pozisyon doğrulaması',
    entity: 'Ayşe Demir',
    owner: 'Personel',
    reason: 'Pozisyon değişikliği onay bekliyor.',
    impact: 'Prim oranı ve görev görünürlüğü etkilenir.',
    priority: 'Orta',
    tone: 'warning',
  },
]

const stores: StoreRow[] = [
  {
    id: 'store-1',
    name: 'Balıkesir 10 Burda AVM',
    code: 'BURDA10',
    city: 'Balıkesir',
    type: 'Şirket',
    regionManager: 'Onur Kaytan',
    storeManager: 'Mert Alcan',
    status: 'Aktif',
    kpi: 'Dahil',
    personnel: 4,
    issue: 'Temiz',
    tone: 'success',
  },
  {
    id: 'store-2',
    name: 'Bursa Downtown',
    code: 'BSDTWN',
    city: 'Bursa',
    type: 'Şirket',
    regionManager: 'Mehmet Ünlü',
    storeManager: 'Abdurrahman Kök',
    status: 'Aktif',
    kpi: 'Dahil',
    personnel: 6,
    issue: 'Müdür kontrolü',
    tone: 'warning',
  },
  {
    id: 'store-3',
    name: 'İstanbul Beylikdüzü Cadde',
    code: 'ISTBCD',
    city: 'İstanbul',
    type: 'Şirket',
    regionManager: 'Onur Kaytan',
    storeManager: 'Eda Doğanay',
    status: 'Aktif',
    kpi: 'Dahil',
    personnel: 5,
    issue: 'Temiz',
    tone: 'success',
  },
  {
    id: 'store-4',
    name: 'Marmara Park',
    code: 'MRMPRK',
    city: 'İstanbul',
    type: 'Bayi',
    regionManager: 'Atama bekliyor',
    storeManager: 'Müdür bilgisi yok',
    status: 'Aktif',
    kpi: 'Hariç',
    personnel: 0,
    issue: 'Atama eksik',
    tone: 'danger',
  },
  {
    id: 'store-5',
    name: 'Bodrum Oasis AVM',
    code: 'BDROAS',
    city: 'Muğla',
    type: 'İşletme',
    regionManager: 'Mehmet Ünlü',
    storeManager: 'Aylin Demir',
    status: 'Pasif',
    kpi: 'Hariç',
    personnel: 2,
    issue: 'Pasif',
    tone: 'neutral',
  },
]

const personnel: PersonnelRow[] = [
  {
    id: 'per-1',
    name: 'Mert Alcan',
    sellerCode: 'CORP_4489',
    store: 'Balıkesir 10 Burda AVM',
    position: 'Mağaza Müdürü',
    status: 'Aktif',
    startDate: '28 Haziran 2025',
    issue: 'Temiz',
    tone: 'success',
  },
  {
    id: 'per-2',
    name: 'Emine Çavuş',
    sellerCode: 'CORP_4218',
    store: 'Balıkesir 10 Burda AVM',
    position: 'Satış Danışmanı',
    status: 'Aktif',
    startDate: '12 Ocak 2026',
    issue: 'Temiz',
    tone: 'success',
  },
  {
    id: 'per-3',
    name: 'Ayşe Demir',
    sellerCode: 'CORP_5109',
    store: 'Bursa Downtown',
    position: 'Müdür Yardımcısı',
    status: 'Aktif',
    startDate: '3 Mart 2026',
    issue: 'Pozisyon kontrolü',
    tone: 'warning',
  },
  {
    id: 'per-4',
    name: 'Sinem Tekkurt',
    sellerCode: 'Kod bekliyor',
    store: 'Atama bekliyor',
    position: 'Satış Danışmanı',
    status: 'Pasif',
    startDate: '11 Ocak 2025',
    issue: 'Kod eksik',
    tone: 'danger',
  },
]

const imports: ImportRow[] = [
  {
    id: 'import-store-2026-06',
    source: 'Mağaza ana veri',
    entity: 'Mağaza',
    rows: '30',
    ready: '29',
    blocked: '1',
    decision: 'Kayda hazır',
    tone: 'warning',
  },
  {
    id: 'import-personnel-2026-06',
    source: 'Personel ana veri',
    entity: 'Personel',
    rows: '150',
    ready: '146',
    blocked: '4',
    decision: 'İnceleme gerekli',
    tone: 'warning',
  },
  {
    id: 'import-region-2026-06',
    source: 'Bölge atamaları',
    entity: 'Bölge',
    rows: '8',
    ready: '8',
    blocked: '0',
    decision: 'Kayda hazır',
    tone: 'success',
  },
]

const audit: AuditRow[] = [
  {
    title: 'Bursa Downtown mağaza müdürü',
    before: 'Müdür bilgisi yok',
    after: 'Abdurrahman Kök',
    actor: 'Admin',
    time: 'Bugün 11:42',
  },
  {
    title: 'Ayşe Demir pozisyonu',
    before: 'Satış Danışmanı',
    after: 'Müdür Yardımcısı',
    actor: 'Admin',
    time: 'Dün 17:08',
  },
  {
    title: 'Bölge atamaları',
    before: '7 aktif bölge',
    after: '8 aktif bölge',
    actor: 'Admin',
    time: '24 Haziran',
  },
]

export function AdminMasterDataCommandV1Prototype() {
  const [activeTab, setActiveTab] = useState<TabId>('issues')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tümü')
  const [selectedIssueId, setSelectedIssueId] = useState(issues[0]!.id)
  const [selectedStoreId, setSelectedStoreId] = useState(stores[3]!.id)
  const [selectedPersonnelId, setSelectedPersonnelId] = useState(personnel[3]!.id)
  const [selectedImportId, setSelectedImportId] = useState(imports[0]!.id)
  const [unsavedCount, setUnsavedCount] = useState(3)

  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0]!
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? stores[0]!
  const selectedPersonnel = personnel.find((person) => person.id === selectedPersonnelId) ?? personnel[0]!
  const selectedImport = imports.find((item) => item.id === selectedImportId) ?? imports[0]!

  const filteredIssues = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('tr-TR')
    return issues.filter((issue) => {
      const text = [issue.title, issue.entity, issue.owner, issue.reason].join(' ').toLocaleLowerCase('tr-TR')
      const statusMatch = statusFilter === 'Tümü' || issue.priority === statusFilter || issue.owner === statusFilter
      return text.includes(normalizedQuery) && statusMatch
    })
  }, [query, statusFilter])

  const filteredStores = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('tr-TR')
    return stores.filter((store) => {
      const text = [store.name, store.code, store.city, store.regionManager, store.storeManager].join(' ').toLocaleLowerCase('tr-TR')
      const statusMatch =
        statusFilter === 'Tümü' ||
        store.type === statusFilter ||
        store.status === statusFilter ||
        store.kpi === statusFilter ||
        store.issue === statusFilter
      return text.includes(normalizedQuery) && statusMatch
    })
  }, [query, statusFilter])

  const filteredPersonnel = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('tr-TR')
    return personnel.filter((person) => {
      const text = [person.name, person.sellerCode, person.store, person.position].join(' ').toLocaleLowerCase('tr-TR')
      const statusMatch =
        statusFilter === 'Tümü' ||
        person.status === statusFilter ||
        person.position === statusFilter ||
        person.issue === statusFilter
      return text.includes(normalizedQuery) && statusMatch
    })
  }, [query, statusFilter])

  const filterOptions = getFilterOptions(activeTab)

  function markUnsaved() {
    setUnsavedCount((current) => current + 1)
  }

  function saveAllChanges() {
    setUnsavedCount(0)
  }

  return (
    <div className="admin-master-prototype-app">
      <div className="admin-master-prototype-shell">
        <aside className="admin-master-prototype-sidebar" aria-label="Admin prototip navigasyon">
          <div className="admin-master-prototype-brand">
            <div className="admin-master-prototype-logo">HR</div>
            <div>
              <strong>HR Axis</strong>
              <span>Admin Home</span>
            </div>
          </div>
          <nav className="admin-master-prototype-nav">
            {navItems.map((item) => (
              <a className={item === 'Ana Veri' ? 'active' : ''} href="#prototype" key={item}>
                <GitBranch size={16} aria-hidden="true" />
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <main className="admin-master-prototype-main">
          <section className="admin-master-prototype-page" aria-labelledby="admin-master-prototype-title">
            <header className="admin-master-prototype-hero">
              <div className="admin-master-prototype-title">
                <div className="admin-master-prototype-pills">
                  <span className="admin-master-prototype-pill primary">Ana Veri</span>
                  <span className="admin-master-prototype-pill soft">Haziran 2026</span>
                  <span className="admin-master-prototype-pill warning">{unsavedCount} kaydedilmedi</span>
                </div>
                <h1 id="admin-master-prototype-title">Ana Veri Kontrolü</h1>
                <p>Mağaza, personel, rol ve bölge ilişkilerini temizleyip kaydedin.</p>
              </div>
              <div className="admin-master-prototype-actions">
                <button className="admin-master-prototype-button" type="button">
                  <RefreshCw size={16} aria-hidden="true" />
                  Yenile
                </button>
                <button className="admin-master-prototype-button" type="button">
                  <UploadCloud size={16} aria-hidden="true" />
                  İçe aktar
                </button>
                <button className="admin-master-prototype-button primary" type="button" onClick={saveAllChanges}>
                  <Save size={16} aria-hidden="true" />
                  Değişiklikleri kaydet
                </button>
              </div>
            </header>

            <MetricStrip unsavedCount={unsavedCount} />

            <section className="admin-master-prototype-board" aria-label="Ana veri karar özeti">
              <article>
                <span className="admin-master-prototype-board-kicker">Öncelik</span>
                <strong>4 kayıt aksiyon bekliyor</strong>
                <p>Bölge, satıcı kodu ve pozisyon eşleşmeleri tamamlanmadan dönem hesapları güvenilir sayılmaz.</p>
              </article>
              <ImpactMap />
            </section>

            <section className="admin-master-prototype-workbench" aria-label="Ana veri çalışma alanı">
              <div className="admin-master-prototype-workbench-head">
                <div className="admin-master-prototype-tabs" role="tablist" aria-label="Ana veri sekmeleri">
                  <TabButton active={activeTab === 'issues'} count={issues.length} label="Düzeltilecekler" onClick={() => setActiveTab('issues')} />
                  <TabButton active={activeTab === 'stores'} count={stores.length} label="Mağazalar" onClick={() => setActiveTab('stores')} />
                  <TabButton active={activeTab === 'personnel'} count={personnel.length} label="Personel" onClick={() => setActiveTab('personnel')} />
                  <TabButton active={activeTab === 'imports'} count={imports.length} label="İçe Aktarım" onClick={() => setActiveTab('imports')} />
                  <TabButton active={activeTab === 'history'} count={audit.length} label="Geçmiş" onClick={() => setActiveTab('history')} />
                </div>
                <div className="admin-master-prototype-filterbar">
                  <label className="admin-master-prototype-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      className="admin-master-prototype-input"
                      placeholder={getSearchPlaceholder(activeTab)}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select className="admin-master-prototype-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    {filterOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <select className="admin-master-prototype-select" defaultValue="Öncelik">
                    <option>Öncelik</option>
                    <option>Son değişiklik</option>
                    <option>Mağaza adı</option>
                    <option>Personel adı</option>
                  </select>
                  <button
                    className="admin-master-prototype-button"
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setStatusFilter('Tümü')
                    }}
                  >
                    Sıfırla
                  </button>
                </div>
              </div>

              <div className="admin-master-prototype-grid">
                <div className="admin-master-prototype-table-wrap">
                  {activeTab === 'issues' ? <IssueTable rows={filteredIssues} selectedId={selectedIssue.id} onSelect={setSelectedIssueId} /> : null}
                  {activeTab === 'stores' ? <StoreTable rows={filteredStores} selectedId={selectedStore.id} onSelect={setSelectedStoreId} /> : null}
                  {activeTab === 'personnel' ? <PersonnelTable rows={filteredPersonnel} selectedId={selectedPersonnel.id} onSelect={setSelectedPersonnelId} /> : null}
                  {activeTab === 'imports' ? <ImportTable rows={imports} selectedId={selectedImport.id} onSelect={setSelectedImportId} /> : null}
                  {activeTab === 'history' ? <AuditTimeline /> : null}
                </div>

                <DetailPanel
                  activeTab={activeTab}
                  importRow={selectedImport}
                  issue={selectedIssue}
                  personnel={selectedPersonnel}
                  store={selectedStore}
                  onUnsaved={markUnsaved}
                />
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  )
}

function getFilterOptions(tab: TabId) {
  if (tab === 'issues') return ['Tümü', 'Yüksek', 'Orta', 'Düşük', 'Mağaza', 'Personel']
  if (tab === 'stores') return ['Tümü', 'Şirket', 'Bayi', 'İşletme', 'Aktif', 'Pasif', 'Dahil', 'Hariç', 'Atama eksik']
  if (tab === 'personnel') return ['Tümü', 'Aktif', 'Pasif', 'Ayrıldı', 'Mağaza Müdürü', 'Müdür Yardımcısı', 'Satış Danışmanı', 'Kod eksik']
  if (tab === 'imports') return ['Tümü', 'Kayda hazır', 'İnceleme gerekli']
  return ['Tümü']
}

function getSearchPlaceholder(tab: TabId) {
  if (tab === 'issues') return 'Sorun, mağaza veya personel ara'
  if (tab === 'stores') return 'Mağaza, kod, şehir veya bölge müdürü ara'
  if (tab === 'personnel') return 'Personel, satıcı kodu, mağaza veya pozisyon ara'
  if (tab === 'imports') return 'Aktarım partisi ara'
  return 'Geçmişte ara'
}

function MetricStrip(input: { unsavedCount: number }) {
  return (
    <div className="admin-master-prototype-metrics" aria-label="Ana veri özeti">
      <Metric icon={<AlertTriangle size={18} />} label="Aksiyon bekleyen" value="4" note="Dönem hesaplarını etkiler" tone="rose" />
      <Metric icon={<Building2 size={18} />} label="Mağaza" value="30" note="Aktif portföy" tone="plum" />
      <Metric icon={<UsersRound size={18} />} label="Personel" value="150" note="Atama ve rol kayıtları" tone="cyan" />
      <Metric icon={<Clock3 size={18} />} label="Kaydedilmemiş" value={String(input.unsavedCount)} note="Kaydetme bekler" tone="amber" />
    </div>
  )
}

function Metric(input: { icon: ReactNode; label: string; value: string; note: string; tone: 'plum' | 'cyan' | 'mint' | 'amber' | 'rose' }) {
  return (
    <article className="admin-master-prototype-card">
      <div className={`admin-master-prototype-metric-icon ${input.tone}`}>{input.icon}</div>
      <div>
        <span>{input.label}</span>
        <strong>{input.value}</strong>
        <small>{input.note}</small>
      </div>
    </article>
  )
}

function ImpactMap() {
  const items: Array<[string, string, Tone]> = [
    ['KPI', 'Mağaza ve personel eşleşmesi', 'info'],
    ['Prim', 'Şirket mağazası ve satıcı kodu', 'success'],
    ['Hedef', 'Mağaza müdürü ve bölge müdürü', 'warning'],
    ['Norm Kadro', 'Aktif personel ve pozisyon', 'neutral'],
  ]
  return (
    <div className="admin-master-prototype-impact-map" aria-label="Etkilenen alanlar">
      {items.map(([title, copy, tone]) => (
        <div className="admin-master-prototype-impact-card" key={title}>
          <Status tone={tone}>{title}</Status>
          <span>{copy}</span>
        </div>
      ))}
    </div>
  )
}

function TabButton(input: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button className={`admin-master-prototype-tab ${input.active ? 'active' : ''}`} type="button" onClick={input.onClick}>
      {input.label}
      <span>{input.count}</span>
    </button>
  )
}

function IssueTable(input: { rows: IssueRow[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <table className="admin-master-prototype-table issue-table">
      <thead>
        <tr>
          <th>Konu</th>
          <th>Kayıt</th>
          <th>Tip</th>
          <th>Öncelik</th>
          <th>Etki</th>
          <th>Karar</th>
        </tr>
      </thead>
      <tbody>
        {input.rows.map((issue) => (
          <tr className={`admin-master-prototype-row ${input.selectedId === issue.id ? 'selected' : ''}`} key={issue.id} onClick={() => input.onSelect(issue.id)}>
            <td>
              <div className="admin-master-prototype-name">
                <strong>{issue.title}</strong>
                <span>{issue.reason}</span>
              </div>
            </td>
            <td>{issue.entity}</td>
            <td>{issue.owner}</td>
            <td><Status tone={issue.tone}>{issue.priority}</Status></td>
            <td>{issue.impact}</td>
            <td>
              <button className="admin-master-prototype-row-link" type="button">
                Düzelt <ChevronRight size={15} aria-hidden="true" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StoreTable(input: { rows: StoreRow[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <table className="admin-master-prototype-table">
      <thead>
        <tr>
          <th>Mağaza</th>
          <th>Tip</th>
          <th>Bölge müdürü</th>
          <th>Mağaza müdürü</th>
          <th>Durum</th>
          <th>KPI</th>
          <th>Personel</th>
          <th>Kontrol</th>
        </tr>
      </thead>
      <tbody>
        {input.rows.map((store) => (
          <tr className={`admin-master-prototype-row ${input.selectedId === store.id ? 'selected' : ''}`} key={store.id} onClick={() => input.onSelect(store.id)}>
            <td>
              <div className="admin-master-prototype-name">
                <strong>{store.name}</strong>
                <span>{store.code} · {store.city}</span>
              </div>
            </td>
            <td>{store.type}</td>
            <td>{store.regionManager}</td>
            <td>{store.storeManager}</td>
            <td><Status tone={store.tone}>{store.status}</Status></td>
            <td><Status tone={store.kpi === 'Dahil' ? 'success' : 'neutral'}>{store.kpi}</Status></td>
            <td>{store.personnel} kişi</td>
            <td>{store.issue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PersonnelTable(input: { rows: PersonnelRow[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <table className="admin-master-prototype-table">
      <thead>
        <tr>
          <th>Personel</th>
          <th>Satıcı kodu</th>
          <th>Mağaza</th>
          <th>Pozisyon</th>
          <th>Durum</th>
          <th>Başlangıç</th>
          <th>Kontrol</th>
        </tr>
      </thead>
      <tbody>
        {input.rows.map((person) => (
          <tr className={`admin-master-prototype-row ${input.selectedId === person.id ? 'selected' : ''}`} key={person.id} onClick={() => input.onSelect(person.id)}>
            <td>
              <div className="admin-master-prototype-name">
                <strong>{person.name}</strong>
                <span>{person.position}</span>
              </div>
            </td>
            <td>{person.sellerCode}</td>
            <td>{person.store}</td>
            <td>{person.position}</td>
            <td><Status tone={person.tone}>{person.status}</Status></td>
            <td>{person.startDate}</td>
            <td>{person.issue}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ImportTable(input: { rows: ImportRow[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <table className="admin-master-prototype-table">
      <thead>
        <tr>
          <th>Parti</th>
          <th>Kapsam</th>
          <th>Satır</th>
          <th>Hazır</th>
          <th>Bekleyen</th>
          <th>Karar</th>
        </tr>
      </thead>
      <tbody>
        {input.rows.map((item) => (
          <tr className={`admin-master-prototype-row ${input.selectedId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => input.onSelect(item.id)}>
            <td>
              <div className="admin-master-prototype-name">
                <strong>{item.source}</strong>
                <span>{item.id}</span>
              </div>
            </td>
            <td>{item.entity}</td>
            <td>{item.rows}</td>
            <td>{item.ready}</td>
            <td>{item.blocked}</td>
            <td><Status tone={item.tone}>{item.decision}</Status></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AuditTimeline() {
  return (
    <div className="admin-master-prototype-timeline">
      {audit.map((item) => (
        <div className="admin-master-prototype-audit-row" key={`${item.title}-${item.time}`}>
          <span className="admin-master-prototype-dot" />
          <div>
            <strong>{item.title}</strong>
            <span>{item.before} → {item.after}</span>
            <small>{item.actor} · {item.time}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

function DetailPanel(input: {
  activeTab: TabId
  importRow: ImportRow
  issue: IssueRow
  personnel: PersonnelRow
  store: StoreRow
  onUnsaved: () => void
}) {
  if (input.activeTab === 'issues') {
    return (
      <aside className="admin-master-prototype-detail" aria-label="Düzeltme detayı">
        <DetailFrame
          icon={<AlertTriangle size={18} />}
          title={input.issue.title}
          subtitle={`${input.issue.owner} · ${input.issue.entity}`}
          status={input.issue.priority}
          tone={input.issue.tone}
        >
          <div className="admin-master-prototype-alert-block">
            <strong>{input.issue.reason}</strong>
            <span>{input.issue.impact}</span>
          </div>
          <RelationEditor entity={input.issue.owner} onUnsaved={input.onUnsaved} />
          <AffectedModules />
          <SaveBar onUnsaved={input.onUnsaved} />
        </DetailFrame>
      </aside>
    )
  }

  if (input.activeTab === 'stores') {
    return (
      <aside className="admin-master-prototype-detail" aria-label="Mağaza detayı">
        <DetailFrame
          icon={<Building2 size={18} />}
          title={input.store.name}
          subtitle={`${input.store.code} · ${input.store.city}`}
          status={input.store.issue}
          tone={input.store.tone}
        >
          <div className="admin-master-prototype-mini-grid">
            <MiniCard label="Tip" value={input.store.type} />
            <MiniCard label="Personel" value={`${input.store.personnel} kişi`} />
            <MiniCard label="KPI" value={input.store.kpi} />
            <MiniCard label="Durum" value={input.store.status} />
          </div>
          <RelationEditor entity="Mağaza" onUnsaved={input.onUnsaved} />
          <AffectedModules />
          <SaveBar onUnsaved={input.onUnsaved} />
        </DetailFrame>
      </aside>
    )
  }

  if (input.activeTab === 'personnel') {
    return (
      <aside className="admin-master-prototype-detail" aria-label="Personel detayı">
        <DetailFrame
          icon={<UserRound size={18} />}
          title={input.personnel.name}
          subtitle={`${input.personnel.position} · ${input.personnel.store}`}
          status={input.personnel.issue}
          tone={input.personnel.tone}
        >
          <div className="admin-master-prototype-mini-grid">
            <MiniCard label="Satıcı kodu" value={input.personnel.sellerCode} />
            <MiniCard label="Başlangıç" value={input.personnel.startDate} />
          </div>
          <RelationEditor entity="Personel" onUnsaved={input.onUnsaved} />
          <AffectedModules />
          <SaveBar onUnsaved={input.onUnsaved} />
        </DetailFrame>
      </aside>
    )
  }

  if (input.activeTab === 'imports') {
    return (
      <aside className="admin-master-prototype-detail" aria-label="Aktarım detayı">
        <DetailFrame
          icon={<DatabaseZap size={18} />}
          title={input.importRow.source}
          subtitle={`${input.importRow.rows} satır · ${input.importRow.entity}`}
          status={input.importRow.decision}
          tone={input.importRow.tone}
        >
          <div className="admin-master-prototype-mini-grid">
            <MiniCard label="Kayda hazır" value={input.importRow.ready} />
            <MiniCard label="Bekleyen" value={input.importRow.blocked} />
          </div>
          <div className="admin-master-prototype-timeline compact">
            <Timeline title="Alan kontrolü" copy="Zorunlu mağaza, personel ve rol alanları incelendi." />
            <Timeline title="Eşleşme kontrolü" copy="Satıcı kodu, mağaza ve bölge bağlantıları karşılaştırıldı." />
            <Timeline title="Kayıt kararı" copy="Hazır kayıtlar kontrol sonrası kaydedilebilir." />
          </div>
          <div className="admin-master-prototype-row-actions">
            <button className="admin-master-prototype-button" type="button">Bekleyenleri aç</button>
            <button className="admin-master-prototype-button primary" type="button">Kaydet</button>
          </div>
        </DetailFrame>
      </aside>
    )
  }

  return (
    <aside className="admin-master-prototype-detail" aria-label="Geçmiş detayı">
      <DetailFrame icon={<History size={18} />} title="Değişiklik geçmişi" subtitle="Önceki ve yeni değerler" status="Kayıtlı" tone="neutral">
        <AuditTimeline />
      </DetailFrame>
    </aside>
  )
}

function DetailFrame(input: { children: ReactNode; icon: ReactNode; title: string; subtitle: string; status: string; tone: Tone }) {
  return (
    <div className="admin-master-prototype-detail-inner">
      <div>
        <div className="admin-master-prototype-chipline">
          <span className="admin-master-prototype-pill soft">{input.icon}</span>
          <Status tone={input.tone}>{input.status}</Status>
        </div>
        <h2>{input.title}</h2>
        <p>{input.subtitle}</p>
      </div>
      {input.children}
    </div>
  )
}

function RelationEditor(input: { entity: string; onUnsaved: () => void }) {
  const storeMode = input.entity === 'Mağaza'
  return (
    <div className="admin-master-prototype-form">
      <div className="admin-master-prototype-section-title">
        <ArrowRightLeft size={16} aria-hidden="true" />
        <strong>İlişki düzeltme</strong>
      </div>
      <Field label={storeMode ? 'Bölge müdürü' : 'Mağaza'} defaultValue={storeMode ? 'Onur Kaytan' : 'Balıkesir 10 Burda AVM'} onChange={input.onUnsaved} />
      <Field label={storeMode ? 'Mağaza müdürü' : 'Pozisyon'} defaultValue={storeMode ? 'Mert Alcan' : 'Satış Danışmanı'} onChange={input.onUnsaved} />
      <Field label={storeMode ? 'Mağaza tipi' : 'Satıcı kodu'} defaultValue={storeMode ? 'Şirket' : 'CORP_4218'} onChange={input.onUnsaved} />
      <Field label="Not" textarea defaultValue="Düzeltme nedeni ve kontrol notu." onChange={input.onUnsaved} />
    </div>
  )
}

function AffectedModules() {
  return (
    <div className="admin-master-prototype-impact-list">
      <div className="admin-master-prototype-section-title">
        <Link2 size={16} aria-hidden="true" />
        <strong>Bu değişiklik nerede görünür?</strong>
      </div>
      <div className="admin-master-prototype-impact-row">
        <Status tone="info">KPI</Status>
        <span>Mağaza ve personel listeleri</span>
      </div>
      <div className="admin-master-prototype-impact-row">
        <Status tone="success">Prim</Status>
        <span>Hakediş ve şirket mağazası kontrolü</span>
      </div>
      <div className="admin-master-prototype-impact-row">
        <Status tone="warning">Hedef</Status>
        <span>Mağaza müdürü ve bölge onayı</span>
      </div>
    </div>
  )
}

function MiniCard(input: { label: string; value: string }) {
  return (
    <div className="admin-master-prototype-mini-card">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function Field(input: { label: string; defaultValue: string; textarea?: boolean; onChange: () => void }) {
  return (
    <div className="admin-master-prototype-field">
      <label>{input.label}</label>
      {input.textarea ? (
        <textarea className="admin-master-prototype-textarea" defaultValue={input.defaultValue} onChange={input.onChange} />
      ) : (
        <input className="admin-master-prototype-input" defaultValue={input.defaultValue} onChange={input.onChange} />
      )}
    </div>
  )
}

function SaveBar(input: { onUnsaved: () => void }) {
  return (
    <div className="admin-master-prototype-savebar">
      <Status tone="warning">Kaydedilmemiş değişiklik</Status>
      <div className="admin-master-prototype-row-actions">
        <button className="admin-master-prototype-button" type="button" onClick={input.onUnsaved}>
          Değişiklik var
        </button>
        <button className="admin-master-prototype-button primary" type="button">
          <Save size={16} aria-hidden="true" />
          Kaydet
        </button>
      </div>
    </div>
  )
}

function Timeline(input: { title: string; copy: string }) {
  return (
    <div className="admin-master-prototype-audit-row">
      <span className="admin-master-prototype-dot" />
      <div>
        <strong>{input.title}</strong>
        <span>{input.copy}</span>
      </div>
    </div>
  )
}

function Status(input: { children: ReactNode; tone: Tone }) {
  return <span className={`admin-master-prototype-status ${input.tone}`}>{input.children}</span>
}
