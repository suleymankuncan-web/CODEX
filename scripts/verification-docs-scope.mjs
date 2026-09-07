// Shared by the local advisor and required gate. Unknown scripts fail closed.
const docsContracts = new Set([
  'scripts/current-state-handoff-contract.test.mjs',
  'scripts/project-control-registries-contract.test.mjs',
  'scripts/agent-token-efficiency-contract.test.mjs',
  'scripts/contributing-contract.test.mjs',
  'scripts/root-execution-routing-contract.test.mjs',
])
const projectSkills = new Set([
  '.agents/skills/hr-axis-pr-closeout/SKILL.md',
  '.agents/skills/hr-axis-session-handoff/SKILL.md',
])

export function isDocsProcessPath(file) {
  if (file.startsWith('docs/api/')) return false
  return file.startsWith('.codex/') || file.startsWith('docs/') ||
    docsContracts.has(file) || projectSkills.has(file) ||
    (!file.includes('/') && file.endsWith('.md'))
}
