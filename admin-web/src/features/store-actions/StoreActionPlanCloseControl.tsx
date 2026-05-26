import { useId, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
        <Button type="button" size="sm" variant="outline" onClick={openForm}>
          <CheckCircle2 data-icon="inline-start" />
          {input.t('storeTasks.actionPlansCloseAction')}
        </Button>
        {closePlanMutation.isSuccess ? (
          <span className="tw:text-sm tw:text-muted-foreground">{input.t('storeTasks.actionPlansCloseSuccess')}</span>
        ) : null}
      </>
    )
  }

  return (
    <form
      className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:p-3"
      aria-label={input.t('storeTasks.actionPlansCloseFormLabel')}
      onSubmit={submitForm}
    >
      <label className="tw:flex tw:flex-col tw:gap-1.5" htmlFor={resolutionNoteId}>
        <span>{input.t('storeTasks.actionPlansResolutionNoteLabel')}</span>
        <Input
          id={resolutionNoteId}
          value={resolutionNote}
          maxLength={500}
          required
          onChange={(event) => setResolutionNote(event.target.value)}
        />
      </label>

      {closePlanMutation.isError ? (
        <p role="alert" className="tw:text-sm tw:text-destructive">
          {input.t('storeTasks.actionPlansCloseErrorTitle')}: {getErrorMessage(closePlanMutation.error)}
        </p>
      ) : null}

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Save data-icon="inline-start" />
          {closePlanMutation.isPending
            ? input.t('storeTasks.actionPlansCloseSubmitting')
            : input.t('storeTasks.actionPlansCloseSubmit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={closePlanMutation.isPending}
          onClick={closeForm}
        >
          <X data-icon="inline-start" />
          {input.t('storeTasks.actionPlansCloseCancel')}
        </Button>
      </div>
    </form>
  )
}

function isActiveStatus(status: StoreActionPlanStatus): status is ActiveStoreActionPlanStatus {
  return (activeStatuses as readonly StoreActionPlanStatus[]).includes(status)
}
