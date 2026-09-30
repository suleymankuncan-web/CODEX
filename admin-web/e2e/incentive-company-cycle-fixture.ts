import type { Page } from './test-fixtures'
import { companyId, createStoreContractSession, installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'

export const cycleCompanyId = companyId
export const cyclePeriod = '2026-09'
export const sealHash = 'a'.repeat(64)
export type CycleStage = 'preparation' | 'sales_director' | 'hr' | 'general_manager' | 'final'
export function companyCycleFixture(stage: CycleStage = 'sales_director') {
  return { companyId, companyName: 'Mühürlü Şirket', period: cyclePeriod,
    cycle: { cycle_id: 'cycle-1', company_id: companyId, period_key: cyclePeriod, current_revision: 1, stage },
    revisions: [{ revision_no: 1, seal_hash: sealHash, sealed_at: '2026-09-01T10:00:00Z', payload: {
      companyName: 'Mühürlü Şirket', total: '125.00',
      roster: [{ store_id: 'store-1', employee_id: 'person-1', display_name: 'Mühürlü Personel', position_code: 'SALES_ASSOCIATE', included: true, reason_note: null },
        { store_id: 'store-1', employee_id: 'norm-1', display_name: 'Norm Personeli', position_code: 'CASHIER', included: false, reason_note: 'Norm katılım gerekçesi' }],
      stores: [{ store_id: 'store-1', store_name: 'Mühürlü Mağaza' }],
      rows: [{ store_id: 'store-1', employee_id: 'person-1', participant_type: 'personnel', target_amount: '1000.00', payable_amount: '100.00', raw_baseline: '100.00', proposed_amount: '125.00', effective_contribution: '125.00' }],
      proposals: [{ store_id: 'store-1', employee_id: 'person-1', reason_note: 'Mühürlü tutar gerekçesi' }],
    } }], decisions: [] as Array<Record<string, unknown>>,
  }
}

export async function installCompanyCycleSession(page: Page, stage: 'sales_director' | 'hr' | 'general_manager' | 'payroll' = 'sales_director', companies = [companyId], personaCompanies = companies) {
  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00Z'))
  await installStoreContractSession(page, 'reportViewer')
  await installGenericStoreApiFallbacks(page)
  const session = createStoreContractSession('reportViewer')
  const role = stage === 'hr' || stage === 'payroll' ? 'HR_ADMIN' : 'REPORT_VIEWER'
  const permission = { sales_director: 'INCENTIVE_SALES_DIRECTOR_APPROVAL', hr: 'INCENTIVE_HR_APPROVAL', general_manager: 'INCENTIVE_GENERAL_MANAGER_APPROVAL', payroll: 'INCENTIVE_PAYROLL_DELIVERY' }[stage]
  await page.route('**/api/auth/session', route => route.fulfill({ json: { ...session, user: { ...session.user,
    roleCodes: [role], roleScopes: { [role]: { companyIds: personaCompanies, regionIds: [], storeIds: [] } },
    authorizationContextVersion: `${stage}-capability`, permissionScopes: { [permission]: { companyIds: companies, regionIds: [], storeIds: [] } },
  } } }))
}
