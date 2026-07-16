import { fileURLToPath } from 'node:url'

export function evaluateReleaseWorkflowFinal({
  rootContractsResult,
  backendResult,
  frontendResult,
  auditResult,
}) {
  const results = {
    'root-contracts': rootContractsResult,
    'backend-release': backendResult,
    'frontend-release': frontendResult,
    'dependency-audit': auditResult,
  }
  const failures = Object.entries(results)
    .filter(([, result]) => result !== 'success')
    .map(([name, result]) => `${name}=${result || 'missing'}`)
  return { ok: failures.length === 0, failures }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const final = evaluateReleaseWorkflowFinal({
    rootContractsResult: process.env.RELEASE_ROOT_CONTRACTS_RESULT,
    backendResult: process.env.RELEASE_BACKEND_RESULT,
    frontendResult: process.env.RELEASE_FRONTEND_RESULT,
    auditResult: process.env.RELEASE_AUDIT_RESULT,
  })
  if (!final.ok) {
    throw new Error(`release-check failed closed: ${final.failures.join(', ')}`)
  }
  console.log('[release-check] all canonical proof jobs completed successfully')
}
