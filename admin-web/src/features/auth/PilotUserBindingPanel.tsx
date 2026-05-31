import { useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalization } from '../localization/useLocalization'
import { getErrorMessage } from '../../lib/format'
import { createPilotUserBinding, type AuthLookupStore } from './api'
import { AdminStatePanel, AdminSurfaceSection } from '../../pages/admin-surface-primitives'
import {
  AuthActionRow,
  AuthButton,
  AuthField,
  AuthFormGrid,
  AuthInput,
  AuthNativeSelect,
} from './AuthSurfacePrimitives'

type PilotRole = 'REGION_MANAGER' | 'STORE_MANAGER' | 'VISUAL_MERCHANDISER'
type PilotAuthProvider = 'oidc' | 'clerk'

type PilotUserBindingState = {
  employeeId: string
  providerSubject: string
  username: string
  email: string
  authProvider: PilotAuthProvider
  roleCode: PilotRole
  storeIds: string[]
  feedback: string | null
  errorFeedback: string | null
}

type PilotUserBindingAction =
  | {
      type: 'set-text-field'
      field: keyof Pick<PilotUserBindingState, 'employeeId' | 'providerSubject' | 'username' | 'email'>
      value: string
    }
  | { type: 'set-auth-provider'; authProvider: PilotAuthProvider }
  | { type: 'set-role-code'; roleCode: PilotRole }
  | { type: 'set-store-ids'; storeIds: string[] }
  | { type: 'submit-started' }
  | { type: 'submit-succeeded'; message: string }
  | { type: 'submit-failed'; message: string }

const pilotUserBindingInitialState: PilotUserBindingState = {
  employeeId: '',
  providerSubject: '',
  username: '',
  email: '',
  authProvider: 'clerk',
  roleCode: 'STORE_MANAGER',
  storeIds: [],
  feedback: null,
  errorFeedback: null,
}

function pilotUserBindingReducer(
  state: PilotUserBindingState,
  action: PilotUserBindingAction,
): PilotUserBindingState {
  switch (action.type) {
    case 'set-text-field':
      return { ...state, [action.field]: action.value }
    case 'set-auth-provider':
      return { ...state, authProvider: action.authProvider }
    case 'set-role-code':
      return { ...state, roleCode: action.roleCode }
    case 'set-store-ids':
      return { ...state, storeIds: action.storeIds }
    case 'submit-started':
      return { ...state, feedback: null, errorFeedback: null }
    case 'submit-succeeded':
      return { ...state, feedback: action.message, errorFeedback: null }
    case 'submit-failed':
      return { ...state, feedback: null, errorFeedback: action.message }
  }
}

export function PilotUserBindingPanel({ stores }: { stores: AuthLookupStore[] }) {
  const queryClient = useQueryClient()
  const { t } = useLocalization()
  const [state, dispatch] = useReducer(pilotUserBindingReducer, pilotUserBindingInitialState)
  const {
    employeeId,
    providerSubject,
    username,
    email,
    authProvider,
    roleCode,
    storeIds,
    feedback,
    errorFeedback,
  } = state

  const mutation = useMutation({
    mutationFn: createPilotUserBinding,
    onSuccess: async (response) => {
      dispatch({ type: 'submit-succeeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-users'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-lookups'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-role-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['auth-action-store-assignments'] }),
      ])
    },
    onError: (error) => {
      dispatch({ type: 'submit-failed', message: getErrorMessage(error) })
    },
  })

  return (
    <AdminSurfaceSection
      eyebrow={t('authAdmin.pilotAccess')}
      title={t('authAdmin.pilotUserBinding')}
    >
      {feedback ? <AdminStatePanel title={feedback} tone="success" /> : null}
      {errorFeedback ? <AdminStatePanel title={errorFeedback} tone="danger" /> : null}
      <AuthFormGrid>
        <AuthField label={t('authAdmin.pilotEmployeeId')}>
          <AuthInput
            aria-label={t('authAdmin.pilotEmployeeId')}
            value={employeeId}
            onChange={(event) =>
              dispatch({ type: 'set-text-field', field: 'employeeId', value: event.target.value })
            }
          />
        </AuthField>
        <AuthField label={t('authAdmin.pilotProviderSubject')}>
          <AuthInput
            aria-label={t('authAdmin.pilotProviderSubject')}
            value={providerSubject}
            onChange={(event) =>
              dispatch({ type: 'set-text-field', field: 'providerSubject', value: event.target.value })
            }
          />
        </AuthField>
        <AuthField label={t('authAdmin.pilotAuthProvider')}>
          <AuthNativeSelect
            aria-label={t('authAdmin.pilotAuthProvider')}
            value={authProvider}
            onChange={(event) =>
              dispatch({
                type: 'set-auth-provider',
                authProvider: event.target.value as PilotAuthProvider,
              })
            }
          >
            <option value="clerk">clerk</option>
            <option value="oidc">oidc</option>
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.pilotUsername')}>
          <AuthInput
            aria-label={t('authAdmin.pilotUsername')}
            value={username}
            onChange={(event) =>
              dispatch({ type: 'set-text-field', field: 'username', value: event.target.value })
            }
          />
        </AuthField>
        <AuthField label={t('authAdmin.pilotEmail')}>
          <AuthInput
            aria-label={t('authAdmin.pilotEmail')}
            value={email}
            onChange={(event) =>
              dispatch({ type: 'set-text-field', field: 'email', value: event.target.value })
            }
          />
        </AuthField>
        <AuthField label={t('authAdmin.pilotRole')}>
          <AuthNativeSelect
            aria-label={t('authAdmin.pilotRole')}
            value={roleCode}
            onChange={(event) =>
              dispatch({ type: 'set-role-code', roleCode: event.target.value as PilotRole })
            }
          >
            <option value="STORE_MANAGER">STORE_MANAGER</option>
            <option value="REGION_MANAGER">REGION_MANAGER</option>
            <option value="VISUAL_MERCHANDISER">VISUAL_MERCHANDISER</option>
          </AuthNativeSelect>
        </AuthField>
        <AuthField label={t('authAdmin.pilotStores')}>
          <AuthNativeSelect
            aria-label={t('authAdmin.pilotStores')}
            multiple
            value={storeIds}
            onChange={(event) => {
              dispatch({
                type: 'set-store-ids',
                storeIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value),
              })
            }}
          >
            {stores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeCode} - {store.storeName}
              </option>
            ))}
          </AuthNativeSelect>
        </AuthField>
      </AuthFormGrid>
      <AuthActionRow className="tw:justify-end">
        <AuthButton
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
            dispatch({ type: 'submit-started' })
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
        </AuthButton>
      </AuthActionRow>
    </AdminSurfaceSection>
  )
}
