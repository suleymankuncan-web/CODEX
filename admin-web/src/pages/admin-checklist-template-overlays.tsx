import type { ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { Textarea } from '../components/ui/textarea'
import type { ChecklistEvidencePolicy, ChecklistTemplateResponseType } from '../features/checklists/api'
import type { AdminChecklistTemplatesPageModel, DraftChecklistItem } from './AdminChecklistTemplatesPage'

type ModelProps = { model: AdminChecklistTemplatesPageModel }

export function ChecklistItemSettingsSheet({ model, sectionId, item, trigger }: ModelProps & {
  sectionId: string
  item: DraftChecklistItem
  trigger: ReactNode
}) {
  const { t } = model
  const update = (patch: Partial<DraftChecklistItem>) => model.updateItem(sectionId, item.id, patch)
  const evidencePolicy = item.evidencePolicy ?? 'none'
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="admin-checklist-sheet" closeLabel={t('adminChecklists.close')}>
        <SheetHeader><SheetTitle>{t('adminChecklists.itemSettings')}</SheetTitle><SheetDescription>{t('adminChecklists.settingsCopy')}</SheetDescription></SheetHeader>
        <div className="admin-checklist-overlay-body">
          <FieldGroup>
            <Field data-invalid={!item.itemText.trim()}><FieldLabel htmlFor={`${item.id}-question`}>{t('adminChecklists.questionAria')}</FieldLabel>
              <Textarea id={`${item.id}-question`} value={item.itemText} aria-invalid={!item.itemText.trim()} disabled={model.isSaving} onChange={(event) => update({ itemText: event.target.value })} />
            </Field>
            <Field><FieldLabel htmlFor={`${item.id}-note`}>{t('adminChecklists.itemNoteAria')}</FieldLabel>
              <Textarea id={`${item.id}-note`} value={item.note} disabled={model.isSaving} onChange={(event) => update({ note: event.target.value })} />
            </Field>
            <Field><FieldLabel htmlFor={`${item.id}-response`}>{t('adminChecklists.responseType')}</FieldLabel>
              <Select value={item.responseType} disabled={model.isSaving} onValueChange={(value) => update({ responseType: value as ChecklistTemplateResponseType })}>
                <SelectTrigger id={`${item.id}-response`} aria-label={t('adminChecklists.responseType')}><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{(Object.keys(model.responseTypeLabels) as ChecklistTemplateResponseType[]).map((type) => <SelectItem key={type} value={type}>{model.responseTypeLabels[type]}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <FieldGroup className="admin-checklist-score-fields">
              {([
                { key: 'minScore', label: t('adminChecklists.minScore'), min: 0 },
                { key: 'maxScore', label: t('adminChecklists.maxScore'), min: 1 },
                { key: 'lowScoreThreshold', label: t('adminChecklists.lowScoreThreshold'), min: 0 },
                { key: 'weight', label: t('adminChecklists.weight'), min: 0 },
              ] as const).map(({ key, label, min }) => <Field key={key} data-invalid={item[key] < min}>
                <FieldLabel htmlFor={`${item.id}-${key}`}>{label}</FieldLabel>
                <Input id={`${item.id}-${key}`} type="number" min={min} max={key === 'weight' ? 100 : undefined} value={item[key]} disabled={model.isSaving} aria-invalid={item[key] < min} onChange={(event) => update({ [key]: finiteNumber(event.target.value, item[key]) })} />
              </Field>)}
            </FieldGroup>
            <Field orientation="horizontal">
              <Checkbox id={`${item.id}-required-note`} checked={item.requiresLowScoreNote} disabled={model.isSaving} onCheckedChange={(checked) => update({ requiresLowScoreNote: checked === true })} />
              <FieldLabel htmlFor={`${item.id}-required-note`}>{t('adminChecklists.lowScoreNoteRequired')}</FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <Checkbox id={`${item.id}-remediation-task`} checked={item.createsRemediationTask} disabled={model.isSaving} onCheckedChange={(checked) => update({ createsRemediationTask: checked === true })} />
              <FieldLabel htmlFor={`${item.id}-remediation-task`}>{t('adminChecklists.createsRemediationTask')}</FieldLabel>
            </Field>
            <Field><FieldLabel htmlFor={`${item.id}-evidence`}>{t('adminChecklists.photoEvidence')}</FieldLabel>
              <Select value={evidencePolicy} disabled={model.isSaving} onValueChange={(value) => update({ evidencePolicy: value as ChecklistEvidencePolicy, maxEvidenceCount: value === 'none' ? 0 : Math.max(1, item.maxEvidenceCount ?? 1) })}>
                <SelectTrigger id={`${item.id}-evidence`} aria-label={t('adminChecklists.photoEvidence')}><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value="none">{t('adminChecklists.evidenceNone')}</SelectItem>
                  <SelectItem value="optional">{t('adminChecklists.evidenceOptional')}</SelectItem>
                  <SelectItem value="required">{t('adminChecklists.evidenceRequired')}</SelectItem>
                </SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field data-disabled={evidencePolicy === 'none'}><FieldLabel htmlFor={`${item.id}-evidence-count`}>{t('adminChecklists.evidenceLimit')}</FieldLabel>
              <Input id={`${item.id}-evidence-count`} type="number" min={1} max={10} disabled={model.isSaving || evidencePolicy === 'none'} value={item.maxEvidenceCount ?? (evidencePolicy === 'none' ? 0 : 1)} onChange={(event) => update({ maxEvidenceCount: Math.min(10, Math.max(1, finiteNumber(event.target.value, 1))) })} />
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter><SheetClose asChild><Button>{t('adminChecklists.done')}</Button></SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function ChecklistTemplatePreview({ model }: ModelProps) {
  const { t } = model
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><Eye data-icon="inline-start" />{t('adminChecklists.preview')}</Button></DialogTrigger>
      <DialogContent className="admin-checklist-preview" closeLabel={t('adminChecklists.close')}>
        <DialogHeader><DialogTitle>{t('adminChecklists.preview')}</DialogTitle><DialogDescription>{t('adminChecklists.previewCopy')}</DialogDescription></DialogHeader>
        <div className="admin-checklist-overlay-body">
          <div className="admin-checklist-preview-heading"><h2>{model.templateName}</h2><p>{model.selectedTemplate.label} · {t('adminChecklists.effectiveFrom')}: {model.effectiveFrom}</p></div>
          {model.sections.map((section) => <section key={section.id} className="admin-checklist-preview-section">
            <h3>{section.name}</h3>
            <ol>{section.items.map((item) => <li key={item.id}>
              <strong>{item.itemText}</strong>{item.note && <p>{item.note}</p>}
              <dl className="admin-checklist-preview-rules">
                <div><dt>{t('adminChecklists.responseType')}</dt><dd>{model.responseTypeLabels[item.responseType]}</dd></div>
                <div><dt>{t('adminChecklists.weight')}</dt><dd>%{item.weight}</dd></div>
                <div><dt>{t('adminChecklists.minScore')} / {t('adminChecklists.maxScore')}</dt><dd>{item.minScore} / {item.maxScore}</dd></div>
                <div><dt>{t('adminChecklists.lowScoreThreshold')}</dt><dd>{item.lowScoreThreshold}</dd></div>
                <div><dt>{t('adminChecklists.photoEvidence')}</dt><dd>{t(item.evidencePolicy === 'required' ? 'adminChecklists.evidenceRequired' : item.evidencePolicy === 'optional' ? 'adminChecklists.evidenceOptional' : 'adminChecklists.evidenceNone')}{item.evidencePolicy && item.evidencePolicy !== 'none' ? ` (${item.maxEvidenceCount ?? 1})` : ''}</dd></div>
                <div><dt>{t('adminChecklists.remediationTask')}</dt><dd>{t(item.createsRemediationTask ? 'adminChecklists.remediationTaskOn' : 'adminChecklists.remediationTaskOff')}</dd></div>
              </dl>
              {item.requiresLowScoreNote && <p>{t('adminChecklists.lowScoreNoteRequired')}</p>}
            </li>)}</ol>
          </section>)}
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">{t('adminChecklists.close')}</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function finiteNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
