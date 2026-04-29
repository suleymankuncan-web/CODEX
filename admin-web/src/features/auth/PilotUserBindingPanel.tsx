import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../../lib/format'
import { createPilotUserBinding, type AuthLookupStore } from './api'

type PilotRole = 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'

export function PilotUserBindingPanel({ stores }: { stores: AuthLookupStore[] }) {
  const queryClient = useQueryClient()
  const [employeeId, setEmployeeId] = useState('')
  const [providerSubject, setProviderSubject] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [roleCode, setRoleCode] = useState<PilotRole>('STORE_MANAGER')
  const [storeIds, setStoreIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: createPilotUserBinding,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setErrorFeedback(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      setFeedback(null)
      setErrorFeedback(getErrorMessage(error))
    },
  })

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Pilot access</div>
          <h3>Pilot user binding</h3>
        </div>
      </div>
      {feedback ? <div className="inline-state inline-state-accent">{feedback}</div> : null}
      {errorFeedback ? <div className="inline-state inline-state-danger">{errorFeedback}</div> : null}
      <div className="form-grid">
        <label className="field-block">
          <span>Pilot employee id</span>
          <input
            aria-label="Pilot employee id"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Pilot provider subject</span>
          <input
            aria-label="Pilot provider subject"
            value={providerSubject}
            onChange={(event) => setProviderSubject(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Pilot username</span>
          <input
            aria-label="Pilot username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Pilot email</span>
          <input
            aria-label="Pilot email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Pilot role</span>
          <select
            aria-label="Pilot role"
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value as PilotRole)}
          >
            <option value="STORE_MANAGER">STORE_MANAGER</option>
            <option value="REGION_MANAGER">REGION_MANAGER</option>
            <option value="VISUAL_MERCHANDISER">VISUAL_MERCHANDISER</option>
          </select>
        </label>
        <label className="field-block">
          <span>Pilot stores</span>
          <select
            aria-label="Pilot stores"
            multiple
            value={storeIds}
            onChange={(event) => {
              setStoreIds(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))
            }}
          >
            {stores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeCode} - {store.storeName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="action-cluster">
        <button
          className="control-button"
          type="button"
          disabled={
            mutation.isPending ||
            !employeeId.trim() ||
            !providerSubject.trim() ||
            !username.trim() ||
            !email.trim() ||
            storeIds.length === 0
          }
          onClick={() => {
            setFeedback(null)
            setErrorFeedback(null)
            mutation.mutate({
              employeeId: employeeId.trim(),
              authProvider: 'oidc',
              providerSubject: providerSubject.trim(),
              username: username.trim(),
              email: email.trim(),
              roleCode,
              storeIds,
            })
          }}
        >
          {mutation.isPending ? 'Creating...' : 'Create pilot binding'}
        </button>
      </div>
    </article>
  )
}
