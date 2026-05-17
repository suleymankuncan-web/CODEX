import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Plus, Rocket, Save, Trash2 } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  createAdminChecklistTemplate,
  publishAdminChecklistTemplate,
  type AdminChecklistTemplateSummary,
  type ChecklistTemplateResponseType,
  type CreateAdminChecklistTemplateInput,
} from '../features/checklists/api'
import { useLocalization } from '../features/localization/useLocalization'
import type { TranslateFunction } from '../features/localization/dictionary'
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

type ChecklistTemplateType = 'BM_STORE_VISIT' | 'VM_STORE_VISIT'

type TemplateOption = {
  label: string
  templateType: ChecklistTemplateType
  templateCode: string
  templateName: string
  category: string
}

type TemplateDraft = {
  effectiveFrom: string
  isDirty: boolean
  savedTemplate: AdminChecklistTemplateSummary | null
  sections: DraftChecklistSection[]
  templateName: string
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

const today = new Date().toISOString().slice(0, 10)

const wholeWeightFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})

const fractionalWeightFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

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

const vmInitialSections: DraftChecklistSection[] = [
  {
    id: 'vm-section-visual-presentation',
    name: 'Gorsel Sunum',
    items: [
      {
        id: 'vm-item-window-concept',
        itemText: 'Vitrin konsepti VM standardina uygun mu?',
        note: 'Tema, renk akisi, manken kombinleri ve ilk gorunur alan birlikte kontrol edilir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 7,
        weight: 30,
        requiresLowScoreNote: true,
      },
      {
        id: 'vm-item-mannequin-story',
        itemText: 'Manken hikayesi ve urun anlatimi net mi?',
        note: 'Kombin butunlugu, aksesuar kullanimi ve fiyat/urun gorunurlugu degerlendirilir.',
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
    id: 'vm-section-floor-layout',
    name: 'Reyon Duzeni',
    items: [
      {
        id: 'vm-item-floor-flow',
        itemText: 'Reyon akisi ve urun bloklari okunabilir mi?',
        note: 'Kategori ayrimi, beden akisi ve eksik urun gorunurlugu incelenir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 6,
        weight: 25,
        requiresLowScoreNote: true,
      },
    ],
  },
  {
    id: 'vm-section-signage',
    name: 'Tabela ve POP',
    items: [
      {
        id: 'vm-item-signage',
        itemText: 'Tabela, POP ve kampanya materyalleri guncel mi?',
        note: 'Eski kampanya gorseli, eksik etiket ve yanlis konumlanan POP notlanir.',
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

function cloneSections(sections: DraftChecklistSection[]) {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }))
}

function createInitialDrafts(): Record<ChecklistTemplateType, TemplateDraft> {
  return {
    BM_STORE_VISIT: {
      effectiveFrom: today,
      isDirty: true,
      savedTemplate: null,
      sections: cloneSections(initialSections),
      templateName: templateOptions[0].templateName,
    },
    VM_STORE_VISIT: {
      effectiveFrom: today,
      isDirty: true,
      savedTemplate: null,
      sections: cloneSections(vmInitialSections),
      templateName: templateOptions[1].templateName,
    },
  }
}

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
  return (value % 1 === 0 ? wholeWeightFormatter : fractionalWeightFormatter).format(value)
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

function useAdminChecklistTemplatesPageModel(input: { authSummary: AuthSessionSummary | null }) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const companyId = getCompanyId(input.authSummary)
  const responseTypeLabels: Record<ChecklistTemplateResponseType, string> = {
    score: t('adminChecklists.responseScore'),
    yes_no: t('adminChecklists.responseYesNo'),
    partial: t('adminChecklists.responsePartial'),
    text: t('adminChecklists.responseText'),
  }
  const [templateType, setTemplateType] = useState<ChecklistTemplateType>('BM_STORE_VISIT')
  const selectedTemplate = templateOptions.find((option) => option.templateType === templateType) ?? templateOptions[0]
  const [draftsByTemplate, setDraftsByTemplate] = useState<Record<ChecklistTemplateType, TemplateDraft>>(
    createInitialDrafts,
  )
  const currentDraft = draftsByTemplate[templateType]
  const { effectiveFrom, isDirty, savedTemplate, sections, templateName } = currentDraft
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
    },
  })
  const publishMutation = useMutation({
    mutationFn: publishAdminChecklistTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
    },
  })
  const isSaving = createMutation.isPending || publishMutation.isPending

  const updateCurrentDraft = (updater: (draft: TemplateDraft) => TemplateDraft) => {
    setDraftsByTemplate((current) => ({
      ...current,
      [templateType]: updater(current[templateType]),
    }))
  }

  const updateCurrentDraftFields = (patch: Partial<TemplateDraft>) => {
    updateCurrentDraft((draft) => ({
      ...draft,
      ...patch,
      isDirty: true,
    }))
    setNotice(null)
  }

  const updateTemplateType = (nextType: ChecklistTemplateType) => {
    const nextTemplate = templateOptions.find((option) => option.templateType === nextType)
    if (!nextTemplate) return

    setTemplateType(nextType)
    setNotice(null)
  }

  const updateSection = (sectionId: string, name: string) => {
    updateCurrentDraftFields({
      sections: sections.map((section) => (section.id === sectionId ? { ...section, name } : section)),
    })
  }

  const updateItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<DraftChecklistItem>,
  ) => {
    updateCurrentDraftFields({
      sections: sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : section,
      ),
    })
  }

  const addSection = () => {
    updateCurrentDraftFields({ sections: [...sections, createEmptySection()] })
  }

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      setNotice({ tone: 'warning', message: t('adminChecklists.noticeMinSection') })
      return
    }

    updateCurrentDraftFields({ sections: sections.filter((section) => section.id !== sectionId) })
  }

  const addItem = (sectionId: string) => {
    updateCurrentDraftFields({
      sections: sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: [...section.items, createEmptyItem()] }
          : section,
      ),
    })
  }

  const removeItem = (sectionId: string, itemId: string) => {
    const targetSection = sections.find((section) => section.id === sectionId)
    if (!targetSection || targetSection.items.length <= 1) {
      setNotice({ tone: 'warning', message: t('adminChecklists.noticeMinItem') })
      return
    }

    updateCurrentDraftFields({
      sections: sections.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
          : section,
      ),
    })
  }

  const saveDraft = async () => {
    if (!canSubmit) {
      setNotice({
        tone: 'warning',
        message: resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore, t),
      })
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
      updateCurrentDraft((draft) => ({
        ...draft,
        isDirty: false,
        savedTemplate: result.data.checklistTemplate,
      }))
      setNotice({ tone: 'success', message: result.command.message })
      return result.data.checklistTemplate
    } catch (error) {
      setNotice({ tone: 'danger', message: getErrorMessage(error) })
      return null
    }
  }

  const publishTemplate = async () => {
    if (!canSubmit) {
      setNotice({
        tone: 'warning',
        message: resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore, t),
      })
      return
    }

    try {
      const draft = !savedTemplate || isDirty ? await saveDraft() : savedTemplate
      if (!draft?.checklistTemplateId) return

      const result = await publishMutation.mutateAsync({
        checklistTemplateId: draft.checklistTemplateId,
        effectiveFrom,
      })
      updateCurrentDraft((draft) => ({
        ...draft,
        isDirty: false,
        savedTemplate: result.data.checklistTemplate,
      }))
      setNotice({ tone: 'success', message: result.command.message })
    } catch (error) {
      setNotice({ tone: 'danger', message: getErrorMessage(error) })
    }
  }

  return {
    addItem,
    addSection,
    canSubmit,
    companyId,
    currentDraft,
    effectiveFrom,
    isSaving,
    itemCount,
    notice,
    publishTemplate,
    removeItem,
    removeSection,
    responseTypeLabels,
    saveDraft,
    savedTemplate,
    sectionCount,
    sections,
    selectedTemplate,
    t,
    templateName,
    templateOptions,
    templateType,
    totalWeight,
    updateCurrentDraftFields,
    updateItem,
    updateSection,
    updateTemplateType,
    weightIsReady,
  }
}

type AdminChecklistTemplatesPageModel = ReturnType<typeof useAdminChecklistTemplatesPageModel>

export function AdminChecklistTemplatesPage(input: { authSummary: AuthSessionSummary | null }) {
  const model = useAdminChecklistTemplatesPageModel(input)

  return <AdminChecklistTemplatesExperience model={model} />
}

function AdminChecklistTemplatesExperience({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  return (
    <section className="admin-checklist-builder-page">
      <AdminChecklistTemplatesHero model={model} />
      <AdminChecklistTemplatesEditorPanel model={model} />
    </section>
  )
}

function AdminChecklistTemplatesHero({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { addSection, canSubmit, isSaving, publishTemplate, saveDraft, t } = model

  return (
    <header className="admin-checklist-builder-hero">
      <div>
        <div className="eyebrow">{t('adminChecklists.heroEyebrow')}</div>
        <h2>{t('adminChecklists.heroTitle')}</h2>
        <p>{t('adminChecklists.heroCopy')}</p>
      </div>
      <div className="admin-checklist-builder-actions">
        <button className="admin-checklist-builder-button secondary" type="button" onClick={addSection}>
          <Plus size={16} />
          {t('adminChecklists.addSection')}
        </button>
        <button
          className="admin-checklist-builder-button"
          type="button"
          onClick={() => void saveDraft()}
          disabled={isSaving || !canSubmit}
        >
          <Save size={16} />
          {t('adminChecklists.saveDraft')}
        </button>
        <button
          className="admin-checklist-builder-button primary"
          type="button"
          onClick={() => void publishTemplate()}
          disabled={isSaving || !canSubmit}
        >
          <Rocket size={16} />
          {t('adminChecklists.publish')}
        </button>
      </div>
    </header>
  )
}

function AdminChecklistTemplatesEditorPanel({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { t } = model

  return (
    <section className="admin-checklist-builder-panel" aria-label={t('adminChecklists.editorAria')}>
      <AdminChecklistTemplateStrip model={model} />
      <AdminChecklistStatusStrip model={model} />
      <AdminChecklistNotice model={model} />
      <AdminChecklistSectionsList model={model} />
    </section>
  )
}

function AdminChecklistTemplateStrip({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const {
    effectiveFrom,
    selectedTemplate,
    t,
    templateName,
    templateOptions,
    templateType,
    updateCurrentDraftFields,
    updateTemplateType,
  } = model

  return (
    <div className="admin-checklist-builder-template-strip">
      <label className="admin-checklist-builder-field">
        <span>{t('adminChecklists.templateName')}</span>
        <input
          value={templateName}
          onChange={(event) => {
            updateCurrentDraftFields({ templateName: event.target.value })
          }}
        />
      </label>
      <label className="admin-checklist-builder-field">
        <span>{t('adminChecklists.checklistType')}</span>
        <select
          value={templateType}
          onChange={(event) => updateTemplateType(event.target.value as ChecklistTemplateType)}
        >
          {templateOptions.map((option) => (
            <option key={option.templateType} value={option.templateType}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-checklist-builder-field">
        <span>{t('adminChecklists.effectiveFrom')}</span>
        <input
          type="date"
          value={effectiveFrom}
          onChange={(event) => {
            updateCurrentDraftFields({ effectiveFrom: event.target.value })
          }}
        />
      </label>
      <div className="admin-checklist-builder-field readonly">
        <span>{t('adminChecklists.templateCode')}</span>
        <strong>{selectedTemplate.templateCode}</strong>
      </div>
    </div>
  )
}

function AdminChecklistStatusStrip({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const {
    addSection,
    companyId,
    itemCount,
    savedTemplate,
    sectionCount,
    t,
    totalWeight,
    weightIsReady,
  } = model

  return (
    <div className="admin-checklist-builder-status-strip">
      <div className="admin-checklist-builder-chips">
        <span className={weightIsReady ? 'ready' : 'warning'}>
          {t('adminChecklists.totalWeight', { total: formatWeight(totalWeight) })}
        </span>
        <span>{t('adminChecklists.sectionCount', { count: sectionCount })}</span>
        <span>{t('adminChecklists.itemCount', { count: itemCount })}</span>
        <span>
          {savedTemplate
            ? t('adminChecklists.savedStatus', {
                version: savedTemplate.versionNo ?? '-',
                status: savedTemplate.status,
              })
            : t('adminChecklists.newDraft')}
        </span>
        {!companyId ? <span className="warning">{t('adminChecklists.missingCompanyScope')}</span> : null}
      </div>
      <button className="admin-checklist-builder-button secondary" type="button" onClick={addSection}>
        <Plus size={16} />
        {t('adminChecklists.addSection')}
      </button>
    </div>
  )
}

function AdminChecklistNotice({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { notice } = model

  if (!notice) return null

  return (
    <div className={`admin-checklist-builder-notice ${notice.tone}`} role="status">
      {notice.tone === 'success' ? <CheckCircle2 size={17} /> : <ClipboardList size={17} />}
      <span>{notice.message}</span>
    </div>
  )
}

function AdminChecklistSectionsList({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { addSection, sections, t } = model

  return (
    <div className="admin-checklist-builder-sections">
      {sections.map((section, sectionIndex) => (
        <AdminChecklistSectionCard
          key={section.id}
          model={model}
          section={section}
          sectionIndex={sectionIndex}
        />
      ))}

      <button className="admin-checklist-builder-add-section" type="button" onClick={addSection}>
        <Plus size={17} />
        {t('adminChecklists.addSection')}
      </button>
    </div>
  )
}

function AdminChecklistSectionCard({
  model,
  section,
  sectionIndex,
}: {
  model: AdminChecklistTemplatesPageModel
  section: DraftChecklistSection
  sectionIndex: number
}) {
  const { addItem, removeSection, t, updateSection } = model
  const sectionWeight = section.items.reduce((sum, item) => sum + item.weight, 0)

  return (
    <article className="admin-checklist-builder-section">
      <div className="admin-checklist-builder-section-head">
        <div className="admin-checklist-builder-section-title">
          <span>{sectionIndex + 1}</span>
          <input
            value={section.name}
            aria-label={t('adminChecklists.sectionNameAria')}
            onChange={(event) => updateSection(section.id, event.target.value)}
          />
        </div>
        <div className="admin-checklist-builder-section-actions">
          <strong>
            {t('adminChecklists.sectionWeight', {
              weight: formatWeight(sectionWeight),
            })}
          </strong>
          <button
            className="admin-checklist-builder-button secondary compact"
            type="button"
            onClick={() => addItem(section.id)}
          >
            <Plus size={15} />
            {t('adminChecklists.addItem')}
          </button>
          <button
            className="admin-checklist-builder-icon-button"
            type="button"
            aria-label={t('adminChecklists.removeSectionAria')}
            onClick={() => removeSection(section.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="admin-checklist-builder-items">
        {section.items.map((item, itemIndex) => (
          <AdminChecklistItemEditor
            key={item.id}
            item={item}
            itemIndex={itemIndex}
            model={model}
            sectionId={section.id}
          />
        ))}
      </div>
    </article>
  )
}

function AdminChecklistItemEditor({
  item,
  itemIndex,
  model,
  sectionId,
}: {
  item: DraftChecklistItem
  itemIndex: number
  model: AdminChecklistTemplatesPageModel
  sectionId: string
}) {
  const { removeItem, t, updateItem } = model

  return (
    <div className="admin-checklist-builder-item">
      <div className="admin-checklist-builder-item-no">{itemIndex + 1}</div>
      <div className="admin-checklist-builder-item-body">
        <div className="admin-checklist-builder-question-line">
          <input
            value={item.itemText}
            aria-label={t('adminChecklists.questionAria')}
            onChange={(event) => updateItem(sectionId, item.id, { itemText: event.target.value })}
          />
          <button
            className="admin-checklist-builder-icon-button"
            type="button"
            aria-label={t('adminChecklists.removeItemAria')}
            onClick={() => removeItem(sectionId, item.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <textarea
          value={item.note}
          aria-label={t('adminChecklists.itemNoteAria')}
          onChange={(event) => updateItem(sectionId, item.id, { note: event.target.value })}
        />
        <AdminChecklistItemSettings item={item} model={model} sectionId={sectionId} />
      </div>
    </div>
  )
}

function AdminChecklistItemSettings({
  item,
  model,
  sectionId,
}: {
  item: DraftChecklistItem
  model: AdminChecklistTemplatesPageModel
  sectionId: string
}) {
  const { responseTypeLabels, t, updateItem } = model

  return (
    <div className="admin-checklist-builder-item-settings">
      <label>
        <span>{t('adminChecklists.responseType')}</span>
        <select
          value={item.responseType}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              responseType: event.target.value as ChecklistTemplateResponseType,
            })
          }
        >
          {(Object.keys(responseTypeLabels) as ChecklistTemplateResponseType[]).map((responseType) => (
            <option key={responseType} value={responseType}>
              {responseTypeLabels[responseType]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t('adminChecklists.minScore')}</span>
        <input
          type="number"
          min={0}
          value={item.minScore}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              minScore: clampNumber(event.target.value, item.minScore),
            })
          }
        />
      </label>
      <label>
        <span>{t('adminChecklists.maxScore')}</span>
        <input
          type="number"
          min={1}
          value={item.maxScore}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              maxScore: clampNumber(event.target.value, item.maxScore),
            })
          }
        />
      </label>
      <label>
        <span>{t('adminChecklists.lowScoreThreshold')}</span>
        <input
          type="number"
          min={0}
          value={item.lowScoreThreshold}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              lowScoreThreshold: clampNumber(event.target.value, item.lowScoreThreshold),
            })
          }
        />
      </label>
      <label>
        <span>{t('adminChecklists.weight')}</span>
        <input
          type="number"
          min={0}
          max={100}
          value={item.weight}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
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
            updateItem(sectionId, item.id, {
              requiresLowScoreNote: event.target.checked,
            })
          }
        />
        <span>{t('adminChecklists.lowScoreNoteRequired')}</span>
      </label>
    </div>
  )
}

function resolveValidationMessage(
  companyId: string,
  weightIsReady: boolean,
  emptyTextCount: number,
  hasInvalidScore: boolean,
  t: TranslateFunction,
) {
  if (!companyId) return t('adminChecklists.validationMissingCompany')
  if (!weightIsReady) return t('adminChecklists.validationWeight')
  if (emptyTextCount > 0) return t('adminChecklists.validationEmptyText')
  if (hasInvalidScore) return t('adminChecklists.validationInvalidScore')

  return t('adminChecklists.validationDefault')
}
