import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { actionToast } from '../lib/action-toast'
import { getChecklistTemplateEffectiveDate } from './business-date-defaults'
import { AdminChecklistTemplatesExperience } from './AdminChecklistTemplateSurface'

export type DraftChecklistItem = {
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

export type DraftChecklistSection = {
  id: string
  name: string
  items: DraftChecklistItem[]
}

export type ChecklistTemplateType = 'BM_STORE_VISIT' | 'VM_STORE_VISIT'

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
const defaultTemplateOption = templateOptions[0] as TemplateOption
const vmTemplateOption = templateOptions[1] as TemplateOption

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
    name: 'Görsel Sunum',
    items: [
      {
        id: 'vm-item-window-concept',
        itemText: 'Vitrin konsepti VM standardına uygun mu?',
        note: 'Tema, renk akışı, manken kombinleri ve ilk görünür alan birlikte kontrol edilir.',
        responseType: 'score',
        minScore: 0,
        maxScore: 10,
        lowScoreThreshold: 7,
        weight: 30,
        requiresLowScoreNote: true,
      },
      {
        id: 'vm-item-mannequin-story',
        itemText: 'Manken hikayesi ve ürün anlatımı net mi?',
        note: 'Kombin bütünlüğü, aksesuar kullanımı ve fiyat/ürün görünürlüğü değerlendirilir.',
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
    name: 'Reyon Düzeni',
    items: [
      {
        id: 'vm-item-floor-flow',
        itemText: 'Reyon akışı ve ürün blokları okunabilir mi?',
        note: 'Kategori ayrımı, beden akışı ve eksik ürün görünürlüğü incelenir.',
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
        itemText: 'Tabela, POP ve kampanya materyalleri güncel mi?',
        note: 'Eski kampanya görseli, eksik etiket ve yanlış konumlanan POP notlanır.',
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

function createInitialDrafts(
  now: Date = new Date(),
): Record<ChecklistTemplateType, TemplateDraft> {
  const effectiveFrom = getChecklistTemplateEffectiveDate(now)
  return {
    BM_STORE_VISIT: {
      effectiveFrom,
      isDirty: true,
      savedTemplate: null,
      sections: cloneSections(initialSections),
      templateName: defaultTemplateOption.templateName,
    },
    VM_STORE_VISIT: {
      effectiveFrom,
      isDirty: true,
      savedTemplate: null,
      sections: cloneSections(vmInitialSections),
      templateName: vmTemplateOption.templateName,
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
  const selectedTemplate = templateOptions.find((option) => option.templateType === templateType) ?? defaultTemplateOption
  const [draftsByTemplate, setDraftsByTemplate] = useState<Record<ChecklistTemplateType, TemplateDraft>>(
    createInitialDrafts,
  )
  const currentDraft = draftsByTemplate[templateType]
  const { effectiveFrom, isDirty, savedTemplate, sections, templateName } = currentDraft

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
  const validationMessage = canSubmit
    ? t('adminChecklists.readyToPublish')
    : resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore, t)

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
  }

  const updateTemplateType = (nextType: ChecklistTemplateType) => {
    const nextTemplate = templateOptions.find((option) => option.templateType === nextType)
    if (!nextTemplate) return

    setTemplateType(nextType)
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
      actionToast.warning(t('adminChecklists.noticeMinSection'))
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
      actionToast.warning(t('adminChecklists.noticeMinItem'))
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
      actionToast.warning(resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore, t))
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
      actionToast.success('Taslak kaydedildi')
      return result.data.checklistTemplate
    } catch (error) {
      actionToast.error(error, 'Taslak kaydedilemedi.')
      return null
    }
  }

  const publishTemplate = async () => {
    if (!canSubmit) {
      actionToast.warning(resolveValidationMessage(companyId, weightIsReady, emptyTextCount, hasInvalidScore, t))
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
      actionToast.success('Yayınlandı')
    } catch (error) {
      actionToast.error(error, 'Yayınlanamadı.')
    }
  }

  return {
    addItem,
    addSection,
    canSubmit,
    companyId,
    currentDraft,
    emptyTextCount,
    effectiveFrom,
    hasInvalidScore,
    isSaving,
    itemCount,
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
    validationMessage,
    weightIsReady,
  }
}

export type AdminChecklistTemplatesPageModel = ReturnType<typeof useAdminChecklistTemplatesPageModel>

export function AdminChecklistTemplatesPage(input: { authSummary: AuthSessionSummary | null }) {
  const model = useAdminChecklistTemplatesPageModel(input)

  return <AdminChecklistTemplatesExperience model={model} />
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
