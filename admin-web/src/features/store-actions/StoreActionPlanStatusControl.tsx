import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilLine, Save, X } from 'lucide-react'
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
        <button type="button" className="control-button" onClick={openForm}>
          <PencilLine size={16} />
          {input.t('storeTasks.actionPlansUpdateStatusAction')}
        </button>
        {updateStatusMutation.isSuccess ? (
          <span className="queue-subtitle">{input.t('storeTasks.actionPlansStatusSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="stacked-row"
      aria-label={input.t('storeTasks.actionPlansStatusFormLabel')}
      onSubmit={submitForm}
    >
      <div className="key-grid">
        <label className="control-select" htmlFor={statusId}>
          <span>{input.t('storeTasks.actionPlansStatusLabel')}</span>
          <select
            id={statusId}
            className="control-input"
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
        <label className="control-select" htmlFor={noteId}>
          <span>{input.t('storeTasks.actionPlansStatusNoteLabel')}</span>
          <input
            id={noteId}
            className="control-input"
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      {updateStatusMutation.isError ? (
        <p role="alert" className="queue-subtitle">
          {input.t('storeTasks.actionPlansStatusErrorTitle')}: {getErrorMessage(updateStatusMutation.error)}
        </p>
      ) : null}

      <div className="action-cluster">
        <button type="submit" className="control-button" disabled={!canSubmit}>
          <Save size={16} />
          {updateStatusMutation.isPending
            ? input.t('storeTasks.actionPlansStatusSubmitting')
            : input.t('storeTasks.actionPlansStatusSubmit')}
        </button>
        <button
          type="button"
          className="control-button"
          disabled={updateStatusMutation.isPending}
          onClick={closeForm}
        >
          <X size={16} />
          {input.t('storeTasks.actionPlansStatusCancel')}
        </button>
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
