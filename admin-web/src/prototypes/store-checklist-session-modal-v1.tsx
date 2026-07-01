import {
  ClipboardCheck,
  Cloud,
  Eye,
  LayoutList,
  Save,
  Send,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { StorePrototypeCommandShell } from './store-prototype-command-shell'
import './store-checklist-session-modal-v1.css'

type ChecklistSection = {
  id: string
  label: string
  icon: typeof Eye
  items: ChecklistItem[]
}

type ChecklistItem = {
  id: string
  title: string
  weight: number
  maxScore: number
}

type ResponseState = {
  note: string
  score: number | null
}

const sections: ChecklistSection[] = [
  {
    id: 'vitrin',
    label: 'Vitrin',
    icon: Eye,
    items: [
      {
        id: 'vitrin-sezon',
        title: 'Vitrin sezon standartlarına uygun mu?',
        weight: 20,
        maxScore: 10,
      },
      {
        id: 'vitrin-temizlik',
        title: 'Vitrin camı, mankenler ve ışık düzeni kontrol edildi mi?',
        weight: 10,
        maxScore: 10,
      },
    ],
  },
  {
    id: 'operasyon',
    label: 'Operasyon',
    icon: LayoutList,
    items: [
      {
        id: 'kasa-operasyon',
        title: 'Kasa önü ve değişim süreci operasyon standardında mı?',
        weight: 18,
        maxScore: 10,
      },
      {
        id: 'depo-gecis',
        title: 'Depo geçişi ve reyon tamamlama ritmi sağlıklı mı?',
        weight: 16,
        maxScore: 10,
      },
    ],
  },
  {
    id: 'ekip',
    label: 'Ekip',
    icon: ShieldCheck,
    items: [
      {
        id: 'ekip-karsilama',
        title: 'Karşılama ve reyon ilgisi mağaza yoğunluğuna uygun mu?',
        weight: 18,
        maxScore: 10,
      },
      {
        id: 'ekip-gorev',
        title: 'Günlük görev paylaşımı ekip tarafından biliniyor mu?',
        weight: 18,
        maxScore: 10,
      },
    ],
  },
]

const initialResponses: Record<string, ResponseState> = {
  'vitrin-sezon': {
    score: 8,
    note: '',
  },
  'vitrin-temizlik': { score: 10, note: '' },
}

const stores = [
  {
    name: 'Bursa Marka Park AVM',
    city: 'Bursa',
    lastVisit: '12 Haziran',
    status: 'Devam ediyor',
    tone: 'amber',
  },
  {
    name: 'Edremit Novada',
    city: 'Balıkesir',
    lastVisit: 'Yok',
    status: 'Bekleyen',
    tone: 'rose',
  },
  {
    name: 'Balıkesir 10 Burda AVM',
    city: 'Balıkesir',
    lastVisit: '14 Haziran',
    status: 'Kabul bekliyor',
    tone: 'cyan',
  },
]

function flattenItems() {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      item,
      section,
    })),
  )
}

export function StoreChecklistSessionModalV1Prototype() {
  const entries = useMemo(() => flattenItems(), [])
  const [open, setOpen] = useState(true)
  const [responses, setResponses] = useState<Record<string, ResponseState>>(initialResponses)
  const answeredCount = entries.filter(
    ({ item }) => responses[item.id]?.score !== null && responses[item.id]?.score !== undefined,
  ).length
  const liveScore = calculateLiveScore(entries, responses)
  const remainingCount = entries.length - answeredCount
  const completionPercent = entries.length > 0 ? Math.round((answeredCount / entries.length) * 100) : 0
  const canCompleteChecklist = entries.length > 0 && remainingCount === 0

  const updateResponse = (itemId: string, patch: Partial<ResponseState>) => {
    setResponses((current) => ({
      ...current,
      [itemId]: {
        note: current[itemId]?.note ?? '',
        score: current[itemId]?.score ?? null,
        ...patch,
      },
    }))
  }

  return (
    <StorePrototypeCommandShell
      activePath="/store/checklists"
      identityLabel="Onur Kaytan Bölgesi"
      personaLabel="Bölge müdürü"
      subtitle="Checklist oturum prototipi"
    >
      <div className="checklist-session-prototype">
        <div className="checklist-session-prototype__page">
          <header className="checklist-session-prototype__header">
            <div className="checklist-session-prototype__title">
              <span className="checklist-session-prototype__kicker">
                <ClipboardCheck size={15} />
                Checklist oturumu
              </span>
              <h1>Mağaza ziyareti</h1>
              <p>Modal prototip, madde puanlama, taslak ve tamamlama akışı.</p>
            </div>
            <button
              className="checklist-session-prototype__button checklist-session-prototype__button--primary"
              type="button"
              onClick={() => setOpen(true)}
            >
              <ClipboardCheck size={17} />
              Checklist yap
            </button>
          </header>

          <section className="checklist-session-prototype__queue" aria-label="Örnek mağaza kuyruğu">
            {stores.map((store) => (
              <div className="checklist-session-prototype__row" key={store.name}>
                <div>
                  <strong>{store.name}</strong>
                  <span>{store.city}</span>
                </div>
                <div>
                  <span>Son ziyaret</span>
                  <strong>{store.lastVisit}</strong>
                </div>
                <div>
                  <span>BM</span>
                  <strong>{store.name === 'Edremit Novada' ? 'Yok' : 'Hazır'}</strong>
                </div>
                <div>
                  <span>VM</span>
                  <strong>{store.name === 'Balıkesir 10 Burda AVM' ? 'Bekliyor' : 'Yok'}</strong>
                </div>
                <div>
                  <span className={`checklist-session-prototype__badge checklist-session-prototype__badge--${store.tone}`}>
                    {store.status}
                  </span>
                </div>
              </div>
            ))}
          </section>
        </div>

        {open ? (
          <div className="checklist-session-modal__backdrop" role="presentation">
            <section
              className="checklist-session-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checklist-session-modal-title"
            >
              <header className="checklist-session-modal__topbar">
                <button
                  className="checklist-session-modal__icon-button"
                  type="button"
                  aria-label="Kapat"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
                <div className="checklist-session-modal__heading">
                  <h2 id="checklist-session-modal-title">Checklist Oturumu</h2>
                  <p>BM mağaza ziyareti, taslak ve tamamla akışı</p>
                </div>
                <span className="checklist-session-modal__kicker">
                  <Cloud size={15} />
                  Taslak kaydedildi
                </span>
              </header>

              <div className="checklist-session-modal__body">
                <aside className="checklist-session-modal__side" aria-label="Checklist özeti">
                  <div className="checklist-session-modal__store-card">
                    <span className="checklist-session-modal__store-icon">
                      <Store size={18} />
                    </span>
                    <span className="checklist-session-modal__store-copy">
                      <strong>Bursa Marka Park AVM</strong>
                      <span>
                        Canlı skor {liveScore} · {answeredCount}/{entries.length} madde
                      </span>
                    </span>
                  </div>
                </aside>

                <main className="checklist-session-modal__work" aria-label="Madde puanlama">
                  <div className="checklist-session-modal__item-list">
                    {entries.map(({ item, section }, index) => {
                      const response = responses[item.id]
                      const score = response?.score
                      const isAnswered = typeof score === 'number'
                      const isBelowTaskThreshold = isAnswered && score <= 5
                      return (
                        <article className="checklist-session-modal__question" data-answered={isAnswered} key={item.id}>
                          <div className="checklist-session-modal__question-head">
                            <div>
                              <span className="checklist-session-modal__badge checklist-session-modal__badge--cyan">
                                Madde {index + 1}/{entries.length} · {section.label}
                              </span>
                              <h3>{item.title}</h3>
                            </div>
                          </div>

                          <div>
                            <div className="checklist-session-modal__field-label">Puan</div>
                            <div className="checklist-session-modal__score-grid" aria-label={`${item.title} puan seçimi`}>
                              {Array.from({ length: 11 }, (_, itemScore) => (
                                <button
                                  className="checklist-session-modal__score"
                                  data-active={score === itemScore}
                                  key={itemScore}
                                  type="button"
                                  onClick={() => updateResponse(item.id, { score: itemScore })}
                                >
                                  {itemScore}
                                </button>
                              ))}
                            </div>
                            <div className="checklist-session-modal__score-legend">
                              <span>0-5 düşük</span>
                              <span>6-8 takip</span>
                              <span>9-10 iyi</span>
                            </div>
                          </div>

                          {isBelowTaskThreshold ? (
                            <div className="checklist-session-modal__auto-task" data-active="true">
                              <ClipboardCheck size={16} />
                              <span>
                                <strong>Bu puanda mağazaya görev oluşacaktır.</strong>
                              </span>
                            </div>
                          ) : null}

                          <div className="checklist-session-modal__note">
                            <label htmlFor={`checklist-session-note-${item.id}`}>Madde notu</label>
                            <textarea
                              id={`checklist-session-note-${item.id}`}
                              placeholder="Gözlem veya mağazaya bırakılacak kısa not yazın"
                              value={response?.note ?? ''}
                              onChange={(event) => updateResponse(item.id, { note: event.target.value })}
                            />
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </main>
              </div>

              <footer className="checklist-session-modal__footer">
                <div className="checklist-session-modal__footer-progress">
                  <div>
                    <span className="checklist-session-modal__footer-note">
                      {remainingCount > 0 ? `${remainingCount} zorunlu madde kaldı` : 'Tüm maddeler puanlandı'}
                    </span>
                    <strong>{completionPercent}%</strong>
                  </div>
                  <span className="checklist-session-modal__bar">
                    <span style={{ width: `${completionPercent}%` }} />
                  </span>
                </div>
                <div className="checklist-session-modal__footer-actions">
                  <button className="checklist-session-modal__button" type="button" onClick={() => setOpen(false)}>
                    <Save size={16} />
                    Taslak kaydet
                  </button>
                  <button className="checklist-session-modal__button" type="button" onClick={() => setOpen(false)}>
                    İptal
                  </button>
                  <button
                    className="checklist-session-modal__button checklist-session-modal__button--primary"
                    type="button"
                    disabled={!canCompleteChecklist}
                  >
                    <Send size={16} />
                    Tamamla
                  </button>
                </div>
              </footer>
            </section>
          </div>
        ) : null}
      </div>
    </StorePrototypeCommandShell>
  )
}

function calculateLiveScore(
  entries: Array<{ item: ChecklistItem; section: ChecklistSection }>,
  responses: Record<string, ResponseState>,
) {
  let total = 0
  let weight = 0
  for (const { item } of entries) {
    const score = responses[item.id]?.score
    if (typeof score !== 'number') continue
    total += (score / item.maxScore) * item.weight
    weight += item.weight
  }
  if (weight === 0) return 0
  return Math.round((total / weight) * 100)
}
