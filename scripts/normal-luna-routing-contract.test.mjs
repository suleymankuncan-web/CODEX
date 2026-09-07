import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.ok(
    text.replace(/\s+/g, ' ').includes(expected.replace(/\s+/g, ' ')),
    `Missing routing contract: ${expected}`,
  )
}

const config = readText('.codex/config.toml')
const agents = readText('AGENTS.md')
const contributing = readText('CONTRIBUTING.md')
const discipline = readText('discipline.md')
const currentState = readText('current-state.md')

test('repository config exposes normal Luna Max with Medium and High defaults', () => {
  requireText(config, 'model_reasoning_effort = "medium"')
  requireText(config, 'plan_mode_reasoning_effort = "high"')
  requireText(config, '[agents.luna_max]')
  requireText(config, 'config_file = "agents/luna-max.toml"')

  assert.doesNotMatch(config, /\[agents\.luna_max_fast\]/)
  assert.doesNotMatch(config, /\[agents\.planner_xhigh\]/)
  assert.equal(existsSync(join(workspaceRoot, '.codex/agents/luna-max-fast.toml')), false)
  assert.equal(existsSync(join(workspaceRoot, '.codex/agents/planner-xhigh.toml')), false)
})

test('normal Luna role keeps max reasoning without a fast service-tier override', () => {
  const lunaPath = join(workspaceRoot, '.codex/agents/luna-max.toml')
  assert.equal(existsSync(lunaPath), true)
  const luna = readFileSync(lunaPath, 'utf8')

  requireText(luna, 'model = "gpt-5.6-luna"')
  requireText(luna, 'model_reasoning_effort = "max"')
  assert.doesNotMatch(luna, /^service_tier\s*=/m)
})

test('operating docs link to one routing policy without a blanket High ceiling', () => {
  for (const text of [agents, contributing, discipline, currentState]) {
    assert.doesNotMatch(text, /luna_max_fast/)
    assert.doesNotMatch(text, /Luna Max Fast/)
    assert.doesNotMatch(text, /planner_xhigh/)
    assert.doesNotMatch(text, /\bXHigh\b/)
  }

  for (const text of [agents, contributing, currentState]) {
    requireText(text, 'discipline.md#adaptive-reasoning-effort-routing')
  }
  requireText(discipline, '### Adaptive Reasoning Effort Routing')
  requireText(discipline, 'Use `luna_max` with `fork_turns: "none"`')
  requireText(discipline, "Do not override Luna's model, effort or service tier at spawn time.")
  requireText(discipline, 'Explicit user selection, including Max, takes precedence')
  requireText(discipline, "Luna's configured Max is an intentional role exception")
  requireText(discipline, 'Current coordinator model and selected effort')
  for (const text of [agents, contributing, discipline, currentState]) {
    assert.doesNotMatch(text, /No repository role may request a reasoning level above High|Repository reasoning never exceeds High|hicbir repo rolu High'in ustune cikmaz|Sol\/root/)
  }
})

test('routing preserves exclusive ownership, inline risk review and a shared failure budget', () => {
  requireText(discipline, 'Never assign two implementers the same file or workflow')
  requireText(discipline, 'final R4/R5 review')
  requireText(discipline, 'Root and worker share one failure budget')
  requireText(discipline, 'two evidence-based correction attempts')
  requireText(discipline, 'No dedicated problem-solver agent is used')
  requireText(discipline, 'Record actionable findings and their resolution separately')
  assert.doesNotMatch(config, /\[agents\.problem_solver_high\]/)
  assert.equal(existsSync(join(workspaceRoot, '.codex/agents/problem-solver-high.toml')), false)
  for (const text of [agents, contributing, discipline]) {
    assert.doesNotMatch(text, /`problem_solver_high`/)
  }
})
