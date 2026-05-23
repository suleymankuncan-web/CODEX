import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Save, X } from 'lucide-react'
import { getErrorMessage } from '../../lib/format'
import type { TranslateFunction } from '../localization/dictionary'
import {
  cancelStoreActionPlan,
  type CancelStoreActionPlanInput,
  type StoreActionPlan,
  type StoreActionPlanStatus,
} from './api'

type ActiveStoreActionPlanStatus = Extract<StoreActionPlanStatus, 'open' | 'in_progress' | 'blocked'>

const activeStatuses = ['open', 'in_progress', 'blocked'] as const satisfies readonly ActiveStoreActionPlanStatus[]

export function StoreActionPlanCancelControl(input: {
  plan: StoreActionPlan
  t: TranslateFunction
}) {
  const cancelReasonId = useId()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const cancelPlanMutation = useMutation({
    mutationFn: cancelStoreActionPlan,
    onSuccess: async () => {
      setIsOpen(false)
      setCancelReason('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-action-plans', 'store-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] }),
      ])
    },
  })

  if (!isActiveStatus(input.plan.status)) {
    return null
  }

  const trimmedCancelReason = cancelReason.trim()
  const canSubmit = trimmedCancelReason.length > 0 && !cancelPlanMutation.isPending

  function openForm() {
    cancelPlanMutation.reset()
    setCancelReason('')
    setIsOpen(true)
  }

  function closeForm() {
    cancelPlanMutation.reset()
    setIsOpen(false)
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    const body: CancelStoreActionPlanInput = {
      cancelReason: trimmedCancelReason,
    }

    cancelPlanMutation.mutate({
      actionPlanId: input.plan.actionPlanId,
      body,
    })
  }

  if (!isOpen) {
    return (
      <>
        <button type="button" className="control-button" onClick={openForm}>
          <Ban size={16} />
          {input.t('storeTasks.actionPlansCancelAction')}
        </button>
        {cancelPlanMutation.isSuccess ? (
          <span className="queue-subtitle">{input.t('storeTasks.actionPlansCancelSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="stacked-row"
      aria-label={input.t('storeTasks.actionPlansCancelFormLabel')}
      onSubmit={submitForm}
    >
      <label className="control-select" htmlFor={cancelReasonId}>
        <span>{input.t('storeTasks.actionPlansCancelReasonLabel')}</span>
        <input
          id={cancelReasonId}
          className="control-input"
          value={cancelReason}
          maxLength={500}
          required
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </label>

      {cancelPlanMutation.isError ? (
        <p role="alert" className="queue-subtitle">
          {input.t('storeTasks.actionPlansCancelErrorTitle')}: {getErrorMessage(cancelPlanMutation.error)}
        </p>
      ) : null}

      <div className="action-cluster">
        <button type="submit" className="control-button" disabled={!canSubmit}>
          <Save size={16} />
          {cancelPlanMutation.isPending
            ? input.t('storeTasks.actionPlansCancelSubmitting')
            : input.t('storeTasks.actionPlansCancelSubmit')}
        </button>
        <button
          type="button"
          className="control-button"
          disabled={cancelPlanMutation.isPending}
          onClick={closeForm}
        >
          <X size={16} />
          {input.t('storeTasks.actionPlansCancelDismiss')}
        </button>
      </div>
    </form>
  )
}

function isActiveStatus(status: StoreActionPlanStatus): status is ActiveStoreActionPlanStatus {
  return (activeStatuses as readonly StoreActionPlanStatus[]).includes(status)
}
