import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { createIncentiveWorkspace } from '../e2e/store-incentives-command-fixtures'
import { createStoreContractSession, companyId } from '../e2e/store-page-contract-fixtures'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HrAxisToaster } from '@/components/hr-axis-toaster'
import { LocalizationProvider } from '@/features/localization/LocalizationProvider'
import { useLocalization } from '@/features/localization/useLocalization'
import { RegionManagerIncentivesOwner } from '@/features/incentives/command-workspace/region-manager-owner'
import { ReportViewerIncentivesView } from '@/features/incentives/command-workspace/report-viewer-view'
import { StorePrototypeCommandShell } from '@/prototypes/store-prototype-command-shell'
import type { IncentiveWorkspace } from '@/features/incentives/command-workspace/types'
import type { AuthSessionSummary } from '@/features/auth/api'
import { getStoreSalesTargetIncentiveWorkspace } from '@/features/incentives/api'
import '@/index.css'
import './incentives-preview.css'

if (!import.meta.env.DEV || !['localhost', '127.0.0.1'].includes(location.hostname)) throw new Error('This preview is local development only.')

type Role = 'report-viewer' | 'region-manager'
let role: Role = new URLSearchParams(location.search).get('role') === 'region-manager' ? 'region-manager' : 'report-viewer'
const period = '2026-09'
const base = structuredClone(createIncentiveWorkspace('report_viewer', { prototypeParity: true }).data) as IncentiveWorkspace
base.period = period; base.periodStart = `${period}-01`; base.periodEnd = `${period}-30`
base.regions.forEach((region, index) => {
  region.package.status = index === 0 ? 'not_submitted' : 'submitted'
  region.package.submittedAt = index === 0 ? null : '2026-10-01T09:00:00.000Z'
  if (index > 0) region.stores.forEach(store => { store.review.status = 'reviewed' })
})
const managers = base.regions.map(region => ({ userId: `manager-${region.regionId}`, displayName: region.regionManager.displayName!, storeIds: region.stores.map(store => store.storeId) }))
const session = createStoreContractSession('reportViewer')
const auth = { ...session, user: { ...session.user, authorizationContextVersion: 'local-preview', permissionScopes: { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } } } as AuthSessionSummary
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } })
const nativeFetch = window.fetch.bind(window)
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

// This dev-only HTML entry uses the real screen components. All API writes stay in memory.
window.fetch = async (request, options) => {
  const url = new URL(request instanceof Request ? request.url : String(request), location.origin)
  if (!url.pathname.startsWith('/api/')) {
    if (url.origin !== location.origin) return json({ message: 'Local preview blocks external requests.' }, 403)
    return nativeFetch(request, options)
  }
  const method = options?.method ?? 'GET'
  const body = options?.body ? JSON.parse(String(options.body)) : {}
  const requestedPeriod = url.searchParams.get('period') ?? body.period ?? period
  const path = url.pathname
  if (path === '/api/store/incentives/workspace' && method === 'GET') {
    const data = structuredClone(base)
    data.view = role === 'region-manager' ? 'region_manager' : 'report_viewer'
    data.period = requestedPeriod
    if (requestedPeriod !== period) data.regions = []
    if (role === 'region-manager') data.regions = data.regions.slice(0, 1)
    const editable = role === 'region-manager' && ['not_submitted', 'admin_returned'].includes(data.regions[0]?.package.status ?? '')
    data.capabilities = { canMarkStoreReview: editable, canCreateCorrection: editable, canVoidCorrection: editable, canSubmitPackage: editable }
    data.regions.forEach(region => {
      region.capabilities.canSubmitPackage = editable
      region.stores.forEach(store => { store.capabilities = { ...store.capabilities, canMarkStoreReview: editable, canCreateCorrection: editable, canVoidCorrection: editable } })
    })
    return json({ data })
  }
  if (path === '/api/store/incentives/final-approval' && method === 'GET') return json({ items: requestedPeriod !== period ? [] : base.regions.map(region => ({
    regionId: region.regionId, regionName: region.regionName, regionManagerName: region.regionManager.displayName,
    submittedByName: region.package.submittedAt ? region.regionManager.displayName : null, submittedByUserId: `manager-${region.regionId}`, reviewNote: region.package.reviewNote,
    regionPackageId: region.package.submittedAt ? `package-${region.regionId}` : null, submittedAt: region.package.submittedAt,
    status: region.package.status, storeCount: region.stores.length, submittedStoreCount: region.package.submittedAt ? region.stores.length : 0,
  })) })
  if (requestedPeriod !== period) return json({ message: 'Bu dönem için örnek veri yok.' }, 409)
  const region = base.regions.find(item => item.regionId === body.regionId)
  if (path === '/api/store/incentives/final-approval' && method === 'POST' && role === 'report-viewer' && region?.package.status === 'submitted' && body.submittedAt === region.package.submittedAt && body.regionPackageId === `package-${region.regionId}`) {
    if (body.decision === 'return' && !body.reviewNote?.trim()) return json({ message: 'Ret gerekçesi zorunludur.' }, 400)
    region.package.status = body.decision === 'return' ? 'admin_returned' : 'admin_approved'
    region.package.reviewNote = body.reviewNote?.trim() ?? null
    for (const store of region.stores) for (const row of store.rows) if (row.correction) row.correction.status = region.package.status
    return json({ data: { status: region.package.status } }, 201)
  }
  const editable = role === 'region-manager' && ['not_submitted', 'admin_returned'].includes(base.regions[0]?.package.status ?? '')
  if (editable && method === 'POST') {
    const stores = base.regions[0]!.stores
    const store = stores.find(item => item.storeId === body.storeId)
    if (path.endsWith('/store-reviews') && store) { store.review.status = body.reviewStatus; return json({ data: { ...body, reviewedAt: new Date().toISOString() } }) }
    if (path.endsWith('/submissions') && region && region === base.regions[0] && stores.every(item => item.review.status === 'reviewed')) {
      region.package.status = 'submitted'; region.package.submittedAt = new Date().toISOString()
      return json({ data: { regionPackageStatus: 'submitted' } })
    }
    if (path.endsWith('/corrections') && store) {
      const row = store.rows.find(item => item.employeeId === body.employeeId && item.participantType === body.participantType)
      if (row) {
        row.finalAmount = body.finalAmount; row.status = 'corrected'
        row.signedDifferenceAmount = (Number(body.finalAmount) - Number(row.calculatedAmount)).toFixed(2)
        row.correction = { ...row.correction, correctionId: `preview-${row.employeeId}`, status: 'draft', reasonNote: body.reasonNote, finalAmount: body.finalAmount, createdAt: new Date().toISOString() } as typeof row.correction
        store.review.status = 'pending_review'
        return json({ data: { correctionId: row.correction?.correctionId, status: 'draft' } })
      }
    }
    if (path.endsWith('/corrections/void')) {
      for (const item of stores) for (const row of item.rows) if (row.correction?.correctionId === body.correctionId) {
        row.finalAmount = row.calculatedAmount; row.correction = null; row.signedDifferenceAmount = '0.00'; row.status = 'projected'
        item.review.status = 'pending_review'; return json({ data: { status: 'voided' } })
      }
    }
  }
  return json({ message: 'Bu işlem yerel örnekte kullanılamıyor.' }, 409)
}

function Preview() {
  const [activeRole, setRole] = useState(role)
  const [selectedPeriod, setPeriod] = useState(period)
  const { locale, t } = useLocalization()
  const queryKey = ['incentive-local-preview', activeRole, selectedPeriod]
  const query = useQuery({ queryKey, queryFn: () => getStoreSalesTargetIncentiveWorkspace({ period: selectedPeriod }) })
  const workspace = query.data?.data as IncentiveWorkspace | undefined
  const common = workspace ? { workspace, period: selectedPeriod, onPeriodChange: setPeriod, isUpdating: query.isFetching, backgroundError: query.error, locale, t } : null
  const switchRole = (next: Role) => {
    role = next; setRole(next); client.removeQueries()
    history.replaceState(null, '', `?role=${next}`)
  }
  return <>
    <div className="incentive-lab-bar"><span><FlaskConical size={16} /> Yerel önizleme · Örnek veri</span><nav aria-label="Önizleme rolü"><Button size="sm" variant={activeRole === 'report-viewer' ? 'default' : 'ghost'} onClick={() => switchRole('report-viewer')}>Rapor görüntüleyici</Button><Button size="sm" variant={activeRole === 'region-manager' ? 'default' : 'ghost'} onClick={() => switchRole('region-manager')}>Bölge müdürü</Button><Button size="icon" variant="ghost" aria-label="Örneği sıfırla" onClick={() => location.reload()}><RotateCcw size={15} /></Button></nav></div>
    <StorePrototypeCommandShell activePath="/store/incentives" identityLabel={activeRole === 'report-viewer' ? 'Rapor görüntüleyici' : managers[0]!.displayName} personaLabel={activeRole === 'report-viewer' ? 'RAPOR GÖRÜNTÜLEYİCİ' : 'BÖLGE MÜDÜRÜ'} subtitle="Primler · Yerel önizleme">
      {common ? activeRole === 'report-viewer' ? <ReportViewerIncentivesView key={`${activeRole}:${selectedPeriod}`} {...common} authSummary={auth} managerDirectory={managers} managerDirectoryLoading={false} managerDirectoryError={false} onRetryManagerDirectory={() => void query.refetch()} /> : <RegionManagerIncentivesOwner authSummary={{ ...auth, user: { ...auth.user, userId: managers[0]!.userId, displayName: managers[0]!.displayName } }} key={`${activeRole}:${selectedPeriod}`} {...common} queryKey={queryKey} /> : <p role="status">Önizleme hazırlanıyor…</p>}
    </StorePrototypeCommandShell>
  </>
}

const previewRoot = createRoot(document.getElementById('root')!)
previewRoot.render(<QueryClientProvider client={client}><LocalizationProvider><TooltipProvider><Preview /><HrAxisToaster /></TooltipProvider></LocalizationProvider></QueryClientProvider>)
if (import.meta.hot) import.meta.hot.dispose(() => {
  previewRoot.unmount()
  window.fetch = nativeFetch
  client.clear()
})
