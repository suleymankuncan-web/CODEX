import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Save, X } from 'lucide-react'
import { getErrorMessage } from '../../lib/format'
import type { TranslateFunction } from '../localization/dictionary'
import {
  closeStoreActionPlan,
  type CloseStoreActionPlanInput,
  type StoreActionPlan,
  type StoreActionPlanStatus,
} from './api'

type ActiveStoreActionPlanStatus = Extract<StoreActionPlanStatus, 'open' | 'in_progress' | 'blocked'>

const activeStatuses = ['open', 'in_progress', 'blocked'] as const satisfies readonly ActiveStoreActionPlanStatus[]

export function StoreActionPlanCloseControl(input: {
  plan: StoreActionPlan
  t: TranslateFunction
}) {
  const resolutionNoteId = useId()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const closePlanMutation = useMutation({
    mutationFn: closeStoreActionPlan,
    onSuccess: async () => {
      setIsOpen(false)
      setResolutionNote('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-action-plans', 'store-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] }),
      ])
    },
  })

  if (!isActiveStatus(input.plan.status)) {
    return null
  }

  const trimmedResolutionNote = resolutionNote.trim()
  const canSubmit = trimmedResolutionNote.length > 0 && !closePlanMutation.isPending

  function openForm() {
    closePlanMutation.reset()
    setResolutionNote('')
    setIsOpen(true)
  }

  function closeForm() {
    closePlanMutation.reset()
    setIsOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    const body: CloseStoreActionPlanInput = {
      resolutionNote: trimmedResolutionNote,
    }

    closePlanMutation.mutate({
      actionPlanId: input.plan.actionPlanId,
      body,
    })
  }

  if (!isOpen) {
    return (
      <>
        <button type="button" className="control-button" onClick={openForm}>
          <CheckCircle2 size={16} />
          {input.t('storeTasks.actionPlansCloseAction')}
        </button>
        {closePlanMutation.isSuccess ? (
          <span className="queue-subtitle">{input.t('storeTasks.actionPlansCloseSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="stacked-row"
      aria-label={input.t('storeTasks.actionPlansCloseFormLabel')}
      onSubmit={submitForm}
    >
      <label className="control-select" htmlFor={resolutionNoteId}>
        <span>{input.t('storeTasks.actionPlansResolutionNoteLabel')}</span>
        <input
          id={resolutionNoteId}
          className="control-input"
          value={resolutionNote}
          maxLength={500}
          required
          onChange={(event) => setResolutionNote(event.target.value)}
        />
      </label>

      {closePlanMutation.isError ? (
        <p role="alert" className="queue-subtitle">
          {input.t('storeTasks.actionPlansCloseErrorTitle')}: {getErrorMessage(closePlanMutation.error)}
        </p>
      ) : null}

      <div className="action-cluster">
        <button type="submit" className="control-button" disabled={!canSubmit}>
          <Save size={16} />
          {closePlanMutation.isPending
            ? input.t('storeTasks.actionPlansCloseSubmitting')
            : input.t('storeTasks.actionPlansCloseSubmit')}
        </button>
        <button
          type="button"
          className="control-button"
          disabled={closePlanMutation.isPending}
          onClick={closeForm}
        >
          <X size={16} />
          {input.t('storeTasks.actionPlansCloseCancel')}
        </button>
      </div>
    </form>
  )
}

function isActiveStatus(status: StoreActionPlanStatus): status is ActiveStoreActionPlanStatus {
  return (activeStatuses as readonly StoreActionPlanStatus[]).includes(status)
}
