import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '../localization/useLocalization'
import { getErrorMessage } from '../../lib/format'
import { createPilotUserBinding, type AuthLookupStore } from './api'

type PilotRole = 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'
type PilotAuthProvider = 'oidc' | 'clerk'

export function PilotUserBindingPanel({ stores }: { stores: AuthLookupStore[] }) {
  const queryClient = useQueryClient()
  const { t } = useLocalization()
  const [employeeId, setEmployeeId] = useState('')
  const [providerSubject, setProviderSubject] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [authProvider, setAuthProvider] = useState<PilotAuthProvider>('clerk')
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
          <div className="eyebrow">{t('authAdmin.pilotAccess')}</div>
          <h3>{t('authAdmin.pilotUserBinding')}</h3>
        </div>
      </div>
      {feedback ? <div className="inline-state inline-state-accent">{feedback}</div> : null}
      {errorFeedback ? <div className="inline-state inline-state-danger">{errorFeedback}</div> : null}
      <div className="form-grid">
        <label className="field-block">
          <span>{t('authAdmin.pilotEmployeeId')}</span>
          <input
            aria-label={t('authAdmin.pilotEmployeeId')}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotProviderSubject')}</span>
          <input
            aria-label={t('authAdmin.pilotProviderSubject')}
            value={providerSubject}
            onChange={(event) => setProviderSubject(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotAuthProvider')}</span>
          <select
            aria-label={t('authAdmin.pilotAuthProvider')}
            value={authProvider}
            onChange={(event) => setAuthProvider(event.target.value as PilotAuthProvider)}
          >
            <option value="clerk">clerk</option>
            <option value="oidc">oidc</option>
          </select>
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotUsername')}</span>
          <input
            aria-label={t('authAdmin.pilotUsername')}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotEmail')}</span>
          <input
            aria-label={t('authAdmin.pilotEmail')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotRole')}</span>
          <select
            aria-label={t('authAdmin.pilotRole')}
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value as PilotRole)}
          >
            <option value="STORE_MANAGER">STORE_MANAGER</option>
            <option value="REGION_MANAGER">REGION_MANAGER</option>
            <option value="VISUAL_MERCHANDISER">VISUAL_MERCHANDISER</option>
          </select>
        </label>
        <label className="field-block">
          <span>{t('authAdmin.pilotStores')}</span>
          <select
            aria-label={t('authAdmin.pilotStores')}
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
              authProvider,
              providerSubject: providerSubject.trim(),
              username: username.trim(),
              email: email.trim(),
              roleCode,
              storeIds,
            })
          }}
        >
          {mutation.isPending ? t('authAdmin.creating') : t('authAdmin.createPilotBinding')}
        </button>
      </div>
    </article>
  )
}
