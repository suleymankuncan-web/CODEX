import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilLine, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '../../lib/format'
import type { TranslateFunction } from '../localization/dictionary'
import {
  updateStoreActionPlanStatus,
  type StoreActionPlan,
  type StoreActionPlanStatus,
  type UpdateStoreActionPlanStatusInput,
} from './api'

type ActiveStoreActionPlanStatus = Extract<StoreActionPlanStatus, 'open' | 'in_progress' | 'blocked'>

const activeStatuses = ['open', 'in_progress', 'blocked'] as const satisfies readonly ActiveStoreActionPlanStatus[]

export function StoreActionPlanStatusControl(input: {
  plan: StoreActionPlan
  t: TranslateFunction
}) {
  const statusId = useId()
  const noteId = useId()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<ActiveStoreActionPlanStatus>(() =>
    normalizeActiveStatus(input.plan.status),
  )
  const [note, setNote] = useState('')
  const updateStatusMutation = useMutation({
    mutationFn: updateStoreActionPlanStatus,
    onSuccess: async () => {
      setIsOpen(false)
      setNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-action-plans', 'store-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] }),
      ])
    },
  })

  if (!isActiveStatus(input.plan.status)) {
    return null
  }

  const trimmedNote = note.trim()
  const canSubmit = status !== input.plan.status && !updateStatusMutation.isPending

  function openForm() {
    updateStatusMutation.reset()
    setStatus(normalizeActiveStatus(input.plan.status))
    setNote('')
    setIsOpen(true)
  }

  function closeForm() {
    updateStatusMutation.reset()
    setIsOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    const body: UpdateStoreActionPlanStatusInput = {
      status,
    }
    if (trimmedNote.length > 0) {
      body.note = trimmedNote
    }

    updateStatusMutation.mutate({
      actionPlanId: input.plan.actionPlanId,
      body,
    })
  }

  if (!isOpen) {
    return (
      <>
        <Button type="button" size="sm" variant="outline" onClick={openForm}>
          <PencilLine data-icon="inline-start" />
          {input.t('storeTasks.actionPlansUpdateStatusAction')}
        </Button>
        {updateStatusMutation.isSuccess ? (
          <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.actionPlansStatusSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:p-3"
      aria-label={input.t('storeTasks.actionPlansStatusFormLabel')}
      onSubmit={submitForm}
    >
      <div className="tw:grid tw:gap-3 tw:sm:grid-cols-2">
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={statusId}>
          <span>{input.t('storeTasks.actionPlansStatusLabel')}</span>
          <select
            id={statusId}
            className="tw:h-9 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-3 tw:text-sm tw:shadow-xs tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px]"
            value={status}
            onChange={(event) => setStatus(event.target.value as ActiveStoreActionPlanStatus)}
          >
            {activeStatuses.map((value) => (
              <option key={value} value={value}>
                {formatActiveStatus(input.t, value)}
              </option>
            ))}
          </select>
        </label>
        <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={noteId}>
          <span>{input.t('storeTasks.actionPlansStatusNoteLabel')}</span>
          <Input
            id={noteId}
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {updateStatusMutation.isError ? (
        <p role="alert" className="tw:text-sm tw:text-destructive">
          {input.t('storeTasks.actionPlansStatusErrorTitle')}: {getErrorMessage(updateStatusMutation.error)}
        </p>
      ) : null}

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Save data-icon="inline-start" />
          {updateStatusMutation.isPending
            ? input.t('storeTasks.actionPlansStatusSubmitting')
            : input.t('storeTasks.actionPlansStatusSubmit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateStatusMutation.isPending}
          onClick={closeForm}
        >
          <X data-icon="inline-start" />
          {input.t('storeTasks.actionPlansStatusCancel')}
        </Button>
      </div>
    </form>
  )
}

function isActiveStatus(status: StoreActionPlanStatus): status is ActiveStoreActionPlanStatus {
  return (activeStatuses as readonly StoreActionPlanStatus[]).includes(status)
}

function normalizeActiveStatus(status: StoreActionPlanStatus): ActiveStoreActionPlanStatus {
  return isActiveStatus(status) ? status : 'open'
}

function formatActiveStatus(t: TranslateFunction, status: ActiveStoreActionPlanStatus) {
  switch (status) {
    case 'open':
      return t('storeTasks.actionPlanStatus.open')
    case 'in_progress':
      return t('storeTasks.actionPlanStatus.in_progress')
    case 'blocked':
      return t('storeTasks.actionPlanStatus.blocked')
    default:
      return status
  }
}
