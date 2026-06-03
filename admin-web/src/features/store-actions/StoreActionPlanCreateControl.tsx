import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CirclePlus, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '../../lib/format'
import { cn } from '../../lib/utils'
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
  triggerLabel?: string
  triggerClassName?: string
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(input.triggerClassName)}
          onClick={openForm}
        >
          {input.triggerLabel ? (
            <>
              {input.triggerLabel}
              <ArrowRight data-icon="inline-end" />
            </>
          ) : (
            <>
              <CirclePlus data-icon="inline-start" />
              {input.t('storeTasks.createPlanAction')}
            </>
          )}
        </Button>
        {createPlanMutation.isSuccess ? (
          <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.createPlanSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:p-3"
      aria-label={input.t('storeTasks.createPlanFormLabel')}
      onSubmit={submitForm}
    >
      <div className="tw:grid tw:gap-3 tw:sm:grid-cols-2">
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={titleId}>
          <span>{input.t('storeTasks.createPlanTitleLabel')}</span>
          <Input
            id={titleId}
            value={form.title}
            maxLength={160}
            required
            onChange={(event) => updateField('title', event.target.value)}
          />
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={dueOnId}>
          <span>{input.t('storeTasks.createPlanDueOnLabel')}</span>
          <Input
            id={dueOnId}
            type="date"
            value={form.dueOn}
            required
            onChange={(event) => updateField('dueOn', event.target.value)}
          />
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={priorityId}>
          <span>{input.t('storeTasks.createPlanPriorityLabel')}</span>
          <select
            id={priorityId}
            className="tw:h-9 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-3 tw:text-sm tw:shadow-xs tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px]"
            value={form.priority}
            onChange={(event) => updateField('priority', event.target.value as StoreActionPlanPriority)}
          >
            <option value="high">{input.t('storeTasks.actionPlanPriority.high')}</option>
            <option value="medium">{input.t('storeTasks.actionPlanPriority.medium')}</option>
            <option value="low">{input.t('storeTasks.actionPlanPriority.low')}</option>
          </select>
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={summaryId}>
          <span>{input.t('storeTasks.createPlanSummaryLabel')}</span>
          <Input
            id={summaryId}
            value={form.summary}
            maxLength={240}
            required
            onChange={(event) => updateField('summary', event.target.value)}
          />
        </label>
      </div>

      {createPlanMutation.isError ? (
        <p role="alert" className="tw:text-sm tw:text-destructive">
          {input.t('storeTasks.createPlanErrorTitle')}: {getErrorMessage(createPlanMutation.error)}
        </p>
      ) : null}

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Save data-icon="inline-start" />
          {createPlanMutation.isPending
            ? input.t('storeTasks.createPlanSubmitting')
            : input.t('storeTasks.createPlanSubmit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={createPlanMutation.isPending}
          onClick={closeForm}
        >
          <X data-icon="inline-start" />
          {input.t('storeTasks.createPlanCancel')}
        </Button>
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
