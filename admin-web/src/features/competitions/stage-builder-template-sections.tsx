import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import type { AuthLookupStore } from '../auth/api'
import type {
  CloneCompetitionTeamTemplatePayload,
  CompetitionTeamTemplate,
  UpdateCompetitionTeamTemplatePayload,
} from './api'
import { getErrorMessage } from '../../lib/format'
import type { TranslationKey } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'
import { formatCount } from './display'
import {
  CompetitionActionRow,
  CompetitionButton,
  CompetitionCheckbox,
  CompetitionCheckboxGrid,
  CompetitionEmptyState,
  CompetitionFieldGrid,
  CompetitionInlineNotice,
  CompetitionKeyValue,
  CompetitionKeyValueGrid,
  CompetitionRow,
  CompetitionRowHeader,
  CompetitionRowList,
  CompetitionStatusBadge,
  CompetitionTextField,
  CompetitionStatePanel,
} from './competition-admin-surface-primitives'
import {
  createTemplateCloneDraft,
  createTemplateEditDraft,
  normalizeCode,
  storeLabel,
  validateTemplateCloneDraft,
  validateTemplateDraft,
  type TemplateCloneDraft,
  type TemplateDraft,
  type TemplateEditDraft,
} from './stage-builder-model'

export function TemplateLibrarySection(input: {
  error: unknown
  feedback: string | null
  isLoading: boolean
  isPending: boolean
  showInactive: boolean
  stores: AuthLookupStore[]
  templates: CompetitionTeamTemplate[]
  onClone: (templateId: string, payload: CloneCompetitionTeamTemplatePayload) => void
  onDeactivate: (templateId: string) => void
  onShowInactiveChange: (value: boolean) => void
  onUpdate: (templateId: string, payload: UpdateCompetitionTeamTemplatePayload) => void
}) {
  const { t } = useLocalization()
  const [editDraft, setEditDraft] = useState<TemplateEditDraft | null>(null)
  const [cloneDraft, setCloneDraft] = useState<TemplateCloneDraft | null>(null)
  const editValidationMessage = editDraft ? validateTemplateDraft(editDraft) : null
  const cloneValidationMessage = cloneDraft ? validateTemplateCloneDraft(cloneDraft) : null

  function updateEditDraft(field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) {
    setEditDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function toggleEditStore(storeId: string) {
    setEditDraft((current) => {
      if (!current) return current

      return {
        ...current,
        storeIds: current.storeIds.includes(storeId)
          ? current.storeIds.filter((currentStoreId) => currentStoreId !== storeId)
          : [...current.storeIds, storeId],
      }
    })
  }

  function submitEditDraft() {
    if (!editDraft || validateTemplateDraft(editDraft)) return
    const description = editDraft.description.trim()

    input.onUpdate(editDraft.templateId, {
      templateCode: editDraft.templateCode.trim(),
      templateName: editDraft.templateName.trim(),
      ...(description ? { description } : {}),
      storeIds: editDraft.storeIds,
    })
    setEditDraft(null)
  }

  function updateCloneDraft(field: keyof Omit<TemplateCloneDraft, 'sourceTemplateId'>, value: string) {
    setCloneDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function submitCloneDraft() {
    if (!cloneDraft || validateTemplateCloneDraft(cloneDraft)) return
    const description = cloneDraft.description.trim()

    input.onClone(cloneDraft.sourceTemplateId, {
      templateCode: cloneDraft.templateCode.trim(),
      templateName: cloneDraft.templateName.trim(),
      ...(description ? { description } : {}),
    })
    setCloneDraft(null)
  }

  return (
    <CompetitionRow className="stage-template-library">
      <CompetitionRowHeader
        title={t('competition.stageBuilder.templateLibraryTitle')}
        description={t('competition.stageBuilder.templateLibraryCopy')}
        badge={
          <CompetitionStatusBadge tone={input.showInactive ? 'accent' : 'neutral'}>
            {input.showInactive ? t('competition.stageBuilder.allTemplates') : t('competition.stageBuilder.activeOnly')}
          </CompetitionStatusBadge>
        }
      />
      <CompetitionCheckbox
        checked={input.showInactive}
        label={t('competition.stageBuilder.showInactiveTemplates')}
        onChange={(event) => input.onShowInactiveChange(event.target.checked)}
      />

      {input.isLoading ? (
        <CompetitionStatePanel
          title={t('competition.stageBuilder.templatesLoadingTitle')}
          copy={t('competition.stageBuilder.templatesLoadingCopy')}
          isLoading
        />
      ) : null}

      {!input.isLoading && input.templates.length === 0 ? (
        <CompetitionEmptyState
          title={t('competition.stageBuilder.noTemplatesTitle')}
          copy={t('competition.stageBuilder.noTemplatesCopy')}
        />
      ) : null}

      {input.templates.length > 0 ? (
        <CompetitionRowList>
          {input.templates.map((template) => (
            <CompetitionRow key={template.templateId}>
              <CompetitionRowHeader
                title={template.templateCode}
                description={template.templateName}
                badge={
                  <CompetitionStatusBadge tone={template.isActive ? 'calm' : 'neutral'}>
                  {template.isActive ? t('competition.stageBuilder.active') : t('competition.stageBuilder.inactive')}
                  </CompetitionStatusBadge>
                }
              />
              <CompetitionKeyValueGrid>
                <CompetitionKeyValue label={t('competition.stageBuilder.stores')} value={String(template.stores.length)} />
                <CompetitionKeyValue label={t('competition.stageBuilder.description')} value={template.description ?? '-'} />
              </CompetitionKeyValueGrid>

              {editDraft?.templateId === template.templateId ? (
                <CompetitionRow>
                  <CompetitionFieldGrid>
                    <CompetitionTextField
                      label={t('competition.stageBuilder.editTemplateCode')}
                      value={editDraft.templateCode}
                      onChange={(event) =>
                        updateEditDraft('templateCode', normalizeCode(event.target.value))
                      }
                    />
                    <CompetitionTextField
                      label={t('competition.stageBuilder.editTemplateName')}
                      value={editDraft.templateName}
                      onChange={(event) => updateEditDraft('templateName', event.target.value)}
                    />
                    <CompetitionTextField
                      label={t('competition.stageBuilder.editTemplateDescription')}
                      value={editDraft.description}
                      onChange={(event) => updateEditDraft('description', event.target.value)}
                    />
                  </CompetitionFieldGrid>
                  <CompetitionCheckboxGrid>
                    {input.stores.map((store) => (
                      <CompetitionCheckbox
                        key={`edit-${template.templateId}-${store.storeId}`}
                        checked={editDraft.storeIds.includes(store.storeId)}
                        label={storeLabel(store)}
                        onChange={() => toggleEditStore(store.storeId)}
                      />
                    ))}
                  </CompetitionCheckboxGrid>
                  {editValidationMessage ? (
                    <CompetitionInlineNotice tone="warning">{t(editValidationMessage)}</CompetitionInlineNotice>
                  ) : null}
                  <CompetitionActionRow>
                    <CompetitionButton
                      type="button"
                      disabled={Boolean(editValidationMessage) || input.isPending}
                      onClick={submitEditDraft}
                    >
                      {t('competition.stageBuilder.saveTemplate')}
                    </CompetitionButton>
                    <CompetitionButton
                      variant="outline"
                      type="button"
                      onClick={() => setEditDraft(null)}
                    >
                      {t('competition.stageBuilder.cancelEdit')}
                    </CompetitionButton>
                  </CompetitionActionRow>
                </CompetitionRow>
              ) : null}

              {cloneDraft?.sourceTemplateId === template.templateId ? (
                <CompetitionRow>
                  <CompetitionFieldGrid>
                    <CompetitionTextField
                      label={t('competition.stageBuilder.cloneTemplateCode')}
                      value={cloneDraft.templateCode}
                      onChange={(event) =>
                        updateCloneDraft('templateCode', normalizeCode(event.target.value))
                      }
                    />
                    <CompetitionTextField
                      label={t('competition.stageBuilder.cloneTemplateName')}
                      value={cloneDraft.templateName}
                      onChange={(event) => updateCloneDraft('templateName', event.target.value)}
                    />
                    <CompetitionTextField
                      label={t('competition.stageBuilder.cloneTemplateDescription')}
                      value={cloneDraft.description}
                      onChange={(event) => updateCloneDraft('description', event.target.value)}
                    />
                  </CompetitionFieldGrid>
                  {cloneValidationMessage ? (
                    <CompetitionInlineNotice tone="warning">{t(cloneValidationMessage)}</CompetitionInlineNotice>
                  ) : null}
                  <CompetitionActionRow>
                    <CompetitionButton
                      type="button"
                      disabled={Boolean(cloneValidationMessage) || input.isPending}
                      onClick={submitCloneDraft}
                    >
                      {t('competition.stageBuilder.cloneTemplate')}
                    </CompetitionButton>
                    <CompetitionButton
                      variant="outline"
                      type="button"
                      onClick={() => setCloneDraft(null)}
                    >
                      {t('competition.stageBuilder.cancelClone')}
                    </CompetitionButton>
                  </CompetitionActionRow>
                </CompetitionRow>
              ) : null}

              <CompetitionActionRow>
                <CompetitionButton
                  variant="outline"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setCloneDraft(null)
                    setEditDraft(createTemplateEditDraft(template))
                  }}
                >
                  {t('competition.stageBuilder.editTemplateButton', { templateCode: template.templateCode })}
                </CompetitionButton>
                <CompetitionButton
                  variant="outline"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setEditDraft(null)
                    setCloneDraft(createTemplateCloneDraft(template))
                  }}
                >
                  {t('competition.stageBuilder.cloneTemplateButton', { templateCode: template.templateCode })}
                </CompetitionButton>
                {template.isActive ? (
                  <CompetitionButton
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onDeactivate(template.templateId)}
                  >
                    {t('competition.stageBuilder.deactivateTemplateButton', { templateCode: template.templateCode })}
                  </CompetitionButton>
                ) : null}
              </CompetitionActionRow>
            </CompetitionRow>
          ))}
        </CompetitionRowList>
      ) : null}

      {input.feedback ? (
        <CompetitionStatePanel title={input.feedback} copy={t('competition.stageBuilder.templateLibraryRefreshCopy')} />
      ) : null}

      {input.error ? (
        <CompetitionStatePanel
          title={t('competition.stageBuilder.templateLibraryActionFailedTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </CompetitionRow>
  )
}

export function TemplateBuilderSection(input: {
  draft: TemplateDraft
  error: unknown
  feedback: string | null
  isPending: boolean
  stores: AuthLookupStore[]
  validationMessage: TranslationKey | null
  onSubmit: () => void
  onToggleStore: (storeId: string) => void
  onUpdate: (field: keyof Omit<TemplateDraft, 'storeIds'>, value: string) => void
}) {
  const { t } = useLocalization()

  return (
    <CompetitionRow className="stage-template-builder">
      <CompetitionRowHeader
        title={t('competition.stageBuilder.teamTemplateTitle')}
        description={t('competition.stageBuilder.teamTemplateCopy')}
        badge={
          <CompetitionStatusBadge tone={input.draft.storeIds.length > 0 ? 'accent' : 'warning'}>
          {formatCount(
            input.draft.storeIds.length,
            'competition.stageBuilder.count.store',
            'competition.stageBuilder.count.stores',
            t,
          )}
          </CompetitionStatusBadge>
        }
      />
      <CompetitionFieldGrid>
        <CompetitionTextField
          label={t('competition.stageBuilder.templateCode')}
          value={input.draft.templateCode}
          onChange={(event) => input.onUpdate('templateCode', normalizeCode(event.target.value))}
        />
        <CompetitionTextField
          label={t('competition.stageBuilder.templateName')}
          value={input.draft.templateName}
          onChange={(event) => input.onUpdate('templateName', event.target.value)}
        />
        <CompetitionTextField
          label={t('competition.stageBuilder.templateDescription')}
          value={input.draft.description}
          onChange={(event) => input.onUpdate('description', event.target.value)}
        />
      </CompetitionFieldGrid>
      <CompetitionCheckboxGrid>
        {input.stores.map((store) => (
          <CompetitionCheckbox
            key={`template-${store.storeId}`}
            checked={input.draft.storeIds.includes(store.storeId)}
            label={storeLabel(store)}
            onChange={() => input.onToggleStore(store.storeId)}
          />
        ))}
      </CompetitionCheckboxGrid>
      {input.validationMessage ? (
        <CompetitionInlineNotice tone="warning">{t(input.validationMessage)}</CompetitionInlineNotice>
      ) : null}
      <CompetitionActionRow>
        <CompetitionButton
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending || input.stores.length === 0}
          onClick={input.onSubmit}
        >
          <PlusCircle data-icon="inline-start" />
          {t('competition.stageBuilder.createTemplate')}
        </CompetitionButton>
      </CompetitionActionRow>
      {input.feedback ? <CompetitionStatePanel title={input.feedback} copy={t('competition.stageBuilder.templateListRefreshCopy')} /> : null}
      {input.error ? (
        <CompetitionStatePanel
          title={t('competition.stageBuilder.templateCreateErrorTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </CompetitionRow>
  )
}
