import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, FileText, ListChecks, Percent, Plus, Rocket, Save, Search, Settings2, Trash2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Spinner } from '../components/ui/spinner'
import { AdminSurfacePage } from './admin-surface-primitives'
import { AdminAzureHeader } from './admin-azure-header'
import { ChecklistItemSettingsSheet, ChecklistTemplatePreview } from './admin-checklist-template-overlays'
import type { AdminChecklistTemplatesPageModel, ChecklistTemplateType, DraftChecklistSection } from './AdminChecklistTemplatesPage'
import './admin-checklist-templates.css'

type ModelProps = { model: AdminChecklistTemplatesPageModel }

export function AdminChecklistTemplatesExperience({ model }: ModelProps) {
  const [search, setSearch] = useState('')
  const { t } = model
  const query = search.trim().toLocaleLowerCase('tr-TR')
  const visibleSections = model.sections.filter((section) => matchesSection(section, query))
  const stateLabel = model.currentDraft.isDirty
    ? t('adminChecklists.unsavedChanges')
    : model.savedTemplate?.status === 'published' || model.savedTemplate?.status === 'active'
      ? t('adminChecklists.published') : t('adminChecklists.savedDraft')

  return (
    <AdminSurfacePage ariaLabel={t('adminChecklists.editorAria')} className="admin-checklist-templates">
      <AdminAzureHeader
        title={t('adminChecklists.heroTitle')}
        icon={<ClipboardList aria-hidden="true" />}
        description={t('adminChecklists.workspaceCopy')}
        actions={<>
          <ChecklistTemplatePreview model={model} />
          <Button variant="outline" onClick={() => void model.saveDraft()} disabled={model.isSaving || !model.canSubmit}>
            <Save data-icon="inline-start" />{t('adminChecklists.saveDraft')}
          </Button>
          <Button onClick={() => void model.publishTemplate()} disabled={model.isSaving || !model.canSubmit} aria-busy={model.isSaving}>
            {model.isSaving ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Rocket data-icon="inline-start" />}
            {t('adminChecklists.publish')}
          </Button>
        </>}
      />
      <div className="admin-checklist-summary" aria-label={t('adminChecklists.summary')}>
        {[
          { icon: Percent, label: t('adminChecklists.totalWeight', { total: formatWeight(model.totalWeight) }), value: `${formatWeight(model.totalWeight)} / 100` },
          { icon: ListChecks, label: t('adminChecklists.sectionsLabel'), value: model.sectionCount },
          { icon: FileText, label: t('adminChecklists.itemsLabel'), value: model.itemCount },
          { icon: Save, label: model.savedTemplate ? t('adminChecklists.versionLabel', { version: model.savedTemplate.versionNo ?? '—' }) : t('adminChecklists.newDraft'), value: stateLabel },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="admin-checklist-summary-item">
            <span><Icon aria-hidden="true" />{label}</span><strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-checklist-workspace" data-testid="checklist-template-editor" aria-busy={model.isSaving}>
        <TemplateConfiguration model={model} onTemplateChange={() => setSearch('')} />
        <div className="admin-checklist-toolbar">
          <div><h2>{t('adminChecklists.sectionsLabel')}</h2><span>{t('adminChecklists.itemCount', { count: model.itemCount })}</span></div>
          <InputGroup>
            <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
            <InputGroupInput aria-label={t('adminChecklists.search')} placeholder={t('adminChecklists.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
          </InputGroup>
          <Button variant="outline" onClick={() => { setSearch(''); model.addSection() }} disabled={model.isSaving}><Plus data-icon="inline-start" />{t('adminChecklists.addSection')}</Button>
        </div>
        <div className="admin-checklist-sections">
          {visibleSections.map((section) => (
            <ChecklistSection key={section.id} model={model} section={section} query={query} clearSearch={() => setSearch('')} />
          ))}
          {visibleSections.length === 0 && <Empty>
            <EmptyHeader><EmptyTitle>{t('adminChecklists.noResults')}</EmptyTitle><EmptyDescription>{t('adminChecklists.noResultsCopy')}</EmptyDescription></EmptyHeader>
            <Button variant="outline" onClick={() => setSearch('')}>{t('adminChecklists.clearSearch')}</Button>
          </Empty>}
        </div>
        <div className="admin-checklist-validation">
          <Alert variant={model.canSubmit ? 'default' : 'destructive'} role="status">
            {model.canSubmit ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
            <AlertTitle>{t('adminChecklists.publishGate')}</AlertTitle>
            <AlertDescription>{model.validationMessage}</AlertDescription>
          </Alert>
        </div>
      </div>
    </AdminSurfacePage>
  )
}

function TemplateConfiguration({ model, onTemplateChange }: ModelProps & { onTemplateChange: () => void }) {
  const { t } = model
  return (
    <FieldGroup className="admin-checklist-configuration">
      <Field><FieldLabel htmlFor="checklist-template-type">{t('adminChecklists.checklistType')}</FieldLabel>
        <Select value={model.templateType} disabled={model.isSaving} onValueChange={(value) => { model.updateTemplateType(value as ChecklistTemplateType); onTemplateChange() }}>
          <SelectTrigger id="checklist-template-type" aria-label={t('adminChecklists.checklistType')}><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{model.templateOptions.map((option) => <SelectItem key={option.templateType} value={option.templateType}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </Field>
      <Field><FieldLabel htmlFor="checklist-template-name">{t('adminChecklists.templateName')}</FieldLabel>
        <Input id="checklist-template-name" value={model.templateName} disabled={model.isSaving} onChange={(event) => model.updateCurrentDraftFields({ templateName: event.target.value })} />
      </Field>
      <Field><FieldLabel htmlFor="checklist-template-date">{t('adminChecklists.effectiveFrom')}</FieldLabel>
        <Input id="checklist-template-date" aria-label={t('adminChecklists.effectiveFrom')} type="date" value={model.effectiveFrom} disabled={model.isSaving} onChange={(event) => model.updateCurrentDraftFields({ effectiveFrom: event.target.value })} />
      </Field>
    </FieldGroup>
  )
}

function ChecklistSection({ model, section, query, clearSearch }: ModelProps & { section: DraftChecklistSection; query: string; clearSearch: () => void }) {
  const { t } = model
  const sectionIndex = model.sections.findIndex((entry) => entry.id === section.id)
  const sectionMatches = section.name.toLocaleLowerCase('tr-TR').includes(query)
  const items = section.items.filter((item) => sectionMatches || `${item.itemText} ${item.note}`.toLocaleLowerCase('tr-TR').includes(query))
  return (
    <Card className="admin-checklist-section" data-testid="checklist-section-card">
      <CardHeader className="admin-checklist-section-header">
        <CardTitle className="tw:sr-only">{section.name || t('adminChecklists.sectionNameAria')}</CardTitle>
        <span className="admin-checklist-section-number" aria-hidden="true">{sectionIndex + 1}</span>
        <Input aria-label={t('adminChecklists.sectionNameAria')} value={section.name} disabled={model.isSaving} aria-invalid={!section.name.trim()} onChange={(event) => model.updateSection(section.id, event.target.value)} />
        <Badge variant="outline">{t('adminChecklists.sectionWeight', { weight: formatWeight(section.items.reduce((total, item) => total + item.weight, 0)) })}</Badge>
        <div className="admin-checklist-row-actions">
          <Button variant="ghost" size="sm" disabled={model.isSaving} onClick={() => { clearSearch(); model.addItem(section.id) }}><Plus data-icon="inline-start" />{t('adminChecklists.addItem')}</Button>
          <Button variant="ghost" size="icon-sm" disabled={model.isSaving || model.sectionCount <= 1} aria-label={t('adminChecklists.removeSectionAria')} onClick={() => model.removeSection(section.id)}><Trash2 data-icon="inline-start" /></Button>
        </div>
      </CardHeader>
      <CardContent className="admin-checklist-section-content">
        {items.map((item) => <div key={item.id} className="admin-checklist-item" data-testid="checklist-item-editor">
          <span className="admin-checklist-item-number" aria-hidden="true">{sectionIndex + 1}.{section.items.indexOf(item) + 1}</span>
          <div className="admin-checklist-item-copy">
            <Input value={item.itemText} aria-label={t('adminChecklists.questionAria')} data-testid="checklist-question-input" aria-invalid={!item.itemText.trim()} disabled={model.isSaving} onChange={(event) => model.updateItem(section.id, item.id, { itemText: event.target.value })} />
            <p>{item.note}</p>
          </div>
          <div className="admin-checklist-item-meta"><span>{model.responseTypeLabels[item.responseType]}</span><strong>%{formatWeight(item.weight)}</strong></div>
          <div className="admin-checklist-row-actions">
            <ChecklistItemSettingsSheet model={model} sectionId={section.id} item={item} trigger={<Button variant="outline" size="sm" disabled={model.isSaving} aria-label={`${t('adminChecklists.itemSettings')}: ${item.itemText}`}><Settings2 data-icon="inline-start" />{t('adminChecklists.settings')}</Button>} />
            <Button variant="ghost" size="icon-sm" disabled={model.isSaving || section.items.length <= 1} aria-label={t('adminChecklists.removeItemAria')} onClick={() => model.removeItem(section.id, item.id)}><Trash2 data-icon="inline-start" /></Button>
          </div>
        </div>)}
      </CardContent>
    </Card>
  )
}

function matchesSection(section: DraftChecklistSection, query: string) {
  return `${section.name} ${section.items.map((item) => `${item.itemText} ${item.note}`).join(' ')}`.toLocaleLowerCase('tr-TR').includes(query)
}

function formatWeight(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value)
}
