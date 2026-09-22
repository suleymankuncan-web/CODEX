import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocalization } from '../localization/useLocalization'
import { translatedNotificationMessage } from '../../lib/notification-messages'
import { nationalPhoneDigits } from '../../lib/phone-number'
import {
  createOffboardingRequest,
  createSellerCodeRequest,
  getOffboardingRequests,
  getPositionOptions,
  getSellerCodeRequests,
  getStoreEmployees,
  resubmitOffboardingRequest,
  resubmitSellerCodeRequest,
  type OffboardingRequest,
  type SellerCodeRequest,
} from './api'
import { OffboardingRequestForm } from '../../pages/store-approvals-offboarding-form'
import { ReturnedRequestsPanel } from '../../pages/store-approvals-returned-panel'
import { SellerCodeRequestForm } from '../../pages/store-approvals-seller-code-form'
import {
  createStoreApprovalsPageState,
  storeApprovalsPageReducer,
} from '../../pages/store-approvals-model'

export type WorkforceRequestDialog = 'seller' | 'offboarding' | 'returned' | null

export function WorkforceRequestDialogs(input: {
  dialog: WorkforceRequestDialog
  onDialogChange: (dialog: WorkforceRequestDialog) => void
  storeId: string
  storeName: string
  handoffRequestId?: string | null
  handoffRequestType?: string | null
}) {
  const loadedHandoff = useRef<string | null>(null)
  const { onDialogChange } = input
  const queryClient = useQueryClient()
  const { locale, t } = useLocalization()
  const enabled = Boolean(input.storeId && input.dialog)
  const [state, dispatch] = useReducer(
    storeApprovalsPageReducer,
    { defaultTargetLabel: t('storeApprovals.targetLabelDefault'), initialPanel: 'sellerCodeRequest' },
    createStoreApprovalsPageState,
  )
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', 'workforce-command-dialog', input.storeId],
    queryFn: () => getStoreEmployees(input.storeId),
    enabled,
  })
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', 'workforce-command-dialog', input.storeId],
    queryFn: () => getPositionOptions(input.storeId),
    enabled,
  })
  const sellerRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'workforce-command-dialog', input.storeId],
    queryFn: () => getSellerCodeRequests({ storeId: input.storeId, limit: 50, offset: 0 }),
    enabled,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'workforce-command-dialog', input.storeId],
    queryFn: () => getOffboardingRequests({ storeId: input.storeId, limit: 50, offset: 0 }),
    enabled,
  })
  const returnedSeller = useMemo(
    () => sellerRequestsQuery.data?.items.filter((item) => item.storeId === input.storeId && item.status === 'rejected') ?? [],
    [input.storeId, sellerRequestsQuery.data?.items],
  )
  const returnedOffboarding = useMemo(
    () => offboardingRequestsQuery.data?.items.filter((item) => item.storeId === input.storeId && item.status === 'rejected') ?? [],
    [input.storeId, offboardingRequestsQuery.data?.items],
  )
  const sellerMutation = useMutation({
    mutationFn: createSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: translatedNotificationMessage(result.command.message) ?? result.command.message })
    },
  })
  const sellerResubmitMutation = useMutation({
    mutationFn: resubmitSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: translatedNotificationMessage(result.command.message) ?? result.command.message })
    },
  })
  const offboardingMutation = useMutation({
    mutationFn: createOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['store-workforce-command'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: translatedNotificationMessage(result.command.message) ?? result.command.message })
    },
  })
  const offboardingResubmitMutation = useMutation({
    mutationFn: resubmitOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: translatedNotificationMessage(result.command.message) ?? result.command.message })
    },
  })
  const submitSeller = () => {
    const payload = {
      firstName: state.sellerFirstName.trim(),
      lastName: state.sellerLastName.trim(),
      nationalId: state.sellerNationalId.trim(),
      phoneNumber: nationalPhoneDigits(state.sellerPhoneNumber),
      username: state.sellerEmail.trim().toLowerCase(),
      email: state.sellerEmail.trim(),
      hireDate: state.sellerHireDate,
      requestedPositionId: state.sellerPositionId.trim(),
      employmentType: state.sellerEmploymentType,
      ...(state.sellerRequestReason.trim() ? { requestReason: state.sellerRequestReason.trim() } : {}),
    }
    if (state.editingSellerRequestId) sellerResubmitMutation.mutate({ requestId: state.editingSellerRequestId, ...payload })
    else sellerMutation.mutate({ storeId: input.storeId, requestType: 'create_code', ...payload })
  }
  const submitOffboarding = () => {
    const requestReason = state.offboardingRequestReason.trim()
    const payload = {
      employeeId: state.offboardingEmployeeId,
      terminationDate: state.offboardingTerminationDate,
      terminationReason: requestReason.slice(0, 80),
      requestReason,
    }
    if (state.editingOffboardingRequestId) offboardingResubmitMutation.mutate({ requestId: state.editingOffboardingRequestId, ...payload })
    else offboardingMutation.mutate({ storeId: input.storeId, ...payload })
  }
  const editSeller = useCallback((item: SellerCodeRequest) => {
    dispatch({ type: 'loadSellerRequestEdit', item, notice: '' })
    onDialogChange('seller')
  }, [onDialogChange])
  const editOffboarding = useCallback((item: OffboardingRequest) => {
    dispatch({ type: 'loadOffboardingRequestEdit', item, notice: '' })
    onDialogChange('offboarding')
  }, [onDialogChange])
  useEffect(() => {
    if (!input.handoffRequestId || !input.handoffRequestType) return
    const key = `${input.handoffRequestType}:${input.handoffRequestId}`
    if (loadedHandoff.current === key) return
    if (input.handoffRequestType === 'sellerCode') {
      const item = sellerRequestsQuery.data?.items.find((request) => request.requestId === input.handoffRequestId)
      if (item) { editSeller(item); loadedHandoff.current = key }
    }
    if (input.handoffRequestType === 'offboarding') {
      const item = offboardingRequestsQuery.data?.items.find((request) => request.requestId === input.handoffRequestId)
      if (item) { editOffboarding(item); loadedHandoff.current = key }
    }
  }, [editOffboarding, editSeller, input.handoffRequestId, input.handoffRequestType, offboardingRequestsQuery.data?.items, sellerRequestsQuery.data?.items])
  const canSubmitSeller = Boolean(
    input.storeId && state.sellerFirstName.trim() && state.sellerLastName.trim()
    && /^[0-9]{11}$/.test(state.sellerNationalId.trim()) && /^(?=(?:\D*\d){10,15}\D*$)[0-9+() -]{10,20}$/.test(state.sellerPhoneNumber.trim())
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.sellerEmail.trim())
    && state.sellerHireDate && state.sellerPositionId.trim() && state.sellerEmploymentType && state.sellerRequestReason.trim(),
  )
  const canSubmitOffboarding = Boolean(
    input.storeId && state.offboardingEmployeeId.trim()
    && state.offboardingTerminationDate && state.offboardingRequestReason.trim(),
  )

  return (
    <Dialog open={input.dialog !== null} onOpenChange={(open) => { if (!open) input.onDialogChange(null) }}>
      <DialogContent className="workforce-request-dialog">
        <DialogHeader className="workforce-drawer-heading">
          <DialogTitle>
            {input.dialog === 'seller' ? 'Personel sicil talebi' : input.dialog === 'offboarding' ? 'İşten ayrılma talebi' : 'İade edilen talepler'}
          </DialogTitle>
          <DialogDescription>{input.storeName}</DialogDescription>
        </DialogHeader>
        <div className="workforce-request-body">
          {input.dialog === 'seller' ? (
            <SellerCodeRequestForm
              access={{ createAllowed: Boolean(input.storeId), submitAllowed: canSubmitSeller }}
              editingRequestId={state.editingSellerRequestId}
              errors={{ create: sellerMutation.error, createVisible: sellerMutation.isError, resubmit: sellerResubmitMutation.error, resubmitVisible: sellerResubmitMutation.isError }}
              onCancelEdit={() => dispatch({ type: 'cancelSellerRequestEdit' })}
              onEmploymentTypeChange={(value) => dispatch({ type: 'setSellerEmploymentType', value })}
              onFirstNameChange={(value) => dispatch({ type: 'setSellerFirstName', value })}
              onHireDateChange={(value) => dispatch({ type: 'setSellerHireDate', value })}
              onLastNameChange={(value) => dispatch({ type: 'setSellerLastName', value })}
              onNationalIdChange={(value) => dispatch({ type: 'setSellerNationalId', value })}
              onPhoneNumberChange={(value) => dispatch({ type: 'setSellerPhoneNumber', value })}
              onUsernameChange={(value) => dispatch({ type: 'setSellerUsername', value })}
              onEmailChange={(value) => dispatch({ type: 'setSellerEmail', value })}
              onPositionIdChange={(value) => dispatch({ type: 'setSellerPositionId', value })}
              onRequestReasonChange={(value) => dispatch({ type: 'setSellerRequestReason', value })}
              onSubmit={submitSeller}
              positionOptionsQuery={positionOptionsQuery}
              sellerEmploymentType={state.sellerEmploymentType}
              sellerFirstName={state.sellerFirstName}
              sellerHireDate={state.sellerHireDate}
              sellerLastName={state.sellerLastName}
              sellerNationalId={state.sellerNationalId}
              sellerPhoneNumber={state.sellerPhoneNumber}
              sellerUsername={state.sellerUsername}
              sellerEmail={state.sellerEmail}
              sellerPositionId={state.sellerPositionId}
              sellerRequestReason={state.sellerRequestReason}
              submission={{ notice: state.sellerRequestNotice, pending: sellerMutation.isPending || sellerResubmitMutation.isPending }}
              storeId={input.storeId}
              storeLabel={input.storeName}
              t={t}
            />
          ) : null}
          {input.dialog === 'offboarding' ? (
            <OffboardingRequestForm
              access={{ createAllowed: Boolean(input.storeId), submitAllowed: canSubmitOffboarding }}
              editingRequestId={state.editingOffboardingRequestId}
              errors={{ create: offboardingMutation.error, createVisible: offboardingMutation.isError, resubmit: offboardingResubmitMutation.error, resubmitVisible: offboardingResubmitMutation.isError }}
              offboardingEmployeeId={state.offboardingEmployeeId}
              offboardingRequestReason={state.offboardingRequestReason}
              offboardingTerminationDate={state.offboardingTerminationDate}
              onCancelEdit={() => dispatch({ type: 'cancelOffboardingRequestEdit' })}
              onEmployeeIdChange={(value) => dispatch({ type: 'setOffboardingEmployeeId', value })}
              onRequestReasonChange={(value) => dispatch({ type: 'setOffboardingRequestReason', value })}
              onSubmit={submitOffboarding}
              onTerminationDateChange={(value) => dispatch({ type: 'setOffboardingTerminationDate', value })}
              submission={{ notice: state.offboardingNotice, pending: offboardingMutation.isPending || offboardingResubmitMutation.isPending }}
              storeEmployeesQuery={storeEmployeesQuery}
              t={t}
            />
          ) : null}
          {input.dialog === 'returned' && (sellerRequestsQuery.isPending || offboardingRequestsQuery.isPending)
            && !sellerRequestsQuery.isError && !offboardingRequestsQuery.isError ? (
            <p role="status">{locale === 'tr' ? 'İade edilen talepler yükleniyor…' : 'Loading returned requests…'}</p>
          ) : input.dialog === 'returned' ? (
            <ReturnedRequestsPanel
              locale={locale}
              returnedOffboardingRequests={returnedOffboarding}
              returnedSellerCodeRequests={returnedSeller}
              sellerCodeRequestsError={sellerRequestsQuery.error}
              hasSellerCodeRequestsError={sellerRequestsQuery.isError}
              offboardingRequestsError={offboardingRequestsQuery.error}
              hasOffboardingRequestsError={offboardingRequestsQuery.isError}
              onEditOffboardingRequest={editOffboarding}
              onEditSellerCodeRequest={editSeller}
              t={t}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
