import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CirclePlus, Save, X } from 'lucide-react'
import { getErrorMessage } from '../../lib/format'
import type { TranslateFunction } from '../localization/dictionary'
import {
  createStoreActionPlan,
  type CreateStoreActionPlanInput,
  type StoreActionPlanPriority,
} from './api'
import type { ReadOnlyStoreActionCandidate } from './candidates'

type FormState = {
  title: string
  summary: string
  dueOn: string
  priority: StoreActionPlanPriority
}

export function StoreActionPlanCreateControl(input: {
  candidate: ReadOnlyStoreActionCandidate
  t: TranslateFunction
  onCreated: () => void
}) {
  const titleId = useId()
  const summaryId = useId()
  const dueOnId = useId()
  const priorityId = useId()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => buildInitialFormState(input.candidate))
  const createPlanMutation = useMutation({
    mutationFn: createStoreActionPlan,
    onSuccess: async () => {
      setIsOpen(false)
      input.onCreated()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-action-plans', 'store-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] }),
      ])
    },
  })

  const trimmedTitle = form.title.trim()
  const trimmedSummary = form.summary.trim()
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedSummary.length > 0 &&
    form.dueOn.length > 0 &&
    !createPlanMutation.isPending

  function openForm() {
    createPlanMutation.reset()
    setForm(buildInitialFormState(input.candidate))
    setIsOpen(true)
  }

  function closeForm() {
    createPlanMutation.reset()
    setIsOpen(false)
  }

  function updateField<Field extends keyof FormState>(field: Field, value: FormState[Field]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    const payload: CreateStoreActionPlanInput = {
      storeId: input.candidate.storeId,
      sourceType: 'kpi_exception',
      sourceId: input.candidate.sourceId,
      title: trimmedTitle,
      summary: trimmedSummary,
      priority: form.priority,
      dueOn: form.dueOn,
    }
    const sourceDeepLink = getSafeInAppPath(input.candidate.deepLink)
    if (sourceDeepLink) {
      payload.sourceDeepLink = sourceDeepLink
    }

    createPlanMutation.mutate(payload)
  }

  if (!isOpen) {
    return (
      <>
        <button type="button" className="control-button" onClick={openForm}>
          <CirclePlus size={16} />
          {input.t('storeTasks.createPlanAction')}
        </button>
        {createPlanMutation.isSuccess ? (
          <span className="queue-subtitle">{input.t('storeTasks.createPlanSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form className="stacked-row" aria-label={input.t('storeTasks.createPlanFormLabel')} onSubmit={submitForm}>
      <div className="key-grid">
        <label className="control-select" htmlFor={titleId}>
          <span>{input.t('storeTasks.createPlanTitleLabel')}</span>
          <input
            id={titleId}
            className="control-input"
            value={form.title}
            maxLength={160}
            required
            onChange={(event) => updateField('title', event.target.value)}
          />
        </label>
        <label className="control-select" htmlFor={dueOnId}>
          <span>{input.t('storeTasks.createPlanDueOnLabel')}</span>
          <input
            id={dueOnId}
            className="control-input"
            type="date"
            value={form.dueOn}
            required
            onChange={(event) => updateField('dueOn', event.target.value)}
          />
        </label>
        <label className="control-select" htmlFor={priorityId}>
          <span>{input.t('storeTasks.createPlanPriorityLabel')}</span>
          <select
            id={priorityId}
            className="control-input"
            value={form.priority}
            onChange={(event) => updateField('priority', event.target.value as StoreActionPlanPriority)}
          >
            <option value="high">{input.t('storeTasks.actionPlanPriority.high')}</option>
            <option value="medium">{input.t('storeTasks.actionPlanPriority.medium')}</option>
            <option value="low">{input.t('storeTasks.actionPlanPriority.low')}</option>
          </select>
        </label>
        <label className="control-select" htmlFor={summaryId}>
          <span>{input.t('storeTasks.createPlanSummaryLabel')}</span>
          <input
            id={summaryId}
            className="control-input"
            value={form.summary}
            maxLength={240}
            required
            onChange={(event) => updateField('summary', event.target.value)}
          />
        </label>
      </div>

      {createPlanMutation.isError ? (
        <p role="alert" className="queue-subtitle">
          {input.t('storeTasks.createPlanErrorTitle')}: {getErrorMessage(createPlanMutation.error)}
        </p>
      ) : null}

      <div className="action-cluster">
        <button type="submit" className="control-button" disabled={!canSubmit}>
          <Save size={16} />
          {createPlanMutation.isPending
            ? input.t('storeTasks.createPlanSubmitting')
            : input.t('storeTasks.createPlanSubmit')}
        </button>
        <button
          type="button"
          className="control-button"
          disabled={createPlanMutation.isPending}
          onClick={closeForm}
        >
          <X size={16} />
          {input.t('storeTasks.createPlanCancel')}
        </button>
      </div>
    </form>
  )
}

function buildInitialFormState(candidate: ReadOnlyStoreActionCandidate): FormState {
  return {
    title: candidate.title,
    summary: candidate.summary,
    dueOn: '',
    priority: mapUrgencyToPriority(candidate.urgency),
  }
}

function mapUrgencyToPriority(urgency: ReadOnlyStoreActionCandidate['urgency']): StoreActionPlanPriority {
  switch (urgency) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'medium'
  }
}

function getSafeInAppPath(input: string) {
  if (!input.startsWith('/') || input.startsWith('//')) {
    return null
  }

  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index)
    if (codePoint <= 31 || codePoint === 127) {
      return null
    }
  }

  return input
}
