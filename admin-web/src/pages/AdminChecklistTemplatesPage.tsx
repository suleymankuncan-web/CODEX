import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Plus, Rocket, Save, Trash2 } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  createAdminChecklistTemplate,
  publishAdminChecklistTemplate,
  type AdminChecklistTemplateSummary,
  type ChecklistTemplateResponseType,
  type CreateAdminChecklistTemplateInput,
} from '../features/checklists/api'
import { getErrorMessage } from '../lib/format'

type DraftChecklistItem = {
  id: string
  itemText: string
  note: string
  responseType: ChecklistTemplateResponseType
  minScore: number
  maxScore: number
  lowScoreThreshold: number
  weight: number
  requiresLowScoreNote: boolean
}

type DraftChecklistSection = {
  id: string
  name: string
  items: DraftChecklistItem[]
}

type TemplateOption = {
  label: string
  templateType: 'BM_STORE_VISIT' | 'VM_STORE_VISIT'
  templateCode: string
  templateName: string
  category: string
}

const templateOptions: TemplateOption[] = [
  {
    label: 'BM Checklist',
    templateType: 'BM_STORE_VISIT',
    templateCode: 'BM_STORE_VISIT_2026',
    templateName: 'BM Mağaza Ziyareti',
    category: 'store_visit',
  },
  {
    label: 'VM Checklist',
    templateType: 'VM_STORE_VISIT',
    templateCode: 'VM_STORE_VISIT_2026',
    templateName: 'VM Mağaza Ziyareti',
    category: 'visual_merchandising',
  },
]

const responseTypeLabels: Record<ChecklistTemplateResponseType, string> = {
  score: 'Skor',
  yes_no: 'Evet / Hayır',
  partial: 'Kısmi',
  text: 'Metin',
}

const today = new Date().toISOString().slice(0, 10)

const initialSections: DraftChecklistSection[] = [
  {
    id: 'section-vitrine',
    name: 'Vitrin',
    items: [
      {
        id: 'item-vitrine-standards',
        itemText: 'Vitrin sezon standartlarına uygun mu?',
        note: 'Sezon kombinleri, manken dizilimi ve ilk karşılama alanı kontrol edilir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 6,
        weight: 20,
        requiresLowScoreNote: true,
      },
      {
        id: 'item-mannequin-combination',
        itemText: 'Manken kombinleri ve ürün anlatımı güncel mi?',
        note: 'Eksik kombin varsa saha notu zorunlu olmalı.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 7,
        weight: 25,
        requiresLowScoreNote: true,
      },
    ],
  },
  {
    id: 'section-operation',
    name: 'Kasa ve Operasyon',
    items: [
      {
        id: 'item-cashier-area',
        itemText: 'Kasa arkası ve bekleme alanı düzenli mi?',
        note: 'Bekleme alanı, hızlı işlem akışı ve kasa önü kontrol edilir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 6,
        weight: 35,
        requiresLowScoreNote: false,
      },
    ],
  },
  {
    id: 'section-team',
    name: 'Ekip',
    items: [
      {
        id: 'item-team-standard',
        itemText: 'Ekip karşılama ve yönlendirme standardına uyuyor mu?',
        note: 'Karşılama, ürün yönlendirme ve alan sahipliği gözlemlenir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 6,
        weight: 20,
        requiresLowScoreNote: true,
      },
    ],
  },
]

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function createEmptyItem(): DraftChecklistItem {
  return {
    id: createDraftId('item'),
    itemText: 'Yeni checklist maddesi',
    note: 'Kısa açıklama veya kontrol notu.',
    responseType: 'score',
    minScore: 0,
    maxScore: 10,
    lowScoreThreshold: 6,
    weight: 10,
    requiresLowScoreNote: false,
  }
}

function createEmptySection(): DraftChecklistSection {
  return {
    id: createDraftId('section'),
    name: 'Yeni Bölüm',
    items: [createEmptyItem()],
  }
}

function getCompanyId(authSummary: AuthSessionSummary | null) {
  return (
    authSummary?.user.readScope.companyIds[0] ??
    authSummary?.user.scope.companyIds[0] ??
    ''
  )
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100
}

function clampNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatWeight(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildExpectedValue(item: DraftChecklistItem) {
  return JSON.stringify({
    note: item.note.trim(),
    minScore: item.minScore,
    lowScoreThreshold: item.lowScoreThreshold,
    requiresLowScoreNote: item.requiresLowScoreNote,
  })
}

function createPayload(input: {
  companyId: string
  template: TemplateOption
  templateName: string
  effectiveFrom: string
  sections: DraftChecklistSection[]
}): CreateAdminChecklistTemplateInput {
  let itemNo = 1

  return {
    companyId: input.companyId,
    templateCode: input.template.templateCode,
    templateName: input.templateName.trim(),
    templateType: input.template.templateType,
    category: input.template.category,
    effectiveFrom: input.effectiveFrom,
    items: input.sections.flatMap((section) =>
      section.items.map((item) => ({
        sectionName: section.name.trim(),
        itemNo: itemNo++,
        itemText: item.itemText.trim(),
        responseType: item.responseType,
        weight: item.weight,
        maxScore: Math.max(1, item.maxScore),
        expectedValue: buildExpectedValue(item),
      })),
    ),
  }
}

export function AdminChecklistTemplatesPage(input: { authSummary: AuthSessionSummary | null }) {
  const companyId = getCompanyId(input.authSummary)
  const [templateType, setTemplateType] = useState<TemplateOption['templateType']>('BM_STORE_VISIT')
  const selectedTemplate = templateOptions.find((option) => option.templateType === templateType) ?? templateOptions[0]
  const [templateName, setTemplateName] = useState(selectedTemplate.templateName)
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [sections, setSections] = useState<DraftChecklistSection[]>(initialSections)
  const [savedTemplate, setSavedTemplate] = useState<AdminChecklistTemplateSummary | null>(null)
  const [isDirty, setIsDirty] = useState(true)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; message: string } | null>(
    null,
  )

  const totalWeight = useMemo(
    () =>
      roundWeight(
        sections.reduce(
          (sectionSum, section) =>
            sectionSum + section.items.reduce((itemSum, item) => itemSum + item.weight, 0),
          0,
        ),
      ),
    [sections],
  )
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0)
  const sectionCount = sections.length
  const emptyTextCount = sections.reduce(
    (sum, section) =>
      sum +
      (section.name.trim() ? 0 : 1) +
      section.items.filter((item) => !item.itemText.trim()).length,
    0,
  )
  const hasInvalidScore = sections.some((section) =>
    section.items.some((item) => item.maxScore < 1 || item.minScore < 0 || item.lowScoreThreshold < 0),
  )
  const weightIsReady = Math.round(totalWeight * 100) === 10_000
  const canSubmit = Boolean(companyId) && weightIsReady && emptyTextCount === 0 && !hasInvalidScore

  const createMutation = useMutation({
    mutationFn: createAdminChecklistTemplate,
  })
  const publishMutation = useMutation({
    mutationFn: publishAdminChecklistTemplate,
  })
  const isSaving = createMutation.isPending || publishMutation.isPending

  const markDirty = () => {
    setIsDirty(true)
    setNotice(null)
  }

  const updateTemplateType = (nextType: TemplateOption['templateType']) => {
    const nextTemplate = templateOptions.find((option) => option.templateType === nextType)
    if (!nextTemplate) return

    setTemplateType(nextType)
    setTemplateName(nextTemplate.templateName)
    setSavedTemplate(null)
    markDirty()
  }

  const updateSection = (sectionId: string, name: string) => {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, name } : section)),
    )
    markDirty()
  }

  const updateItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<DraftChecklistItem>,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : section,
      ),
    )
    markDirty()
  }

  const addSection = () => {
    setSections((current) => [...current, createEmptySection()])
    markDirty()
  }

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      setNotice({ tone: 'warning', message: 'En az bir bölüm kalmalı.' })
      return
    }

    setSections((current) => current.filter((section) => section.id !== sectionId))
    markDirty()
  }

  const addItem = (sectionId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, createEmptyItem()] }
          : section,
      ),
    )
    markDirty()
  }

  const removeItem = (sectionId: string, itemId: string) => {
    const targetSection = sections.find((section) => section.id === sectionId)
    if (!targetSection || targetSection.items.length <= 1) {
      setNotice({ tone: 'warning', message: 'Her bölümde en az bir madde kalmalı.' })
      return
    }

    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
          : section,
      ),
    )
    markDirty()
  }

  const saveDraft = async () => {
    if (!canSubmit) {
      setNotice({ tone: 'warning', message: resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore) })
      return null
    }

    try {
      const result = await createMutation.mutateAsync(
        createPayload({
          companyId,
          template: selectedTemplate,
          templateName,
          effectiveFrom,
          sections,
        }),
      )
      setSavedTemplate(result.data.checklistTemplate)
      setIsDirty(false)
      setNotice({ tone: 'success', message: result.command.message })
      return result.data.checklistTemplate
    } catch (error) {
      setNotice({ tone: 'danger', message: getErrorMessage(error) })
      return null
    }
  }

  const publishTemplate = async () => {
    if (!canSubmit) {
      setNotice({ tone: 'warning', message: resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore) })
      return
    }

    try {
      const draft = !savedTemplate || isDirty ? await saveDraft() : savedTemplate
      if (!draft?.checklistTemplateId) return

      const result = await publishMutation.mutateAsync({
        checklistTemplateId: draft.checklistTemplateId,
        effectiveFrom,
      })
      setSavedTemplate(result.data.checklistTemplate)
      setIsDirty(false)
      setNotice({ tone: 'success', message: result.command.message })
    } catch (error) {
      setNotice({ tone: 'danger', message: getErrorMessage(error) })
    }
  }

  return (
    <section className="admin-checklist-builder-page">
      <header className="admin-checklist-builder-hero">
        <div>
          <div className="eyebrow">Admin checklist</div>
          <h2>Checklist şablon editörü</h2>
          <p>
            Bölüm ekle, madde ekle, ağırlıkları 100’e tamamla ve yayınla. Yayınlanan
            şablon yeni saha checklist başlangıçlarında kullanılacak.
          </p>
        </div>
        <div className="admin-checklist-builder-actions">
          <button className="admin-checklist-builder-button secondary" type="button" onClick={addSection}>
            <Plus size={16} />
            Bölüm Ekle
          </button>
          <button
            className="admin-checklist-builder-button"
            type="button"
            onClick={() => void saveDraft()}
            disabled={isSaving || !canSubmit}
          >
            <Save size={16} />
            Taslak Kaydet
          </button>
          <button
            className="admin-checklist-builder-button primary"
            type="button"
            onClick={() => void publishTemplate()}
            disabled={isSaving || !canSubmit}
          >
            <Rocket size={16} />
            Yayınla
          </button>
        </div>
      </header>

      <section className="admin-checklist-builder-panel" aria-label="Checklist şablon düzenleme alanı">
        <div className="admin-checklist-builder-template-strip">
          <label className="admin-checklist-builder-field">
            <span>Şablon adı</span>
            <input
              value={templateName}
              onChange={(event) => {
                setTemplateName(event.target.value)
                markDirty()
              }}
            />
          </label>
          <label className="admin-checklist-builder-field">
            <span>Checklist tipi</span>
            <select
              value={templateType}
              onChange={(event) => updateTemplateType(event.target.value as TemplateOption['templateType'])}
            >
              {templateOptions.map((option) => (
                <option key={option.templateType} value={option.templateType}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-checklist-builder-field">
            <span>Yürürlük tarihi</span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => {
                setEffectiveFrom(event.target.value)
                markDirty()
              }}
            />
          </label>
          <div className="admin-checklist-builder-field readonly">
            <span>Şablon kodu</span>
            <strong>{selectedTemplate.templateCode}</strong>
          </div>
        </div>

        <div className="admin-checklist-builder-status-strip">
          <div className="admin-checklist-builder-chips">
            <span className={weightIsReady ? 'ready' : 'warning'}>
              Toplam ağırlık: {formatWeight(totalWeight)}/100
            </span>
            <span>{sectionCount} bölüm</span>
            <span>{itemCount} madde</span>
            <span>{savedTemplate ? `v${savedTemplate.versionNo ?? '-'} ${savedTemplate.status}` : 'Yeni taslak'}</span>
            {!companyId ? <span className="warning">Şirket scope yok</span> : null}
          </div>
          <button className="admin-checklist-builder-button secondary" type="button" onClick={addSection}>
            <Plus size={16} />
            Bölüm Ekle
          </button>
        </div>

        {notice ? (
          <div className={`admin-checklist-builder-notice ${notice.tone}`} role="status">
            {notice.tone === 'success' ? <CheckCircle2 size={17} /> : <ClipboardList size={17} />}
            <span>{notice.message}</span>
          </div>
        ) : null}

        <div className="admin-checklist-builder-sections">
          {sections.map((section, sectionIndex) => (
            <article className="admin-checklist-builder-section" key={section.id}>
              <div className="admin-checklist-builder-section-head">
                <div className="admin-checklist-builder-section-title">
                  <span>{sectionIndex + 1}</span>
                  <input
                    value={section.name}
                    aria-label="Bölüm adı"
                    onChange={(event) => updateSection(section.id, event.target.value)}
                  />
                </div>
                <div className="admin-checklist-builder-section-actions">
                  <strong>
                    Ağırlık:{' '}
                    {formatWeight(section.items.reduce((sum, item) => sum + item.weight, 0))}
                  </strong>
                  <button
                    className="admin-checklist-builder-button secondary compact"
                    type="button"
                    onClick={() => addItem(section.id)}
                  >
                    <Plus size={15} />
                    Madde Ekle
                  </button>
                  <button
                    className="admin-checklist-builder-icon-button"
                    type="button"
                    aria-label="Bölümü sil"
                    onClick={() => removeSection(section.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="admin-checklist-builder-items">
                {section.items.map((item, itemIndex) => (
                  <div className="admin-checklist-builder-item" key={item.id}>
                    <div className="admin-checklist-builder-item-no">{itemIndex + 1}</div>
                    <div className="admin-checklist-builder-item-body">
                      <div className="admin-checklist-builder-question-line">
                        <input
                          value={item.itemText}
                          aria-label="Checklist maddesi"
                          onChange={(event) =>
                            updateItem(section.id, item.id, { itemText: event.target.value })
                          }
                        />
                        <button
                          className="admin-checklist-builder-icon-button"
                          type="button"
                          aria-label="Maddeyi sil"
                          onClick={() => removeItem(section.id, item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <textarea
                        value={item.note}
                        aria-label="Madde açıklaması"
                        onChange={(event) => updateItem(section.id, item.id, { note: event.target.value })}
                      />
                      <div className="admin-checklist-builder-item-settings">
                        <label>
                          <span>Cevap tipi</span>
                          <select
                            value={item.responseType}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                responseType: event.target.value as ChecklistTemplateResponseType,
                              })
                            }
                          >
                            {(Object.keys(responseTypeLabels) as ChecklistTemplateResponseType[]).map(
                              (responseType) => (
                                <option key={responseType} value={responseType}>
                                  {responseTypeLabels[responseType]}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label>
                          <span>Min</span>
                          <input
                            type="number"
                            min={0}
                            value={item.minScore}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                minScore: clampNumber(event.target.value, item.minScore),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Max</span>
                          <input
                            type="number"
                            min={1}
                            value={item.maxScore}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                maxScore: clampNumber(event.target.value, item.maxScore),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Düşük eşik</span>
                          <input
                            type="number"
                            min={0}
                            value={item.lowScoreThreshold}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                lowScoreThreshold: clampNumber(
                                  event.target.value,
                                  item.lowScoreThreshold,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>Ağırlık</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.weight}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                weight: clampNumber(event.target.value, item.weight),
                              })
                            }
                          />
                        </label>
                        <label className="admin-checklist-builder-checkbox">
                          <input
                            type="checkbox"
                            checked={item.requiresLowScoreNote}
                            onChange={(event) =>
                              updateItem(section.id, item.id, {
                                requiresLowScoreNote: event.target.checked,
                              })
                            }
                          />
                          <span>Düşük puanda açıklama zorunlu</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          <button className="admin-checklist-builder-add-section" type="button" onClick={addSection}>
            <Plus size={17} />
            Bölüm Ekle
          </button>
        </div>
      </section>
    </section>
  )
}

function resolveValidationMessage(
  companyId: string,
  weightIsReady: boolean,
  emptyTextCount: number,
  hasInvalidScore: boolean,
) {
  if (!companyId) return 'Şirket scope bulunamadı. Bu kullanıcıyla şablon yayınlanamaz.'
  if (!weightIsReady) return 'Yayınlamak için madde ağırlıkları toplamı 100 olmalı.'
  if (emptyTextCount > 0) return 'Bölüm adı ve madde metni boş bırakılamaz.'
  if (hasInvalidScore) return 'Skor alanlarında geçerli sayılar kullanılmalı.'

  return 'Şablon yayına hazır değil.'
}
