import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  Hash,
  ListChecks,
  Percent,
  Plus,
  Rocket,
  Save,
  Trash2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import type { ChecklistTemplateResponseType } from '../features/checklists/api'
import { cn } from '../lib/utils'
import {
  AdminActionRow,
  AdminFilterBar,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceSection,
} from './admin-surface-primitives'
import {
  AdminOperationalHeader,
  AdminOperationalMetrics,
  AdminOperationalPage,
} from './admin-operational-primitives'
import type {
  AdminChecklistTemplatesPageModel,
  ChecklistTemplateType,
  DraftChecklistItem,
  DraftChecklistSection,
} from './AdminChecklistTemplatesPage'

const wholeWeightFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
})

const fractionalWeightFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

export function AdminChecklistTemplatesExperience({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  return (
    <AdminOperationalPage ariaLabel={model.t('adminChecklists.editorAria')}>
      <AdminChecklistTemplatesHero model={model} />
      <AdminChecklistTemplatesEditorPanel model={model} />
    </AdminOperationalPage>
  )
}

function AdminChecklistTemplatesHero({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const {
    addSection,
    canSubmit,
    companyId,
    currentDraft,
    isSaving,
    itemCount,
    publishTemplate,
    saveDraft,
    sectionCount,
    selectedTemplate,
    t,
    totalWeight,
    weightIsReady,
  } = model
  const weightPercent = Math.max(0, Math.min(100, totalWeight))
  const savedLabel = currentDraft.savedTemplate
    ? t('adminChecklists.savedStatus', {
        version: currentDraft.savedTemplate.versionNo ?? '-',
        status: currentDraft.savedTemplate.status,
      })
    : t('adminChecklists.newDraft')

  return (
    <>
      <AdminOperationalHeader
        icon={<ClipboardList size={20} />}
        eyebrow={t('adminChecklists.heroEyebrow')}
        title={t('adminChecklists.heroTitle')}
        description={t('adminChecklists.heroCopy')}
        meta={
          <>
            <AdminSurfaceBadge tone={currentDraft.isDirty ? 'warning' : 'success'}>
              {savedLabel}
            </AdminSurfaceBadge>
            {!companyId ? (
              <AdminSurfaceBadge tone="danger">{t('adminChecklists.missingCompanyScope')}</AdminSurfaceBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" type="button" onClick={addSection}>
              <Plus size={16} />
              {t('adminChecklists.addSection')}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving || !canSubmit}
            >
              <Save size={16} />
              {t('adminChecklists.saveDraft')}
            </Button>
            <Button
              type="button"
              onClick={() => void publishTemplate()}
              disabled={isSaving || !canSubmit}
            >
              <Rocket size={16} />
              {t('adminChecklists.publish')}
            </Button>
          </>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'weight',
            label: t('adminChecklists.totalWeight', { total: formatWeight(totalWeight) }),
            value: `%${formatWeight(weightPercent)}`,
            icon: <Percent size={18} />,
            tone: weightIsReady ? 'success' : 'warning',
          },
          {
            id: 'sections',
            label: t('adminChecklists.sectionCount', { count: sectionCount }),
            value: sectionCount,
            icon: <ListChecks size={18} />,
            tone: 'accent',
          },
          {
            id: 'items',
            label: t('adminChecklists.itemCount', { count: itemCount }),
            value: itemCount,
            icon: <FileText size={18} />,
            tone: 'cyan',
          },
          {
            id: 'template',
            label: selectedTemplate.label,
            value: selectedTemplate.templateType.replace('_STORE_VISIT', ''),
            description: selectedTemplate.templateCode,
            icon: <Hash size={18} />,
            tone: 'neutral',
          },
        ]}
      />
    </>
  )
}

function AdminChecklistTemplatesEditorPanel({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { t } = model

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminChecklists.editorAria')}
      title={t('adminChecklists.editorAria')}
      actions={
        <Button variant="outline" size="sm" type="button" onClick={model.addSection}>
          <Plus size={15} />
          {t('adminChecklists.addSection')}
        </Button>
      }
      testId="checklist-template-editor"
    >
      <AdminChecklistTemplateStrip model={model} />
      <AdminChecklistPublishGate model={model} />
      <AdminChecklistNotice model={model} />
      <AdminChecklistSectionsList model={model} />
    </AdminSurfaceSection>
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
    <AdminFilterBar className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-3 tw:md:grid-cols-[minmax(220px,1.2fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)_minmax(180px,0.8fr)]">
      <FieldShell label={t('adminChecklists.templateName')}>
        <Input
          aria-label={t('adminChecklists.templateName')}
          value={templateName}
          onChange={(event) => {
            updateCurrentDraftFields({ templateName: event.target.value })
          }}
        />
      </FieldShell>
      <FieldShell label={t('adminChecklists.checklistType')}>
        <Select
          value={templateType}
          onValueChange={(value) => updateTemplateType(value as ChecklistTemplateType)}
        >
          <SelectTrigger aria-label={t('adminChecklists.checklistType')} className="tw:w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templateOptions.map((option) => (
              <SelectItem key={option.templateType} value={option.templateType}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
      <FieldShell label={t('adminChecklists.effectiveFrom')}>
        <Input
          aria-label={t('adminChecklists.effectiveFrom')}
          type="date"
          value={effectiveFrom}
          onChange={(event) => {
            updateCurrentDraftFields({ effectiveFrom: event.target.value })
          }}
        />
      </FieldShell>
      <AdminKeyValueGrid className="tw:sm:grid-cols-1 tw:lg:grid-cols-1">
        <AdminKeyValue label={t('adminChecklists.templateCode')} value={selectedTemplate.templateCode} />
      </AdminKeyValueGrid>
    </AdminFilterBar>
  )
}

function AdminChecklistPublishGate({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const {
    canSubmit,
    emptyTextCount,
    hasInvalidScore,
    itemCount,
    sectionCount,
    t,
    validationMessage,
  } = model
  const Icon = canSubmit ? CheckCircle2 : AlertTriangle

  return (
    <div className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-3 tw:md:grid-cols-[minmax(0,1fr)_auto] tw:md:items-center">
      <div className="tw:flex tw:min-w-0 tw:items-start tw:gap-3">
        <span className={cn(
          'tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-lg',
          canSubmit ? 'tw:bg-emerald-50 tw:text-emerald-700' : 'tw:bg-amber-50 tw:text-amber-700',
        )}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="tw:min-w-0">
          <p className="tw:m-0 tw:text-xs tw:font-medium tw:text-muted-foreground">
            {t('adminChecklists.publishGate')}
          </p>
          <p className="tw:m-0 tw:mt-1 tw:text-sm tw:font-medium tw:text-foreground">{validationMessage}</p>
        </div>
      </div>
      <AdminKeyValueGrid className="tw:grid-cols-3 tw:md:min-w-96">
        <AdminKeyValue label={t('adminChecklists.sectionCount', { count: sectionCount })} value={sectionCount} />
        <AdminKeyValue label={t('adminChecklists.itemCount', { count: itemCount })} value={itemCount} />
        <AdminKeyValue
          label={hasInvalidScore ? t('adminChecklists.scoreGuard') : t('adminChecklists.blockingFields')}
          value={hasInvalidScore ? t('adminChecklists.invalidScores') : emptyTextCount}
        />
      </AdminKeyValueGrid>
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

  return <AdminStatePanel title={notice.message} tone={notice.tone} />
}

function AdminChecklistSectionsList({
  model,
}: {
  model: AdminChecklistTemplatesPageModel
}) {
  const { addSection, sections, t } = model

  return (
    <div className="tw:grid tw:gap-3">
      {sections.map((section, sectionIndex) => (
        <AdminChecklistSectionCard
          key={section.id}
          model={model}
          section={section}
          sectionIndex={sectionIndex}
        />
      ))}

      <Button variant="outline" type="button" onClick={addSection} className="tw:w-full">
        <Plus size={17} />
        {t('adminChecklists.addSection')}
      </Button>
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
    <Card className="tw:border tw:border-border tw:bg-background/75 tw:shadow-sm" data-testid="checklist-section-card">
      <CardHeader className="tw:border-b tw:border-border/70 tw:pb-3">
        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-sm tw:font-medium tw:text-primary">
              {sectionIndex + 1}
            </span>
            <Input
              value={section.name}
              aria-label={t('adminChecklists.sectionNameAria')}
              className="tw:text-base tw:font-medium"
              onChange={(event) => updateSection(section.id, event.target.value)}
            />
          </div>
          <AdminActionRow className="tw:lg:justify-end">
            <AdminSurfaceBadge tone={Math.round(sectionWeight * 100) === 10_000 ? 'success' : 'neutral'}>
              {t('adminChecklists.sectionWeight', {
                weight: formatWeight(sectionWeight),
              })}
            </AdminSurfaceBadge>
            <Button variant="outline" size="sm" type="button" onClick={() => addItem(section.id)}>
              <Plus size={15} />
              {t('adminChecklists.addItem')}
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              type="button"
              aria-label={t('adminChecklists.removeSectionAria')}
              onClick={() => removeSection(section.id)}
            >
              <Trash2 size={16} />
            </Button>
          </AdminActionRow>
        </div>
      </CardHeader>
      <CardContent className="tw:grid tw:gap-3">
        {section.items.map((item, itemIndex) => (
          <AdminChecklistItemEditor
            key={item.id}
            item={item}
            itemIndex={itemIndex}
            model={model}
            sectionId={section.id}
          />
        ))}
      </CardContent>
    </Card>
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
    <div
      className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border/80 tw:bg-card/80 tw:p-3"
      data-testid="checklist-item-editor"
    >
      <div className="tw:grid tw:gap-3 tw:xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <div className="tw:grid tw:grid-cols-[2rem_minmax(0,1fr)] tw:gap-3">
          <div className="tw:grid tw:size-8 tw:place-items-center tw:rounded-lg tw:bg-muted tw:text-sm tw:font-medium tw:text-muted-foreground">
            {itemIndex + 1}
          </div>
          <div className="tw:grid tw:min-w-0 tw:gap-2">
            <div className="tw:grid tw:grid-cols-[minmax(0,1fr)_auto] tw:gap-2">
              <Input
                value={item.itemText}
                aria-label={t('adminChecklists.questionAria')}
                data-testid="checklist-question-input"
                onChange={(event) => updateItem(sectionId, item.id, { itemText: event.target.value })}
              />
              <Button
                variant="destructive"
                size="icon-sm"
                type="button"
                aria-label={t('adminChecklists.removeItemAria')}
                onClick={() => removeItem(sectionId, item.id)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <Textarea
              value={item.note}
              aria-label={t('adminChecklists.itemNoteAria')}
              className="tw:min-h-14"
              onChange={(event) => updateItem(sectionId, item.id, { note: event.target.value })}
            />
          </div>
        </div>
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
    <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:md:grid-cols-[1.1fr_repeat(4,0.72fr)]">
      <FieldShell className="tw:col-span-2 tw:md:col-span-1" label={t('adminChecklists.responseType')}>
        <Select
          value={item.responseType}
          onValueChange={(value) =>
            updateItem(sectionId, item.id, {
              responseType: value as ChecklistTemplateResponseType,
            })
          }
        >
          <SelectTrigger aria-label={t('adminChecklists.responseType')} className="tw:w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(responseTypeLabels) as ChecklistTemplateResponseType[]).map((responseType) => (
              <SelectItem key={responseType} value={responseType}>
                {responseTypeLabels[responseType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
      <FieldShell label={t('adminChecklists.minScore')}>
        <Input
          aria-label={t('adminChecklists.minScore')}
          type="number"
          min={0}
          value={item.minScore}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              minScore: clampNumber(event.target.value, item.minScore),
            })
          }
        />
      </FieldShell>
      <FieldShell label={t('adminChecklists.maxScore')}>
        <Input
          aria-label={t('adminChecklists.maxScore')}
          type="number"
          min={1}
          value={item.maxScore}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              maxScore: clampNumber(event.target.value, item.maxScore),
            })
          }
        />
      </FieldShell>
      <FieldShell label={t('adminChecklists.lowScoreThreshold')}>
        <Input
          aria-label={t('adminChecklists.lowScoreThreshold')}
          type="number"
          min={0}
          value={item.lowScoreThreshold}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              lowScoreThreshold: clampNumber(event.target.value, item.lowScoreThreshold),
            })
          }
        />
      </FieldShell>
      <FieldShell label={t('adminChecklists.weight')}>
        <Input
          aria-label={t('adminChecklists.weight')}
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
      </FieldShell>
      <label className="tw:col-span-2 tw:flex tw:min-h-10 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:px-3 tw:py-2 tw:text-sm tw:text-foreground tw:md:col-span-5">
        <input
          type="checkbox"
          checked={item.requiresLowScoreNote}
          onChange={(event) =>
            updateItem(sectionId, item.id, {
              requiresLowScoreNote: event.target.checked,
            })
          }
        />
        <span className="tw:leading-5">{t('adminChecklists.lowScoreNoteRequired')}</span>
      </label>
    </div>
  )
}

function FieldShell({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: ReactNode
}) {
  return (
    <label className={cn('tw:grid tw:gap-1.5 tw:text-xs tw:font-medium tw:text-muted-foreground', className)}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function clampNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatWeight(value: number) {
  return (value % 1 === 0 ? wholeWeightFormatter : fractionalWeightFormatter).format(value)
}
