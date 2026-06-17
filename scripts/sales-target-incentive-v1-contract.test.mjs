import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planPath = 'docs/superpowers/plans/2026-06-17-sales-target-incentive-v1.md'
const fixturePath = 'docs/implementation/sales-target-incentive-v1-fixtures.md'
const skeletonPath = 'docs/implementation/sales-target-incentive-v1-contract-skeleton.json'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  return JSON.parse(readText(path))
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

test('Sales Target Incentive V1 plan links PR tracking issues and locks PR-1 decisions', () => {
  const text = readText(planPath)

  for (const expected of [
    'https://github.com/suleymankuncan-web/CODEX/issues/724',
    'https://github.com/suleymankuncan-web/CODEX/issues/725',
    'https://github.com/suleymankuncan-web/CODEX/issues/726',
    'https://github.com/suleymankuncan-web/CODEX/issues/727',
    'https://github.com/suleymankuncan-web/CODEX/issues/728',
    'https://github.com/suleymankuncan-web/CODEX/issues/729',
    'https://github.com/suleymankuncan-web/CODEX/issues/730',
    'truncate toward zero to two decimal places',
    'first day of the next month `02:00:00 Europe/Istanbul`',
    'sales-target-incentive-v1.0.0',
    'Rate Bracket Boundary Semantics',
    'storeAchievementPct = (storeNetSales / approvedStoreTarget) * 100',
    'personalAchievementPct = (personalPositiveSales / approvedPersonalTarget) * 100',
    '@RequireRoles("SUPER_ADMIN", "REGION_MANAGER")',
    "targetRequestApproveRoles = ['SUPER_ADMIN', 'REGION_MANAGER']",
    'must not require a region-manager-specific approval',
    'lower-bound inclusive and upper-bound exclusive',
    '`89.9600%` and `89.9999%` remain in the `>= 85.0000% and <',
    '`79.9999`, `80.0000`, `84.9999`, `85.0000`, `89.9600`, `89.9999`',
  ]) {
    requireText(text, expected)
  }
})
test('Sales Target Incentive V1 fixture locks precision period source and examples', () => {
  const text = readText(fixturePath)

  for (const expected of [
    'Sub-kurus outcomes are truncated toward zero to two decimal places.',
    'Automatic close is eligible to run from the first day of the next month',
    'Upload timestamp never assigns the incentive period.',
    'sales-target-incentive-v1.0.0',
    'manager-sales-target-v1.0.0',
    'personnel-sales-target-v1.0.0',
    'Rate lookup must not round, floor, or truncate the achievement before',
    '`>= 85.0000% and < 90.0000%`',
    '`89.9600%` and `89.9999%` remain in the `>= 85.0000% and <',
    'Store gate: failed',
    'Payable amount: `0.00`',
    '`CASHIER` position',
    'Franchise store',
    'Operator store',
    'latest approved assignment at period close',
    'An approved revision may have been approved by `REGION_MANAGER` or',
    'must not require a region-manager-specific approval',
  ]) {
    requireText(text, expected)
  }
})

test('Sales Target Incentive V1 contract skeleton covers hidden and scoped personas', () => {
  const skeleton = readJson(skeletonPath)
  const scenarios = new Map(skeleton.visibilityScenarios.map((scenario) => [scenario.id, scenario]))

  for (const id of [
    'eligible_personnel_own_company_store',
    'cashier_hidden',
    'franchise_hidden',
    'operator_hidden',
    'store_manager_own_company_store',
    'region_manager_assigned_company_stores',
    'admin_all_company_stores',
  ]) {
    assert.ok(scenarios.has(id), `${id} scenario is required`)
  }

  assert.equal(scenarios.get('cashier_hidden').expectedApiVisibility, 'none')
  assert.equal(scenarios.get('cashier_hidden').expectedUiVisibility, 'none')
  assert.equal(scenarios.get('franchise_hidden').expectedApiVisibility, 'none')
  assert.equal(scenarios.get('operator_hidden').expectedApiVisibility, 'none')
  assert.equal(scenarios.get('region_manager_assigned_company_stores').expectedApiVisibility, 'assigned_company_stores_only')
  assert.equal(skeleton.currencyPrecision.subKurusPolicy, 'truncate_toward_zero')
  assert.equal(skeleton.rateBracketPolicy.comparison, 'lower_inclusive_upper_exclusive')
  assert.equal(skeleton.rateBracketPolicy.roundBeforeLookup, false)
  assert.equal(skeleton.rateBracketPolicy.displayRangesAreNonAuthoritative, true)
  assert.equal(skeleton.approvedTargetPolicy.source, 'existing_target_workflow_approved_state')
  assert.deepEqual(skeleton.approvedTargetPolicy.acceptedApproverRoles, [
    'REGION_MANAGER',
    'SUPER_ADMIN',
  ])
  assert.equal(skeleton.approvedTargetPolicy.doNotReinterpretApprovalByRole, true)
  assert.deepEqual(skeleton.rateBracketPolicy.thresholdsPct, [
    '80.0000',
    '85.0000',
    '90.0000',
    '95.0000',
    '100.0000',
    '110.0000',
  ])
  const edgeFixtures = new Map(
    skeleton.rateBracketPolicy.edgeFixtures.map((fixture) => [fixture.achievementPct, fixture]),
  )
  assert.equal(edgeFixtures.get('89.9600').expectedManagerRate, '0.0030')
  assert.equal(edgeFixtures.get('89.9999').expectedManagerRate, '0.0030')
  assert.equal(edgeFixtures.get('90.0000').expectedManagerRate, '0.0040')
  assert.equal(skeleton.sourcePolicies.managerSalesSource, 'store_net_sales')
  assert.equal(skeleton.sourcePolicies.personnelSalesSource, 'personnel_positive_gross_sales')
  assert.equal(skeleton.sourcePolicies.negativePersonnelRows, 'reconciliation_only')
})
