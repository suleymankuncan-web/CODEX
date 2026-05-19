import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { EmptyState, ScreenState, StatusPill } from '../../components/dashboard-primitives'
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

    input.onUpdate(editDraft.templateId, {
      templateCode: editDraft.templateCode.trim(),
      templateName: editDraft.templateName.trim(),
      description: editDraft.description.trim() || undefined,
      storeIds: editDraft.storeIds,
    })
    setEditDraft(null)
  }

  function updateCloneDraft(field: keyof Omit<TemplateCloneDraft, 'sourceTemplateId'>, value: string) {
    setCloneDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  function submitCloneDraft() {
    if (!cloneDraft || validateTemplateCloneDraft(cloneDraft)) return

    input.onClone(cloneDraft.sourceTemplateId, {
      templateCode: cloneDraft.templateCode.trim(),
      templateName: cloneDraft.templateName.trim(),
      description: cloneDraft.description.trim() || undefined,
    })
    setCloneDraft(null)
  }

  return (
    <article className="stacked-row stage-template-library">
      <div className="stacked-row-head">
        <div>
          <strong>{t('competition.stageBuilder.templateLibraryTitle')}</strong>
          <p className="queue-subtitle">{t('competition.stageBuilder.templateLibraryCopy')}</p>
        </div>
        <StatusPill tone={input.showInactive ? 'accent' : 'neutral'}>
          {input.showInactive ? t('competition.stageBuilder.allTemplates') : t('competition.stageBuilder.activeOnly')}
        </StatusPill>
      </div>
      <label className="store-checkbox template-toggle">
        <input
          type="checkbox"
          checked={input.showInactive}
          onChange={(event) => input.onShowInactiveChange(event.target.checked)}
        />
        <span>{t('competition.stageBuilder.showInactiveTemplates')}</span>
      </label>

      {input.isLoading ? (
        <ScreenState
          title={t('competition.stageBuilder.templatesLoadingTitle')}
          copy={t('competition.stageBuilder.templatesLoadingCopy')}
        />
      ) : null}

      {!input.isLoading && input.templates.length === 0 ? (
        <EmptyState
          title={t('competition.stageBuilder.noTemplatesTitle')}
          copy={t('competition.stageBuilder.noTemplatesCopy')}
        />
      ) : null}

      {input.templates.length > 0 ? (
        <div className="stacked-table">
          {input.templates.map((template) => (
            <article className="stacked-row" key={template.templateId}>
              <div className="stacked-row-head">
                <div>
                  <strong>{template.templateCode}</strong>
                  <p className="queue-subtitle">{template.templateName}</p>
                </div>
                <StatusPill tone={template.isActive ? 'calm' : 'neutral'}>
                  {template.isActive ? t('competition.stageBuilder.active') : t('competition.stageBuilder.inactive')}
                </StatusPill>
              </div>
              <div className="key-grid">
                <div className="key-item">
                  <span>{t('competition.stageBuilder.stores')}</span>
                  <strong>{String(template.stores.length)}</strong>
                </div>
                <div className="key-item">
                  <span>{t('competition.stageBuilder.description')}</span>
                  <strong>{template.description ?? '-'}</strong>
                </div>
              </div>

              {editDraft?.templateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>{t('competition.stageBuilder.editTemplateCode')}</span>
                      <input
                        value={editDraft.templateCode}
                        onChange={(event) =>
                          updateEditDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>{t('competition.stageBuilder.editTemplateName')}</span>
                      <input
                        value={editDraft.templateName}
                        onChange={(event) => updateEditDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>{t('competition.stageBuilder.editTemplateDescription')}</span>
                      <input
                        value={editDraft.description}
                        onChange={(event) => updateEditDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="store-checkbox-grid">
                    {input.stores.map((store) => (
                      <label className="store-checkbox" key={`edit-${template.templateId}-${store.storeId}`}>
                        <input
                          type="checkbox"
                          checked={editDraft.storeIds.includes(store.storeId)}
                          onChange={() => toggleEditStore(store.storeId)}
                        />
                        <span>{storeLabel(store)}</span>
                      </label>
                    ))}
                  </div>
                  {editValidationMessage ? (
                    <p className="validation-copy">{t(editValidationMessage)}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(editValidationMessage) || input.isPending}
                      onClick={submitEditDraft}
                    >
                      {t('competition.stageBuilder.saveTemplate')}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setEditDraft(null)}
                    >
                      {t('competition.stageBuilder.cancelEdit')}
                    </button>
                  </div>
                </div>
              ) : null}

              {cloneDraft?.sourceTemplateId === template.templateId ? (
                <div className="stacked-row">
                  <div className="form-grid">
                    <label className="field-block">
                      <span>{t('competition.stageBuilder.cloneTemplateCode')}</span>
                      <input
                        value={cloneDraft.templateCode}
                        onChange={(event) =>
                          updateCloneDraft('templateCode', normalizeCode(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-block">
                      <span>{t('competition.stageBuilder.cloneTemplateName')}</span>
                      <input
                        value={cloneDraft.templateName}
                        onChange={(event) => updateCloneDraft('templateName', event.target.value)}
                      />
                    </label>
                    <label className="field-block field-block-full">
                      <span>{t('competition.stageBuilder.cloneTemplateDescription')}</span>
                      <input
                        value={cloneDraft.description}
                        onChange={(event) => updateCloneDraft('description', event.target.value)}
                      />
                    </label>
                  </div>
                  {cloneValidationMessage ? (
                    <p className="validation-copy">{t(cloneValidationMessage)}</p>
                  ) : null}
                  <div className="action-cluster">
                    <button
                      className="control-button"
                      type="button"
                      disabled={Boolean(cloneValidationMessage) || input.isPending}
                      onClick={submitCloneDraft}
                    >
                      {t('competition.stageBuilder.cloneTemplate')}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setCloneDraft(null)}
                    >
                      {t('competition.stageBuilder.cancelClone')}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="action-cluster">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setCloneDraft(null)
                    setEditDraft(createTemplateEditDraft(template))
                  }}
                >
                  {t('competition.stageBuilder.editTemplateButton', { templateCode: template.templateCode })}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={input.isPending}
                  onClick={() => {
                    setEditDraft(null)
                    setCloneDraft(createTemplateCloneDraft(template))
                  }}
                >
                  {t('competition.stageBuilder.cloneTemplateButton', { templateCode: template.templateCode })}
                </button>
                {template.isActive ? (
                  <button
                    className="control-button"
                    type="button"
                    disabled={input.isPending}
                    onClick={() => input.onDeactivate(template.templateId)}
                  >
                    {t('competition.stageBuilder.deactivateTemplateButton', { templateCode: template.templateCode })}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {input.feedback ? (
        <ScreenState title={input.feedback} copy={t('competition.stageBuilder.templateLibraryRefreshCopy')} />
      ) : null}

      {input.error ? (
        <ScreenState
          title={t('competition.stageBuilder.templateLibraryActionFailedTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
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
    <article className="stacked-row stage-template-builder">
      <div className="stacked-row-head">
        <div>
          <strong>{t('competition.stageBuilder.teamTemplateTitle')}</strong>
          <p className="queue-subtitle">{t('competition.stageBuilder.teamTemplateCopy')}</p>
        </div>
        <StatusPill tone={input.draft.storeIds.length > 0 ? 'accent' : 'warning'}>
          {formatCount(
            input.draft.storeIds.length,
            'competition.stageBuilder.count.store',
            'competition.stageBuilder.count.stores',
            t,
          )}
        </StatusPill>
      </div>
      <div className="form-grid">
        <label className="field-block">
          <span>{t('competition.stageBuilder.templateCode')}</span>
          <input
            value={input.draft.templateCode}
            onChange={(event) => input.onUpdate('templateCode', normalizeCode(event.target.value))}
          />
        </label>
        <label className="field-block">
          <span>{t('competition.stageBuilder.templateName')}</span>
          <input
            value={input.draft.templateName}
            onChange={(event) => input.onUpdate('templateName', event.target.value)}
          />
        </label>
        <label className="field-block field-block-full">
          <span>{t('competition.stageBuilder.templateDescription')}</span>
          <input
            value={input.draft.description}
            onChange={(event) => input.onUpdate('description', event.target.value)}
          />
        </label>
      </div>
      <div className="store-checkbox-grid">
        {input.stores.map((store) => (
          <label className="store-checkbox" key={`template-${store.storeId}`}>
            <input
              type="checkbox"
              checked={input.draft.storeIds.includes(store.storeId)}
              onChange={() => input.onToggleStore(store.storeId)}
            />
            <span>{storeLabel(store)}</span>
          </label>
        ))}
      </div>
      {input.validationMessage ? (
        <p className="validation-copy">{t(input.validationMessage)}</p>
      ) : null}
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={Boolean(input.validationMessage) || input.isPending || input.stores.length === 0}
          onClick={input.onSubmit}
        >
          <PlusCircle size={16} />
          {t('competition.stageBuilder.createTemplate')}
        </button>
      </div>
      {input.feedback ? <ScreenState title={input.feedback} copy={t('competition.stageBuilder.templateListRefreshCopy')} /> : null}
      {input.error ? (
        <ScreenState
          title={t('competition.stageBuilder.templateCreateErrorTitle')}
          copy={getErrorMessage(input.error)}
          tone="error"
        />
      ) : null}
    </article>
  )
}
