import { useId, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MessageSquarePlus, Send, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { getErrorMessage } from '../../lib/format'
import { useLocalization } from '../localization/useLocalization'
import {
  createPilotFeedback,
  type CreatePilotFeedbackInput,
  type PilotFeedbackSeverity,
  type PilotFeedbackType,
} from './api'

type PilotFeedbackFormState = {
  feedbackType: PilotFeedbackType
  severitySuggestion: PilotFeedbackSeverity
  title: string
  description: string
}

const initialFormState: PilotFeedbackFormState = {
  feedbackType: 'friction',
  severitySuggestion: 'p2',
  title: '',
  description: '',
}

const feedbackTypes = ['bug', 'friction', 'idea', 'data_quality', 'other'] as const satisfies readonly PilotFeedbackType[]
const severities = ['p0', 'p1', 'p2', 'p3'] as const satisfies readonly PilotFeedbackSeverity[]

export function PilotFeedbackControl() {
  const { t } = useLocalization()
  const location = useLocation()
  const titleId = useId()
  const typeId = useId()
  const severityId = useId()
  const descriptionId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<PilotFeedbackFormState>(initialFormState)
  const createMutation = useMutation({
    mutationFn: createPilotFeedback,
    onSuccess: () => {
      setForm(initialFormState)
      setIsOpen(false)
    },
  })

  const routePath = getRoutePath(location.pathname)
  const trimmedTitle = form.title.trim()
  const trimmedDescription = form.description.trim()
  const canSubmit = trimmedTitle.length > 0 && trimmedDescription.length > 0 && !createMutation.isPending

  function updateField<Field extends keyof PilotFeedbackFormState>(
    field: Field,
    value: PilotFeedbackFormState[Field],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function openForm() {
    createMutation.reset()
    setIsOpen(true)
  }

  function closeForm() {
    createMutation.reset()
    setIsOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    const payload: CreatePilotFeedbackInput = {
      feedbackType: form.feedbackType,
      severitySuggestion: form.severitySuggestion,
      routePath,
      title: trimmedTitle,
      description: trimmedDescription,
    }
    const pageTitle = getPageTitle()
    if (pageTitle) {
      payload.pageTitle = pageTitle
    }

    createMutation.mutate(payload)
  }

  const dialog = isOpen ? (
    <div className="pilot-feedback-backdrop">
      <form
        aria-labelledby="pilot-feedback-title"
        aria-modal="true"
        className="pilot-feedback-dialog"
        role="dialog"
        onSubmit={submitForm}
      >
        <div className="pilot-feedback-dialog-head">
          <div>
            <h3 id="pilot-feedback-title">{t('pilotFeedback.dialogTitle')}</h3>
            <p>{t('pilotFeedback.dialogCopy')}</p>
          </div>
          <button
            type="button"
            className="pilot-feedback-close"
            aria-label={t('pilotFeedback.cancel')}
            disabled={createMutation.isPending}
            onClick={closeForm}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label className="field-block" htmlFor={typeId}>
            <span>{t('pilotFeedback.typeLabel')}</span>
            <select
              id={typeId}
              value={form.feedbackType}
              onChange={(event) => updateField('feedbackType', event.target.value as PilotFeedbackType)}
            >
              {feedbackTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`pilotFeedback.type.${type}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block" htmlFor={severityId}>
            <span>{t('pilotFeedback.severityLabel')}</span>
            <select
              id={severityId}
              value={form.severitySuggestion}
              onChange={(event) => updateField('severitySuggestion', event.target.value as PilotFeedbackSeverity)}
            >
              {severities.map((severity) => (
                <option key={severity} value={severity}>
                  {t(`pilotFeedback.severity.${severity}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block field-block-full" htmlFor={titleId}>
            <span>{t('pilotFeedback.titleLabel')}</span>
            <input
              id={titleId}
              value={form.title}
              maxLength={160}
              required
              onChange={(event) => updateField('title', event.target.value)}
            />
          </label>
          <label className="field-block field-block-full" htmlFor={descriptionId}>
            <span>{t('pilotFeedback.descriptionLabel')}</span>
            <textarea
              id={descriptionId}
              className="field-textarea"
              value={form.description}
              maxLength={4000}
              required
              onChange={(event) => updateField('description', event.target.value)}
            />
          </label>
        </div>

        <div className="key-item">
          <span>{t('pilotFeedback.routeLabel')}</span>
          <strong>{routePath}</strong>
        </div>

        {createMutation.isError ? (
          <p role="alert" className="queue-subtitle">
            {t('pilotFeedback.errorTitle')}: {getErrorMessage(createMutation.error)}
          </p>
        ) : null}

        <div className="action-cluster">
          <button type="submit" className="control-button" disabled={!canSubmit}>
            <Send aria-hidden="true" size={16} />
            {createMutation.isPending ? t('pilotFeedback.submitting') : t('pilotFeedback.submit')}
          </button>
          <button type="button" className="control-button" disabled={createMutation.isPending} onClick={closeForm}>
            <X aria-hidden="true" size={16} />
            {t('pilotFeedback.cancel')}
          </button>
        </div>
      </form>
    </div>
  ) : null

  return (
    <>
      <div className="pilot-feedback-control">
        <button type="button" className="pilot-feedback-trigger" onClick={openForm}>
          <MessageSquarePlus aria-hidden="true" size={18} />
          <span>{t('pilotFeedback.openAction')}</span>
        </button>
        {createMutation.isSuccess ? (
          <span className="pilot-feedback-success" role="status">
            {t('pilotFeedback.success')}
          </span>
        ) : null}
      </div>

      {dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}

function getRoutePath(pathname: string) {
  return pathname.slice(0, 300)
}

function getPageTitle() {
  if (typeof document === 'undefined') {
    return null
  }

  const title = document.title.trim()
  return title.length > 0 ? title.slice(0, 160) : null
}
