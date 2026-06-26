import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleSlash2,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import lufianLogoUrl from '../assets/lufian-logo.png'

type WorkforceStatus = 'short' | 'balanced' | 'over' | 'unknown'

type WorkforceEmployee = { name: string; position: string; tenure: string; startDate: string }
type WorkforceHistoryItem = { date: string; name: string; position: string; status: 'Giriş' | 'Çıkış'; storeNote: string }
type WorkforcePositionCount = { label: string; count: number }

type WorkforceStoreRow = {
  active: number
  code: string
  detail: {
    employees: WorkforceEmployee[]
    history?: WorkforceHistoryItem[]
    positions: WorkforcePositionCount[]
  }
  manager: string
  norm: string
  shortage: string
  status: WorkforceStatus
  store: string
  turnover: string
}

type WorkforceSortKey = 'active' | 'norm' | 'shortage' | 'status' | 'store' | 'turnover'
type WorkforceSortDirection = 'asc' | 'desc'
type WorkforceDetailTab = 'history' | 'people' | 'positions'
type PrototypeStoreInput = Omit<WorkforceStoreRow, 'detail'> & {
  employees?: WorkforceEmployee[]
  history?: WorkforceHistoryItem[]
  positions?: WorkforcePositionCount[]
}

const corePrototypeStores: WorkforceStoreRow[] = [
  {
    active: 4,
    code: 'BAL-10',
    detail: {
      employees: [
        { name: 'EMİNE ÇAVUŞ', position: 'Satış Danışmanı', tenure: '11 ay', startDate: '28 Haziran 2025' },
        { name: 'GÜRKAN ÇAKAR', position: 'Satış Danışmanı', tenure: '5 ay', startDate: '20 Ocak 2026' },
        { name: 'MERT ALCAN', position: 'Mağaza Müdürü', tenure: '6 ay', startDate: '20 Aralık 2025' },
        { name: 'SİNEM TEKKURT', position: 'Satış Danışmanı', tenure: '1 yıl 5 ay', startDate: '11 Ocak 2025' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 3 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '3 Haziran 2026', name: 'DİLARA ÖZKAN', position: 'Satış Danışmanı', status: 'Çıkış', storeNote: 'Norm açığı oluştu' },
        { date: '18 Mayıs 2026', name: 'GÜRKAN ÇAKAR', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Yeni atama' },
        { date: '11 Ocak 2025', name: 'SİNEM TEKKURT', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Mağaza kadrosu' },
      ],
    },
    manager: 'MERT ALCAN',
    norm: '4 / 5',
    shortage: '18 gündür',
    status: 'short',
    store: 'Balıkesir 10 Burda AVM',
    turnover: '%22,4',
  },
  {
    active: 4,
    code: 'BAL-EDR',
    detail: {
      employees: [
        { name: 'AYŞE DEMİR', position: 'Satış Danışmanı', tenure: '8 ay', startDate: '9 Ekim 2025' },
        { name: 'DENİZ YILMAZ', position: 'Satış Danışmanı', tenure: '1 yıl', startDate: '3 Haziran 2025' },
        { name: 'ELİF ARSLAN', position: 'Mağaza Müdürü', tenure: '2 yıl', startDate: '13 Haziran 2024' },
        { name: 'MURAT AKSOY', position: 'Satış Danışmanı', tenure: '4 ay', startDate: '12 Şubat 2026' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 3 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '16 Mayıs 2026', name: 'ECE YILDIRIM', position: 'Satış Danışmanı', status: 'Çıkış', storeNote: 'Eksik kadro başladı' },
        { date: '12 Şubat 2026', name: 'MURAT AKSOY', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Kadroyu destekledi' },
        { date: '13 Haziran 2024', name: 'ELİF ARSLAN', position: 'Mağaza Müdürü', status: 'Giriş', storeNote: 'Mağaza müdürü' },
      ],
    },
    manager: 'Müdür bilgisi yok',
    norm: '4 / 5',
    shortage: '41 gündür',
    status: 'short',
    store: 'Balıkesir Edremit AVM',
    turnover: '%31,8',
  },
  {
    active: 6,
    code: 'BRS-ANT',
    detail: {
      employees: [
        { name: 'EMRE KORKMAZ', position: 'Mağaza Müdürü', tenure: '1 yıl', startDate: '4 Haziran 2025' },
        { name: 'BARIŞ GÜNEŞ', position: 'Satış Danışmanı', tenure: '7 ay', startDate: '18 Kasım 2025' },
        { name: 'CANSU EREN', position: 'Satış Danışmanı', tenure: '9 ay', startDate: '3 Eylül 2025' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 5 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '4 Haziran 2025', name: 'EMRE KORKMAZ', position: 'Mağaza Müdürü', status: 'Giriş', storeNote: 'Mağaza müdürü' },
        { date: '18 Kasım 2025', name: 'BARIŞ GÜNEŞ', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Aktif kadro' },
      ],
    },
    manager: 'EMRE KORKMAZ',
    norm: '6 / 6',
    shortage: 'Yok',
    status: 'balanced',
    store: 'Bursa Anatolium AVM',
    turnover: '%9,6',
  },
  {
    active: 6,
    code: 'BRS-DWN',
    detail: {
      employees: [
        { name: 'ABDURRAHMAN KÖK', position: 'Mağaza Müdürü', tenure: '10 ay', startDate: '25 Ağustos 2025' },
        { name: 'MELİS ÖZ', position: 'Satış Danışmanı', tenure: '1 yıl', startDate: '14 Haziran 2025' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 5 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '25 Ağustos 2025', name: 'ABDURRAHMAN KÖK', position: 'Mağaza Müdürü', status: 'Giriş', storeNote: 'Mağaza müdürü' },
        { date: '14 Haziran 2025', name: 'MELİS ÖZ', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Aktif kadro' },
      ],
    },
    manager: 'ABDURRAHMAN KÖK',
    norm: '6 / 6',
    shortage: 'Yok',
    status: 'balanced',
    store: 'Bursa Downtown AVM',
    turnover: '%24,7',
  },
  {
    active: 8,
    code: 'BRS-KNT',
    detail: {
      employees: [
        { name: 'ALPER TOKCANLI', position: 'Mağaza Müdürü', tenure: '1 yıl 2 ay', startDate: '9 Nisan 2025' },
        { name: 'SEDA POLAT', position: 'Satış Danışmanı', tenure: '6 ay', startDate: '7 Aralık 2025' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 7 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '9 Nisan 2025', name: 'ALPER TOKCANLI', position: 'Mağaza Müdürü', status: 'Giriş', storeNote: 'Mağaza müdürü' },
        { date: '7 Aralık 2025', name: 'SEDA POLAT', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Aktif kadro' },
        { date: '2 Mayıs 2026', name: 'BERK ERDEM', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Fazla kadro' },
      ],
    },
    manager: 'ALPER TOKCANLI',
    norm: '8 / 7',
    shortage: 'Yok',
    status: 'over',
    store: 'Bursa Kent Meydanı AVM',
    turnover: '%12,2',
  },
  {
    active: 5,
    code: 'BRS-INE',
    detail: {
      employees: [
        { name: 'PINAR KAYA', position: 'Mağaza Müdürü', tenure: '1 yıl', startDate: '1 Haziran 2025' },
        { name: 'TOLGA KURT', position: 'Satış Danışmanı', tenure: '3 ay', startDate: '19 Mart 2026' },
      ],
      positions: [
        { label: 'Satış Danışmanı', count: 4 },
        { label: 'Mağaza Müdürü', count: 1 },
      ],
      history: [
        { date: '1 Haziran 2025', name: 'PINAR KAYA', position: 'Mağaza Müdürü', status: 'Giriş', storeNote: 'Mağaza müdürü' },
        { date: '19 Mart 2026', name: 'TOLGA KURT', position: 'Satış Danışmanı', status: 'Giriş', storeNote: 'Aktif kadro' },
      ],
    },
    manager: 'Müdür bilgisi yok',
    norm: '5 / 5',
    shortage: 'Yok',
    status: 'balanced',
    store: 'Bursa İnegöl AVM',
    turnover: 'Veri yok',
  },
]

const prototypeEmployeeNames = [
  'DERYA UÇAR',
  'MİNA ÖZDEMİR',
  'KEREM TUNA',
  'ECE SÖNMEZ',
  'ALİHAN YÜCE',
  'SİBEL KOÇ',
  'BURAK İLERİ',
  'NAZLI ŞAHİN',
  'OĞUZHAN POLAT',
  'İLAYDA ER',
  'CANSU TAN',
  'BARIŞ AKIN',
]

const additionalPrototypeStores: WorkforceStoreRow[] = [
  createPrototypeStore({ active: 8, code: 'IST-BYL', manager: 'CANER ÖZTÜRK', norm: '8 / 8', shortage: 'Yok', status: 'balanced', store: 'İstanbul Beylikdüzü Cadde', turnover: '%14,8' }),
  createPrototypeStore({ active: 6, code: 'IST-MTR', manager: 'SEDA YILDIRIM', norm: '6 / 7', shortage: '12 gündür', status: 'short', store: 'İstanbul Bahçelievler Metroport AVM', turnover: '%18,1' }),
  createPrototypeStore({ active: 4, code: 'IST-BCK', manager: 'Müdür bilgisi yok', norm: '4 / 6', shortage: '27 gündür', status: 'short', store: 'İstanbul Büyükçekmece Cadde', turnover: '%21,7' }),
  createPrototypeStore({ active: 9, code: 'IST-VNZ', manager: 'MELİKE SARI', norm: '9 / 9', shortage: 'Yok', status: 'balanced', store: 'İstanbul Venezia Mega Outlet', turnover: '%11,6' }),
  createPrototypeStore({ active: 10, code: 'IST-MOI', manager: 'ONUR ÇELİK', norm: '10 / 9', shortage: 'Yok', status: 'over', store: 'İstanbul MOİ AVM', turnover: '%16,9' }),
  createPrototypeStore({ active: 7, code: 'IST-MALL', manager: 'GİZEM AKTAŞ', norm: '7 / 7', shortage: 'Yok', status: 'balanced', store: 'Mall Of İstanbul AVM', turnover: '%13,2' }),
  createPrototypeStore({ active: 11, code: 'IST-AKS', manager: 'BURCU KAYA', norm: '11 / 11', shortage: 'Yok', status: 'balanced', store: 'Akasya AVM', turnover: '%10,4' }),
  createPrototypeStore({ active: 6, code: 'IZM-IST', manager: 'CEM ÖNAL', norm: '6 / 8', shortage: '9 gündür', status: 'short', store: 'İstinyePark İzmir', turnover: '%19,9' }),
  createPrototypeStore({ active: 7, code: 'IST-HIL', manager: 'GÖKÇE ARI', norm: '7 / 7', shortage: 'Yok', status: 'balanced', store: 'Hilltown Küçükyalı', turnover: 'Veri yok' }),
  createPrototypeStore({ active: 8, code: 'BOD-OAS', manager: 'DENİZ TUNÇ', norm: '8 / 7', shortage: 'Yok', status: 'over', store: 'Bodrum Oasis AVM', turnover: '%12,6' }),
  createPrototypeStore({ active: 7, code: 'ANT-ERA', manager: 'NESLİHAN KILIÇ', norm: '7 / 7', shortage: 'Yok', status: 'balanced', store: 'Antalya Erasta AVM', turnover: '%15,2' }),
  createPrototypeStore({ active: 5, code: 'IST-FOR', manager: 'YUSUF ATEŞ', norm: '5 / 6', shortage: '6 gündür', status: 'short', store: 'Forum İstanbul AVM', turnover: '%25,4' }),
  createPrototypeStore({ active: 6, code: 'ADN-CAD', manager: 'TUĞBA DOĞAN', norm: '6 / 6', shortage: 'Yok', status: 'balanced', store: 'Adana Cadde', turnover: '%8,6' }),
  createPrototypeStore({ active: 4, code: 'ORD-CAD', manager: 'Müdür bilgisi yok', norm: 'Tanımlı değil / 4', shortage: 'Yok', status: 'unknown', store: 'Ordu Cadde', turnover: 'Veri yok' }),
  createPrototypeStore({ active: 6, code: 'LBG-39', manager: 'AYKUT ŞEN', norm: '6 / 6', shortage: 'Yok', status: 'balanced', store: 'Lüleburgaz 39 Burda AVM', turnover: '%17,4' }),
  createPrototypeStore({ active: 7, code: 'IST-MAR', manager: 'NİHAN ERDEM', norm: '7 / 8', shortage: '16 gündür', status: 'short', store: 'Marmara Park AVM', turnover: '%23,5' }),
  createPrototypeStore({ active: 4, code: 'EDR-NOV', manager: 'Müdür bilgisi yok', norm: 'Tanımlı değil / 5', shortage: 'Yok', status: 'unknown', store: 'Edremit Novada', turnover: 'Veri yok' }),
  createPrototypeStore({ active: 3, code: 'BRS-MRK', manager: 'FATİH ALKAN', norm: '3 / 5', shortage: '43 gündür', status: 'short', store: 'Bursa Marka Park AVM', turnover: '%32,6' }),
  createPrototypeStore({ active: 6, code: 'SAK-AGO', manager: 'İREM YÜCEL', norm: '6 / 6', shortage: 'Yok', status: 'balanced', store: 'Sakarya Agora AVM', turnover: '%13,7' }),
  createPrototypeStore({ active: 5, code: 'ESK-ESP', manager: 'MURAT BİLGİN', norm: '5 / 5', shortage: 'Yok', status: 'balanced', store: 'Eskişehir Espark AVM', turnover: '%18,8' }),
  createPrototypeStore({ active: 9, code: 'IZM-OPT', manager: 'ELİF NUR TAŞ', norm: '9 / 8', shortage: 'Yok', status: 'over', store: 'İzmir Optimum AVM', turnover: '%14,1' }),
  createPrototypeStore({ active: 5, code: 'ANK-ACY', manager: 'KADİR DEMİRCİ', norm: '5 / 6', shortage: '21 gündür', status: 'short', store: 'Ankara Acity AVM', turnover: '%27,3' }),
  createPrototypeStore({ active: 8, code: 'MER-FOR', manager: 'SELİN KARA', norm: '8 / 8', shortage: 'Yok', status: 'balanced', store: 'Mersin Forum AVM', turnover: '%16,2' }),
  createPrototypeStore({ active: 5, code: 'TRB-FOR', manager: 'Müdür bilgisi yok', norm: 'Tanımlı değil / 5', shortage: 'Yok', status: 'unknown', store: 'Trabzon Forum AVM', turnover: 'Veri yok' }),
]

const prototypeStores = [...corePrototypeStores, ...additionalPrototypeStores]

function createPrototypeStore(input: PrototypeStoreInput): WorkforceStoreRow {
  const hasManager = input.manager !== 'Müdür bilgisi yok'
  const managerEmployee: WorkforceEmployee[] = hasManager
    ? [{ name: input.manager, position: 'Mağaza Müdürü', tenure: '1 yıl 2 ay', startDate: '9 Nisan 2025' }]
    : []
  const advisorCount = Math.max(0, input.active - managerEmployee.length)
  const employees =
    input.employees ??
    [
      ...managerEmployee,
      ...Array.from({ length: advisorCount }, (_, index) => ({
        name: prototypeEmployeeNames[(index + input.code.length) % prototypeEmployeeNames.length] ?? `Personel ${index + 1}`,
        position: index % 5 === 0 ? 'Müdür Yardımcısı' : 'Satış Danışmanı',
        startDate: index % 3 === 0 ? '14 Şubat 2026' : index % 3 === 1 ? '18 Kasım 2025' : '6 Haziran 2025',
        tenure: index % 3 === 0 ? '4 ay' : index % 3 === 1 ? '7 ay' : '1 yıl',
      })),
    ]
  const positions =
    input.positions ??
    [
      { label: 'Satış Danışmanı', count: employees.filter((employee) => employee.position === 'Satış Danışmanı').length },
      { label: 'Müdür Yardımcısı', count: employees.filter((employee) => employee.position === 'Müdür Yardımcısı').length },
      { label: 'Mağaza Müdürü', count: employees.filter((employee) => employee.position === 'Mağaza Müdürü').length },
    ].filter((position) => position.count > 0)

  return {
    ...input,
    detail: {
      employees,
      history: input.history ?? createPrototypeHistory(input, employees),
      positions,
    },
  }
}

function createPrototypeHistory(input: PrototypeStoreInput, employees: WorkforceEmployee[]): WorkforceHistoryItem[] {
  const primary = employees[1] ?? employees[0] ?? { name: 'Personel bilgisi yok', position: 'Satış Danışmanı' }
  const secondary = employees[2] ?? employees[0] ?? primary

  if (input.status === 'short') {
    return [
      { date: '3 Haziran 2026', name: primary.name, position: primary.position, status: 'Çıkış', storeNote: 'Eksik kadro başladı' },
      { date: '18 Mayıs 2026', name: secondary.name, position: secondary.position, status: 'Giriş', storeNote: 'Yerine alım süreci takipte' },
    ]
  }

  if (input.status === 'over') {
    return [
      { date: '2 Mayıs 2026', name: primary.name, position: primary.position, status: 'Giriş', storeNote: 'Norm üstü kadro oluştu' },
      { date: '16 Mart 2026', name: secondary.name, position: secondary.position, status: 'Giriş', storeNote: 'Sezon desteği' },
    ]
  }

  if (input.status === 'unknown') {
    return [
      { date: '1 Haziran 2026', name: primary.name, position: primary.position, status: 'Giriş', storeNote: 'Norm tanımı bekleniyor' },
    ]
  }

  return [
    { date: '12 Haziran 2026', name: primary.name, position: primary.position, status: 'Giriş', storeNote: 'Aktif kadro' },
    { date: '22 Nisan 2026', name: secondary.name, position: secondary.position, status: 'Çıkış', storeNote: 'Denge korundu' },
  ]
}

const navItems = [
  { label: 'Ana Sayfa', href: '/store/home', icon: Store },
  { label: 'KPI Özetleri', href: '/store/kpis', icon: TrendingUp },
  { label: 'Hedefler', href: '/store/targets', icon: CircleSlash2 },
  { label: 'Norm Kadro', href: '/store/workforce?prototype=full-ledger', icon: UsersRound, active: true },
]

const statusCopy: Record<WorkforceStatus, { label: string; tone: string }> = {
  balanced: { label: 'Tam', tone: 'mint' },
  over: { label: 'Fazla', tone: 'blue' },
  short: { label: 'Eksik', tone: 'rose' },
  unknown: { label: 'Tanımsız', tone: 'neutral' },
}

export function StoreWorkforceFullLedgerPrototypeShell() {
  return (
    <div className="store-shell store-command-app">
      <aside className="store-command-sidebar" aria-label="Mağaza navigasyonu">
        <div className="store-command-brand">
          <div className="store-command-brand-mark store-command-brand-logo" aria-hidden="true">
            <img src={lufianLogoUrl} alt="" />
          </div>
          <div className="store-command-brand-text">
            <strong>LUFIAN</strong>
            <small>Store Home</small>
          </div>
        </div>

        <div className="store-command-persona-chip" aria-hidden="true">
          <span className="store-command-persona-dot" />
          <span>Bölge müdürü</span>
        </div>

        <nav className="store-command-nav" aria-label="Mağaza menüsü">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                className={`store-command-nav-link${item.active ? ' store-command-nav-link-active' : ''}`}
                href={item.href}
                key={item.href}
              >
                <span className="store-command-nav-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="store-command-nav-label">{item.label}</span>
              </a>
            )
          })}
        </nav>
      </aside>

      <main className="store-main store-command-main" aria-label="Norm Kadro prototipi">
        <StoreWorkforceFullLedgerPrototype />
      </main>
    </div>
  )
}

function StoreWorkforceFullLedgerPrototype() {
  const [selectedStore, setSelectedStore] = useState<WorkforceStoreRow | null>(null)
  const [query, setQuery] = useState('')
  const [selectedYear, setSelectedYear] = useState(2026)
  const [sort, setSort] = useState<{ direction: WorkforceSortDirection; key: WorkforceSortKey }>({
    direction: 'asc',
    key: 'status',
  })
  const metrics = useMemo(() => getPrototypeMetrics(prototypeStores), [])
  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR')
    const filtered = normalized
      ? prototypeStores.filter((row) =>
        `${row.store} ${row.manager}`.toLocaleLowerCase('tr-TR').includes(normalized),
      )
      : prototypeStores

    return [...filtered].sort((left, right) => {
      const result = comparePrototypeRows(left, right, sort.key)
      return sort.direction === 'asc' ? result : -result
    })
  }, [query, sort.direction, sort.key])
  const toggleSort = (key: WorkforceSortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <section className="workforce-prototype">
      <style>{prototypeStyles}</style>
      <header className="wfp-hero">
        <div>
          <div className="wfp-kicker">
            <span>Norm Kadro</span>
            <b>{selectedYear}</b>
            <b>Bölge müdürü</b>
          </div>
          <div className="wfp-title-row">
            <span className="wfp-title-icon" aria-hidden="true">
              <UsersRound />
            </span>
            <div>
              <h1>Norm Kadro</h1>
              <p>Mağaza norm dengesi, eksik kadro süresi ve personel görünümü.</p>
            </div>
          </div>
        </div>
        <div className="wfp-actions">
          <button type="button" className="wfp-button secondary">
            <Download />
            Excel dışa aktar
          </button>
          <button type="button" className="wfp-button primary">
            <RefreshCw />
            Yenile
          </button>
        </div>
      </header>

      <section className="wfp-metrics" aria-label="Norm Kadro özetleri">
        <Metric icon={<Store />} label="Toplam mağaza" note="Aktif bölge portföyü" value={String(metrics.totalStores)} />
        <Metric icon={<CircleSlash2 />} label="Eksik kadro" note={`${metrics.openPositions} açık pozisyon`} tone="rose" value={String(metrics.shortStores)} />
        <Metric icon={<TrendingUp />} label="Yıl geneli turnover" note={`${metrics.turnoverStores} mağazada veri var`} tone="amber" value={metrics.averageTurnover} />
        <Metric icon={<UsersRound />} label="Ortalama kıdem" note="Aktif personel" value="1 yıl 2 ay" />
      </section>

      <section className="wfp-toolbar" aria-label="Norm Kadro filtreleri">
        <label className="wfp-search">
          <Search />
          <input
            aria-label="Mağaza veya müdür ara"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Mağaza veya müdür ara"
            value={query}
          />
        </label>
        <button className="wfp-filter-button" type="button">
          <Filter />
          Tüm durumlar
        </button>
        <YearCalendarPicker onYearChange={setSelectedYear} selectedYear={selectedYear} />
      </section>

      <section className="wfp-ledger" aria-label="Bölge mağazaları">
        <div className="wfp-ledger-head">
          <SortHeader
            active={sort.key === 'store'}
            direction={sort.direction}
            label="Mağaza"
            onSort={() => toggleSort('store')}
          />
          <SortHeader
            active={sort.key === 'active'}
            direction={sort.direction}
            label="Aktif personel"
            onSort={() => toggleSort('active')}
          />
          <SortHeader
            active={sort.key === 'norm'}
            direction={sort.direction}
            label="Norm / Fiili"
            onSort={() => toggleSort('norm')}
          />
          <SortHeader
            active={sort.key === 'status'}
            direction={sort.direction}
            label="Durum"
            onSort={() => toggleSort('status')}
          />
          <SortHeader
            active={sort.key === 'shortage'}
            direction={sort.direction}
            label="Eksik gün"
            onSort={() => toggleSort('shortage')}
          />
          <SortHeader
            active={sort.key === 'turnover'}
            direction={sort.direction}
            label="Turnover"
            onSort={() => toggleSort('turnover')}
          />
          <span>Aksiyon</span>
        </div>

        <div className="wfp-ledger-list">
          {visibleRows.map((row) => (
            <article className={`wfp-row ${row.status}`} key={row.code}>
              <div className="wfp-store">
                <span aria-hidden="true">
                  <Store />
                </span>
                <div>
                  <b>{row.store}</b>
                  <small>{row.manager}</small>
                </div>
              </div>
              <div className="wfp-count">
                <b>{row.active}</b>
                <small>aktif</small>
              </div>
              <div className="wfp-count">
                <b>{row.norm}</b>
                <small>{getNormStatusNote(row)}</small>
              </div>
              <Badge tone={statusCopy[row.status].tone}>{statusCopy[row.status].label}</Badge>
              <span className={`wfp-shortage ${row.status === 'short' ? 'hot' : ''}`}>
                <Clock3 />
                {row.shortage}
              </span>
              <span className="wfp-turnover">
                <b>{row.turnover}</b>
                <i />
              </span>
              <button className="wfp-row-action" onClick={() => setSelectedStore(row)} type="button">
                Detay
                <ArrowRight />
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedStore ? (
        <StoreDetailDialog row={selectedStore} onClose={() => setSelectedStore(null)} />
      ) : null}
    </section>
  )
}

function SortHeader(input: {
  active: boolean
  direction: WorkforceSortDirection
  label: string
  onSort: () => void
}) {
  return (
    <div className="wfp-sort">
      <button
        aria-sort={input.active ? (input.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`wfp-sort-trigger ${input.active ? 'active' : ''}`}
        onClick={input.onSort}
        type="button"
      >
        <span>{input.label}</span>
        <Filter />
        {input.active ? <small>{input.direction === 'asc' ? 'Artan' : 'Azalan'}</small> : null}
      </button>
    </div>
  )
}

function YearCalendarPicker(input: { onYearChange: (year: number) => void; selectedYear: number }) {
  const [open, setOpen] = useState(false)
  const yearOptions = useMemo(
    () => Array.from({ length: 9 }, (_, index) => input.selectedYear - 4 + index),
    [input.selectedYear],
  )

  function selectYear(year: number) {
    input.onYearChange(year)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <button className="wfp-filter-button wfp-year-trigger" type="button">
          <CalendarDays />
          {input.selectedYear}
          <ChevronDown />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="wfp-year-popover">
        <PopoverHeader>
          <PopoverTitle>Yıl seç</PopoverTitle>
        </PopoverHeader>
        <div className="wfp-year-options" aria-label="Hızlı yıl seçimi">
          {yearOptions.map((year) => (
            <button
              className={year === input.selectedYear ? 'active' : ''}
              key={year}
              onClick={() => selectYear(year)}
              type="button"
            >
              {year}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Metric(input: { icon: ReactNode; label: string; note: string; tone?: 'amber' | 'default' | 'rose'; value: string }) {
  return (
    <article className={`wfp-metric ${input.tone ?? 'default'}`}>
      <span aria-hidden="true">{input.icon}</span>
      <div>
        <small>{input.label}</small>
        <b>{input.value}</b>
        <em>{input.note}</em>
      </div>
    </article>
  )
}

function Badge(input: { children: ReactNode; tone: string }) {
  return <span className={`wfp-badge ${input.tone}`}>{input.children}</span>
}

function StoreDetailDialog(input: { onClose: () => void; row: WorkforceStoreRow }) {
  const [activeTab, setActiveTab] = useState<WorkforceDetailTab>('people')
  const status = statusCopy[input.row.status]
  const historyCount = input.row.detail.history?.length ?? 0

  return (
    <div className="wfp-dialog-backdrop" role="presentation">
      <section aria-label={`${input.row.store} detayı`} className="wfp-dialog" role="dialog">
        <header>
          <div>
            <div className="wfp-kicker compact">
              <span>{input.row.manager}</span>
              <b>{status.label}</b>
            </div>
            <h2>{input.row.store} Norm Kadro dosyası</h2>
            <p>Mağaza norm dengesi, aktif personel ve pozisyon görünümü.</p>
          </div>
          <button aria-label="Kapat" className="wfp-close" onClick={input.onClose} type="button">
            <X />
          </button>
        </header>
        <div className="wfp-dialog-summary">
          <Fact label="Norm / fiili" value={input.row.norm} />
          <Fact label="Eksik süre" value={input.row.shortage} />
          <Fact label="Yıl turnover" value={input.row.turnover} />
          <Fact label="Aktif personel" value={String(input.row.active)} />
        </div>
        <div className="wfp-tabs">
          <DetailTabButton active={activeTab === 'people'} onClick={() => setActiveTab('people')}>
            Personel
          </DetailTabButton>
          <DetailTabButton active={activeTab === 'positions'} onClick={() => setActiveTab('positions')}>
            Pozisyon
          </DetailTabButton>
          <DetailTabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            <span>Geçmiş</span>
            <small>{historyCount}</small>
          </DetailTabButton>
        </div>
        {activeTab === 'people' ? <PeopleDetailPane row={input.row} /> : null}
        {activeTab === 'positions' ? <PositionDetailPane row={input.row} /> : null}
        {activeTab === 'history' ? <HistoryDetailPane row={input.row} /> : null}
        <footer>
          <button className="wfp-button secondary" onClick={input.onClose} type="button">Kapat</button>
        </footer>
      </section>
    </div>
  )
}

function DetailTabButton(input: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button aria-selected={input.active} className={input.active ? 'active' : ''} onClick={input.onClick} type="button">
      {input.children}
    </button>
  )
}

function PeopleDetailPane(input: { row: WorkforceStoreRow }) {
  return (
    <div className="wfp-people-table">
      <div>
        <span>Personel</span>
        <span>Pozisyon</span>
        <span>Kıdem</span>
        <span>Başlangıç</span>
      </div>
      {input.row.detail.employees.map((employee) => (
        <div key={employee.name}>
          <strong>{employee.name}</strong>
          <span>{employee.position}</span>
          <span>{employee.tenure}</span>
          <span>{employee.startDate}</span>
        </div>
      ))}
    </div>
  )
}

function PositionDetailPane(input: { row: WorkforceStoreRow }) {
  const maxCount = Math.max(...input.row.detail.positions.map((position) => position.count), 1)

  return (
    <div className="wfp-position-pane">
      <div className="wfp-pane-heading">
        <strong>Pozisyon dengesi</strong>
        <span>{input.row.detail.positions.length} rol</span>
      </div>
      <div className="wfp-position-grid">
        {input.row.detail.positions.map((position) => (
          <article key={position.label}>
            <div>
              <span>{position.label}</span>
              <b>{position.count} aktif personel</b>
            </div>
            <strong>{position.count}</strong>
            <i aria-hidden="true">
              <em style={{ width: `${Math.max(10, (position.count / maxCount) * 100)}%` }} />
            </i>
          </article>
        ))}
      </div>
    </div>
  )
}

function HistoryDetailPane(input: { row: WorkforceStoreRow }) {
  const history = input.row.detail.history ?? []

  return (
    <div className="wfp-history-table">
      <div>
        <span>Tarih</span>
        <span>Personel</span>
        <span>Pozisyon</span>
        <span>Hareket</span>
        <span>Not</span>
      </div>
      {history.map((item) => (
        <div key={`${item.date}-${item.name}-${item.status}`}>
          <span>{item.date}</span>
          <strong>{item.name}</strong>
          <span>{item.position}</span>
          <Badge tone={item.status === 'Giriş' ? 'mint' : 'rose'}>{item.status}</Badge>
          <span>{item.storeNote}</span>
        </div>
      ))}
    </div>
  )
}

function Fact(input: { label: string; value: string }) {
  return (
    <div className="wfp-fact">
      <span>{input.label}</span>
      <b>{input.value}</b>
    </div>
  )
}

function comparePrototypeRows(left: WorkforceStoreRow, right: WorkforceStoreRow, key: WorkforceSortKey) {
  if (key === 'store') {
    return left.store.localeCompare(right.store, 'tr')
  }

  if (key === 'active') {
    return left.active - right.active
  }

  if (key === 'norm') {
    return getNormDelta(left) - getNormDelta(right)
  }

  if (key === 'shortage') {
    return getNumericValue(left.shortage) - getNumericValue(right.shortage)
  }

  if (key === 'turnover') {
    return getNumericValue(left.turnover) - getNumericValue(right.turnover)
  }

  const statusOrder: Record<WorkforceStatus, number> = {
    short: 0,
    balanced: 1,
    over: 2,
    unknown: 3,
  }
  return statusOrder[left.status] - statusOrder[right.status]
}

function getNormDelta(row: WorkforceStoreRow) {
  const [actual, planned] = row.norm.split('/').map((part) => Number(part.trim()))
  const actualValue = actual ?? Number.NaN
  const plannedValue = planned ?? Number.NaN
  if (!Number.isFinite(actualValue) || !Number.isFinite(plannedValue)) return 0
  return actualValue - plannedValue
}

function getNormStatusNote(row: WorkforceStoreRow) {
  if (row.status === 'unknown') return 'Tanımlı değil'
  const delta = getNormDelta(row)
  if (delta < 0) return `${Math.abs(delta)} açık`
  if (delta > 0) return `${delta} fazla`
  return 'tam'
}

function getNumericValue(value: string) {
  const normalized = value.replace('%', '').replace(',', '.')
  const match = normalized.match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function getPrototypeMetrics(rows: WorkforceStoreRow[]) {
  const shortStores = rows.filter((row) => row.status === 'short').length
  const openPositions = rows.reduce((total, row) => total + Math.max(0, -getNormDelta(row)), 0)
  const turnoverValues = rows
    .map((row) => getNumericValue(row.turnover))
    .filter((value) => value > 0)
  const turnoverAverage =
    turnoverValues.length > 0
      ? turnoverValues.reduce((total, value) => total + value, 0) / turnoverValues.length
      : 0

  return {
    averageTurnover: turnoverValues.length > 0 ? `%${turnoverAverage.toFixed(1).replace('.', ',')}` : 'Veri yok',
    openPositions,
    shortStores,
    totalStores: rows.length,
    turnoverStores: turnoverValues.length,
  }
}

const prototypeStyles = `
.workforce-prototype {
  --ink: #10111a;
  --muted: #646a7f;
  --line: #dfe3ee;
  --panel: rgba(255,255,255,.88);
  --soft: #f7f8fc;
  --plum: #6742e8;
  --plum-soft: #f0ecff;
  --cyan: #1697a8;
  --rose: #be2946;
  --rose-soft: #fff2f5;
  --mint: #14855d;
  --mint-soft: #effbf5;
  --amber: #a86b00;
  --amber-soft: #fff7e7;
  --blue: #2563eb;
  --blue-soft: #eef5ff;
  width: min(1360px, 100%);
  margin: 0 auto;
  padding: 18px 20px 36px;
  color: var(--ink);
}
.wfp-hero {
  min-height: 122px;
  border: 1px solid rgba(204,210,223,.82);
  border-radius: 26px;
  background:
    linear-gradient(115deg, rgba(255,255,255,.9), rgba(255,255,255,.7)),
    radial-gradient(circle at 84% 22%, rgba(22,151,168,.2), transparent 34%),
    radial-gradient(circle at 12% 0%, rgba(103,66,232,.16), transparent 36%);
  box-shadow: 0 24px 80px rgba(30,33,44,.1);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
}
.wfp-kicker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.wfp-kicker span,
.wfp-kicker b {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(103,66,232,.16);
  border-radius: 999px;
  padding: 0 11px;
  font-size: 12px;
  font-weight: 700;
}
.wfp-kicker span { color: var(--plum); background: var(--plum-soft); }
.wfp-kicker b { color: #414151; background: rgba(255,255,255,.78); }
.wfp-kicker.compact span,
.wfp-kicker.compact b { min-height: 25px; font-size: 11px; }
.wfp-title-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.wfp-title-icon,
.wfp-metric > span,
.wfp-store > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--plum);
  background: var(--plum-soft);
}
.wfp-title-icon {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(103,66,232,.16);
  border-radius: 15px;
  flex: 0 0 auto;
}
.wfp-title-icon svg { width: 25px; height: 25px; }
.wfp-hero h1 {
  margin: 0;
  font-size: clamp(26px, 2.72vw, 40px);
  line-height: 1;
  letter-spacing: -.03em;
  font-weight: 660;
}
.wfp-hero p {
  max-width: 620px;
  margin: 8px 0 0;
  color: #414151;
  font-size: 12px;
  line-height: 1.55;
}
.wfp-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
}
.wfp-button,
.wfp-filter-button,
.wfp-row-action,
.wfp-close {
  min-height: 38px;
  border-radius: 12px;
  border: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 13px;
  font-size: 13px;
  font-weight: 680;
  cursor: pointer;
  background: white;
  color: var(--ink);
}
.wfp-button svg,
.wfp-filter-button svg,
.wfp-row-action svg,
.wfp-close svg { width: 16px; height: 16px; }
.wfp-button.primary {
  color: white;
  border-color: rgba(103,66,232,.2);
  background: linear-gradient(120deg, var(--plum), var(--cyan));
  box-shadow: 0 14px 26px rgba(103,66,232,.2);
}
.wfp-button.secondary {
  background: rgba(255,255,255,.9);
}
.wfp-metrics {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.wfp-metric {
  min-height: 112px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--panel);
  box-shadow: 0 12px 32px rgba(36,38,50,.08);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 13px;
}
.wfp-metric > span {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  flex: 0 0 auto;
}
.wfp-metric > span svg { width: 20px; height: 20px; }
.wfp-metric.rose > span { color: var(--rose); background: var(--rose-soft); }
.wfp-metric.amber > span { color: var(--amber); background: var(--amber-soft); }
.wfp-metric small,
.wfp-metric em {
  display: block;
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
}
.wfp-metric small { font-weight: 620; }
.wfp-metric b {
  display: block;
  margin-top: 5px;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -.03em;
  font-weight: 720;
}
.wfp-metric em { margin-top: 7px; font-weight: 520; }
.wfp-toolbar {
  margin-top: 14px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 190px 132px;
  gap: 10px;
}
.wfp-search,
.wfp-filter-button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: rgba(255,255,255,.88);
  box-shadow: 0 10px 26px rgba(30,33,44,.05);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  color: var(--muted);
}
.wfp-search svg { width: 17px; height: 17px; }
.wfp-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-weight: 610;
}
.wfp-year-trigger {
  justify-content: space-between;
  color: var(--ink);
}
.wfp-year-trigger svg:last-child {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--muted);
}
.wfp-year-popover {
  width: 326px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgba(255,255,255,.98);
  box-shadow: 0 24px 70px rgba(30,33,44,.16);
  padding: 12px;
}
.wfp-year-popover [data-slot="popover-title"] {
  color: var(--ink);
  font-size: 13px;
  font-weight: 680;
}
.wfp-year-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0,1fr));
  gap: 8px;
}
.wfp-year-options button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}
.wfp-year-options button.active {
  border-color: rgba(103,66,232,.35);
  color: var(--plum);
  background: rgba(103,66,232,.08);
}
.wfp-ledger {
  margin-top: 14px;
  border: 1px solid var(--line);
  border-radius: 22px;
  overflow: visible;
  background: var(--panel);
  box-shadow: 0 24px 80px rgba(30,33,44,.1);
}
.wfp-ledger-head,
.wfp-row {
  display: grid;
  grid-template-columns:
    minmax(280px, 1.5fr)
    minmax(92px, .56fr)
    minmax(116px, .66fr)
    minmax(92px, .52fr)
    minmax(112px, .62fr)
    minmax(96px, .54fr)
    minmax(92px, auto);
  align-items: center;
  gap: 12px;
}
.wfp-ledger-head {
  position: relative;
  z-index: 8;
  min-height: 44px;
  padding: 0 18px 0 16px;
  border-bottom: 1px solid var(--line);
  border-radius: 22px 22px 0 0;
  background: #fbfcff;
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
}
.wfp-ledger-head > span {
  justify-self: center;
}
.wfp-ledger-head > span:last-child {
  text-align: center;
}
.wfp-sort {
  position: relative;
  min-width: 0;
  justify-self: center;
}
.wfp-sort:first-child {
  justify-self: start;
}
.wfp-sort-trigger {
  min-height: 28px;
  max-width: 100%;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 760;
  cursor: pointer;
}
.wfp-sort:first-child .wfp-sort-trigger {
  justify-content: flex-start;
}
.wfp-sort-trigger svg {
  width: 12px;
  height: 12px;
}
.wfp-sort-trigger small {
  min-height: 18px;
  border-radius: 999px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  background: rgba(103,66,232,.1);
  color: var(--plum);
  font-size: 10px;
  font-weight: 740;
}
.wfp-sort-trigger:hover,
.wfp-sort-trigger.active {
  color: var(--plum);
  border-color: rgba(103,66,232,.16);
  background: var(--plum-soft);
}
.wfp-ledger-list {
  max-height: calc(100vh - 430px);
  min-height: 430px;
  overflow: auto;
  border-radius: 0 0 22px 22px;
}
.wfp-row {
  position: relative;
  min-height: 76px;
  border-bottom: 1px solid var(--line);
  padding: 0 18px 0 16px;
  background:
    linear-gradient(90deg, rgba(255,255,255,.96), rgba(255,255,255,.82)),
    white;
}
.wfp-row:hover {
  background:
    linear-gradient(90deg, rgba(103,66,232,.055), rgba(22,151,168,.035)),
    white;
}
.wfp-row::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  opacity: .82;
}
.wfp-row.short::before { background: var(--rose); }
.wfp-row.balanced::before { background: var(--mint); }
.wfp-row.over::before { background: var(--blue); }
.wfp-store {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
}
.wfp-store > span {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  flex: 0 0 auto;
}
.wfp-store svg { width: 17px; height: 17px; }
.wfp-store b,
.wfp-store small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfp-store b { font-size: 13px; font-weight: 700; }
.wfp-store small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 520;
}
.wfp-count {
  min-width: 64px;
  text-align: center;
}
.wfp-count b,
.wfp-count small { display: block; }
.wfp-count b { font-size: 14px; font-weight: 720; }
.wfp-count small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}
.wfp-badge,
.wfp-shortage {
  width: fit-content;
  min-height: 28px;
  border-radius: 999px;
  border: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 640;
  white-space: nowrap;
  justify-self: center;
}
.wfp-badge.rose,
.wfp-shortage.hot {
  color: var(--rose);
  border-color: #f5cbd5;
  background: var(--rose-soft);
}
.wfp-badge.mint {
  color: var(--mint);
  border-color: #cceede;
  background: var(--mint-soft);
}
.wfp-badge.blue {
  color: var(--blue);
  border-color: #cfe0ff;
  background: var(--blue-soft);
}
.wfp-badge.neutral,
.wfp-shortage {
  color: #414151;
  background: white;
}
.wfp-shortage svg { width: 15px; height: 15px; }
.wfp-turnover {
  display: grid;
  gap: 6px;
  width: 78px;
  justify-self: center;
}
.wfp-turnover b { font-size: 13px; font-weight: 720; }
.wfp-turnover i {
  display: block;
  width: 100%;
  height: 5px;
  border-radius: 999px;
  background: #e9ecf4;
}
.wfp-row-action {
  min-height: 34px;
  padding: 0 10px;
  border-color: rgba(103,66,232,.22);
  color: var(--plum);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.wfp-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(14,17,28,.34);
  backdrop-filter: blur(8px);
}
.wfp-dialog {
  width: min(980px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255,255,255,.96);
  box-shadow: 0 30px 90px rgba(15,23,42,.24);
}
.wfp-dialog header {
  padding: 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.wfp-dialog h2 {
  margin: 14px 0 0;
  font-size: 26px;
  letter-spacing: -.03em;
}
.wfp-dialog p {
  margin: 9px 0 0;
  color: var(--muted);
}
.wfp-close {
  width: 40px;
  height: 40px;
  min-height: 40px;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 14px;
}
.wfp-dialog-summary {
  padding: 18px 24px 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 10px;
}
.wfp-fact {
  min-height: 70px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--soft);
  padding: 12px;
}
.wfp-fact span {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 640;
}
.wfp-fact b {
  display: block;
  margin-top: 8px;
  font-size: 15px;
  font-weight: 740;
}
.wfp-tabs {
  margin: 18px 24px 0;
  width: fit-content;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px;
  display: flex;
  gap: 4px;
  background: white;
}
.wfp-tabs button {
  min-height: 32px;
  border: 0;
  border-radius: 999px;
  padding: 0 14px;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.wfp-tabs button.active {
  color: var(--plum);
  background: var(--plum-soft);
}
.wfp-tabs button small {
  min-width: 20px;
  min-height: 20px;
  border: 1px solid var(--line);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: var(--muted);
  font-size: 11px;
  font-weight: 740;
}
.wfp-tabs button.active small {
  border-color: rgba(103,66,232,.2);
  color: var(--plum);
}
.wfp-people-table {
  margin: 18px 24px 24px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
}
.wfp-people-table > div {
  display: grid;
  grid-template-columns: minmax(240px, 1.2fr) minmax(180px, 1fr) minmax(120px, .6fr) minmax(160px, .8fr);
  gap: 14px;
  align-items: center;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}
.wfp-people-table > div:first-child {
  background: #f6f8fc;
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
}
.wfp-people-table > div:last-child { border-bottom: 0; }
.wfp-people-table strong,
.wfp-people-table span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfp-people-table strong { font-size: 13px; }
.wfp-people-table span { font-size: 13px; color: #414151; }
.wfp-pane-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.wfp-pane-heading strong {
  font-size: 15px;
}
.wfp-pane-heading span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.wfp-position-pane,
.wfp-history-table {
  margin: 18px 24px 24px;
}
.wfp-position-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.wfp-position-grid article {
  min-height: 96px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--soft);
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px 14px;
}
.wfp-position-grid span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.wfp-position-grid b {
  display: block;
  margin-top: 5px;
  font-size: 15px;
}
.wfp-position-grid strong {
  font-size: 26px;
  line-height: 1;
}
.wfp-position-grid i {
  grid-column: 1 / -1;
  height: 7px;
  border-radius: 999px;
  background: #e9ecf4;
  overflow: hidden;
}
.wfp-position-grid i,
.wfp-position-grid em {
  display: block;
}
.wfp-position-grid em {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--plum), var(--cyan));
}
.wfp-history-table {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
}
.wfp-history-table > div {
  display: grid;
  grid-template-columns:
    minmax(130px, .8fr)
    minmax(190px, 1.1fr)
    minmax(170px, 1fr)
    minmax(90px, .45fr)
    minmax(180px, 1.1fr);
  gap: 14px;
  align-items: center;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}
.wfp-history-table > div:first-child {
  background: #f6f8fc;
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
}
.wfp-history-table > div:last-child {
  border-bottom: 0;
}
.wfp-history-table strong,
.wfp-history-table span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wfp-history-table strong {
  font-size: 13px;
}
.wfp-history-table span {
  font-size: 13px;
  color: #414151;
}
.wfp-dialog footer {
  position: sticky;
  bottom: 0;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  background: rgba(255,255,255,.94);
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 1120px) {
  .wfp-ledger-head { display: none; }
  .wfp-ledger-list {
    max-height: none;
    display: grid;
    gap: 10px;
    padding: 10px;
  }
  .wfp-row {
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 12px;
    min-height: auto;
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 14px;
  }
  .wfp-row::before {
    width: 100%;
    height: 4px;
    inset: 0 0 auto;
  }
  .wfp-store,
  .wfp-row-action { grid-column: 1 / -1; }
  .wfp-store b { white-space: normal; }
}
@media (max-width: 760px) {
  .workforce-prototype { padding: 14px; }
  .wfp-hero,
  .wfp-title-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .wfp-actions,
  .wfp-button,
  .wfp-filter-button { width: 100%; }
  .wfp-metrics,
  .wfp-toolbar,
  .wfp-dialog-summary,
  .wfp-position-grid,
  .wfp-history-table > div,
  .wfp-people-table > div {
    grid-template-columns: 1fr;
  }
  .wfp-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .wfp-store,
  .wfp-row-action {
    grid-column: 1 / -1;
  }
  .wfp-dialog-backdrop { padding: 12px; }
}
`
