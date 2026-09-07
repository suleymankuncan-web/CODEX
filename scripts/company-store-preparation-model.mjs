const maxRows = 10000
const statuses = ['active', 'inactive', 'closed']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = () => { throw new Error('invalid_preparation_input') }
const code = (value) => typeof value === 'string' && value.length > 0 && value.length <= 80 &&
  value.trim() === value && !/[\x00-\x1f\x7f]/u.test(value)
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail()
}

function codes(value) {
  if (!Array.isArray(value) || value.length > maxRows || !value.every(code)) fail()
}

// A private, offline comparison. This result is never an activation permit.
export function prepareCompanyStores(input, evaluationDate) {
  exactKeys(input, ['schemaVersion', 'snapshotDate', 'targetCompanyId', 'directoryStoreCodes',
    'selectedStoreCodes', 'registeredStores', 'runtime'])
  if (input.schemaVersion !== 1 || !date(input.snapshotDate) || !date(evaluationDate) ||
    typeof input.targetCompanyId !== 'string' || !uuid.test(input.targetCompanyId)) fail()
  codes(input.directoryStoreCodes)
  codes(input.selectedStoreCodes)
  if (!Array.isArray(input.registeredStores) || input.registeredStores.length > maxRows) fail()
  for (const row of input.registeredStores) {
    exactKeys(row, ['storeId', 'companyId', 'storeCode', 'status', 'kpiImportEnabled'])
    if (typeof row.storeId !== 'string' || !uuid.test(row.storeId) ||
      typeof row.companyId !== 'string' || !uuid.test(row.companyId) || !code(row.storeCode) ||
      !statuses.includes(row.status) || typeof row.kpiImportEnabled !== 'boolean') fail()
  }
  exactKeys(input.runtime, ['strictLocal', 'dataClass'])
  if (typeof input.runtime.strictLocal !== 'boolean' ||
    !['synthetic', 'company', 'unspecified'].includes(input.runtime.dataClass)) fail()

  const directory = new Set(input.directoryStoreCodes)
  const selected = [...new Set(input.selectedStoreCodes)].sort()
  const inventory = new Map()
  const ids = new Set()
  let duplicateIds = false
  for (const row of input.registeredStores) {
    const id = row.storeId.toLowerCase()
    duplicateIds ||= ids.has(id)
    ids.add(id)
    const matches = inventory.get(row.storeCode) ?? []
    matches.push(row)
    inventory.set(row.storeCode, matches)
  }
  const counts = { eligible: 0, missing: 0, ambiguous: 0, wrongCompany: 0,
    inactive: 0, importDisabled: 0, absentFromDirectory: 0 }
  const rows = selected.map((storeCode) => {
    const matches = inventory.get(storeCode) ?? []
    const reasons = []
    if (!directory.has(storeCode)) reasons.push('absent_from_directory')
    if (matches.length === 0) reasons.push('missing_store')
    else if (matches.length > 1) reasons.push('ambiguous_store_code')
    else {
      if (matches[0].companyId.toLowerCase() !== input.targetCompanyId.toLowerCase()) reasons.push('wrong_company')
      if (matches[0].status !== 'active') reasons.push('inactive_store')
      if (!matches[0].kpiImportEnabled) reasons.push('import_disabled')
    }
    if (reasons.length === 0) counts.eligible++
    const countKeys = { missing_store: 'missing', ambiguous_store_code: 'ambiguous',
      wrong_company: 'wrongCompany', inactive_store: 'inactive', import_disabled: 'importDisabled',
      absent_from_directory: 'absentFromDirectory' }
    for (const reason of reasons) counts[countKeys[reason]]++
    return { storeCode, state: reasons.length ? 'blocked' : 'eligible', reasons }
  })
  const blockers = []
  if (input.snapshotDate !== evaluationDate) blockers.push('snapshot_date_mismatch')
  if (selected.length === 0) blockers.push('store_selection_required')
  if (selected.length !== input.selectedStoreCodes.length) blockers.push('duplicate_selection')
  if (duplicateIds) blockers.push('duplicate_store_identity')
  if (counts.eligible !== selected.length) blockers.push('selected_store_mapping_incomplete')
  const runtimeBlockers = ['company_runtime_not_verified', 'connector_readiness_not_evaluated',
    'shared_ingestion_not_connected']
  if (input.runtime.strictLocal && input.runtime.dataClass === 'synthetic') {
    runtimeBlockers.unshift('synthetic_runtime_only')
  } else if (input.runtime.strictLocal && input.runtime.dataClass === 'unspecified') {
    runtimeBlockers.unshift('invalid_strict_local_data_class')
  } else if (!input.runtime.strictLocal) {
    runtimeBlockers.unshift('strict_local_required')
  }

  return {
    summary: { schemaVersion: 1, snapshotDate: input.snapshotDate, evaluationDate,
      mappingState: blockers.length ? 'blocked' : 'prepared', activationState: 'blocked',
      counts: { directory: directory.size, registered: input.registeredStores.length,
        selected: selected.length, ...counts }, blockers, runtimeBlockers,
      dataImported: false, configurationChanged: false },
    privateReport: { schemaVersion: 1, targetCompanyId: input.targetCompanyId,
      snapshotDate: input.snapshotDate, evaluationDate, rows },
  }
}
