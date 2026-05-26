import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
        <Button type="button" size="sm" variant="outline" onClick={openForm}>
          <Ban data-icon="inline-start" />
          {input.t('storeTasks.actionPlansCancelAction')}
        </Button>
        {cancelPlanMutation.isSuccess ? (
          <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.actionPlansCancelSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:p-3"
      aria-label={input.t('storeTasks.actionPlansCancelFormLabel')}
      onSubmit={submitForm}
    >
      <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={cancelReasonId}>
        <span>{input.t('storeTasks.actionPlansCancelReasonLabel')}</span>
        <Input
          id={cancelReasonId}
          value={cancelReason}
          maxLength={500}
          required
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </label>

      {cancelPlanMutation.isError ? (
        <p role="alert" className="tw:text-sm tw:text-destructive">
          {input.t('storeTasks.actionPlansCancelErrorTitle')}: {getErrorMessage(cancelPlanMutation.error)}
        </p>
      ) : null}

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Save data-icon="inline-start" />
          {cancelPlanMutation.isPending
            ? input.t('storeTasks.actionPlansCancelSubmitting')
            : input.t('storeTasks.actionPlansCancelSubmit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={cancelPlanMutation.isPending}
          onClick={closeForm}
        >
          <X data-icon="inline-start" />
          {input.t('storeTasks.actionPlansCancelDismiss')}
        </Button>
      </div>
    </form>
  )
}

function isActiveStatus(status: StoreActionPlanStatus): status is ActiveStoreActionPlanStatus {
  return (activeStatuses as readonly StoreActionPlanStatus[]).includes(status)
}
