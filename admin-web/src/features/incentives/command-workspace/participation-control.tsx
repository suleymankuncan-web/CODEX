import { useEffect, useEffectEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { sendOpenApiJson } from '@/lib/openapi-client'
import { actionToast } from '@/lib/action-toast'
import type { AppLocale } from '@/lib/i18n'
import type { IncentiveRow, IncentiveStore } from './types'

export function IncentiveParticipationControl(input: {
  store: IncentiveStore; row: IncentiveRow; period: string; locale: AppLocale; readOnly: boolean; locked: boolean;
  onPendingChange: (pending: boolean) => void; onDirtyChange: (dirty: boolean) => void;
  draft?: { excluded: boolean; reason: string } | undefined; onDraftChange: (draft: { excluded: boolean; reason: string }) => void; onSaved: () => void;
  draftSource?: { snapshotId: string | null; included: boolean; reasonNote: string | null } | undefined;
}) {
  const tr = input.locale === 'tr'
  const current = input.row.participation
  const conflict = Boolean(input.draftSource && (input.draftSource.snapshotId !== (input.store.review.finalSnapshotId ?? null)
    || input.draftSource.included !== (current?.included ?? true) || input.draftSource.reasonNote !== (current?.reasonNote ?? null)))
  const excluded = input.draft?.excluded ?? (current?.included === false)
  const reason = input.draft?.reason ?? current?.reasonNote ?? ''
  const changed = !input.readOnly && (conflict || excluded !== (current?.included === false) || (excluded && reason.trim() !== current?.reasonNote))
  const dirtyChange = useEffectEvent(input.onDirtyChange)
  useEffect(() => { dirtyChange(changed); return () => dirtyChange(false) }, [changed])
  const client = useQueryClient()
  const mutation = useMutation({
    retry: 0,
    onError: () => actionToast.error(null, tr ? 'Karar do\u011Frulanamad\u0131. G\u00FCncel revizyonu kontrol edin.' : 'Decision could not be confirmed. Review the current revision.'),
    mutationFn: () => sendOpenApiJson('/api/store/incentives/workspace/participation', { method: 'POST', body: {
      period: input.period, storeId: input.store.storeId, employeeId: input.row.employeeId, included: !excluded,
      ...(excluded ? { reasonNote: reason.trim() } : {}), expectedRevision: input.store.review.participationRevision!, expectedSnapshotId: input.store.review.finalSnapshotId!,
    } }),
    onSettled: async (_data, error) => {
      try {
        await client.invalidateQueries({ predicate: entry => entry.queryKey.some(key => typeof key === 'string' && key.includes('incentive')) })
        if (!error) input.onSaved()
      }
      finally { input.onPendingChange(false) }
    },
  })
  if (input.readOnly) return current?.included === false ? <p className="incentive-participation-note">{tr ? 'Prime Dahil De\u011Fildir' : 'Excluded from incentive'}: {current.reasonNote}</p> : null
  const disabled = conflict || input.locked || !input.store.capabilities.canMarkStoreReview || !input.store.review.finalSnapshotId || input.store.review.participationRevision === undefined || mutation.isPending
  const valid = !excluded || (reason.trim().length >= 3 && reason.length <= 1000)
  const id = `participation-${input.store.storeId}-${input.row.employeeId}-${input.row.participantType}`
  return <div className="incentive-participation-control">
    {conflict ? <><p role="alert">{tr ? 'Kaynak veya kay\u0131tl\u0131 karar de\u011Fi\u015Fti. Eski taslak yeni kayna\u011Fa uygulanamaz.' : 'The source or recorded decision changed. The old draft cannot be applied automatically.'}</p><Button size="sm" variant="outline" disabled={input.locked || mutation.isPending} onClick={input.onSaved}>{tr ? 'G\u00FCncel karar\u0131 incele' : 'Review current decision'}</Button></> : null}
    <label className="incentive-participation-toggle"><Checkbox checked={excluded} disabled={disabled} onCheckedChange={value => input.onDraftChange({ excluded: value === true, reason })} aria-label={`${input.row.displayName}: ${tr ? 'Prime Dahil De\u011Fildir' : 'Excluded from incentive'}`} />{tr ? 'Prime Dahil De\u011Fildir' : 'Excluded from incentive'}</label>
    {excluded ? <><label htmlFor={id}>{tr ? 'D\u0131\u015Flama gerek\u00E7esi' : 'Exclusion reason'}</label><Textarea id={id} aria-label={`${input.row.displayName}: ${tr ? 'D\u0131\u015Flama gerek\u00E7esi' : 'Exclusion reason'}`} value={reason} maxLength={1000} required disabled={disabled} onChange={event => input.onDraftChange({ excluded, reason: event.target.value })} /></> : null}
    {changed ? <Button size="sm" variant="outline" disabled={disabled || !valid} onClick={() => { input.onPendingChange(true); mutation.mutate() }} aria-label={`${input.row.displayName}: ${tr ? 'Prim karar\u0131n\u0131 kaydet' : 'Save participation'}`}>{mutation.isPending ? (tr ? 'Kaydediliyor' : 'Saving') : (tr ? 'Karar\u0131 kaydet' : 'Save participation')}</Button> : null}
    {mutation.isError ? <p role="alert">{tr ? 'Karar do\u011Frulanamad\u0131. G\u00FCncel revizyonu kontrol edip yeniden deneyin.' : 'Decision could not be confirmed. Review the current revision before retrying.'}</p> : null}
  </div>
}
