import { useMemo, useReducer, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  BriefcaseBusiness,
  ClipboardList,
  Clock3,
  RotateCcw,
  UserMinus,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getActionStoreIds } from '../features/auth/authorization'
import { useLocalization } from '../features/localization/useLocalization'
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
  type StoreEmployee,
} from '../features/workforce/api'
import { formatDate, formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { StoreRequestFeedback } from './store-approvals-atoms'
import { OffboardingRequestForm } from './store-approvals-offboarding-form'
import { ReturnedRequestsPanel } from './store-approvals-returned-panel'
import { SellerCodeRequestForm } from './store-approvals-seller-code-form'
import {
  createStoreApprovalsPageState,
  formatApprovalStatus,
  storeApprovalsPageReducer,
} from './store-approvals-model'
import {
  buildWorkforceRequestSummaries,
  deriveWorkforceSummary,
  getTenureFromDate,
  isClosedWorkforceStatus,
  parseDateOnly,
} from './store-workforce-model'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'
import { RegionWorkforceView } from './store-workforce-region-view'

type WorkforceMode = 'region' | 'store'
type WorkforcePanel = 'personnel' | 'sellerCodeRequest' | 'offboardingRequest' | 'returnedRequests'

function resolveWorkforceMode(authSummary: AuthSessionSummary | null): WorkforceMode {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('REGION_MANAGER') ? 'region' : 'store'
}

export function StoreWorkforcePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const mode = resolveWorkforceMode(input.authSummary)

  if (mode === 'region') {
    return <RegionWorkforceView authSummary={input.authSummary} />
  }

  return <StoreManagerWorkforce authSummary={input.authSummary} />
}

function StoreManagerWorkforce(input: {
  authSummary: AuthSessionSummary | null
}) {
  const queryClient = useQueryClient()
  const { locale, t } = useLocalization()
  const storeIds = getActionStoreIds(input.authSummary)
  const storeId = storeIds[0] ?? ''
  const now = useMemo(() => new Date(), [])
  const [activePanel, setActivePanel] = useState<WorkforcePanel>('personnel')
  const [state, dispatch] = useReducer(
    storeApprovalsPageReducer,
    {
      defaultTargetLabel: t('storeApprovals.targetLabelDefault'),
      initialPanel: 'sellerCodeRequest',
    },
    createStoreApprovalsPageState,
  )

  const scopeKey = [
    'store-workforce',
    (input.authSummary?.user.roleCodes ?? []).join('|'),
    storeIds.join('|'),
    storeId,
  ].join(':')
  const enabled = Boolean(storeId)
  const storeEmployeesQuery = useQuery({
    queryKey: ['workforce-store-employees', 'store-workforce', scopeKey],
    queryFn: () => getStoreEmployees(storeId),
    enabled,
  })
  const positionOptionsQuery = useQuery({
    queryKey: ['workforce-position-options', 'store-workforce', scopeKey],
    queryFn: () => getPositionOptions(storeId),
    enabled,
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['seller-code-requests', 'store-workforce', scopeKey],
    queryFn: () => getSellerCodeRequests(),
    enabled,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'store-workforce', scopeKey],
    queryFn: () => getOffboardingRequests(),
    enabled,
  })

  const employees = storeEmployeesQuery.data?.items ?? []
  const sellerCodeRequests =
    sellerCodeRequestsQuery.data?.items.filter((item) => item.storeId === storeId) ?? []
  const offboardingRequests =
    offboardingRequestsQuery.data?.items.filter((item) => item.storeId === storeId) ?? []
  const returnedSellerCodeRequests = sellerCodeRequests.filter((item) => item.status === 'rejected')
  const returnedOffboardingRequests = offboardingRequests.filter((item) => item.status === 'rejected')
  const requests = buildWorkforceRequestSummaries({
    offboardingRequests,
    sellerCodeRequests,
  })
  const openMovementCount = requests.filter((item) => !isClosedWorkforceStatus(item.status)).length
  const workforceSummary = deriveWorkforceSummary(employees, now, locale)
  const sellerCodeMutation = useMutation({
    mutationFn: createSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: result.command.message })
    },
  })
  const resubmitSellerCodeMutation = useMutation({
    mutationFn: resubmitSellerCodeRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['seller-code-requests'] })
      dispatch({ type: 'resetSellerRequestSuccess', message: result.command.message })
    },
  })
  const offboardingMutation = useMutation({
    mutationFn: createOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: result.command.message })
    },
  })
  const resubmitOffboardingMutation = useMutation({
    mutationFn: resubmitOffboardingRequest,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['offboarding-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['workforce-store-employees'] })
      dispatch({ type: 'resetOffboardingRequestSuccess', message: result.command.message })
    },
  })
  const canSubmitSellerCodeRequest =
    Boolean(storeId) &&
    Boolean(state.sellerFirstName.trim()) &&
    Boolean(state.sellerLastName.trim()) &&
    /^[0-9]{11}$/.test(state.sellerNationalId.trim()) &&
    Boolean(state.sellerPhoneNumber.trim()) &&
    Boolean(state.sellerHireDate) &&
    Boolean(state.sellerPositionId.trim())
  const canSubmitOffboardingRequest =
    Boolean(storeId) &&
    Boolean(state.offboardingEmployeeId.trim()) &&
    Boolean(state.offboardingTerminationDate) &&
    Boolean(state.offboardingRequestReason.trim())
  const sellerRequestPending = sellerCodeMutation.isPending || resubmitSellerCodeMutation.isPending
  const offboardingRequestPending = offboardingMutation.isPending || resubmitOffboardingMutation.isPending

  const submitSellerCodeRequest = () => {
    const trimmedSellerRequestReason = state.sellerRequestReason.trim()
    const payload = {
      firstName: state.sellerFirstName.trim(),
      lastName: state.sellerLastName.trim(),
      nationalId: state.sellerNationalId.trim(),
      phoneNumber: state.sellerPhoneNumber.trim(),
      hireDate: state.sellerHireDate,
      requestedPositionId: state.sellerPositionId.trim(),
      employmentType: state.sellerEmploymentType,
      ...(trimmedSellerRequestReason ? { requestReason: trimmedSellerRequestReason } : {}),
    }

    if (state.editingSellerRequestId) {
      resubmitSellerCodeMutation.mutate({
        requestId: state.editingSellerRequestId,
        ...payload,
      })
      return
    }

    sellerCodeMutation.mutate({
      storeId,
      requestType: 'create_code',
      ...payload,
    })
  }
  const submitOffboardingRequest = () => {
    const requestReason = state.offboardingRequestReason.trim()
    const payload = {
      employeeId: state.offboardingEmployeeId,
      terminationDate: state.offboardingTerminationDate,
      terminationReason: requestReason.slice(0, 80),
      requestReason,
    }

    if (state.editingOffboardingRequestId) {
      resubmitOffboardingMutation.mutate({
        requestId: state.editingOffboardingRequestId,
        ...payload,
      })
      return
    }

    offboardingMutation.mutate({
      storeId,
      ...payload,
    })
  }
  const startEditingSellerRequest = (item: SellerCodeRequest) => {
    dispatch({
      type: 'loadSellerRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedSellerLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedSellerLoaded'),
    })
    setActivePanel('sellerCodeRequest')
  }
  const startEditingOffboardingRequest = (item: OffboardingRequest) => {
    dispatch({
      type: 'loadOffboardingRequestEdit',
      item,
      notice: item.reviewNote
        ? t('storeApprovals.returnedOffboardingLoadedWithNote', { note: item.reviewNote })
        : t('storeApprovals.returnedOffboardingLoaded'),
    })
    setActivePanel('offboardingRequest')
  }

  if (!storeId) {
    return (
      <StoreSurfacePage
        ariaLabel={t('storeWorkforce.title')}
        className="tw:mx-auto tw:w-full tw:max-w-7xl"
        testId="store-workforce-page"
      >
        <StoreSurfaceHeader
          eyebrow={t('storeWorkforce.eyebrow')}
          title={t('storeWorkforce.title')}
          description={t('storeWorkforce.missingActionStoreCopy')}
        />
        <StoreEmptyState
          title={t('storeWorkforce.missingActionStoreTitle')}
          titleAsHeading
          description={t('storeWorkforce.missingActionStoreCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (storeEmployeesQuery.isLoading && !storeEmployeesQuery.data) {
    return (
      <StoreSurfacePage
        ariaLabel={t('storeWorkforce.title')}
        className="tw:mx-auto tw:w-full tw:max-w-7xl"
        testId="store-workforce-page"
      >
        <StoreSurfaceHeader
          eyebrow={t('storeWorkforce.eyebrow')}
          title={t('storeWorkforce.title')}
          description={t('storeWorkforce.storeManagerDescription')}
        />
        <StoreSectionCard title={t('storeWorkforce.personnelLoadingTitle')}>
          <StoreRequestFeedback tone="success">
            {t('storeWorkforce.personnelLoadingCopy')}
          </StoreRequestFeedback>
        </StoreSectionCard>
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage
      ariaLabel={t('storeWorkforce.title')}
      ariaLabelledBy="store-workforce-title"
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-workforce-page"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeWorkforce.eyebrow')}
        title={t('storeWorkforce.title')}
        titleId="store-workforce-title"
        description={t('storeWorkforce.storeManagerDescription')}
        badges={[
          { label: t('storeWorkforce.storeBadge'), tone: 'accent' },
          { label: t('storeWorkforce.realDataBadge'), tone: 'calm' },
        ]}
      />

      <StoreMetricGrid ariaLabel={t('storeWorkforce.summaryAria')}>
        <StoreMetricCard
          icon={<UsersRound data-icon="inline-start" />}
          title={t('storeWorkforce.personnelScope')}
          value={formatNumber(employees.length, locale)}
          note={t('storeWorkforce.personnelScopeNote')}
          tone="accent"
        />
        <StoreMetricCard
          icon={<Clock3 data-icon="inline-start" />}
          title={t('storeWorkforce.averageTenure')}
          value={workforceSummary.averageTenureLabel}
          note={workforceSummary.missingTenureCount > 0
            ? t('storeWorkforce.averageTenureMissing', {
              count: workforceSummary.missingTenureCount,
            })
            : t('storeWorkforce.averageTenureNote')}
          tone="calm"
        />
        <StoreMetricCard
          icon={<BriefcaseBusiness data-icon="inline-start" />}
          title={t('storeWorkforce.normActual')}
          value={t('storeWorkforce.valueNotConfigured')}
          note={t('storeWorkforce.normActualHonestNote')}
          tone="neutral"
        />
        <StoreMetricCard
          icon={<ClipboardList data-icon="inline-start" />}
          title={t('storeWorkforce.openMovements')}
          value={formatNumber(openMovementCount, locale)}
          note={t('storeWorkforce.openMovementsNote')}
          tone={openMovementCount > 0 ? 'warning' : 'calm'}
        />
      </StoreMetricGrid>

      <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4">
          <StoreSectionCard
            title={t('storeWorkforce.personnelListTitle')}
            description={t('storeWorkforce.personnelListDescription')}
            badge={{
              label: t('storeWorkforce.personnelListBadge', {
                count: employees.length,
              }),
              tone: 'calm',
            }}
            testId="store-workforce-personnel-list"
          >
            {storeEmployeesQuery.isError ? (
              <StoreErrorState
                title={t('storeWorkforce.personnelErrorTitle')}
                description={getErrorMessage(storeEmployeesQuery.error)}
              />
            ) : employees.length === 0 ? (
              <StoreEmptyState
                title={t('storeWorkforce.personnelEmptyTitle')}
                titleAsHeading
                description={t('storeWorkforce.personnelEmptyCopy')}
              />
            ) : (
              <StoreStackedList>
                {employees.map((employee) => (
                  <PersonnelRow
                    key={employee.employeeId}
                    employee={employee}
                    locale={locale}
                    now={now}
                    t={t}
                  />
                ))}
              </StoreStackedList>
            )}
          </StoreSectionCard>

          <StoreSectionCard
            title={t('storeWorkforce.positionDistributionTitle')}
            description={t('storeWorkforce.positionDistributionDescription')}
            badge={{
              label: t('storeWorkforce.positionDistributionBadge', {
                count: workforceSummary.positionRows.length,
              }),
              tone: 'accent',
            }}
          >
            {workforceSummary.positionRows.length === 0 ? (
              <StoreEmptyState
                title={t('storeWorkforce.positionDistributionEmptyTitle')}
                titleAsHeading
                description={t('storeWorkforce.positionDistributionEmptyCopy')}
              />
            ) : (
              <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                {workforceSummary.positionRows.map((row) => (
                  <div
                    key={row.label}
                    className="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/70 tw:p-3"
                  >
                    <span className="tw:min-w-0 tw:truncate tw:text-sm tw:font-medium tw:text-foreground">
                      {row.label}
                    </span>
                    <StoreStatusBadge tone="calm">{formatNumber(row.count, locale)}</StoreStatusBadge>
                  </div>
                ))}
              </div>
            )}
          </StoreSectionCard>

          <StoreSectionCard
            title={t('storeWorkforce.tenureBucketsTitle')}
            description={t('storeWorkforce.tenureBucketsDescription')}
          >
            <StoreInfoGrid
              items={workforceSummary.tenureBuckets.map((bucket) => ({
                label: bucket.label,
                value: formatNumber(bucket.count, locale),
                tone: bucket.count > 0 ? 'calm' : 'neutral',
              }))}
            />
          </StoreSectionCard>
        </div>

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4">
          <StoreSectionCard
            title={t('storeWorkforce.requestCenterTitle')}
            description={t('storeWorkforce.requestCenterDescription')}
            badge={{
              label: t('storeWorkforce.requestCenterBadge', {
                count: requests.length,
              }),
              tone: requests.length > 0 ? 'warning' : 'neutral',
            }}
          >
            {sellerCodeRequestsQuery.isError || offboardingRequestsQuery.isError ? (
              <div className="tw:flex tw:flex-col tw:gap-2">
                {sellerCodeRequestsQuery.isError ? (
                  <StoreRequestFeedback tone="error">
                    {getErrorMessage(sellerCodeRequestsQuery.error)}
                  </StoreRequestFeedback>
                ) : null}
                {offboardingRequestsQuery.isError ? (
                  <StoreRequestFeedback tone="error">
                    {getErrorMessage(offboardingRequestsQuery.error)}
                  </StoreRequestFeedback>
                ) : null}
              </div>
            ) : requests.length === 0 ? (
              <StoreEmptyState
                title={t('storeWorkforce.requestsEmptyTitle')}
                titleAsHeading
                description={t('storeWorkforce.requestsEmptyCopy')}
              />
            ) : (
              <StoreStackedList>
                {requests.slice(0, 6).map((request) => (
                  <StoreStackedRow key={request.key}>
                    <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                      <div className="tw:min-w-0">
                        <strong className="tw:block tw:truncate tw:text-sm tw:font-medium tw:text-foreground">
                          {request.title}
                        </strong>
                        <span className="tw:block tw:truncate tw:text-xs tw:text-muted-foreground">
                          {request.subtitle}
                        </span>
                        <span className="tw:mt-1 tw:block tw:text-xs tw:text-muted-foreground">
                          {formatDateTime(request.updatedAt, locale)}
                        </span>
                      </div>
                      <StoreStatusBadge tone={mapWorkforceStatusTone(request.status)}>
                        {formatApprovalStatus(request.status, t)}
                      </StoreStatusBadge>
                    </div>
                  </StoreStackedRow>
                ))}
              </StoreStackedList>
            )}
          </StoreSectionCard>

          <StoreSectionCard
            title={t('storeWorkforce.requestActionTitle')}
            description={t('storeWorkforce.requestActionDescription')}
            testId="store-workforce-request-workbench"
          >
            <ToggleGroup
              aria-label={t('storeWorkforce.requestActionAria')}
              className="store-approvals-action-tabs tw:mb-3"
              type="single"
              value={activePanel}
              onValueChange={(value) => {
                if (value) setActivePanel(value as WorkforcePanel)
              }}
            >
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="personnel"
                aria-label={t('storeWorkforce.openPersonnelPanel')}
              >
                {t('storeWorkforce.openPersonnelPanel')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="sellerCodeRequest"
                aria-label={t('storeApprovals.openSellerCodeRequest')}
              >
                <UserPlus size={14} />
                {t('storeApprovals.openSellerCodeRequest')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="offboardingRequest"
                aria-label={t('storeApprovals.openOffboardingRequest')}
              >
                <UserMinus size={14} />
                {t('storeApprovals.openOffboardingRequest')}
              </ToggleGroupItem>
              <ToggleGroupItem
                className="store-approvals-action-tab"
                value="returnedRequests"
                aria-label={t('storeApprovals.openReturnedRequests')}
              >
                <RotateCcw size={14} />
                {t('storeApprovals.openReturnedRequests')}
              </ToggleGroupItem>
            </ToggleGroup>

            {activePanel === 'personnel' ? (
              <StoreEmptyState
                title={t('storeWorkforce.personnelActionTitle')}
                titleAsHeading
                description={t('storeWorkforce.personnelActionCopy')}
              />
            ) : null}
            {activePanel === 'sellerCodeRequest' ? (
              <SellerCodeRequestForm
                access={{
                  createAllowed: enabled,
                  submitAllowed: canSubmitSellerCodeRequest,
                }}
                editingRequestId={state.editingSellerRequestId}
                errors={{
                  create: sellerCodeMutation.error,
                  createVisible: sellerCodeMutation.isError,
                  resubmit: resubmitSellerCodeMutation.error,
                  resubmitVisible: resubmitSellerCodeMutation.isError,
                }}
                onCancelEdit={() => dispatch({ type: 'cancelSellerRequestEdit' })}
                onEmploymentTypeChange={(value) =>
                  dispatch({ type: 'setSellerEmploymentType', value })
                }
                onFirstNameChange={(value) => dispatch({ type: 'setSellerFirstName', value })}
                onHireDateChange={(value) => dispatch({ type: 'setSellerHireDate', value })}
                onLastNameChange={(value) => dispatch({ type: 'setSellerLastName', value })}
                onNationalIdChange={(value) => dispatch({ type: 'setSellerNationalId', value })}
                onPhoneNumberChange={(value) => dispatch({ type: 'setSellerPhoneNumber', value })}
                onPositionIdChange={(value) => dispatch({ type: 'setSellerPositionId', value })}
                onRequestReasonChange={(value) =>
                  dispatch({ type: 'setSellerRequestReason', value })
                }
                onSubmit={submitSellerCodeRequest}
                positionOptionsQuery={positionOptionsQuery}
                sellerEmploymentType={state.sellerEmploymentType}
                sellerFirstName={state.sellerFirstName}
                sellerHireDate={state.sellerHireDate}
                sellerLastName={state.sellerLastName}
                sellerNationalId={state.sellerNationalId}
                sellerPhoneNumber={state.sellerPhoneNumber}
                sellerPositionId={state.sellerPositionId}
                sellerRequestReason={state.sellerRequestReason}
                submission={{
                  notice: state.sellerRequestNotice,
                  pending: sellerRequestPending,
                }}
                storeId={storeId}
                t={t}
              />
            ) : null}
            {activePanel === 'offboardingRequest' ? (
              <OffboardingRequestForm
                access={{
                  createAllowed: enabled,
                  submitAllowed: canSubmitOffboardingRequest,
                }}
                editingRequestId={state.editingOffboardingRequestId}
                errors={{
                  create: offboardingMutation.error,
                  createVisible: offboardingMutation.isError,
                  resubmit: resubmitOffboardingMutation.error,
                  resubmitVisible: resubmitOffboardingMutation.isError,
                }}
                offboardingEmployeeId={state.offboardingEmployeeId}
                offboardingRequestReason={state.offboardingRequestReason}
                offboardingTerminationDate={state.offboardingTerminationDate}
                onCancelEdit={() => dispatch({ type: 'cancelOffboardingRequestEdit' })}
                onEmployeeIdChange={(value) =>
                  dispatch({ type: 'setOffboardingEmployeeId', value })
                }
                onRequestReasonChange={(value) =>
                  dispatch({ type: 'setOffboardingRequestReason', value })
                }
                onSubmit={submitOffboardingRequest}
                onTerminationDateChange={(value) =>
                  dispatch({ type: 'setOffboardingTerminationDate', value })
                }
                submission={{
                  notice: state.offboardingNotice,
                  pending: offboardingRequestPending,
                }}
                storeEmployeesQuery={storeEmployeesQuery}
                t={t}
              />
            ) : null}
            {activePanel === 'returnedRequests' ? (
              <ReturnedRequestsPanel
                locale={locale}
                returnedOffboardingRequests={returnedOffboardingRequests}
                returnedSellerCodeRequests={returnedSellerCodeRequests}
                sellerCodeRequestsError={sellerCodeRequestsQuery.error}
                hasSellerCodeRequestsError={sellerCodeRequestsQuery.isError}
                offboardingRequestsError={offboardingRequestsQuery.error}
                hasOffboardingRequestsError={offboardingRequestsQuery.isError}
                onEditOffboardingRequest={startEditingOffboardingRequest}
                onEditSellerCodeRequest={startEditingSellerRequest}
                t={t}
              />
            ) : null}
          </StoreSectionCard>
        </div>
      </div>
    </StoreSurfacePage>
  )
}

function PersonnelRow(input: {
  employee: StoreEmployee
  locale: AppLocale
  now: Date
  t: ReturnType<typeof useLocalization>['t']
}) {
  const tenure = getTenureFromDate(input.employee.assignmentStartDate, input.now, input.locale)
  const reference = input.employee.externalEmployeeRef ?? input.t('storeWorkforce.missingReference')

  return (
    <StoreStackedRow className="tw:grid tw:gap-3 tw:md:grid-cols-[minmax(180px,1.2fr)_minmax(140px,0.8fr)_minmax(120px,0.7fr)_minmax(120px,0.7fr)] tw:md:items-center">
      <div className="tw:min-w-0">
        <strong className="tw:block tw:truncate tw:text-sm tw:font-medium tw:text-foreground">
          {input.employee.displayName || input.t('storeWorkforce.missingEmployeeName')}
        </strong>
        <span className="tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{reference}</span>
      </div>
      <div className="tw:min-w-0">
        <span className="tw:block tw:text-[11px] tw:font-medium tw:uppercase tw:tracking-wide tw:text-muted-foreground">
          {input.t('storeWorkforce.position')}
        </span>
        <span className="tw:block tw:truncate tw:text-sm tw:text-foreground">
          {input.employee.positionName || input.t('storeWorkforce.missingPosition')}
        </span>
      </div>
      <div>
        <span className="tw:block tw:text-[11px] tw:font-medium tw:uppercase tw:tracking-wide tw:text-muted-foreground">
          {input.t('storeWorkforce.assignmentStart')}
        </span>
        <span className="tw:block tw:text-sm tw:text-foreground">
          {formatSafeDate(input.employee.assignmentStartDate, input.locale, input.t)}
        </span>
      </div>
      <div>
        <span className="tw:block tw:text-[11px] tw:font-medium tw:uppercase tw:tracking-wide tw:text-muted-foreground">
          {input.t('storeWorkforce.tenure')}
        </span>
        <StoreStatusBadge tone={tenure.months === null ? 'neutral' : 'calm'}>
          {tenure.label}
        </StoreStatusBadge>
      </div>
    </StoreStackedRow>
  )
}

function formatSafeDate(
  value: string,
  locale: AppLocale,
  t: ReturnType<typeof useLocalization>['t'],
) {
  return parseDateOnly(value) ? formatDate(value, locale) : t('storeWorkforce.missingDate')
}

function mapWorkforceStatusTone(status: string) {
  if (status === 'approved') return 'calm'
  if (status === 'rejected') return 'warning'
  if (status.includes('pending')) return 'accent'
  return 'neutral'
}
